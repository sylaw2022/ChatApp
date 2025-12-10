require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Initialize Supabase database
let supabase, User, Message, Group;
try {
    supabase = require('./db');
    User = require('./models/User');
    Message = require('./models/Message');
    Group = require('./models/Group');
    console.log('Supabase models loaded successfully');
} catch (error) {
    console.error('Database initialization error:', error);
    // Continue anyway - errors will be caught in routes
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        code: '500',
        message: err.message || 'A server error has occurred',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

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
        await User.findByIdAndUpdate(uid, { avatar: fileUrl });
        res.json({ fileUrl });
    } catch (e) { res.status(400).json({ error: 'Error' }); }
});

// --- REST OF THE API (Same as before) ---

app.post('/api/register', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const role = username.startsWith('admin') ? 'admin' : 'user';
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, role });
        res.json({ msg: 'Created' });
    } catch (e) { 
        console.error('Registration error:', e);
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === '23505') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: e.message || 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
        res.json({ token, userId: user.id, username: user.username, role: user.role, ...user });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: e.message || 'Login failed' });
    }
});

app.put('/api/profile', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { token, nickname, isVisible } = req.body;
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        const uid = parseInt(decoded.id);
        
        const updateData = {};
        if (nickname !== undefined) updateData.nickname = nickname;
        if (isVisible !== undefined) updateData.isVisible = isVisible;
        
        const user = await User.findByIdAndUpdate(uid, updateData);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (e) {
        console.error('Profile update error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: e.message || 'Profile update failed' });
    }
});

app.post('/api/friends/request', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { token, toUserId } = req.body;
        const fromId = jwt.verify(token, JWT_SECRET).id;
        if(fromId === toUserId) return res.status(400).json({error: "Cannot add self"});
        const targetUser = await User.findById(toUserId);
        if(!targetUser) return res.status(404).json({error: "User not found"});
        
        const hasRequest = await User.hasFriendRequest(fromId, toUserId);
        const isFriend = await User.isFriend(fromId, toUserId);
        if(hasRequest || isFriend) {
            return res.json({msg: 'Already requested/friends'});
        }
        
        await User.addFriendRequest(fromId, toUserId);
        const fromUser = await User.findById(fromId);
        sendEvent(toUserId, 'friend_request', { from: fromUser });
        res.json({ success: true });
    } catch (e) {
        console.error('Friend request error:', e);
        res.status(500).json({ error: e.message || 'Friend request failed' });
    }
});

app.post('/api/friends/accept', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { token, fromUserId } = req.body;
        const myId = jwt.verify(token, JWT_SECRET).id;
        await User.removeFriendRequest(fromUserId, myId);
        await User.addFriend(myId, fromUserId);
        sendEvent(fromUserId, 'friend_accepted', { fromId: myId });
        res.json({ success: true });
    } catch (e) {
        console.error('Friend accept error:', e);
        res.status(500).json({ error: e.message || 'Friend accept failed' });
    }
});

app.get('/api/my-network', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const token = req.headers['authorization']?.split(' ')[1];
        if(!token) return res.status(401).json({ error: 'Unauthorized' });
        const uid = jwt.verify(token, JWT_SECRET).id;
        const friends = await User.getFriends(uid);
        const requests = await User.getFriendRequests(uid);
        res.json({ friends, requests });
    } catch (e) {
        console.error('My network error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch network' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const users = await User.find({ $or: [{ isVisible: true }, { isVisible: { $exists: false } }] });
        const filtered = users.map(u => ({
            _id: u.id,
            username: u.username,
            nickname: u.nickname,
            avatar: u.avatar,
            role: u.role
        }));
        res.json(filtered);
    } catch (e) {
        console.error('Users error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch users' });
    }
});

app.post('/api/groups', async (req, res) => {
    try {
        if (!Group) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { token, name, members } = req.body;
        const adminId = jwt.verify(token, JWT_SECRET).id;
        const allMembers = [...new Set([...members, adminId].map(id => parseInt(id)))];
        const group = await Group.create({ name, admin: adminId, members: allMembers });
        allMembers.forEach(m => sendEvent(m, 'group_created', group));
        res.json(group);
    } catch (e) {
        console.error('Create group error:', e);
        res.status(500).json({ error: e.message || 'Failed to create group' });
    }
});

app.delete('/api/groups/:id', async (req, res) => {
    try {
        if (!Group || !User || !Message) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const token = req.headers['authorization']?.split(' ')[1];
        const uid = jwt.verify(token, JWT_SECRET).id;
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({error: "Group not found"});
        const user = await User.findById(uid);
        if (group.admin_id !== uid && user.role !== 'admin') return res.status(403).json({error: "Not authorized"});
        
        if (group.members) {
            group.members.forEach(m => sendEvent(m.id || m, 'group_deleted', { groupId: group.id }));
        }
        await Group.findByIdAndDelete(req.params.id);
        await Message.deleteMany({ groupId: req.params.id });
        res.json({ success: true });
    } catch (e) {
        console.error('Delete group error:', e);
        res.status(500).json({ error: e.message || 'Failed to delete group' });
    }
});

app.get('/api/groups', async (req, res) => {
    try {
        if (!Group) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const token = req.headers['authorization']?.split(' ')[1];
        const uid = jwt.verify(token, JWT_SECRET).id;
        const groups = Group.find({ members: uid });
        res.json(groups);
    } catch (e) {
        console.error('Get groups error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch groups' });
    }
});

app.get('/api/groups/:groupId/details', async (req, res) => {
    try {
        if (!Group) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const group = await Group.findById(req.params.groupId);
        res.json(group);
    } catch (e) {
        console.error('Group details error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch group details' });
    }
});

app.get('/api/groups/:groupId/messages', async (req, res) => {
    try {
        if (!Message) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const msgs = await Message.find({ groupId: req.params.groupId });
        res.json(msgs);
    } catch (e) {
        console.error('Group messages error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch messages' });
    }
});

app.post('/api/message', async (req, res) => {
    try {
        if (!Message) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { token, recipientId, groupId, content, type, fileUrl } = req.body;
        const senderId = jwt.verify(token, JWT_SECRET).id;
        const msg = await Message.create({ sender: senderId, recipient: recipientId, groupId, content, type, fileUrl });

        if(groupId) {
            const g = await Group.findById(groupId);
            if (g && g.members) {
                g.members.forEach(m => {
                    const memberId = m.id || m;
                    sendEvent(memberId, 'receive_message', msg);
                });
            }
        } else {
            sendEvent(recipientId, 'receive_message', msg);
            sendEvent(senderId, 'receive_message', msg);
        }
        res.json({success:true, message: msg});
    } catch (e) {
        console.error('Send message error:', e);
        res.status(500).json({ error: e.message || 'Failed to send message' });
    }
});

app.get('/api/admin/users', async (req,res) => { 
    try {
        if (!User) return res.status(500).json({ error: 'Database not initialized' });
        const users = await User.find(); res.json(users); 
    } catch (e) {
        console.error('Admin users error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch users' });
    }
});
app.delete('/api/admin/users/:id', async (req,res) => { 
    try {
        if (!User) return res.status(500).json({ error: 'Database not initialized' });
        await User.findByIdAndDelete(req.params.id); 
        res.json({ok:true}); 
    } catch (e) {
        console.error('Delete user error:', e);
        res.status(500).json({ error: e.message || 'Failed to delete user' });
    }
});
app.post('/api/signal', (req, res) => { 
    const decoded = jwt.verify(req.body.token, JWT_SECRET);
    sendEvent(req.body.to, req.body.type, { ...req.body.payload, from: decoded.id });
    res.json({ok:true});
});
app.get('/api/messages/:u1/:u2', async (req, res) => {
    try {
        if (!Message) return res.status(500).json({ error: 'Database not initialized' });
        const m = await Message.find({ 
            groupId: null, 
            $or: [
                {sender: parseInt(req.params.u1), recipient: parseInt(req.params.u2)},
                {sender: parseInt(req.params.u2), recipient: parseInt(req.params.u1)}
            ]
        });
        res.json(m);
    } catch (e) {
        console.error('Messages error:', e);
        res.status(500).json({ error: e.message || 'Failed to fetch messages' });
    }
});

// Only start the server if NOT running in Vercel
if (process.env.VERCEL !== '1') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
}

// REQUIRED: Export the app for Vercel
module.exports = app;
