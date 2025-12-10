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
    if (supabase) {
        User = require('./models/User');
        Message = require('./models/Message');
        Group = require('./models/Group');
        console.log('✅ Supabase models loaded successfully');
    } else {
        console.error('❌ Supabase client is null - check your environment variables');
        User = null;
        Message = null;
        Group = null;
    }
} catch (error) {
    console.error('❌ Database initialization error:', error.message);
    User = null;
    Message = null;
    Group = null;
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
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        const userIdStr = String(userId);
        
        res.writeHead(200, { 
            'Content-Type': 'text/event-stream', 
            'Cache-Control': 'no-cache', 
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.flushHeaders();
        
        // Store connection with multiple key formats for maximum compatibility
        clients[userIdStr] = res;
        clients[String(userId)] = res;
        if (typeof userId === 'number') {
            clients[userId] = res;
        }
        const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
        if (!isNaN(userIdInt)) {
            clients[userIdInt] = res;
            clients[String(userIdInt)] = res;
        }
        
        console.log(`✅ SSE connection established for user ${userIdStr} (stored with keys: ${Object.keys(clients).filter(k => clients[k] === res).join(', ')})`);
        
        const keepAlive = setInterval(() => {
            try {
                res.write(': keepalive\n\n');
            } catch (err) {
                clearInterval(keepAlive);
                delete clients[userIdStr];
                if (typeof userId === 'number') {
                    delete clients[String(userId)];
                }
            }
        }, 15000);
        
        req.on('close', () => { 
            clearInterval(keepAlive); 
            delete clients[userIdStr];
            if (typeof userId === 'number') {
                delete clients[String(userId)];
            }
            console.log(`❌ SSE connection closed for user ${userIdStr}`);
        });
    } catch (e) { 
        console.error('SSE connection error:', e);
        res.status(401).end(); 
    }
});

const sendEvent = (uid, type, data) => { 
    // Try both string and integer formats for the user ID
    const uidStr = String(uid);
    const uidInt = typeof uid === 'string' ? parseInt(uid) : uid;
    
    // Try multiple key formats
    const target = clients[uidStr] || clients[String(uidInt)] || clients[uidInt] || clients[parseInt(uidStr)];
    
    if (target) {
        try {
            // Create event payload with type and message/data
            const eventPayload = {
                type: type,
                message: data,
                data: data
            };
            const eventString = `data: ${JSON.stringify(eventPayload)}\n\n`;
            target.write(eventString);
            console.log(`✅ Sent ${type} event to user ${uidStr} (found as key: ${clients[uidStr] ? uidStr : (clients[String(uidInt)] ? String(uidInt) : 'other')})`);
            if (type === 'receive_message') {
                const msgId = data?.id || data?._id;
                console.log(`   Message ID: ${msgId}, Content: ${data?.content?.substring(0, 50)}...`);
            }
        } catch (err) {
            console.error(`❌ Failed to send event to user ${uidStr}:`, err);
            // Remove dead connection
            delete clients[uidStr];
            delete clients[String(uidInt)];
            if (typeof uidInt === 'number') {
                delete clients[uidInt];
            }
        }
    } else {
        console.log(`⚠️ No SSE connection found for user ${uidStr} (type: ${type})`);
        console.log(`   Tried keys: ${uidStr}, ${String(uidInt)}, ${uidInt}, ${parseInt(uidStr)}`);
        console.log(`   Available clients:`, Object.keys(clients));
        console.log(`   Client types:`, Object.keys(clients).map(k => typeof k));
    }
};

// --- CALL SIGNALING STORAGE ---
// Store pending call signals for polling (key: userId, value: array of signals)
let callSignals = {};

// Helper to add call signal for a user
const addCallSignal = (userId, signal) => {
    const uid = String(userId);
    if (!callSignals[uid]) callSignals[uid] = [];
    callSignals[uid].push({ ...signal, timestamp: Date.now() });
    // Keep only last 50 signals per user
    if (callSignals[uid].length > 50) callSignals[uid] = callSignals[uid].slice(-50);
};

// Helper to get and clear call signals for a user
const getCallSignals = (userId) => {
    const uid = String(userId);
    const signals = callSignals[uid] || [];
    callSignals[uid] = []; // Clear after reading
    return signals;
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
        // Return user data with both id and _id for compatibility
        res.json({ 
            token, 
            userId: user.id,
            _id: user.id, // Add _id for client compatibility
            id: user.id,
            username: user.username, 
            role: user.role,
            nickname: user.nickname || '',
            avatar: user.avatar || '',
            isVisible: user.isVisible !== undefined ? user.isVisible : true
        });
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
        if (!token || !toUserId) {
            return res.status(400).json({ error: 'Token and toUserId are required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const fromId = decoded.id;
        const toId = typeof toUserId === 'string' ? parseInt(toUserId) : toUserId;
        const fromIdInt = typeof fromId === 'string' ? parseInt(fromId) : fromId;
        
        if (fromIdInt === toId) {
            return res.status(400).json({ error: "Cannot add self" });
        }
        
        const targetUser = await User.findById(toId);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }
        
        const hasRequest = await User.hasFriendRequest(fromIdInt, toId);
        const isFriend = await User.isFriend(fromIdInt, toId);
        
        if (hasRequest) {
            return res.status(400).json({ error: 'Friend request already sent' });
        }
        if (isFriend) {
            return res.status(400).json({ error: 'Already friends' });
        }
        
        await User.addFriendRequest(fromIdInt, toId);
        const fromUser = await User.findById(fromIdInt);
        sendEvent(toId, 'friend_request', { from: fromUser });
        res.json({ success: true, message: 'Friend request sent' });
    } catch (e) {
        console.error('Friend request error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
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
            _id: u.id, // Add _id for client compatibility
            id: u.id,
            username: u.username,
            nickname: u.nickname || '',
            avatar: u.avatar || '',
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
        
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        
        if (!content && !fileUrl) {
            return res.status(400).json({ error: 'Message content or file required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const senderId = decoded.id;
        const senderIdInt = typeof senderId === 'string' ? parseInt(senderId) : senderId;
        const recipientIdInt = recipientId ? (typeof recipientId === 'string' ? parseInt(recipientId) : recipientId) : null;
        const groupIdInt = groupId ? (typeof groupId === 'string' ? parseInt(groupId) : groupId) : null;
        
        if (!groupIdInt && !recipientIdInt) {
            return res.status(400).json({ error: 'Either recipientId or groupId is required' });
        }
        
        const msg = await Message.create({ 
            sender: senderIdInt, 
            recipient: recipientIdInt, 
            groupId: groupIdInt, 
            content: content || '', 
            type: type || 'text', 
            fileUrl: fileUrl || '' 
        });

        if (!msg) {
            return res.status(500).json({ error: 'Failed to create message' });
        }

        if(groupIdInt) {
            const g = await Group.findById(groupIdInt);
            if (g && g.members) {
                g.members.forEach(m => {
                    const memberId = typeof m === 'object' ? (m.id || m._id) : m;
                    const memberIdInt = typeof memberId === 'string' ? parseInt(memberId) : memberId;
                    sendEvent(memberIdInt, 'receive_message', msg);
                });
            }
        } else if (recipientIdInt) {
            // Send to recipient
            console.log(`📤 Sending message to recipient ${recipientIdInt} (type: ${typeof recipientIdInt}) from sender ${senderIdInt} (type: ${typeof senderIdInt})`);
            console.log(`📤 Message data:`, JSON.stringify(msg, null, 2));
            console.log(`📤 Available SSE clients:`, Object.keys(clients));
            
            // Send with message as the data directly
            sendEvent(recipientIdInt, 'receive_message', msg);
            // Also send to sender so they see their own message
            sendEvent(senderIdInt, 'receive_message', msg);
        }
        res.json({success:true, message: msg});
    } catch (e) {
        console.error('Send message error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
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

// --- CALL ENDPOINTS ---
app.post('/api/calls/initiate', async (req, res) => {
    try {
        const { token, userToCall, signalData, fromId, fromUsername } = req.body;
        if (!token || !userToCall || !signalData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const callerId = decoded.id;
        const targetId = typeof userToCall === 'string' ? parseInt(userToCall) : userToCall;
        const callerIdInt = typeof callerId === 'string' ? parseInt(callerId) : callerId;
        
        const isVideo = req.body.isVideo || false;
        
        // Send call signal via SSE
        sendEvent(targetId, 'call_user', {
            from: callerIdInt,
            signal: { ...signalData, isVideo },
            name: fromUsername || 'Someone'
        });
        
        // Also store for polling
        addCallSignal(targetId, {
            type: 'call_user',
            data: {
                from: callerIdInt,
                signal: { ...signalData, isVideo },
                name: fromUsername || 'Someone'
            }
        });
        
        res.json({ success: true });
    } catch (e) {
        console.error('Call initiate error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: e.message || 'Failed to initiate call' });
    }
});

app.post('/api/calls/answer', async (req, res) => {
    try {
        const { token, signal, to } = req.body;
        if (!token || !signal || !to) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const answererId = decoded.id;
        const callerId = typeof to === 'string' ? parseInt(to) : to;
        const answererIdInt = typeof answererId === 'string' ? parseInt(answererId) : answererId;
        
        // Send answer signal via SSE
        sendEvent(callerId, 'call_accepted', signal);
        
        // Also store for polling
        addCallSignal(callerId, {
            type: 'call_accepted',
            data: signal
        });
        
        res.json({ success: true });
    } catch (e) {
        console.error('Call answer error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: e.message || 'Failed to answer call' });
    }
});

app.post('/api/calls/ice-candidate', async (req, res) => {
    try {
        const { token, to, candidate } = req.body;
        if (!token || !to || !candidate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const senderId = decoded.id;
        const targetId = typeof to === 'string' ? parseInt(to) : to;
        const senderIdInt = typeof senderId === 'string' ? parseInt(senderId) : senderId;
        
        // Send ICE candidate via SSE
        sendEvent(targetId, 'ice_candidate', candidate);
        
        // Also store for polling
        addCallSignal(targetId, {
            type: 'ice_candidate',
            data: candidate
        });
        
        res.json({ success: true });
    } catch (e) {
        console.error('ICE candidate error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: e.message || 'Failed to send ICE candidate' });
    }
});

app.post('/api/calls/end', async (req, res) => {
    try {
        const { token, to } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const senderId = decoded.id;
        const senderIdInt = typeof senderId === 'string' ? parseInt(senderId) : senderId;
        
        // If 'to' is provided, send end call signal to that user
        if (to) {
            const targetId = typeof to === 'string' ? parseInt(to) : to;
            sendEvent(targetId, 'end_call', { from: senderIdInt });
            addCallSignal(targetId, {
                type: 'end_call',
                data: { from: senderIdInt }
            });
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error('End call error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: e.message || 'Failed to end call' });
    }
});

app.get('/api/calls/poll', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
        
        // Get and clear pending signals
        const signals = getCallSignals(userIdInt);
        
        res.json(signals);
    } catch (e) {
        console.error('Call poll error:', e);
        if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: e.message || 'Failed to poll calls' });
    }
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
