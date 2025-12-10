require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Initialize SQLite database
const db = require('./db');
const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

// Configure Multer to use memory storage (don't save to disk)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper: Upload to Cloudinary
const uploadToCloudinary = async (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" }, // Auto detect image/video/audio
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
};

// SQLite database is initialized in db.js
console.log('SQLite database ready');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// --- SSE SETUP ---
let clients = {}; 
app.get('/api/events', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).end();
    try {
        const userId = jwt.verify(token, JWT_SECRET).id;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.flushHeaders();
        clients[userId] = res;
        const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);
        req.on('close', () => { clearInterval(keepAlive); delete clients[userId]; });
    } catch (e) { res.status(401).end(); }
});

const sendEvent = (uid, type, data) => { 
    const target = clients[String(uid)];
    if(target) target.write(`data: ${JSON.stringify({type,data})}\n\n`); 
};

// --- FILE UPLOAD ROUTES (UPDATED) ---

// 1. General Upload (Chat files)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
        // Upload to Cloudinary
        const fileUrl = await uploadToCloudinary(req.file.buffer);
        res.json({ fileUrl });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// 2. Avatar Upload
app.post('/api/profile/avatar', upload.single('file'), async (req, res) => {
    const { token } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
        const uid = jwt.verify(token, JWT_SECRET).id;
        const fileUrl = await uploadToCloudinary(req.file.buffer);
        User.findByIdAndUpdate(uid, { avatar: fileUrl });
        res.json({ fileUrl });
    } catch (e) { res.status(400).json({ error: 'Error' }); }
});

// --- REST OF THE API (Same as before) ---

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const role = username.startsWith('admin') ? 'admin' : 'user';
        const hashedPassword = await bcrypt.hash(password, 10);
        User.create({ username, password: hashedPassword, role });
        res.json({ msg: 'Created' });
    } catch (e) { 
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({ error: 'Username exists' });
        } else {
            res.status(400).json({ error: 'Registration failed' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Invalid' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, userId: user.id, username: user.username, role: user.role, ...user });
});

app.put('/api/profile', async (req, res) => {
    const { token, nickname, isVisible } = req.body;
    const uid = jwt.verify(token, JWT_SECRET).id;
    const user = User.findByIdAndUpdate(uid, { nickname, isVisible });
    res.json(user);
});

app.post('/api/friends/request', async (req, res) => {
    const { token, toUserId } = req.body;
    const fromId = jwt.verify(token, JWT_SECRET).id;
    if(fromId === toUserId) return res.status(400).json({error: "Cannot add self"});
    const targetUser = User.findById(toUserId);
    if(!targetUser) return res.status(404).json({error: "User not found"});
    
    if(User.hasFriendRequest(fromId, toUserId) || User.isFriend(fromId, toUserId)) {
        return res.json({msg: 'Already requested/friends'});
    }
    
    User.addFriendRequest(fromId, toUserId);
    sendEvent(toUserId, 'friend_request', { from: User.findById(fromId) });
    res.json({ success: true });
});

app.post('/api/friends/accept', async (req, res) => {
    const { token, fromUserId } = req.body;
    const myId = jwt.verify(token, JWT_SECRET).id;
    User.removeFriendRequest(fromUserId, myId);
    User.addFriend(myId, fromUserId);
    sendEvent(fromUserId, 'friend_accepted', { fromId: myId });
    res.json({ success: true });
});

app.get('/api/my-network', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if(!token) return res.status(401);
    const uid = jwt.verify(token, JWT_SECRET).id;
    const friends = User.getFriends(uid);
    const requests = User.getFriendRequests(uid);
    res.json({ friends, requests });
});

app.get('/api/users', async (req, res) => {
    const users = User.find({ $or: [{ isVisible: true }, { isVisible: { $exists: false } }] });
    const filtered = users.map(u => ({
        _id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        role: u.role
    }));
    res.json(filtered);
});

app.post('/api/groups', async (req, res) => {
    const { token, name, members } = req.body;
    const adminId = jwt.verify(token, JWT_SECRET).id;
    const allMembers = [...new Set([...members, adminId].map(id => parseInt(id)))];
    const group = Group.create({ name, admin: adminId, members: allMembers });
    allMembers.forEach(m => sendEvent(m, 'group_created', group));
    res.json(group);
});

app.delete('/api/groups/:id', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    const uid = jwt.verify(token, JWT_SECRET).id;
    const group = Group.findById(req.params.id);
    if (!group) return res.status(404).json({error: "Group not found"});
    const user = User.findById(uid);
    if (group.admin_id !== uid && user.role !== 'admin') return res.status(403).json({error: "Not authorized"});
    
    group.members.forEach(m => sendEvent(m.id, 'group_deleted', { groupId: group.id }));
    Group.findByIdAndDelete(req.params.id);
    Message.deleteMany({ groupId: req.params.id });
    res.json({ success: true });
});

app.get('/api/groups', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    const uid = jwt.verify(token, JWT_SECRET).id;
    const groups = Group.find({ members: uid });
    res.json(groups);
});

app.get('/api/groups/:groupId/details', async (req, res) => {
    const group = Group.findById(req.params.groupId);
    res.json(group);
});

app.get('/api/groups/:groupId/messages', async (req, res) => {
    const msgs = Message.find({ groupId: req.params.groupId });
    res.json(msgs);
});

app.post('/api/message', async (req, res) => {
    const { token, recipientId, groupId, content, type, fileUrl } = req.body;
    const senderId = jwt.verify(token, JWT_SECRET).id;
    const msg = Message.create({ sender: senderId, recipient: recipientId, groupId, content, type, fileUrl });

    if(groupId) {
        const g = Group.findById(groupId);
        g.members.forEach(m => sendEvent(m.id, 'receive_message', msg));
    } else {
        sendEvent(recipientId, 'receive_message', msg);
        sendEvent(senderId, 'receive_message', msg);
    }
    res.json({success:true, message: msg});
});

app.get('/api/admin/users', async (req,res) => { res.json(User.find()); });
app.delete('/api/admin/users/:id', async (req,res) => { User.findByIdAndDelete(req.params.id); res.json({ok:true}); });
app.post('/api/signal', (req, res) => { 
    const decoded = jwt.verify(req.body.token, JWT_SECRET);
    sendEvent(req.body.to, req.body.type, { ...req.body.payload, from: decoded.id });
    res.json({ok:true});
});
app.get('/api/messages/:u1/:u2', async (req, res) => {
    const m = Message.find({ 
        groupId: null, 
        $or: [
            {sender: parseInt(req.params.u1), recipient: parseInt(req.params.u2)},
            {sender: parseInt(req.params.u2), recipient: parseInt(req.params.u1)}
        ]
    });
    res.json(m);
});

// Only start the server if NOT running in Vercel
if (process.env.VERCEL !== '1') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
}

// REQUIRED: Export the app for Vercel
module.exports = app;
