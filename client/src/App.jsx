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
        <h2 style={{ margin: 0 }}>Chat App {user?.role === 'admin' && <span style={{fontSize:'0.6em', background:'red', padding:'2px 5px', borderRadius:'4px', verticalAlign:'middle'}}>ADMIN</span>}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
            {user?.role === 'admin' && (
                <button 
                    onClick={() => setView(view === 'chat' ? 'admin' : 'chat')}
                    style={{ background: view === 'admin' ? '#555' : '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
                >
                    {view === 'chat' ? 'Admin Panel' : 'Back to Chat'}
                </button>
            )}
            <button onClick={logout} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'admin' && user?.role === 'admin' ? (
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
        axios.get(`${API_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => setUsers(res.data))
        .catch(err => alert("Failed to fetch users"))
        .finally(() => setLoading(false));
    }, [token]);

    const deleteUser = async (id) => {
        if(!window.confirm("Are you sure? This will delete the user and their messages.")) return;
        try {
            await axios.delete(`${API_URL}/admin/users/${id}`, {
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

// --- CHAT DASHBOARD (Messaging, Calls, File Share) ---
function ChatDashboard({ token, myId, myUsername }) {
  // Chat State
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const eventSourceRef = useRef(null);

  // Call State
  const [callActive, setCallActive] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState(null);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  
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
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
  };

  // --- SERVER-SENT EVENTS (SSE) CONNECTION ---
  useEffect(() => {
    if (!token) return;

    // Connect to SSE endpoint with token as query parameter
    // (EventSource doesn't support custom headers, so we'll use query param)
    const eventSource = new EventSource(`${API_URL}/events?token=${encodeURIComponent(token)}`);

    eventSourceRef.current = eventSource;

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'receive_message') {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === 'call_user') {
          setReceivingCall(true);
          setCaller(data.from);
          setCallerSignal(data.signal);
          setCallStatus(`${data.name} is calling...`);
        } else if (data.type === 'call_accepted') {
          setCallStatus('Call Connected');
          if (connectionRef.current) {
            connectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          }
        } else if (data.type === 'ice_candidate') {
          if (connectionRef.current) {
            connectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } else if (data.type === 'end_call') {
          endCallCleanup();
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
        const response = await axios.get(`${API_URL}/calls/poll`, {
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
            setCallStatus('Call Connected');
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
    axios.get(`${API_URL}/users`).then(res => setUsers(res.data.filter(u => u._id !== myId)));
  }, [myId]);

  useEffect(() => {
    if (selectedUser) {
      axios.get(`${API_URL}/messages/${myId}/${selectedUser._id}`).then(res => setMessages(res.data));
    }
  }, [selectedUser, myId]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  // --- MESSAGE LOGIC ---
  const currentMessages = messages.filter(msg => 
    (selectedUser && msg.sender === selectedUser._id && msg.recipient === myId) ||
    (selectedUser && msg.sender === myId && msg.recipient === selectedUser._id)
  );

  const sendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() && selectedUser) {
      try {
        const response = await axios.post(`${API_URL}/messages/send`, {
          recipientId: selectedUser._id,
          content: input,
          type: 'text'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInput('');
        // Message will be received via SSE, but we can also add it optimistically
        // The SSE handler will add it to the messages array
      } catch (err) {
        console.error('Failed to send message:', err);
        const errorMsg = err.response?.data?.error || err.message || 'Failed to send message';
        alert(errorMsg);
      }
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
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { fileUrl } = res.data;

      if (selectedUser) {
        try {
          await axios.post(`${API_URL}/messages/send`, {
            recipientId: selectedUser._id,
            content: file.name,
            type: type, // 'image', 'audio', 'video'
            fileUrl: fileUrl
          }, {
            headers: { Authorization: `Bearer ${token}` }
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
  const callUser = () => {
    if (!selectedUser) return;
    setCallActive(true);
    setCallStatus(`Calling ${selectedUser.username}...`);

    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) => {
      const peer = new RTCPeerConnection(peerConstraints);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          axios.post(`${API_URL}/calls/ice-candidate`, {
            to: selectedUser._id,
            candidate: event.candidate
          }, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(err => console.error('Failed to send ICE candidate:', err));
        }
      };

      peer.ontrack = (event) => {
        userVideo.current.srcObject = event.streams[0];
      };

      connectionRef.current = peer;

      peer.createOffer().then((offer) => {
        peer.setLocalDescription(offer);
        axios.post(`${API_URL}/calls/initiate`, {
          userToCall: selectedUser._id,
          signalData: offer,
          fromId: myId,
          fromUsername: myUsername
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => {
          console.error('Failed to initiate call:', err);
          alert('Failed to initiate call');
        });
      });
    });
  };

  const answerCall = () => {
    setCallActive(true);
    setReceivingCall(false);
    setCallStatus('Call Connected');

    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) => {
      const peer = new RTCPeerConnection(peerConstraints);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          axios.post(`${API_URL}/calls/ice-candidate`, {
            to: caller,
            candidate: event.candidate
          }, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(err => console.error('Failed to send ICE candidate:', err));
        }
      };

      peer.ontrack = (event) => {
        userVideo.current.srcObject = event.streams[0];
      };

      connectionRef.current = peer;

      peer.setRemoteDescription(new RTCSessionDescription(callerSignal));
      peer.createAnswer().then((answer) => {
        peer.setLocalDescription(answer);
        axios.post(`${API_URL}/calls/answer`, {
          signal: answer,
          to: caller
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => {
          console.error('Failed to answer call:', err);
          alert('Failed to answer call');
        });
      });
    });
  };

  const leaveCall = () => {
    const otherId = selectedUser?._id || caller;
    if (otherId) {
      axios.post(`${API_URL}/calls/end`, {
        to: otherId
      }, {
        headers: { Authorization: `Bearer ${token}` }
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
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Invisible Audio Elements for WebRTC */}
      <audio ref={myVideo} muted />
      <audio ref={userVideo} autoPlay />

      {/* Sidebar (User List) */}
      <div style={{ width: '260px', borderRight: '1px solid #ddd', background:'#f8f9fa', display:'flex', flexDirection:'column' }}>
        <h3 style={{ padding: '20px', margin: 0, borderBottom: '1px solid #ddd' }}>Contacts</h3>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {users.map(u => (
            <div 
              key={u._id} 
              onClick={() => setSelectedUser(u)}
              style={{ 
                padding: '15px 20px', 
                cursor: 'pointer',
                background: selectedUser?._id === u._id ? '#e9ecef' : 'transparent',
                borderBottom: '1px solid #eee',
                fontWeight: selectedUser?._id === u._id ? 'bold' : 'normal'
              }}
            >
              {u.username}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
        
        {/* Call Banner */}
        {(callActive || receivingCall) && (
          <div style={{ background: '#333', color: '#fff', padding: '10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 5px rgba(0,0,0,0.2)' }}>
            <span style={{ fontWeight: 'bold' }}>📞 {callStatus}</span>
            <div>
              {receivingCall && !callActive && (
                <button onClick={answerCall} style={{ background: '#28a745', color:'white', border:'none', padding:'8px 16px', borderRadius:'4px', marginRight: '10px', cursor:'pointer' }}>Answer</button>
              )}
              <button onClick={leaveCall} style={{ background: '#dc3545', color:'white', border:'none', padding:'8px 16px', borderRadius:'4px', cursor:'pointer' }}>End Call</button>
            </div>
          </div>
        )}

        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '15px 20px', borderBottom:'1px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff' }}>
                <h3 style={{ margin: 0 }}>{selectedUser.username}</h3>
                {!callActive && !receivingCall && (
                  <button onClick={callUser} style={{ background: 'transparent', border:'1px solid #007bff', color:'#007bff', padding:'6px 12px', borderRadius:'20px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                     📞 Call
                  </button>
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
