import os

# Define the project structure and file contents
files = {
    "chat-app/server/package.json": """{
  "name": "chat-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.0.3",
    "socket.io": "^4.7.2"
  }
}""",

    "chat-app/server/.env": """MONGO_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=supersecretkey123
PORT=4000
""",

    "chat-app/server/models/User.js": """const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

module.exports = mongoose.model('User', UserSchema);
""",

    "chat-app/server/models/Message.js": """const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
""",

    "chat-app/server/server.js": """require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// Connect to DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const JWT_SECRET = process.env.JWT_SECRET;

// --- AUTHENTICATION ROUTES ---

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ username, password: hashedPassword });
    res.json({ message: 'User created' });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'User not found' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
  res.json({ token, userId: user._id, username: user.username });
});

// Get All Users
app.get('/users', async (req, res) => {
  const users = await User.find({}, 'username _id');
  res.json(users);
});

// Get Chat History
app.get('/messages/:userId/:otherUserId', async (req, res) => {
  const { userId, otherUserId } = req.params;
  const messages = await Message.find({
    $or: [
      { sender: userId, recipient: otherUserId },
      { sender: otherUserId, recipient: userId }
    ]
  }).sort({ timestamp: 1 });
  res.json(messages);
});

// --- SOCKET.IO ---

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.userId = decoded.id;
    next();
  });
});

const onlineUsers = new Map(); // Map userId -> socketId

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  onlineUsers.set(socket.userId, socket.id);

  socket.on('send_message', async (data) => {
    const { recipientId, content } = data;

    // 1. STORE
    const newMessage = await Message.create({
      sender: socket.userId,
      recipient: recipientId,
      content
    });

    // 2. FORWARD
    const recipientSocketId = onlineUsers.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_message', newMessage);
    }

    socket.emit('receive_message', newMessage); 
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
""",

    "chat-app/client/package.json": """{
  "name": "chat-client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "socket.io-client": "^4.7.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}""",

    "chat-app/client/vite.config.js": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
""",

    "chat-app/client/index.html": """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chat App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
""",

    "chat-app/client/src/index.css": """:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  width: 100%;
  height: 100vh;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  color: white;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
input {
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
}
""",

    "chat-app/client/src/main.jsx": """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
""",

    "chat-app/client/src/App.jsx": """import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = 'http://localhost:4000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    const storedId = localStorage.getItem('userId');
    if (storedUser && storedId) {
        setUser({ id: storedId, username: storedUser });
    }
  }, []);

  if (!token) return <Auth setToken={setToken} setUser={setUser} />;
  
  return <ChatDashboard token={token} logout={() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setToken(null);
    setUser(null);
  }} />;
}

// --- AUTH COMPONENT ---
function Auth({ setToken, setUser }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? '/register' : '/login';
    try {
      const { data } = await axios.post(`${API_URL}${endpoint}`, { username, password });
      if (!isRegister) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);
        setToken(data.token);
        setUser({ id: data.userId, username: data.username });
      } else {
        alert('Registration successful! Please login.');
        setIsRegister(false);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'An error occurred');
    }
  };

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column' }}>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'10px', width:'300px' }}>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">{isRegister ? 'Register' : 'Login'}</button>
      </form>
      <p>
        {isRegister ? "Already have an account?" : "Don't have an account?"}
        <button 
            style={{backgroundColor:'transparent', color:'blue', border:'none', textDecoration:'underline'}}
            onClick={() => setIsRegister(!isRegister)}
        >
            Switch to {isRegister ? 'Login' : 'Register'}
        </button>
      </p>
    </div>
  );
}

// --- CHAT DASHBOARD ---
function ChatDashboard({ token, logout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);
  const myId = localStorage.getItem('userId');

  // Initialize Socket
  useEffect(() => {
    const newSocket = io(API_URL, {
      auth: { token }
    });
    setSocket(newSocket);

    // Listen for incoming messages (The "Forward" part)
    newSocket.on('receive_message', (message) => {
      setMessages((prev) => {
        return [...prev, message];
      });
    });

    return () => newSocket.close();
  }, [token]);

  // Fetch Users
  useEffect(() => {
    axios.get(`${API_URL}/users`).then(res => {
      setUsers(res.data.filter(u => u._id !== myId));
    });
  }, [myId]);

  // Fetch Chat History when a user is selected
  useEffect(() => {
    if (selectedUser) {
      axios.get(`${API_URL}/messages/${myId}/${selectedUser._id}`)
        .then(res => setMessages(res.data));
    }
  }, [selectedUser, myId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (socket && input.trim() && selectedUser) {
      // Emit to server
      socket.emit('send_message', {
        recipientId: selectedUser._id,
        content: input
      });
      setInput('');
    }
  };

  // Filter messages for the current view
  const currentMessages = messages.filter(msg => 
    (selectedUser && msg.sender === selectedUser._id && msg.recipient === myId) ||
    (selectedUser && msg.sender === myId && msg.recipient === selectedUser._id)
  );

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px', display:'flex', flexDirection:'column' }}>
        <h3>Users</h3>
        <ul style={{ listStyle:'none', padding:0, flex:1 }}>
          {users.map(u => (
            <li 
              key={u._id} 
              onClick={() => setSelectedUser(u)}
              style={{ 
                cursor: 'pointer', 
                fontWeight: selectedUser?._id === u._id ? 'bold' : 'normal',
                backgroundColor: selectedUser?._id === u._id ? '#eee' : 'transparent',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '5px'
              }}
            >
              {u.username}
            </li>
          ))}
        </ul>
        <button onClick={logout} style={{backgroundColor:'#ff4444'}}>Logout</button>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            <div style={{borderBottom:'1px solid #ddd', paddingBottom:'10px', marginBottom:'10px'}}>
                <h3>Chat with {selectedUser.username}</h3>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius:'8px', padding: '10px', marginBottom: '10px', backgroundColor:'#f9f9f9' }}>
              {currentMessages.length === 0 && <p style={{color:'#888', textAlign:'center'}}>No messages yet.</p>}
              {currentMessages.map((msg, index) => (
                <div key={index} style={{ textAlign: msg.sender === myId ? 'right' : 'left', margin: '5px' }}>
                  <span style={{ 
                    background: msg.sender === myId ? '#007bff' : '#e5e5ea', 
                    color: msg.sender === myId ? 'white' : 'black',
                    padding: '8px 12px', 
                    borderRadius: '15px',
                    display: 'inline-block',
                    maxWidth: '70%'
                  }}>
                    {msg.content}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} style={{ display: 'flex', gap:'10px' }}>
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                style={{ flex: 1, padding: '10px' }} 
                placeholder="Type a message..." 
              />
              <button type="submit" style={{ padding: '10px 20px', backgroundColor:'#007bff' }}>Send</button>
            </form>
          </>
        ) : (
          <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'center', color:'#888'}}>
            <h3>Select a user to start chatting</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
"""
}

def create_project():
    print("Generating Chat App Project...")
    for filepath, content in files.items():
        # Create directories if they don't exist
        directory = os.path.dirname(filepath)
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"Created directory: {directory}")
        
        # Write file contents
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Created file: {filepath}")
    
    print("\n\nDone! The 'chat-app' folder has been created.")
    print("Please follow the instructions to install dependencies and run the app.")

if __name__ == "__main__":
    create_project()