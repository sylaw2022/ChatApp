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
// Configure CORS with more permissive settings for SSE
app.use(cors({ 
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json());

// Handle OPTIONS requests explicitly for SSE endpoint
app.options('/api/events', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
});

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
// Note: SSE doesn't work reliably on Vercel serverless functions
// Vercel functions have execution time limits and can't maintain long-lived connections
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

let clients = {}; 
app.get('/api/events', (req, res) => {
    // On Vercel, SSE doesn't work - return error to trigger polling fallback
    if (isVercel) {
        console.log('⚠️ SSE not supported on Vercel - client should use polling');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(503).json({ 
            error: 'SSE not available on serverless platform',
            usePolling: true 
        });
    }
    
    const token = req.query.token;
    if (!token) {
        console.error('SSE connection rejected: No token provided');
        // Set CORS headers even for error responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(401).json({ error: 'Token required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        const userIdStr = String(userId);
        
        console.log(`📡 SSE connection request from user ${userIdStr} (ID type: ${typeof userId}, value: ${userId})`);
        console.log(`📡 Request origin: ${req.headers.origin || 'none'}`);
        console.log(`📡 Request headers:`, req.headers);
        
        // Set CORS headers BEFORE writeHead
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Authorization, Content-Type');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
        
        // Set SSE-specific headers
        res.writeHead(200, { 
            'Content-Type': 'text/event-stream', 
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable buffering in nginx
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'false'
        });
        
        // Send initial connection message
        res.write(': connected\n\n');
        res.flushHeaders();
        
        // Store connection with multiple key formats for maximum compatibility
        const storedKeys = [];
        clients[userIdStr] = res;
        storedKeys.push(userIdStr);
        clients[String(userId)] = res;
        storedKeys.push(String(userId));
        if (typeof userId === 'number') {
            clients[userId] = res;
            storedKeys.push(userId);
        }
        const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
        if (!isNaN(userIdInt)) {
            clients[userIdInt] = res;
            storedKeys.push(userIdInt);
            clients[String(userIdInt)] = res;
            storedKeys.push(String(userIdInt));
        }
        console.log(`📡 SSE connection stored for user ${userIdStr} (ID type: ${typeof userId}, value: ${userId})`);
        console.log(`📡 Stored with keys:`, storedKeys);
        console.log(`📡 All client keys after storage:`, Object.keys(clients));
        console.log(`📡 Total active SSE connections: ${Object.keys(clients).length}`);
        
        console.log(`✅ SSE connection established for user ${userIdStr} (stored with keys: ${Object.keys(clients).filter(k => clients[k] === res).join(', ')})`);
        
        const keepAlive = setInterval(() => {
            try {
                res.write(': keepalive\n\n');
            } catch (err) {
                clearInterval(keepAlive);
                // Clean up ALL possible key formats
                delete clients[userIdStr];
                delete clients[String(userId)];
                if (typeof userId === 'number') {
                    delete clients[userId];
                }
                const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
                if (!isNaN(userIdInt)) {
                    delete clients[userIdInt];
                    delete clients[String(userIdInt)];
                }
            }
        }, 15000);
        
        req.on('close', () => { 
            clearInterval(keepAlive); 
            // Clean up ALL possible key formats
            delete clients[userIdStr];
            delete clients[String(userId)];
            if (typeof userId === 'number') {
                delete clients[userId];
            }
            const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
            if (!isNaN(userIdInt)) {
                delete clients[userIdInt];
                delete clients[String(userIdInt)];
            }
            console.log(`❌ SSE connection closed for user ${userIdStr}`);
        });
        
        req.on('error', (err) => {
            console.error(`❌ SSE request error for user ${userIdStr}:`, err);
            clearInterval(keepAlive);
            // Clean up connections - remove ALL possible key formats
            const keysToDelete = [userIdStr, String(userId)];
            if (typeof userId === 'number') {
                keysToDelete.push(userId);
            }
            const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
            if (!isNaN(userIdInt)) {
                keysToDelete.push(userIdInt, String(userIdInt));
            }
            keysToDelete.forEach(key => {
                if (clients[key]) {
                    delete clients[key];
                    console.log(`   Deleted client key due to error: ${key} (type: ${typeof key})`);
                }
            });
            console.log(`❌ SSE error cleanup complete. Remaining clients:`, Object.keys(clients));
        });
    } catch (e) { 
        console.error('SSE connection error:', e);
        // Set CORS headers even for error responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Authorization, Content-Type');
        if (!res.headersSent) {
            res.status(401).json({ error: 'Invalid token or connection error' });
        }
    }
});

const sendEvent = (uid, type, data) => { 
    // Try both string and integer formats for the user ID
    const uidStr = String(uid);
    const uidInt = typeof uid === 'string' ? parseInt(uid, 10) : uid;
    
    // Special logging for message and end_call events
    if (type === 'receive_message') {
        console.log('📨📨📨 BACKEND: Sending receive_message event 📨📨📨');
        console.log('📨 Target user ID:', uidStr, '(original:', uid, 'type:', typeof uid, ')');
        console.log('📨 Available clients:', Object.keys(clients));
        console.log('📨 Client key types:', Object.keys(clients).map(k => `${k}(${typeof k})`));
    }
    if (type === 'end_call') {
        console.log('🔴🔴🔴 BACKEND: Sending end_call event 🔴🔴🔴');
        console.log('🔴 Target user ID:', uidStr);
        console.log('🔴 Event data:', JSON.stringify(data, null, 2));
        console.log('🔴 Available clients:', Object.keys(clients));
    }
    
    // Try multiple key formats in order of likelihood
    let target = null;
    let foundKey = null;
    
    // Try all possible key formats - be exhaustive
    const keysToTry = [
        uidStr,                    // "1"
        String(uidInt),            // "1" (if uidInt is 1)
        uidInt,                    // 1
        parseInt(uidStr, 10),       // 1 (if uidStr is "1")
        String(parseInt(uidStr, 10)) // "1" (converted back)
    ].filter((k, index, self) => 
        k !== null && 
        k !== undefined && 
        !isNaN(k) && 
        self.indexOf(k) === index // Remove duplicates
    );
    
    console.log(`🔍 Looking up client for user ${uidStr} (original: ${uid}, type: ${typeof uid})`);
    console.log(`🔍 Keys to try:`, keysToTry);
    console.log(`🔍 Available client keys:`, Object.keys(clients));
    
    for (const key of keysToTry) {
        if (clients[key]) {
            target = clients[key];
            foundKey = key;
            console.log(`✅ Found client using key: ${key} (type: ${typeof key})`);
            break;
        }
    }
    
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
            console.log(`✅ Sent ${type} event to user ${uidStr} (found as key: ${foundKey})`);
            if (type === 'end_call') {
                console.log('🔴🔴🔴 BACKEND: end_call event written to SSE connection 🔴🔴🔴');
                console.log('🔴 Event payload:', eventString.substring(0, 200) + '...');
            }
            if (type === 'receive_message') {
                const msgId = data?.id || data?._id;
                const senderId = data?.sender?.id || data?.sender?._id || data?.sender_id;
                const recipientId = data?.recipient || data?.recipient_id;
                console.log(`📨✅ Message event written to SSE connection for user ${uidStr}`);
                console.log(`📨   Message ID: ${msgId}, Sender: ${senderId}, Recipient: ${recipientId}`);
                console.log(`📨   Content: ${data?.content?.substring(0, 50)}...`);
                console.log(`📨   Event payload length: ${eventString.length} bytes`);
            }
            return true;
        } catch (err) {
            console.error(`❌ Failed to send event to user ${uidStr}:`, err);
            if (type === 'end_call') {
                console.error('🔴🔴🔴 BACKEND: Failed to write end_call event to SSE connection 🔴🔴🔴');
            }
            // Remove dead connection - clean up ALL possible key formats
            keysToTry.forEach(key => delete clients[key]);
            return false;
        }
    } else {
        console.log(`⚠️ No SSE connection found for user ${uidStr} (type: ${type})`);
        if (type === 'receive_message') {
            console.error('📨❌❌❌ BACKEND: No SSE connection found for receive_message event ❌❌❌');
            console.error('📨 Target user:', uidStr, '(original:', uid, 'type:', typeof uid, ')');
            console.error('📨 Tried keys:', keysToTry);
            console.error('📨 Available clients:', Object.keys(clients));
            console.error('📨 Client key types:', Object.keys(clients).map(k => `${k}(${typeof k})`));
        }
        if (type === 'end_call') {
            console.error('🔴🔴🔴 BACKEND: No SSE connection found for end_call event 🔴🔴🔴');
            console.error('🔴 Target user:', uidStr);
            console.error('🔴 Tried keys:', keysToTry);
        }
        console.log(`   Tried keys:`, keysToTry);
        console.log(`   Available clients:`, Object.keys(clients));
        console.log(`   Client types:`, Object.keys(clients).map(k => `${k}(${typeof k})`));
        return false;
    }
};

// --- CALL SIGNALING STORAGE ---
// Store pending call signals for polling (key: userId, value: array of signals)
let callSignals = {};

// Helper to add call signal for a user
const addCallSignal = (userId, signal) => {
    const uid = String(userId);
    if (!callSignals[uid]) callSignals[uid] = [];
    const signalWithTimestamp = { ...signal, timestamp: Date.now() };
    callSignals[uid].push(signalWithTimestamp);
    // Keep only last 50 signals per user
    if (callSignals[uid].length > 50) callSignals[uid] = callSignals[uid].slice(-50);
    console.log(`📞 Stored call signal for user ${uid}:`, {
        type: signal.type,
        timestamp: signalWithTimestamp.timestamp,
        totalSignals: callSignals[uid].length
    });
};

// Helper to get and clear call signals for a user
// On Vercel, we keep signals for 60 seconds to account for serverless function cold starts
// Signals are marked as "read" after first retrieval to prevent duplicate processing
const getCallSignals = (userId) => {
    const uid = String(userId);
    const now = Date.now();
    const SIGNAL_TTL = 60000; // 60 seconds - signals expire after this time (longer for Vercel)
    
    if (!callSignals[uid]) {
        callSignals[uid] = [];
        return [];
    }
    
    // Filter out expired signals (keep for 60 seconds)
    const beforeFilter = callSignals[uid].length;
    callSignals[uid] = callSignals[uid].filter(s => (now - s.timestamp) < SIGNAL_TTL);
    const afterFilter = callSignals[uid].length;
    
    // Get unread signals only (prevent duplicate processing)
    const unreadSignals = callSignals[uid].filter(s => !s.read);
    
    // Mark signals as read AFTER we return them (so they're available for multiple polls)
    // But only mark as read if they're not too old
    const MAX_AGE_FOR_READ = 30000; // 30 seconds - don't mark very old signals as read
    unreadSignals.forEach(s => {
        const age = now - s.timestamp;
        if (age < MAX_AGE_FOR_READ) {
            s.read = true;
            s.readAt = now;
        }
    });
    
    // Clear signals that are older than 30 seconds OR were read more than 10 seconds ago
    // Increased times to account for slower polling or network delays
    const CLEAR_AGE = 30000; // 30 seconds for unread signals (increased from 15s)
    const READ_CLEAR_AGE = 10000; // 10 seconds for read signals (increased from 5s)
    callSignals[uid] = callSignals[uid].filter(s => {
        if (s.read) {
            return (now - (s.readAt || s.timestamp)) < READ_CLEAR_AGE;
        }
        return (now - s.timestamp) < CLEAR_AGE;
    });
    
    console.log(`📞 Retrieved call signals for user ${uid}:`, {
        beforeFilter,
        afterFilter,
        unread: unreadSignals.length,
        total: callSignals[uid].length,
        signalTypes: unreadSignals.map(s => s.type),
        ages: unreadSignals.map(s => `${Math.round((now - s.timestamp) / 1000)}s`)
    });
    
    return unreadSignals;
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
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Trim username to handle whitespace issues
        const trimmedUsername = username.trim();
        console.log(`🔍 Login attempt for username: "${trimmedUsername}"`);
        
        const user = await User.findOne({ username: trimmedUsername });
        
        if (!user) {
            console.log(`❌ User not found: "${trimmedUsername}"`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        console.log(`✅ User found: ${user.username} (ID: ${user.id})`);
        
        // Check if password field exists and is a valid bcrypt hash
        if (!user.password) {
            console.error(`❌ User ${user.username} has no password field`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            console.log(`❌ Password mismatch for user: ${user.username}`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        console.log(`✅ Login successful for user: ${user.username}`);
        
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

// Diagnostic endpoint to check user info (for debugging login issues)
app.get('/api/debug/user/:username', async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const { username } = req.params;
        const user = await User.findOne({ username: username.trim() });
        
        if (!user) {
            return res.json({ 
                exists: false, 
                username: username,
                message: 'User not found in database'
            });
        }
        
        // Return user info without password hash (but indicate if password exists)
        res.json({
            exists: true,
            id: user.id,
            username: user.username,
            role: user.role,
            nickname: user.nickname || '',
            avatar: user.avatar || '',
            isVisible: user.isVisible,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0,
            passwordStartsWith: user.password ? user.password.substring(0, 10) + '...' : null,
            message: 'User found. Password field exists: ' + (user.password ? 'Yes' : 'No')
        });
    } catch (e) {
        console.error('Debug user error:', e);
        res.status(500).json({ error: e.message || 'Failed to check user' });
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
        
        // Ensure message is properly formatted
        console.log('📤 Created message structure:', {
            id: msg.id,
            _id: msg._id,
            sender: msg.sender,
            recipient: msg.recipient,
            recipient_id: msg.recipient_id,
            sender_id: msg.sender_id,
            hasSenderObject: !!msg.sender,
            senderIdInObject: msg.sender?.id || msg.sender?._id
        });

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
            console.log('📤 ========================================');
            console.log(`📤 MESSAGE SENDING: From ${senderIdInt} to ${recipientIdInt}`);
            console.log(`📤 Message ID: ${msg.id || msg._id}, Content: ${msg.content?.substring(0, 50)}...`);
            console.log(`📤 Message sender ID: ${msg.sender?.id || msg.sender?._id || msg.sender_id}`);
            console.log(`📤 Message recipient ID: ${msg.recipient || msg.recipient_id}`);
            console.log(`📤 Available SSE clients:`, Object.keys(clients));
            console.log(`📤 Client key types:`, Object.keys(clients).map(k => `${k}(${typeof k})`));
            console.log(`📤 Message object structure:`, {
                id: msg.id,
                _id: msg._id,
                sender: msg.sender,
                recipient: msg.recipient,
                recipient_id: msg.recipient_id,
                sender_id: msg.sender_id,
                content: msg.content?.substring(0, 30)
            });
            
            // Send with message as the data directly
            console.log(`📤 Attempting to send to RECIPIENT ${recipientIdInt} (type: ${typeof recipientIdInt})...`);
            console.log(`📤 Current active SSE connections:`, Object.keys(clients));
            console.log(`📤 Connection details:`, Object.keys(clients).map(k => `${k}(${typeof k})`));
            const recipientSent = sendEvent(recipientIdInt, 'receive_message', msg);
            console.log(`📤 Recipient send result: ${recipientSent ? '✅ SUCCESS' : '❌ FAILED'}`);
            if (!recipientSent) {
                console.error(`📤❌ CRITICAL: Failed to send message to recipient ${recipientIdInt}`);
                console.error(`📤   This means the recipient's SSE connection is not active or not found`);
                console.error(`📤   The recipient will need to rely on polling or refresh their connection`);
            }
            
            // Also send to sender so they see their own message
            console.log(`📤 Attempting to send to SENDER ${senderIdInt} (type: ${typeof senderIdInt})...`);
            const senderSent = sendEvent(senderIdInt, 'receive_message', msg);
            console.log(`📤 Sender send result: ${senderSent ? '✅ SUCCESS' : '❌ FAILED'}`);
            console.log('📤 ========================================');
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
        
        // Also store for polling (critical for Vercel where SSE doesn't work)
        addCallSignal(targetId, {
            type: 'call_user',
            data: {
                from: callerIdInt,
                signal: { ...signalData, isVideo },
                name: fromUsername || 'Someone'
            }
        });
        
        console.log(`📞 Call initiated: caller ${callerIdInt} → target ${targetId} (video: ${isVideo})`);
        console.log(`📞 Signal stored for polling. Target user should poll /api/calls/poll to receive it.`);
        
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
        if (!token || !to) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // ICE candidate can be null when gathering is complete - this is normal
        if (!candidate) {
            console.log('📞 ICE candidate is null (gathering complete), skipping');
            return res.json({ success: true });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const senderId = decoded.id;
        const targetId = typeof to === 'string' ? parseInt(to) : to;
        const senderIdInt = typeof senderId === 'string' ? parseInt(senderId) : senderId;
        
        // Ensure candidate has required fields for RTCIceCandidate
        // RTCIceCandidate requires either sdpMid or sdpMLineIndex
        const validCandidate = {
            candidate: candidate.candidate || '',
            sdpMid: candidate.sdpMid || null,
            sdpMLineIndex: candidate.sdpMLineIndex !== undefined ? candidate.sdpMLineIndex : null
        };
        
        // Only send if candidate has required fields
        if (!validCandidate.candidate && !validCandidate.sdpMid && validCandidate.sdpMLineIndex === null) {
            console.warn('⚠️ Invalid ICE candidate format, skipping:', candidate);
            return res.json({ success: true });
        }
        
        // Send ICE candidate via SSE
        sendEvent(targetId, 'ice_candidate', validCandidate);
        
        // Also store for polling
        addCallSignal(targetId, {
            type: 'ice_candidate',
            data: validCandidate
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
            console.log(`📞 USER (${senderIdInt}) sending end_call event to other party (${targetId})`);
            console.log(`📞 This could be caller ending call OR receiver declining call`);
            const sent = sendEvent(targetId, 'end_call', { from: senderIdInt });
            if (sent) {
                console.log(`✅ Call termination event sent successfully from ${senderIdInt} to ${targetId}`);
            } else {
                console.error(`❌ Failed to send call termination event from ${senderIdInt} to ${targetId}`);
            }
            addCallSignal(targetId, {
                type: 'end_call',
                data: { from: senderIdInt }
            });
            console.log(`📞 Call termination signal also stored for polling (target: ${targetId})`);
        } else {
            console.log(`📞 End call request received but no target user specified (from: ${senderIdInt})`);
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
            console.log('📞 Poll request received but no token provided');
            return res.status(401).json({ error: 'Token required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        const userIdInt = typeof userId === 'string' ? parseInt(userId) : userId;
        
        console.log(`📞 Poll request received from user ${userIdInt}`);
        
        // Get pending signals (with TTL handling)
        const signals = getCallSignals(userIdInt);
        
        if (signals.length > 0) {
            console.log(`📞 Poll response for user ${userIdInt}: returning ${signals.length} signal(s):`, signals.map(s => s.type));
        } else {
            // Log occasionally to confirm polling is working (every 10th poll)
            const shouldLog = Math.random() < 0.1;
            if (shouldLog) {
                console.log(`📞 Poll response for user ${userIdInt}: no signals (polling is active)`);
            }
        }
        
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
