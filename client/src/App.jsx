import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// API URL configuration - works for both local and Vercel deployment
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? (window.location.origin) 
    : 'http://localhost:4000');

// --- ICONS COMPONENT (Inline SVGs) ---
const Icons = {
  Image: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
  ),
  Audio: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
  ),
  Video: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
  )
};

// --- MAIN APP COMPONENT ---
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('chat'); // 'chat' or 'admin'

  useEffect(() => {
    // If we have a token but no user, try to get from localStorage or parse token
    if (token && !user) {
      const storedUser = localStorage.getItem('username');
      const storedId = localStorage.getItem('userId');
      const storedRole = localStorage.getItem('role');
      const storedAvatar = localStorage.getItem('avatar') || '';
      const storedNickname = localStorage.getItem('nickname') || '';

      if (storedUser && storedId) {
        setUser({ 
          id: storedId, 
          _id: storedId,
          username: storedUser, 
          role: storedRole || 'user',
          avatar: storedAvatar,
          nickname: storedNickname
        });
      } else {
        // Try to parse token as fallback
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ 
            id: payload.id, 
            _id: payload.id,
            username: payload.username, 
            role: payload.role || 'user',
            avatar: storedAvatar,
            nickname: storedNickname
          });
        } catch (e) {
          console.error('Failed to parse token:', e);
        }
      }
    }
  }, [token]);

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setView('chat');
  };

  if (!token) return <Auth setToken={setToken} setUser={setUser} />;
  
  // Show loading if user data is not yet available
  if (!user) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#333', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Avatar Icon - Clickable to open profile */}
          <div 
            onClick={() => setView('profile')}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '5px 10px',
              borderRadius: '5px',
              background: view === 'profile' ? '#555' : 'transparent',
              transition: 'background 0.2s'
            }}
          >
            <img 
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=007bff&color=fff&size=40`}
              alt={user?.username}
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                objectFit: 'cover',
                background: '#555',
                border: '2px solid #fff'
              }}
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=007bff&color=fff&size=40`;
              }}
            />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95em' }}>
                {user?.nickname || user?.username}
              </div>
              {user?.role === 'admin' && (
                <span style={{fontSize:'0.7em', background:'red', padding:'2px 5px', borderRadius:'3px', verticalAlign:'middle'}}>ADMIN</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
                onClick={() => setView('chat')}
                style={{ background: view === 'chat' ? '#555' : '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
            >
                Chat
            </button>
            <button 
                onClick={() => setView('profile')}
                style={{ background: view === 'profile' ? '#555' : '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
            >
                Profile
            </button>
            {user?.role === 'admin' && (
                <button 
                    onClick={() => setView('admin')}
                    style={{ background: view === 'admin' ? '#555' : '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
                >
                    Admin
                </button>
            )}
            <button onClick={logout} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'profile' ? (
            <ProfileView token={token} user={user} setUser={setUser} />
        ) : view === 'admin' && user?.role === 'admin' ? (
            <AdminDashboard token={token} />
        ) : (
            <ChatDashboard token={token} myId={user?.id} myUsername={user?.username} />
        )}
      </div>
    </div>
  );
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
      const { data } = await axios.post(`${API_URL}/api${endpoint}`, { username, password });
      if (!isRegister) {
        // Get user ID from response (could be id, _id, or userId)
        const userId = data.id || data._id || data.userId;
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', data.username);
        localStorage.setItem('role', data.role || 'user');
        localStorage.setItem('avatar', data.avatar || '');
        localStorage.setItem('nickname', data.nickname || '');
        // Set user state immediately
        setUser({ 
          id: userId, 
          _id: userId,
          username: data.username, 
          role: data.role || 'user',
          avatar: data.avatar || '',
          nickname: data.nickname || ''
        });
        setToken(data.token);
      } else {
        alert('Registration successful! Please login.');
        setIsRegister(false);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'An error occurred';
      alert(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
  };

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column', background: '#f0f2f5' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{isRegister ? 'Register' : 'Login'}</h2>
        <p style={{fontSize: '0.8em', color: '#666', textAlign: 'center', marginBottom: '20px'}}>Tip: Username starting with <b>"admin"</b> gets Admin Role.</p>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'15px', width:'300px' }}>
          <input style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <input style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={{ padding: '10px', borderRadius: '5px', border: 'none', background: '#007bff', color: 'white', fontWeight: 'bold', cursor: 'pointer' }} type="submit">{isRegister ? 'Register' : 'Login'}</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button style={{background:'transparent', color:'#007bff', border:'none', textDecoration:'underline', cursor: 'pointer'}} onClick={() => setIsRegister(!isRegister)}>
                Switch to {isRegister ? 'Login' : 'Register'}
            </button>
        </div>
      </div>
    </div>
  );
}

// --- ADMIN DASHBOARD ---
function AdminDashboard({ token }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${API_URL}/api/admin/users`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => setUsers(res.data))
        .catch(err => alert("Failed to fetch users"))
        .finally(() => setLoading(false));
    }, [token]);

    const deleteUser = async (id) => {
        if(!window.confirm("Are you sure? This will delete the user and their messages.")) return;
        try {
            await axios.delete(`${API_URL}/api/admin/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(users.filter(u => u._id !== id));
        } catch (err) {
            alert("Error deleting user");
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>User Management</h1>
            {loading ? <p>Loading...</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <thead>
                        <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
                            <th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Username</th>
                            <th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Role</th>
                            <th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Created At</th>
                            <th style={{ padding: '15px', borderBottom: '2px solid #ddd' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u._id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '15px' }}>{u.username}</td>
                                <td style={{ padding: '15px' }}>
                                    <span style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: '4px', 
                                        background: u.role === 'admin' ? '#d4edda' : '#e2e3e5',
                                        color: u.role === 'admin' ? '#155724' : '#383d41',
                                        fontSize: '0.85em',
                                        fontWeight: 'bold'
                                    }}>
                                        {u.role.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '15px', fontSize: '0.9em', color: '#666' }}>
                                    {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '15px' }}>
                                    {u.role !== 'admin' && (
                                        <button 
                                            onClick={() => deleteUser(u._id)}
                                            style={{ background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '5px 10px' }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// --- PROFILE VIEW ---
function ProfileView({ token, user, setUser }) {
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [isVisible, setIsVisible] = useState(user?.isVisible !== false);
  const [avatarFile, setAvatarFile] = useState(null);

  const handleSave = async () => {
    try {
      const { data } = await axios.put(`${API_URL}/api/profile`, { token, nickname, isVisible });
      localStorage.setItem('nickname', data.nickname || '');
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        fd.append('token', token);
        const res = await axios.post(`${API_URL}/api/profile/avatar`, fd);
        localStorage.setItem('avatar', res.data.fileUrl);
        data.avatar = res.data.fileUrl;
      }
      setUser(prev => ({ ...prev, ...data }));
      alert('Profile saved!');
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message || 'Failed to save profile';
      alert(errorMsg);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '500px', margin: '40px auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2>Your Profile</h2>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <img 
          src={avatarFile ? URL.createObjectURL(avatarFile) : (user?.avatar || '')} 
          alt="Avatar" 
          style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', background: '#ddd' }}
        />
        <div>
          <input type="file" id="avatar-upload" hidden onChange={e => setAvatarFile(e.target.files[0])} />
          <button onClick={() => document.getElementById('avatar-upload').click()} style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Upload Photo
          </button>
        </div>
      </div>
      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Display Name</label>
      <input 
        value={nickname} 
        onChange={e => setNickname(e.target.value)} 
        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', marginBottom: '20px' }}
        placeholder="Enter your display name"
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
        <input type="checkbox" checked={isVisible} onChange={e => setIsVisible(e.target.checked)} />
        Public Profile (visible to others)
      </label>
      <button onClick={handleSave} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
        Save Changes
      </button>
    </div>
  );
}

// --- CHAT DASHBOARD (Messaging, Calls, File Share) ---
function ChatDashboard({ token, myId, myUsername }) {
  // Chat State
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'communities', 'all'
  const eventSourceRef = useRef(null);

  // Call State
  const [callActive, setCallActive] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState(null);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [isVideoCall, setIsVideoCall] = useState(false); // Toggle for video/audio
  const [localStream, setLocalStream] = useState(null);
  
  // Refs
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const messagesEndRef = useRef(null); // For auto-scrolling
  const callPollIntervalRef = useRef(null);

  const peerConstraints = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  // Helper function to cleanup call state
  const endCallCleanup = () => {
    setCallActive(false);
    setReceivingCall(false);
    setCallStatus('');
    setCaller(null);
    setIsVideoCall(false);
    
    // Stop local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Clear video/audio elements
    if (myVideo.current) {
      myVideo.current.srcObject = null;
    }
    if (userVideo.current) {
      userVideo.current.srcObject = null;
    }
    
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
  };

  // --- SERVER-SENT EVENTS (SSE) CONNECTION ---
  useEffect(() => {
    if (!token) return;

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout = null;

    const connectSSE = () => {
      try {
        // Connect to SSE endpoint with token as query parameter
        // (EventSource doesn't support custom headers, so we'll use query param)
        const eventSource = new EventSource(`${API_URL}/api/events?token=${encodeURIComponent(token)}`);

        eventSourceRef.current = eventSource;
        
        eventSource.onopen = () => {
          console.log('✅ SSE connection opened');
          reconnectAttempts = 0; // Reset on successful connection
        };
        
        eventSource.onerror = (err) => {
          console.error('❌ SSE connection error:', err);
          console.error('   EventSource readyState:', eventSource.readyState);
          console.error('   EventSource URL:', eventSource.url);
          
          // EventSource.readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
          if (eventSource.readyState === EventSource.CLOSED) {
            console.log('   Connection closed, attempting to reconnect...');
            eventSource.close();
            
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
              console.log(`   Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
              reconnectTimeout = setTimeout(() => {
                connectSSE();
              }, delay);
            } else {
              console.error('   Max reconnection attempts reached. Please refresh the page.');
            }
          }
        };

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        console.log('📥 Raw SSE event received:', event.data);
        const data = JSON.parse(event.data);
        console.log('📥 Parsed SSE data:', data);
        
        if (data.type === 'receive_message') {
          console.log('📨 Received SSE message event:', data);
          const newMessage = data.message || data.data;
          console.log('📨 Extracted message:', newMessage);
          
          if (newMessage) {
            // Ensure message has required fields
            const formattedMessage = {
              _id: newMessage._id || newMessage.id,
              id: newMessage.id || newMessage._id,
              sender: newMessage.sender || { _id: newMessage.sender_id, id: newMessage.sender_id },
              recipient: newMessage.recipient || newMessage.recipient_id,
              groupId: newMessage.groupId || newMessage.group_id,
              content: newMessage.content || '',
              type: newMessage.type || 'text',
              fileUrl: newMessage.fileUrl || '',
              timestamp: newMessage.timestamp || new Date().toISOString()
            };
            
            console.log('📨 Formatted message:', formattedMessage);
            console.log('📨 Current myId:', myId);
            console.log('📨 Message recipient:', formattedMessage.recipient);
            console.log('📨 Message sender:', formattedMessage.sender);
            
            setMessages((prev) => {
              // Avoid duplicates
              const exists = prev.some(m => 
                (m._id === formattedMessage._id || m.id === formattedMessage.id) ||
                (m._id === formattedMessage.id || m.id === formattedMessage._id)
              );
              if (exists) {
                console.log('⚠️ Duplicate message ignored');
                return prev;
              }
              console.log('✅ Adding new message to list. Previous count:', prev.length, 'New count:', prev.length + 1);
              return [...prev, formattedMessage];
            });
          } else {
            console.warn('⚠️ Received message event but message data is missing. Full event:', data);
          }
        } else if (data.type === 'call_user') {
          setReceivingCall(true);
          setCaller(data.from);
          setCallerSignal(data.signal);
          setCallStatus(`${data.name} is calling...`);
        } else if (data.type === 'call_accepted') {
          setCallStatus('Call in progress');
          if (connectionRef.current) {
            connectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          }
        } else if (data.type === 'ice_candidate') {
          if (connectionRef.current) {
            connectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } else if (data.type === 'end_call') {
          endCallCleanup();
        } else {
          console.log('📥 Received non-message SSE event:', data.type);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        // Reconnect will happen automatically via useEffect
      }, 3000);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (callPollIntervalRef.current) {
        clearInterval(callPollIntervalRef.current);
      }
    };
  }, [token]);

  // Poll for call signals (backup method if SSE doesn't work for calls)
  useEffect(() => {
    if (!token) return;

    const pollCalls = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/calls/poll`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const signals = response.data;
        signals.forEach(signal => {
          if (signal.type === 'call_user') {
            setReceivingCall(true);
            setCaller(signal.data.from);
            setCallerSignal(signal.data.signal);
            setCallStatus(`${signal.data.name} is calling...`);
          } else if (signal.type === 'call_accepted') {
            setCallStatus('Call in progress');
            if (connectionRef.current) {
              connectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
            }
          } else if (signal.type === 'ice_candidate') {
            if (connectionRef.current) {
              connectionRef.current.addIceCandidate(new RTCIceCandidate(signal.data));
            }
          } else if (signal.type === 'end_call') {
            endCallCleanup();
          }
        });
      } catch (err) {
        console.error('Error polling calls:', err);
      }
    };

    // Poll every 2 seconds
    callPollIntervalRef.current = setInterval(pollCalls, 2000);

    return () => {
      if (callPollIntervalRef.current) {
        clearInterval(callPollIntervalRef.current);
      }
    };
  }, [token]);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!token || !myId) return;
    // Fetch all users
    axios.get(`${API_URL}/api/users`)
      .then(res => {
        console.log('Users data:', res.data);
        setUsers(res.data.filter(u => (u._id || u.id) !== myId));
      })
      .catch(err => {
        console.error('Failed to fetch users:', err);
        setUsers([]);
      });
    
    // Fetch friends and requests
    axios.get(`${API_URL}/api/my-network`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        console.log('Network data:', res.data);
        setFriends(res.data.friends || []);
        setRequests(res.data.requests || []);
      })
      .catch(err => {
        console.error('Failed to fetch network:', err);
        setFriends([]);
        setRequests([]);
      });
    
    // Fetch groups
    axios.get(`${API_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        console.log('Groups data:', res.data);
        setGroups(res.data || []);
      })
      .catch(err => {
        console.error('Failed to fetch groups:', err);
        setGroups([]);
      });
  }, [myId, token]);

  useEffect(() => {
    if (selectedUser && myId) {
      axios.get(`${API_URL}/api/messages/${myId}/${selectedUser._id || selectedUser.id}`)
        .then(res => setMessages(res.data || []))
        .catch(err => console.error('Failed to fetch messages:', err));
    } else if (selectedGroup) {
      axios.get(`${API_URL}/api/groups/${selectedGroup._id || selectedGroup.id}/messages`)
        .then(res => setMessages(res.data || []))
        .catch(err => console.error('Failed to fetch group messages:', err));
    } else {
      setMessages([]);
    }
  }, [selectedUser, selectedGroup, myId]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  // --- MESSAGE LOGIC ---
  const currentMessages = selectedGroup 
    ? messages.filter(msg => {
        const msgGroupId = msg.groupId || msg.group_id;
        const groupId = selectedGroup._id || selectedGroup.id;
        return String(msgGroupId) === String(groupId);
      })
    : selectedUser ? messages.filter(msg => {
        const msgSenderId = msg.sender?._id || msg.sender?.id || msg.sender;
        const msgRecipientId = msg.recipient || msg.recipient_id;
        const userId = selectedUser._id || selectedUser.id;
        const myIdStr = String(myId);
        const userIdStr = String(userId);
        const senderIdStr = String(msgSenderId);
        const recipientIdStr = String(msgRecipientId);
        
        // Message is between current user and selected user
        return (
          (senderIdStr === myIdStr && recipientIdStr === userIdStr) ||
          (senderIdStr === userIdStr && recipientIdStr === myIdStr)
        );
      }) : [];

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || (!selectedUser && !selectedGroup)) return;
    
    const messageContent = input.trim();
    setInput(''); // Clear input immediately for better UX
    
    // Optimistically add message to local state
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      id: `temp-${Date.now()}`,
      sender: { _id: myId, id: myId, username: myUsername },
      recipient: selectedUser ? (selectedUser._id || selectedUser.id) : null,
      groupId: selectedGroup ? (selectedGroup._id || selectedGroup.id) : null,
      content: messageContent,
      type: 'text',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      const response = await axios.post(`${API_URL}/api/message`, {
        token,
        recipientId: selectedUser ? (selectedUser._id || selectedUser.id) : null,
        groupId: selectedGroup ? (selectedGroup._id || selectedGroup.id) : null,
        content: messageContent,
        type: 'text'
      });
      
      // Replace temp message with real message from server
      if (response.data?.message) {
        setMessages(prev => {
          const filtered = prev.filter(m => m._id !== tempMessage._id && m.id !== tempMessage.id);
          return [...filtered, response.data.message];
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m._id !== tempMessage._id && m.id !== tempMessage.id));
      const errorMsg = err.response?.data?.error || err.message || 'Failed to send message';
      alert(errorMsg);
    }
  };

  // --- FILE UPLOAD LOGIC ---
  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Optional: Check size (10MB limit)
    if (file.size > 10 * 1024 * 1024) return alert("File too large (Max 10MB)");

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { fileUrl } = res.data;

      if (selectedUser) {
        try {
          await axios.post(`${API_URL}/api/message`, {
            token,
            recipientId: selectedUser._id || selectedUser.id,
            content: file.name,
            type: type, // 'image', 'audio', 'video'
            fileUrl: fileUrl
          });
        } catch (err) {
          console.error('Failed to send file message:', err);
          alert('Failed to send file');
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload file");
    }
  };

  // --- CALL LOGIC ---
  const callUser = (videoEnabled = false) => {
    if (!selectedUser) return;
    setIsVideoCall(videoEnabled);
    setCallActive(true);
    setCallStatus(`Calling ${selectedUser.username}...`);

    navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: true }).then((stream) => {
      setLocalStream(stream);
      
      // Set local stream to video element if video call
      if (videoEnabled && myVideo.current) {
        myVideo.current.srcObject = stream;
      }
      
      const peer = new RTCPeerConnection(peerConstraints);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          axios.post(`${API_URL}/api/calls/ice-candidate`, {
            token,
            to: selectedUser._id || selectedUser.id,
            candidate: event.candidate
          }).catch(err => console.error('Failed to send ICE candidate:', err));
        }
      };

      peer.ontrack = (event) => {
        if (videoEnabled && userVideo.current) {
          userVideo.current.srcObject = event.streams[0];
        } else if (!videoEnabled && userVideo.current) {
          // For audio-only, use audio element
          userVideo.current.srcObject = event.streams[0];
        }
        // Update status when media is received
        setCallStatus('Call in progress');
      };
      
      // Update status when connection is established
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setCallStatus('Call in progress');
        }
      };

      connectionRef.current = peer;

      peer.createOffer().then((offer) => {
        peer.setLocalDescription(offer);
        axios.post(`${API_URL}/api/calls/initiate`, {
          token,
          userToCall: selectedUser._id || selectedUser.id,
          signalData: offer,
          fromId: myId,
          fromUsername: myUsername,
          isVideo: videoEnabled
        }).catch(err => {
          console.error('Failed to initiate call:', err);
          alert('Failed to initiate call');
          endCallCleanup();
        });
      });
    }).catch(err => {
      console.error('Failed to get user media:', err);
      alert('Failed to access camera/microphone. Please check permissions.');
      endCallCleanup();
    });
  };

  const answerCall = () => {
    // Determine if this is a video call from the caller signal
    const videoCall = callerSignal?.isVideo || false;
    setIsVideoCall(videoCall);
    setCallActive(true);
    setReceivingCall(false);
    setCallStatus('Call in progress');

    navigator.mediaDevices.getUserMedia({ video: videoCall, audio: true }).then((stream) => {
      setLocalStream(stream);
      
      // Set local stream to video element if video call
      if (videoCall && myVideo.current) {
        myVideo.current.srcObject = stream;
      }
      
      const peer = new RTCPeerConnection(peerConstraints);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          axios.post(`${API_URL}/api/calls/ice-candidate`, {
            token,
            to: caller,
            candidate: event.candidate
          }).catch(err => console.error('Failed to send ICE candidate:', err));
        }
      };

      peer.ontrack = (event) => {
        if (videoCall && userVideo.current) {
          userVideo.current.srcObject = event.streams[0];
        } else if (!videoCall && userVideo.current) {
          userVideo.current.srcObject = event.streams[0];
        }
        // Update status when media is received
        setCallStatus('Call in progress');
      };
      
      // Update status when connection is established
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setCallStatus('Call in progress');
        }
      };

      connectionRef.current = peer;

      peer.setRemoteDescription(new RTCSessionDescription(callerSignal));
      peer.createAnswer().then((answer) => {
        peer.setLocalDescription(answer);
        axios.post(`${API_URL}/api/calls/answer`, {
          token,
          signal: answer,
          to: caller
        }).catch(err => {
          console.error('Failed to answer call:', err);
          alert('Failed to answer call');
          endCallCleanup();
        });
      });
    }).catch(err => {
      console.error('Failed to get user media:', err);
      alert('Failed to access camera/microphone. Please check permissions.');
      endCallCleanup();
    });
  };

  const leaveCall = () => {
    const otherId = selectedUser?._id || caller;
    if (otherId) {
      axios.post(`${API_URL}/api/calls/end`, {
        token,
        to: otherId
      }).catch(err => console.error('Failed to end call:', err));
    }
    endCallCleanup();
    // Note: To properly stop the mic, we would need to store the stream in a ref and call stream.getTracks().forEach(t => t.stop())
  };

  const renderMessageContent = (msg) => {
    switch(msg.type) {
        case 'image':
            return <img src={msg.fileUrl} alt="sent" style={{ maxWidth: '200px', borderRadius: '8px', cursor:'pointer' }} onClick={()=>window.open(msg.fileUrl, '_blank')} />;
        case 'audio':
            return <audio controls src={msg.fileUrl} style={{ width: '200px' }} />;
        case 'video':
            return <video controls src={msg.fileUrl} style={{ maxWidth: '200px', borderRadius: '8px' }} />;
        default:
            return <span>{msg.content}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', position: 'relative' }}>
      {/* Video/Audio Elements for WebRTC */}
      {isVideoCall && callActive ? (
        <>
          {/* Remote video (full screen) */}
          <video 
            ref={userVideo} 
            autoPlay 
            style={{ 
              position: 'absolute', 
              width: '100%', 
              height: '100%', 
              top: 0, 
              left: 0, 
              objectFit: 'cover', 
              zIndex: 998, 
              background: '#000' 
            }} 
          />
          {/* Local video preview (picture-in-picture) */}
          <video 
            ref={myVideo} 
            muted 
            autoPlay 
            style={{ 
              position: 'absolute', 
              width: '200px', 
              height: '150px', 
              bottom: '80px', 
              right: '20px', 
              borderRadius: '12px', 
              border: '3px solid #fff', 
              zIndex: 1000, 
              background: '#000',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }} 
          />
        </>
      ) : (
        <>
          <audio ref={myVideo} muted />
          <audio ref={userVideo} autoPlay />
        </>
      )}

      {/* Sidebar (User List) */}
      <div style={{ width: '260px', borderRight: '1px solid #ddd', background:'#f8f9fa', display:'flex', flexDirection:'column' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
          <button 
            onClick={() => { setActiveTab('friends'); setSelectedUser(null); setSelectedGroup(null); }}
            style={{ 
              flex: 1, padding: '10px', border: 'none', background: activeTab === 'friends' ? '#007bff' : 'transparent',
              color: activeTab === 'friends' ? 'white' : '#333', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Friends
          </button>
          <button 
            onClick={() => { setActiveTab('communities'); setSelectedUser(null); setSelectedGroup(null); }}
            style={{ 
              flex: 1, padding: '10px', border: 'none', background: activeTab === 'communities' ? '#007bff' : 'transparent',
              color: activeTab === 'communities' ? 'white' : '#333', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Groups
          </button>
          <button 
            onClick={() => { setActiveTab('all'); setSelectedUser(null); setSelectedGroup(null); }}
            style={{ 
              flex: 1, padding: '10px', border: 'none', background: activeTab === 'all' ? '#007bff' : 'transparent',
              color: activeTab === 'all' ? 'white' : '#333', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            All
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Friend Requests */}
          {activeTab === 'friends' && requests.length > 0 && (
            <div style={{ padding: '10px', background: '#fff3cd', borderBottom: '1px solid #ddd' }}>
              <div style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: '5px' }}>Friend Requests ({requests.length})</div>
              {requests.map(req => (
                <div key={req._id || req.id} style={{ padding: '5px', fontSize: '0.9em' }}>
                  {req.username || req.nickname}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      axios.post(`${API_URL}/api/friends/accept`, { token, fromUserId: req._id || req.id })
                        .then(() => {
                          setRequests(requests.filter(r => (r._id || r.id) !== (req._id || req.id)));
                          setFriends([...friends, req]);
                        })
                        .catch(err => alert('Failed to accept request'));
                    }}
                    style={{ marginLeft: '5px', padding: '2px 8px', fontSize: '0.8em', background: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Friends List */}
          {activeTab === 'friends' && friends.map(f => (
            <div 
              key={f._id || f.id} 
              onClick={() => { setSelectedUser(f); setSelectedGroup(null); }}
              style={{ 
                padding: '15px 20px', 
                cursor: 'pointer',
                background: selectedUser?._id === (f._id || f.id) ? '#e9ecef' : 'transparent',
                borderBottom: '1px solid #eee',
                fontWeight: selectedUser?._id === (f._id || f.id) ? 'bold' : 'normal'
              }}
            >
              {f.nickname || f.username}
            </div>
          ))}
          
          {/* Groups/Communities */}
          {activeTab === 'communities' && (
            <>
              {groups.length > 0 ? groups.map(g => (
                <div 
                  key={g._id || g.id} 
                  onClick={() => { setSelectedGroup(g); setSelectedUser(null); }}
                  style={{ 
                    padding: '15px 20px', 
                    cursor: 'pointer',
                    background: selectedGroup?._id === (g._id || g.id) ? '#e9ecef' : 'transparent',
                    borderBottom: '1px solid #eee',
                    fontWeight: selectedGroup?._id === (g._id || g.id) ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '1.2em' }}>👥</span>
                  <span>{g.name || 'Unnamed Group'}</span>
                </div>
              )) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  <div style={{ marginBottom: '10px', fontSize: '2em' }}>👥</div>
                  <div>No groups yet</div>
                  <div style={{ fontSize: '0.85em', marginTop: '5px', color: '#aaa' }}>Create a group to get started</div>
                </div>
              )}
            </>
          )}
          
          {/* All Users */}
          {activeTab === 'all' && (
            <>
              {users.length > 0 ? users.map(u => {
                const userId = u._id || u.id;
                const isFriend = friends.some(f => (f._id || f.id) === userId);
                const hasRequest = requests.some(r => (r._id || r.id) === userId);
                const canAdd = !isFriend && !hasRequest;
                
                return (
                  <div 
                    key={userId} 
                    onClick={() => { setSelectedUser(u); setSelectedGroup(null); }}
                    style={{ 
                      padding: '15px 20px', 
                      cursor: 'pointer',
                      background: selectedUser?._id === userId ? '#e9ecef' : 'transparent',
                      borderBottom: '1px solid #eee',
                      fontWeight: selectedUser?._id === userId ? 'bold' : 'normal'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>{u.nickname || u.username}</span>
                      {canAdd && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetUserId = u._id || u.id;
                            axios.post(`${API_URL}/api/friends/request`, { token, toUserId: targetUserId })
                              .then((res) => {
                                alert(res.data?.message || 'Friend request sent!');
                                // Refresh requests list
                                axios.get(`${API_URL}/api/my-network`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                }).then(res => {
                                  setRequests(res.data.requests || []);
                                }).catch(err => console.error('Failed to refresh network:', err));
                              })
                              .catch(err => {
                                const errorMsg = err.response?.data?.error || err.message || 'Failed to send request';
                                alert(errorMsg);
                                console.error('Add friend error:', err);
                              });
                          }}
                          style={{ 
                            marginLeft: '10px', 
                            padding: '4px 10px', 
                            fontSize: '0.85em', 
                            background: '#28a745', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          + Add Friend
                        </button>
                      )}
                      {hasRequest && (
                        <span style={{ fontSize: '0.75em', color: '#888', marginLeft: '10px' }}>Request sent</span>
                      )}
                      {isFriend && (
                        <span style={{ fontSize: '0.75em', color: '#28a745', marginLeft: '10px' }}>✓ Friend</span>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No users found</div>
              )}
            </>
          )}
          
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
        
        {/* Call Banner */}
        {(callActive || receivingCall) && (
          <div style={{ 
            background: isVideoCall ? '#28a745' : '#007bff', 
            color: '#fff', 
            padding: '15px 20px', 
            display:'flex', 
            justifyContent:'space-between', 
            alignItems:'center', 
            boxShadow:'0 2px 5px rgba(0,0,0,0.2)',
            zIndex: 1001,
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.5em' }}>{isVideoCall ? '📹' : '📞'}</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{callStatus}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {receivingCall && !callActive && (
                <>
                  <button 
                    onClick={answerCall} 
                    style={{ 
                      background: '#28a745', 
                      color:'white', 
                      border:'none', 
                      padding:'10px 20px', 
                      borderRadius:'6px', 
                      cursor:'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95em',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#218838'}
                    onMouseLeave={(e) => e.target.style.background = '#28a745'}
                  >
                    ✓ Answer
                  </button>
                  <button 
                    onClick={leaveCall} 
                    style={{ 
                      background: '#dc3545', 
                      color:'white', 
                      border:'none', 
                      padding:'10px 20px', 
                      borderRadius:'6px', 
                      cursor:'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95em',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#c82333'}
                    onMouseLeave={(e) => e.target.style.background = '#dc3545'}
                  >
                    ✕ Decline
                  </button>
                </>
              )}
              {callActive && (
                <button 
                  onClick={leaveCall} 
                  style={{ 
                    background: '#dc3545', 
                    color:'white', 
                    border:'none', 
                    padding:'10px 20px', 
                    borderRadius:'6px', 
                    cursor:'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.95em',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#c82333'}
                  onMouseLeave={(e) => e.target.style.background = '#dc3545'}
                >
                  ✕ End Call
                </button>
              )}
            </div>
          </div>
        )}

        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '15px 20px', borderBottom:'1px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff' }}>
                <h3 style={{ margin: 0 }}>{(selectedUser?.nickname || selectedUser?.username) || selectedGroup?.name}</h3>
                {!callActive && !receivingCall && selectedUser && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                      onClick={() => callUser(false)} 
                      style={{ 
                        background: 'transparent', 
                        border:'1px solid #007bff', 
                        color:'#007bff', 
                        padding:'8px 16px', 
                        borderRadius:'20px', 
                        cursor:'pointer', 
                        display:'flex', 
                        alignItems:'center', 
                        gap:'8px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#007bff'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '1.2em' }}>📞</span>
                      <span>Audio</span>
                    </button>
                    <button 
                      onClick={() => callUser(true)} 
                      style={{ 
                        background: 'transparent', 
                        border:'1px solid #28a745', 
                        color:'#28a745', 
                        padding:'8px 16px', 
                        borderRadius:'20px', 
                        cursor:'pointer', 
                        display:'flex', 
                        alignItems:'center', 
                        gap:'8px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#28a745'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '1.2em' }}>📹</span>
                      <span>Video</span>
                    </button>
                  </div>
                )}
            </div>
            
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f0f2f5' }}>
              {currentMessages.length === 0 && <div style={{textAlign:'center', color:'#888', marginTop:'20px'}}>No messages yet. Say hi!</div>}
              {currentMessages.map((msg, index) => (
                <div key={index} style={{ textAlign: msg.sender === myId ? 'right' : 'left', marginBottom: '15px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    background: msg.sender === myId ? '#007bff' : '#fff', 
                    color: msg.sender === myId ? '#fff' : '#000',
                    padding: '10px 15px', 
                    borderRadius: '18px', 
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    maxWidth: '70%',
                    textAlign: 'left'
                  }}>
                    {renderMessageContent(msg)}
                  </div>
                  <div style={{ fontSize:'0.75em', color:'#999', marginTop:'4px', padding:'0 5px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '15px', borderTop:'1px solid #ddd', background:'white' }}>
               {/* Media Toolbar */}
               <div style={{ display: 'flex', gap: '15px', paddingBottom: '10px', marginLeft:'5px' }}>
                <label style={{ cursor: 'pointer', color: '#666', display:'flex', alignItems:'center' }} title="Send Image">
                  <Icons.Image />
                  <input type="file" accept="image/*" hidden onChange={(e) => handleFileUpload(e, 'image')} />
                </label>
                <label style={{ cursor: 'pointer', color: '#666', display:'flex', alignItems:'center' }} title="Send Audio">
                  <Icons.Audio />
                  <input type="file" accept="audio/*" hidden onChange={(e) => handleFileUpload(e, 'audio')} />
                </label>
                <label style={{ cursor: 'pointer', color: '#666', display:'flex', alignItems:'center' }} title="Send Video">
                  <Icons.Video />
                  <input type="file" accept="video/*" hidden onChange={(e) => handleFileUpload(e, 'video')} />
                </label>
              </div>

              {/* Text Input Form */}
              <form onSubmit={sendMessage} style={{ display: 'flex', gap:'10px' }}>
                <input 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  style={{ flex: 1, padding: '12px', borderRadius:'20px', border:'1px solid #ddd', outline:'none' }} 
                  placeholder="Type a message..." 
                />
                <button type="submit" style={{ padding: '0 20px', borderRadius:'20px', background:'#007bff', color:'white', border:'none', fontWeight:'bold', cursor:'pointer' }}>
                    Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', color:'#888', background:'#f0f2f5'}}>
             <div style={{ fontSize: '4rem', opacity: 0.2 }}>💬</div>
             <h3>Select a conversation to start chatting</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
