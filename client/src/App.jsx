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
  const [isMobile, setIsMobile] = useState(() => {
    // Safe check for window.innerWidth (might not be available during SSR)
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  // Handle mobile screen size detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100%',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ 
        background: '#333', 
        color: '#fff', 
        padding: '10px 20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '10px',
        flexShrink: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '1 1 auto', minWidth: 0 }}>
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
                onClick={() => setView('chat')}
                style={{ background: view === 'chat' ? '#555' : '#007bff', color: 'white', border: 'none', padding: isMobile ? '10px 12px' : '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: isMobile ? '14px' : '16px', minHeight: '44px' }}
            >
                Chat
            </button>
            <button 
                onClick={() => setView('profile')}
                style={{ background: view === 'profile' ? '#555' : '#007bff', color: 'white', border: 'none', padding: isMobile ? '10px 12px' : '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: isMobile ? '14px' : '16px', minHeight: '44px' }}
            >
                Profile
            </button>
            {user?.role === 'admin' && (
                <button 
                    onClick={() => setView('admin')}
                    style={{ background: view === 'admin' ? '#555' : '#007bff', color: 'white', border: 'none', padding: isMobile ? '10px 12px' : '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: isMobile ? '14px' : '16px', minHeight: '44px' }}
                >
                    Admin
                </button>
            )}
            <button onClick={logout} style={{ background: '#dc3545', color: 'white', border: 'none', padding: isMobile ? '10px 12px' : '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: isMobile ? '14px' : '16px', minHeight: '44px' }}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // For mobile sidebar toggle
  const [isMobile, setIsMobile] = useState(() => {
    // Safe check for window.innerWidth (might not be available during SSR)
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });
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
  const [showCallEnding, setShowCallEnding] = useState(false); // Track if call is ending to keep UI visible
  const callEndedIntentionallyRef = useRef(false); // Track if call was ended intentionally (not a connection failure)
  const callTargetRef = useRef(null); // Store the target user ID for the current call (for both caller and receiver)
  
  // Refs
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const messagesEndRef = useRef(null); // For auto-scrolling
  const callPollIntervalRef = useRef(null);
  const callActiveRef = useRef(false);
  const receivingCallRef = useRef(false);

  // WebRTC ICE Servers configuration
  // STUN servers help discover public IP, TURN servers relay traffic when direct connection fails
  const peerConstraints = {
    iceServers: [
      // Google's public STUN servers (multiple for redundancy)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Additional STUN servers
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipbuster.com' },
      // Free TURN servers with authentication
      // Metered.ca TURN servers
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:relay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:relay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:relay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Additional TURN servers (backup options)
      {
        urls: 'turn:openrelay.metered.ca:80?transport=udp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:3478?transport=udp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:3478?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    // ICE candidate gathering configuration
    iceCandidatePoolSize: 10,
    // Additional configuration for better connectivity
    iceTransportPolicy: 'all' // Try both relay and non-relay candidates
  };

  // Helper function to cleanup call state
  const endCallCleanup = (statusMessage = '') => {
    // Mark that call was ended intentionally to prevent connection state handlers from overriding
    // Set this FIRST before any other operations
    callEndedIntentionallyRef.current = true;
    console.log('📞 ========================================');
    console.log('📞 endCallCleanup called with status:', statusMessage);
    console.log('📞 Call marked as intentionally ended - handlers will be ignored');
    console.log('📞 ========================================');
    
    // Remove event handlers from connection BEFORE closing to prevent state change events
    // This prevents handlers from firing when connection is closed
    if (connectionRef.current) {
      console.log('📞 Removing connection event handlers before closing to prevent status override');
      try {
        connectionRef.current.onconnectionstatechange = null;
        connectionRef.current.oniceconnectionstatechange = null;
        connectionRef.current.onicegatheringstatechange = null;
        connectionRef.current.ontrack = null;
        connectionRef.current.onicecandidate = null;
        console.log('📞 All connection handlers removed successfully');
      } catch (e) {
        console.warn('📞 Error removing handlers:', e);
      }
    } else {
      console.log('📞 No connectionRef.current to clean up');
    }
    
    // If there's a status message, show it briefly before cleaning up
    if (statusMessage) {
      console.log('📞 Setting call ending status:', statusMessage);
      setCallStatus(statusMessage);
      setShowCallEnding(true); // Keep UI visible
      
      // Stop media tracks immediately but keep UI visible
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
      
      // Close connection AFTER removing handlers
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
      
      // Clean up state after showing message
      setTimeout(() => {
        console.log('📞 Cleaning up call state after status message');
        // Reset refs first
        callActiveRef.current = false;
        receivingCallRef.current = false;
        // Then reset state
        setCallActive(false);
        setReceivingCall(false);
        setCallStatus('');
        setCaller(null);
        setIsVideoCall(false);
        setShowCallEnding(false);
        callEndedIntentionallyRef.current = false; // Reset flag
        callTargetRef.current = null; // Clear stored target
        console.log('📞 Refs reset - ready for new calls');
      }, 3000); // Show message for 3 seconds
    } else {
      // Immediate cleanup if no message
      // Reset refs first
      callActiveRef.current = false;
      receivingCallRef.current = false;
      // Then reset state
      setCallActive(false);
      setReceivingCall(false);
      setCallStatus('');
      setCaller(null);
      setIsVideoCall(false);
      setShowCallEnding(false);
      callEndedIntentionallyRef.current = false; // Reset flag
      callTargetRef.current = null; // Clear stored target
      console.log('📞 Refs reset - ready for new calls');
      
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
      
      // Close connection AFTER removing handlers
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
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
        // Detect if we're on Vercel (serverless) - SSE doesn't work there
        const isVercel = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('vercel.com');
        
        // FOR TESTING: Set to true to force polling mode on local machine
        // This allows you to test polling functionality without deploying to Vercel
        const FORCE_POLLING_MODE = false; // Change to false for normal SSE operation
        
        if (isVercel || FORCE_POLLING_MODE) {
          console.log('⚠️ SSE disabled - using polling only', 
            isVercel ? '(Vercel detected)' : '(FORCE_POLLING_MODE enabled for testing)');
          // Don't attempt SSE, rely on polling instead
          return;
        }
        
        // Connect to SSE endpoint with token as query parameter
        // (EventSource doesn't support custom headers, so we'll use query param)
        // Use relative path in development to go through Vite proxy, absolute in production
        const sseUrl = import.meta.env.DEV 
          ? `/api/events?token=${encodeURIComponent(token)}`
          : `${API_URL}/api/events?token=${encodeURIComponent(token)}`;
        console.log('📡 Connecting to SSE endpoint:', sseUrl.replace(/token=[^&]+/, 'token=***'));
        const eventSource = new EventSource(sseUrl);

        eventSourceRef.current = eventSource;
        
        eventSource.onopen = () => {
          console.log('✅ SSE connection opened');
          reconnectAttempts = 0; // Reset on successful connection
        };
        
        eventSource.onerror = (err) => {
          console.error('❌ SSE connection error:', err);
          console.error('   EventSource readyState:', eventSource.readyState);
          console.error('   EventSource URL:', eventSource.url);
          
          // If SSE fails (e.g., on Vercel), close and rely on polling
          if (eventSource.readyState === EventSource.CLOSED) {
            console.log('⚠️ SSE connection closed - will rely on polling for real-time updates');
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
          }
          
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
            console.log('📥 Raw SSE event received:', event.data?.substring(0, 200));
            
            // Skip keepalive messages
            if (event.data === ': keepalive' || event.data.startsWith(': ')) {
              console.log('📥 Skipping keepalive message');
              return;
            }
            
            const data = JSON.parse(event.data);
            console.log('📥 Parsed SSE data type:', data.type);
            
            // Log all event types for debugging - especially end_call and receive_message
            if (data.type === 'end_call') {
              console.log('🔴🔴🔴 RAW END_CALL EVENT DETECTED IN PARSED DATA 🔴🔴🔴');
              console.log('🔴 Full data object:', JSON.stringify(data, null, 2));
            }
            if (data.type === 'receive_message') {
              console.log('📨📨📨 RAW RECEIVE_MESSAGE EVENT DETECTED IN PARSED DATA 📨📨📨');
              console.log('📨 Full data object:', JSON.stringify(data, null, 2));
            }
            
            if (data.type === 'receive_message') {
              console.log('📨 Received SSE message event:', data);
              const newMessage = data.message || data.data;
              console.log('📨 Extracted message:', newMessage);
              
              if (newMessage) {
                // Ensure message has required fields - match the format from Message.formatMessage
                const formattedMessage = {
                  _id: newMessage._id || newMessage.id,
                  id: newMessage.id || newMessage._id,
                  sender: newMessage.sender || { 
                    _id: newMessage.sender_id || newMessage.sender?._id, 
                    id: newMessage.sender_id || newMessage.sender?.id,
                    username: newMessage.sender?.username || newMessage.sender_username,
                    nickname: newMessage.sender?.nickname || newMessage.sender_nickname,
                    avatar: newMessage.sender?.avatar || newMessage.sender_avatar
                  },
                  recipient: newMessage.recipient || newMessage.recipient_id,
                  recipient_id: newMessage.recipient_id || newMessage.recipient,
                  groupId: newMessage.groupId || newMessage.group_id,
                  group_id: newMessage.group_id || newMessage.groupId,
                  content: newMessage.content || '',
                  type: newMessage.type || 'text',
                  fileUrl: newMessage.fileUrl || '',
                  timestamp: newMessage.timestamp || new Date().toISOString()
                };
                
                console.log('📨 Formatted message:', formattedMessage);
                console.log('📨 Current myId:', myId);
                console.log('📨 Selected user:', selectedUser?._id || selectedUser?.id);
                console.log('📨 Selected group:', selectedGroup?._id || selectedGroup?.id);
                console.log('📨 Message recipient:', formattedMessage.recipient);
                console.log('📨 Message sender ID:', formattedMessage.sender?._id || formattedMessage.sender?.id);
                
                setMessages((prev) => {
                  // Avoid duplicates
                  const exists = prev.some(m => {
                    const msgId = m._id || m.id;
                    const newMsgId = formattedMessage._id || formattedMessage.id;
                    return String(msgId) === String(newMsgId);
                  });
                  if (exists) {
                    console.log('⚠️ Duplicate message ignored (ID:', formattedMessage._id || formattedMessage.id, ')');
                    return prev;
                  }
                  
                  // Check if this message belongs to the currently selected conversation
                  const belongsToCurrentConversation = 
                    (selectedUser && (
                      (String(formattedMessage.sender?._id || formattedMessage.sender?.id) === String(myId) && 
                       String(formattedMessage.recipient || formattedMessage.recipient_id) === String(selectedUser._id || selectedUser.id)) ||
                      (String(formattedMessage.sender?._id || formattedMessage.sender?.id) === String(selectedUser._id || selectedUser.id) && 
                       String(formattedMessage.recipient || formattedMessage.recipient_id) === String(myId))
                    )) ||
                    (selectedGroup && String(formattedMessage.groupId || formattedMessage.group_id) === String(selectedGroup._id || selectedGroup.id));
                  
                  console.log('✅ Adding new message to list. Previous count:', prev.length, 'New count:', prev.length + 1);
                  console.log('📨 Message belongs to current conversation:', belongsToCurrentConversation);
                  console.log('📨 Message details:', {
                    senderId: formattedMessage.sender?._id || formattedMessage.sender?.id,
                    recipientId: formattedMessage.recipient || formattedMessage.recipient_id,
                    myId: myId,
                    selectedUserId: selectedUser?._id || selectedUser?.id,
                    content: formattedMessage.content?.substring(0, 30)
                  });
                  
                  // Always add the message to the array (it will be filtered by currentMessages)
                  // This ensures messages are available when switching conversations
                  const updated = [...prev, formattedMessage];
                  
                  // Sort by timestamp to maintain chronological order
                  updated.sort((a, b) => {
                    const timeA = new Date(a.timestamp || 0).getTime();
                    const timeB = new Date(b.timestamp || 0).getTime();
                    return timeA - timeB;
                  });
                  
                  return updated;
                });
              } else {
                console.warn('⚠️ Received message event but message data is missing. Full event:', data);
              }
            } else if (data.type === 'call_user') {
              // Only ignore if we're actually in an active call (connection exists) or actively receiving (with caller)
              // Be lenient - allow new calls if previous call ended
              const hasActiveConnection = connectionRef.current !== null && callActive;
              const isActuallyReceiving = receivingCall && caller !== null && !callActive;
              
              console.log('📞 RECEIVER: Checking if should process call_user event:', {
                callActive,
                receivingCall,
                caller,
                hasConnection: connectionRef.current !== null,
                hasActiveConnection,
                isActuallyReceiving,
                callStatus
              });
              
              if (hasActiveConnection) {
                console.log('📞 RECEIVER: Ignoring - active call in progress');
                return;
              }
              
              if (isActuallyReceiving) {
                console.log('📞 RECEIVER: Ignoring - already receiving a call');
                return;
              }
              
              // If we get here, we should process the call
              console.log('📞 RECEIVER: ✅ Will process call_user event - no active call detected');
              
              console.log('📞 RECEIVER: Processing incoming call_user event');
              console.log('📞 RECEIVER: Full call_user data:', JSON.stringify(data, null, 2));
              
              const callerId = data.from;
              const callerName = data.name || data.signal?.name || 'Someone';
              
              // Store caller ID as target for later use when ending call
              callTargetRef.current = callerId;
              console.log('📞 RECEIVER: Storing caller ID as target:', callerId, 'name:', callerName);
              
              // Set refs immediately to prevent race conditions
              receivingCallRef.current = true;
              setReceivingCall(true);
              setCaller(callerId);
              setCallerSignal(data.signal);
              const statusMessage = `${callerName} is calling...`;
              setCallStatus(statusMessage);
              console.log('📞 RECEIVER: Call received via SSE, status set to:', statusMessage);
              console.log('📞 RECEIVER: State updated - receivingCall:', true, 'caller:', callerId);
              console.log('📞 RECEIVER: Call banner should be visible:', { callActive, receivingCall: true, showCallEnding });
            } else if (data.type === 'call_accepted') {
              setCallStatus('Call in progress');
              if (connectionRef.current) {
                connectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
              }
            } else if (data.type === 'ice_candidate') {
              if (connectionRef.current && data.candidate) {
                // ICE candidate can be null when gathering is complete - skip it
                if (data.candidate === null || data.candidate === undefined) {
                  console.log('📞 ICE candidate is null (gathering complete), skipping');
                  return;
                }
                // Validate candidate has required fields
                if (!data.candidate.candidate && !data.candidate.sdpMid && data.candidate.sdpMLineIndex === undefined) {
                  console.warn('⚠️ Invalid ICE candidate format:', data.candidate);
                  return;
                }
                try {
                  connectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (err) {
                  console.error('❌ Error adding ICE candidate:', err, 'Candidate:', data.candidate);
                }
              }
            } else if (data.type === 'end_call') {
              // Log immediately when event is received
              console.log('🔴🔴🔴 END_CALL EVENT RECEIVED VIA SSE 🔴🔴🔴');
              console.log('📞 Full event data:', JSON.stringify(data, null, 2));
              
              const terminatedBy = data.from || data.data?.from || data.message?.from;
              const isCurrentlyCaller = callActive && !receivingCall;
              const isCurrentlyReceiver = receivingCall && !callActive;
              const role = isCurrentlyCaller ? 'CALLER' : (isCurrentlyReceiver ? 'RECEIVER' : 'USER');
              
              console.log('📞 ========================================');
              console.log(`📞 ${role}: Received end_call event via SSE`);
              console.log('📞 Call terminated by other party:', terminatedBy);
              console.log('📞 Current call state - callActive:', callActive, 'receivingCall:', receivingCall);
              console.log('📞 Full data object:', data);
              console.log('📞 ========================================');
              
              // CRITICAL: Set flag and state IMMEDIATELY to prevent any handlers from firing
              callEndedIntentionallyRef.current = true;
              setShowCallEnding(true);
              
              // Determine appropriate status message based on current role
              let statusMessage = 'Call ended by other party';
              if (isCurrentlyReceiver && !callActive) {
                statusMessage = 'Call declined by caller';
              } else if (isCurrentlyCaller) {
                statusMessage = 'Call ended by other party';
              }
              setCallStatus(statusMessage);
              
              // Remove handlers BEFORE any cleanup to prevent race conditions
              if (connectionRef.current) {
                console.log(`📞 ${role}: Removing all connection handlers immediately to prevent status override`);
                try {
                  connectionRef.current.onconnectionstatechange = null;
                  connectionRef.current.oniceconnectionstatechange = null;
                  connectionRef.current.onicegatheringstatechange = null;
                  connectionRef.current.ontrack = null;
                  connectionRef.current.onicecandidate = null;
                  console.log(`📞 ${role}: All handlers removed successfully`);
                } catch (e) {
                  console.warn(`📞 ${role}: Error removing handlers:`, e);
                }
              } else {
                console.log(`📞 ${role}: No connectionRef.current to clean up`);
              }
              
              // Now call cleanup
              console.log(`📞 ${role}: Calling endCallCleanup with status "${statusMessage}"`);
              endCallCleanup(statusMessage);
            } else {
              console.log('📥 Received non-message SSE event:', data.type);
            }
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };
      } catch (err) {
        console.error('Failed to create SSE connection:', err);
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimeout = setTimeout(() => {
            connectSSE();
          }, delay);
        }
      }
    };

    connectSSE();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (callPollIntervalRef.current) {
        clearInterval(callPollIntervalRef.current);
      }
    };
  }, [token]);

  // Poll for messages when SSE is not available
  useEffect(() => {
    if (!token || !selectedUser) return;
    
    // Only poll for messages if SSE is not available
    if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
      return; // SSE is working, no need to poll
    }
    
    let lastMessageId = null;
    const pollMessages = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/messages/${myId}/${selectedUser._id || selectedUser.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const fetchedMessages = response.data || [];
        if (fetchedMessages.length > 0) {
          const latestMessage = fetchedMessages[fetchedMessages.length - 1];
          const latestId = latestMessage.id || latestMessage._id;
          
          // Only update if we have a new message
          if (lastMessageId && latestId !== lastMessageId) {
            console.log('📨 New message detected via polling:', latestId);
            setMessages(prev => {
              // Check if message already exists
              const exists = prev.some(m => (m.id || m._id) === latestId);
              if (!exists) {
                return [...prev, latestMessage];
              }
              return prev;
            });
          }
          lastMessageId = latestId;
        }
      } catch (err) {
        console.error('Error polling messages:', err);
      }
    };
    
    // Poll messages every 3 seconds when SSE is not available
    const messagePollInterval = setInterval(pollMessages, 3000);
    console.log('📨 Message polling started (SSE not available)');
    
    return () => {
      clearInterval(messagePollInterval);
    };
  }, [token, selectedUser, myId]);

  // Poll for call signals (backup method if SSE doesn't work for calls)
  // This is critical for Vercel deployment where SSE doesn't work
  useEffect(() => {
    if (!token) return;

    // Check if SSE is available - if not, we MUST use polling
    const isVercel = window.location.hostname.includes('vercel.app') || 
                     window.location.hostname.includes('vercel.com');
    const FORCE_POLLING_MODE = false; // Set to true for local testing
    const sseAvailable = eventSourceRef.current && 
                         eventSourceRef.current.readyState === EventSource.OPEN;
    
    console.log('📞 Call polling check:', {
      isVercel,
      FORCE_POLLING_MODE,
      sseAvailable,
      sseState: eventSourceRef.current?.readyState,
      willPoll: !sseAvailable || isVercel || FORCE_POLLING_MODE
    });
    
    // Only poll if SSE is not available (Vercel or forced polling mode)
    if (sseAvailable && !isVercel && !FORCE_POLLING_MODE) {
      console.log('📞 SSE available, skipping call polling');
      return;
    }

    console.log('📞 Starting call polling (SSE not available or on Vercel)');

    const pollCalls = async () => {
      try {
        console.log('📞 Polling for call signals...');
        const response = await axios.get(`${API_URL}/api/calls/poll`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const signals = response.data;
        if (signals && signals.length > 0) {
          console.log(`📞 ✅ Polled ${signals.length} call signal(s):`, signals.map(s => s.type));
        } else {
          // Log occasionally to confirm polling is running (every 10th poll)
          if (Math.random() < 0.1) {
            console.log('📞 Poll completed (no signals)');
          }
        }
        
        signals.forEach(signal => {
          if (signal.type === 'call_user') {
            // Only ignore if we're actually in an active call (connection exists) or actively receiving (with caller)
            // Be lenient - allow new calls if previous call ended
            const hasActiveConnection = connectionRef.current !== null && callActive;
            const isActuallyReceiving = receivingCall && caller !== null && !callActive;
            
            console.log('📞 RECEIVER: Checking if should process call_user event (poll):', {
              callActive,
              receivingCall,
              caller,
              hasConnection: connectionRef.current !== null,
              hasActiveConnection,
              isActuallyReceiving,
              callStatus
            });
            
            if (hasActiveConnection) {
              console.log('📞 RECEIVER: Ignoring (poll) - active call in progress');
              return;
            }
            
            if (isActuallyReceiving) {
              console.log('📞 RECEIVER: Ignoring (poll) - already receiving a call');
              return;
            }
            
            // If we get here, we should process the call
            console.log('📞 RECEIVER: ✅ Will process call_user event (poll) - no active call detected');
            
            console.log('📞 RECEIVER: Processing incoming call_user event (poll)');
            console.log('📞 RECEIVER: Full call_user signal:', JSON.stringify(signal, null, 2));
            
            const callerId = signal.data.from;
            const callerName = signal.data.name || signal.data.signal?.name || 'Someone';
            
            // Store caller ID as target for later use when ending call
            callTargetRef.current = callerId;
            console.log('📞 RECEIVER: Storing caller ID as target (poll):', callerId, 'name:', callerName);
            
            // Set refs immediately to prevent race conditions
            receivingCallRef.current = true;
            setReceivingCall(true);
            setCaller(callerId);
            setCallerSignal(signal.data.signal);
            const statusMessage = `${callerName} is calling...`;
            setCallStatus(statusMessage);
            console.log('📞 RECEIVER: Call received via poll, status set to:', statusMessage);
            console.log('📞 RECEIVER: State updated - receivingCall:', true, 'caller:', callerId);
            console.log('📞 RECEIVER: Call banner should be visible:', { callActive, receivingCall: true, showCallEnding });
          } else if (signal.type === 'call_accepted') {
            setCallStatus('Call in progress');
            if (connectionRef.current) {
              connectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
            }
          } else if (signal.type === 'ice_candidate') {
            if (connectionRef.current && signal.data) {
              // ICE candidate can be null when gathering is complete - skip it
              if (signal.data === null || signal.data === undefined) {
                console.log('📞 ICE candidate is null (gathering complete), skipping');
                return;
              }
              // Validate candidate has required fields
              if (!signal.data.candidate && !signal.data.sdpMid && signal.data.sdpMLineIndex === undefined) {
                console.warn('⚠️ Invalid ICE candidate format:', signal.data);
                return;
              }
              try {
                connectionRef.current.addIceCandidate(new RTCIceCandidate(signal.data));
                console.log('📞 ICE candidate added via polling');
              } catch (err) {
                console.error('❌ Error adding ICE candidate:', err, 'Candidate:', signal.data);
              }
            }
          } else if (signal.type === 'end_call') {
            // Log immediately when event is received
            console.log('🔴🔴🔴 END_CALL EVENT RECEIVED VIA POLL 🔴🔴🔴');
            console.log('📞 Full signal data:', JSON.stringify(signal, null, 2));
            
            const terminatedBy = signal.data?.from;
            const isCurrentlyCaller = callActive && !receivingCall;
            const isCurrentlyReceiver = receivingCall && !callActive;
            const role = isCurrentlyCaller ? 'CALLER' : (isCurrentlyReceiver ? 'RECEIVER' : 'USER');
            
            console.log('📞 ========================================');
            console.log(`📞 ${role}: Received end_call event via POLL`);
            console.log('📞 Call terminated by other party:', terminatedBy);
            console.log('📞 Current call state - callActive:', callActive, 'receivingCall:', receivingCall);
            console.log('📞 Full signal object:', signal);
            console.log('📞 ========================================');
            
            // CRITICAL: Set flag and state IMMEDIATELY to prevent any handlers from firing
            callEndedIntentionallyRef.current = true;
            setShowCallEnding(true);
            
            // Determine appropriate status message based on current role
            let statusMessage = 'Call ended by other party';
            if (isCurrentlyReceiver && !callActive) {
              statusMessage = 'Call declined by caller';
            } else if (isCurrentlyCaller) {
              statusMessage = 'Call ended by other party';
            }
            setCallStatus(statusMessage);
            
            // Remove handlers BEFORE any cleanup to prevent race conditions
            if (connectionRef.current) {
              console.log(`📞 ${role}: Removing all connection handlers immediately (poll) to prevent status override`);
              try {
                connectionRef.current.onconnectionstatechange = null;
                connectionRef.current.oniceconnectionstatechange = null;
                connectionRef.current.onicegatheringstatechange = null;
                connectionRef.current.ontrack = null;
                connectionRef.current.onicecandidate = null;
                console.log(`📞 ${role}: All handlers removed successfully (poll)`);
              } catch (e) {
                console.warn(`📞 ${role}: Error removing handlers (poll):`, e);
              }
            } else {
              console.log(`📞 ${role}: No connectionRef.current to clean up (poll)`);
            }
            
            // Now call cleanup
            console.log(`📞 ${role}: Calling endCallCleanup (poll) with status "${statusMessage}"`);
            endCallCleanup(statusMessage);
          }
        });
      } catch (err) {
        console.error('Error polling calls:', err);
      }
    };

    // Dynamic polling interval: faster during active calls (500ms), slower otherwise (2s)
    // This ensures WebRTC signaling is fast enough for ICE candidates
    const updatePollInterval = () => {
      if (callPollIntervalRef.current) {
        clearInterval(callPollIntervalRef.current);
      }
      
      // Poll faster when call is active or receiving (use refs to get latest values)
      const interval = (callActiveRef.current || receivingCallRef.current) ? 500 : 2000;
      console.log(`📞 Setting call polling interval to ${interval}ms (callActive: ${callActiveRef.current}, receivingCall: ${receivingCallRef.current})`);
      callPollIntervalRef.current = setInterval(pollCalls, interval);
    };

    // Initial poll
    pollCalls();
    
    // Set initial interval
    updatePollInterval();

    // Update interval when call state changes (check every second)
    const intervalCheck = setInterval(() => {
      updatePollInterval();
    }, 1000);

    return () => {
      if (callPollIntervalRef.current) {
        clearInterval(callPollIntervalRef.current);
      }
      if (intervalCheck) {
        clearInterval(intervalCheck);
      }
    };
  }, [token]);

  // Sync call state refs with state values for polling interval adjustment
  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    receivingCallRef.current = receivingCall;
  }, [receivingCall]);

  // Handle mobile screen size detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile when selecting a user
      if (mobile && selectedUser) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedUser]);

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

  // Fetch initial messages when conversation changes
  useEffect(() => {
    if (selectedUser && myId) {
      const userId = selectedUser._id || selectedUser.id;
      console.log(`📥 Fetching messages for conversation with user ${userId}`);
      axios.get(`${API_URL}/api/messages/${myId}/${userId}`)
        .then(res => {
          const fetchedMessages = res.data || [];
          console.log(`📥 Fetched ${fetchedMessages.length} messages from API`);
          
          // Debug: Log first message structure
          if (fetchedMessages.length > 0) {
            console.log('📥 First fetched message structure:', {
              message: fetchedMessages[0],
              sender: fetchedMessages[0].sender,
              sender_id: fetchedMessages[0].sender_id,
              myId: myId
            });
          }
          
          // Merge with existing messages instead of replacing
          // This preserves SSE messages that came in before the fetch completed
          setMessages(prev => {
            // Create a map of existing messages by ID
            const existingMap = new Map();
            prev.forEach(msg => {
              const id = String(msg._id || msg.id);
              existingMap.set(id, msg);
            });
            
            // Add fetched messages
            fetchedMessages.forEach(msg => {
              const id = String(msg._id || msg.id);
              if (!existingMap.has(id)) {
                existingMap.set(id, msg);
              }
            });
            
            // Convert back to array and sort by timestamp
            const merged = Array.from(existingMap.values());
            merged.sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeA - timeB;
            });
            
            console.log(`📥 Merged messages: ${prev.length} existing + ${fetchedMessages.length} fetched = ${merged.length} total`);
            return merged;
          });
        })
        .catch(err => console.error('Failed to fetch messages:', err));
    } else if (selectedGroup) {
      const groupId = selectedGroup._id || selectedGroup.id;
      console.log(`📥 Fetching messages for group ${groupId}`);
      axios.get(`${API_URL}/api/groups/${groupId}/messages`)
        .then(res => {
          const fetchedMessages = res.data || [];
          console.log(`📥 Fetched ${fetchedMessages.length} group messages from API`);
          // Merge with existing messages
          setMessages(prev => {
            const existingMap = new Map();
            prev.forEach(msg => {
              const id = String(msg._id || msg.id);
              existingMap.set(id, msg);
            });
            
            fetchedMessages.forEach(msg => {
              const id = String(msg._id || msg.id);
              if (!existingMap.has(id)) {
                existingMap.set(id, msg);
              }
            });
            
            const merged = Array.from(existingMap.values());
            merged.sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeA - timeB;
            });
            
            console.log(`📥 Merged group messages: ${prev.length} existing + ${fetchedMessages.length} fetched = ${merged.length} total`);
            return merged;
          });
        })
        .catch(err => console.error('Failed to fetch group messages:', err));
    } else {
      // Only clear messages if no conversation is selected
      setMessages([]);
    }
  }, [
    selectedUser ? (selectedUser._id || selectedUser.id) : null,
    selectedGroup ? (selectedGroup._id || selectedGroup.id) : null,
    myId
  ]);

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
        // Extract sender ID - handle multiple possible formats
        const msgSenderId = msg.sender?._id || msg.sender?.id || msg.sender || msg.sender_id;
        // Extract recipient ID - can be direct value or nested
        const msgRecipientId = msg.recipient || msg.recipient_id;
        const userId = selectedUser._id || selectedUser.id;
        
        // Debug all messages for this conversation
        console.log('🔍 Filtering message:', {
          msgSenderId,
          msgRecipientId,
          myId,
          userId,
          sender: msg.sender,
          recipient: msg.recipient,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          content: msg.content?.substring(0, 30)
        });
        
        // Normalize all IDs to numbers for comparison (handle both string and number IDs)
        const normalizeId = (id) => {
          if (!id) return null;
          if (typeof id === 'number') return id;
          if (typeof id === 'string') {
            const parsed = parseInt(id, 10);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        };
        
        const myIdNum = normalizeId(myId);
        const userIdNum = normalizeId(userId);
        const senderIdNum = normalizeId(msgSenderId);
        const recipientIdNum = normalizeId(msgRecipientId);
        
        // Message is between current user and selected user
        // Compare using numeric values
        if (myIdNum !== null && userIdNum !== null && senderIdNum !== null && recipientIdNum !== null) {
          // Case 1: I sent to selected user (senderIdNum === myIdNum && recipientIdNum === userIdNum)
          // Case 2: Selected user sent to me (senderIdNum === userIdNum && recipientIdNum === myIdNum)
          const case1 = senderIdNum === myIdNum && recipientIdNum === userIdNum;
          const case2 = senderIdNum === userIdNum && recipientIdNum === myIdNum;
          const matches = case1 || case2;
          
          if (messages.indexOf(msg) < 3) {
            console.log('🔍 Numeric comparison result:', matches, {
              case1: `sender(${senderIdNum}) === me(${myIdNum}) && recipient(${recipientIdNum}) === selected(${userIdNum}) = ${case1}`,
              case2: `sender(${senderIdNum}) === selected(${userIdNum}) && recipient(${recipientIdNum}) === me(${myIdNum}) = ${case2}`,
              senderIdNum,
              myIdNum,
              recipientIdNum,
              userIdNum,
              finalMatch: matches
            });
          }
          return matches;
        }
        
        // Fallback to string comparison if numeric conversion fails
        const myIdStr = myId ? String(myId).trim() : '';
        const userIdStr = userId ? String(userId).trim() : '';
        const senderIdStr = msgSenderId ? String(msgSenderId).trim() : '';
        const recipientIdStr = msgRecipientId ? String(msgRecipientId).trim() : '';
        const case1Str = senderIdStr === myIdStr && recipientIdStr === userIdStr;
        const case2Str = senderIdStr === userIdStr && recipientIdStr === myIdStr;
        const matches = case1Str || case2Str;
        
        if (messages.indexOf(msg) < 3) {
          console.log('🔍 String comparison result:', matches, {
            case1: `sender("${senderIdStr}") === me("${myIdStr}") && recipient("${recipientIdStr}") === selected("${userIdStr}") = ${case1Str}`,
            case2: `sender("${senderIdStr}") === selected("${userIdStr}") && recipient("${recipientIdStr}") === me("${myIdStr}") = ${case2Str}`,
            senderIdStr,
            myIdStr,
            recipientIdStr,
            userIdStr,
            finalMatch: matches
          });
        }
        return matches;
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
        const serverMessage = response.data.message;
        console.log('📤 Message sent successfully, received from server:', serverMessage);
        
        // Format the message to match expected format
        const formattedServerMessage = {
          _id: serverMessage._id || serverMessage.id,
          id: serverMessage.id || serverMessage._id,
          sender: serverMessage.sender || { 
            _id: serverMessage.sender_id || serverMessage.sender?._id, 
            id: serverMessage.sender_id || serverMessage.sender?.id,
            username: serverMessage.sender?.username || serverMessage.sender_username,
            nickname: serverMessage.sender?.nickname || serverMessage.sender_nickname,
            avatar: serverMessage.sender?.avatar || serverMessage.sender_avatar
          },
          recipient: serverMessage.recipient || serverMessage.recipient_id,
          recipient_id: serverMessage.recipient_id || serverMessage.recipient,
          groupId: serverMessage.groupId || serverMessage.group_id,
          group_id: serverMessage.group_id || serverMessage.groupId,
          content: serverMessage.content || '',
          type: serverMessage.type || 'text',
          fileUrl: serverMessage.fileUrl || '',
          timestamp: serverMessage.timestamp || new Date().toISOString()
        };
        
        setMessages(prev => {
          // Remove temp message
          const filtered = prev.filter(m => m._id !== tempMessage._id && m.id !== tempMessage.id);
          
          // Check if message already exists (might have come via SSE)
          const exists = filtered.some(m => {
            const msgId = m._id || m.id;
            const newMsgId = formattedServerMessage._id || formattedServerMessage.id;
            return String(msgId) === String(newMsgId);
          });
          
          if (exists) {
            console.log('📤 Message already exists (likely from SSE), updating instead');
            // Update existing message
            return filtered.map(m => {
              const msgId = m._id || m.id;
              const newMsgId = formattedServerMessage._id || formattedServerMessage.id;
              if (String(msgId) === String(newMsgId)) {
                return formattedServerMessage;
              }
              return m;
            });
          }
          
          console.log('📤 Adding server message to list');
          return [...filtered, formattedServerMessage];
        });
      } else {
        console.warn('⚠️ Server response missing message data:', response.data);
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
    const targetUserId = selectedUser._id || selectedUser.id;
    // Store target user ID for later use when ending call
    callTargetRef.current = targetUserId;
    console.log('📞 CALLER: Storing target user ID:', targetUserId);
    
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
          const candidate = event.candidate;
          // Log candidate type for debugging
          if (candidate.type === 'relay') {
            console.log('📞 TURN candidate gathered:', candidate.candidate);
          } else if (candidate.type === 'srflx') {
            console.log('📞 STUN candidate gathered:', candidate.candidate);
          } else {
            console.log('📞 Host candidate gathered:', candidate.candidate);
          }
          
          axios.post(`${API_URL}/api/calls/ice-candidate`, {
            token,
            to: selectedUser._id || selectedUser.id,
            candidate: candidate
          }).catch(err => console.error('Failed to send ICE candidate:', err));
        } else {
          console.log('📞 ICE candidate gathering complete (null candidate received)');
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
      
      // Monitor connection state changes
      peer.onconnectionstatechange = () => {
        // CRITICAL: Check flag FIRST before any operations
        if (callEndedIntentionallyRef.current || showCallEnding) {
          console.log('📞 Call ended intentionally, ignoring connection state change');
          return;
        }
        
        console.log('📞 Peer connection state:', peer.connectionState);
        
        if (peer.connectionState === 'connected') {
          // Double-check flag before updating
          if (!callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Call in progress');
          }
        } else if (peer.connectionState === 'disconnected') {
          console.warn('⚠️ Peer connection disconnected');
          // Only show "Connection lost" if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection lost...');
          }
        } else if (peer.connectionState === 'failed') {
          console.error('❌ Peer connection failed - ICE failed');
          // Only show error and try to reconnect if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection failed - trying to reconnect...');
            // Try to restart ICE
            peer.restartIce();
          } else {
            console.log('📞 Not showing connection failed - call was ended intentionally or already ending');
          }
        } else if (peer.connectionState === 'closed') {
          console.log('📞 Peer connection closed');
          // Don't update status if call was intentionally ended
        }
      };
      
      // Monitor ICE connection state
      peer.oniceconnectionstatechange = () => {
        // CRITICAL: Check flag FIRST before any operations
        if (callEndedIntentionallyRef.current || showCallEnding) {
          console.log('📞 Call ended intentionally, ignoring ICE state change');
          return;
        }
        
        console.log('📞 ICE connection state:', peer.iceConnectionState);
        
        if (peer.iceConnectionState === 'failed') {
          console.error('❌ ICE connection failed');
          // Only show error if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection failed - check network');
            // Try to restart ICE
            peer.restartIce();
          } else {
            console.log('📞 Not showing ICE failed - call was ended intentionally or already ending');
          }
        } else if (peer.iceConnectionState === 'disconnected') {
          console.warn('⚠️ ICE connection disconnected');
          // Only show "Connection lost" if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection lost...');
          }
        } else if (peer.iceConnectionState === 'connected') {
          console.log('✅ ICE connection established');
          // Double-check flag before updating
          if (!callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Call in progress');
          }
        }
      };
      
      // Monitor ICE gathering state
      peer.onicegatheringstatechange = () => {
        console.log('📞 ICE gathering state:', peer.iceGatheringState);
        if (peer.iceGatheringState === 'complete') {
          console.log('✅ ICE gathering complete');
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
    // Set ref immediately to prevent race conditions with event handlers
    callActiveRef.current = true;
    receivingCallRef.current = false;
    setCallActive(true);
    setReceivingCall(false);
    // Set status immediately when answering
    setCallStatus('Call in progress');
    console.log('📞 RECEIVER: Answering call, setting status to "Call in progress"');
    console.log('📞 RECEIVER: callActiveRef.current set to true to prevent event override');

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
          const candidate = event.candidate;
          // Log candidate type for debugging
          if (candidate.type === 'relay') {
            console.log('📞 TURN candidate gathered (answer):', candidate.candidate);
          } else if (candidate.type === 'srflx') {
            console.log('📞 STUN candidate gathered (answer):', candidate.candidate);
          } else {
            console.log('📞 Host candidate gathered (answer):', candidate.candidate);
          }
          
          axios.post(`${API_URL}/api/calls/ice-candidate`, {
            token,
            to: caller,
            candidate: candidate
          }).catch(err => console.error('Failed to send ICE candidate:', err));
        } else {
          console.log('📞 ICE candidate gathering complete (answer) (null candidate received)');
        }
      };

      peer.ontrack = (event) => {
        if (videoCall && userVideo.current) {
          userVideo.current.srcObject = event.streams[0];
        } else if (!videoCall && userVideo.current) {
          userVideo.current.srcObject = event.streams[0];
        }
        // Update status when media is received - ensure it stays "Call in progress"
        console.log('📞 RECEIVER: Media track received, ensuring status is "Call in progress"');
        setCallStatus('Call in progress');
      };
      
      // Monitor connection state changes
      peer.onconnectionstatechange = () => {
        console.log('📞 Peer connection state (answer):', peer.connectionState);
        
        // Don't update status if call was ended intentionally
        if (callEndedIntentionallyRef.current || showCallEnding) {
          console.log('📞 Call ended intentionally, ignoring connection state change (answer)');
          return;
        }
        
        if (peer.connectionState === 'connected') {
          console.log('📞 RECEIVER: Connection established, setting status to "Call in progress"');
          setCallStatus('Call in progress');
        } else if (peer.connectionState === 'connecting') {
          // Keep status as "Call in progress" while connecting (don't change it)
          console.log('📞 RECEIVER: Connection in progress, maintaining "Call in progress" status');
          if (callStatus !== 'Call in progress') {
            setCallStatus('Call in progress');
          }
        } else if (peer.connectionState === 'disconnected') {
          console.warn('⚠️ Peer connection disconnected');
          // Only show "Connection lost" if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection lost...');
          }
        } else if (peer.connectionState === 'failed') {
          console.error('❌ Peer connection failed - ICE failed');
          // Only show error and try to reconnect if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection failed - trying to reconnect...');
            // Try to restart ICE
            peer.restartIce();
          } else {
            console.log('📞 Not showing connection failed (answer) - call was ended intentionally or already ending');
          }
        } else if (peer.connectionState === 'closed') {
          console.log('📞 Peer connection closed');
          // Don't update status if call was intentionally ended
        }
      };
      
      // Monitor ICE connection state
      peer.oniceconnectionstatechange = () => {
        // CRITICAL: Check flag FIRST before any operations
        if (callEndedIntentionallyRef.current || showCallEnding) {
          console.log('📞 Call ended intentionally, ignoring ICE state change (answer)');
          return;
        }
        
        console.log('📞 ICE connection state (answer):', peer.iceConnectionState);
        
        if (peer.iceConnectionState === 'failed') {
          console.error('❌ ICE connection failed (answer) - attempting ICE restart');
          // Only show error if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection failed - retrying...');
            // Try to restart ICE with exponential backoff
            setTimeout(() => {
              if (peer.iceConnectionState === 'failed' && !callEndedIntentionallyRef.current) {
                console.log('📞 Restarting ICE connection (answer)...');
                try {
                  peer.restartIce();
                } catch (err) {
                  console.error('❌ Error restarting ICE (answer):', err);
                }
              }
            }, 1000);
          } else {
            console.log('📞 Not showing ICE failed (answer) - call was ended intentionally or already ending');
          }
        } else if (peer.iceConnectionState === 'disconnected') {
          console.warn('⚠️ ICE connection disconnected (answer)');
          // Only show "Connection lost" if call is still active and NOT intentionally ended
          if ((callActive || receivingCall) && !callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Connection lost...');
          }
        } else if (peer.iceConnectionState === 'connected') {
          console.log('✅ ICE connection established (answer)');
          // Double-check flag before updating
          if (!callEndedIntentionallyRef.current && !showCallEnding) {
            setCallStatus('Call in progress');
          }
        } else if (peer.iceConnectionState === 'checking') {
          console.log('📞 ICE connection checking (answer)...');
          // Keep status as "Call in progress" while checking (don't change it to "Connecting...")
          if (!callEndedIntentionallyRef.current && !showCallEnding) {
            // Don't change status - keep it as "Call in progress" since call was already answered
            console.log('📞 RECEIVER: ICE checking, maintaining "Call in progress" status');
          }
        }
      };
      
      // Monitor ICE gathering state
      peer.onicegatheringstatechange = () => {
        console.log('📞 ICE gathering state (answer):', peer.iceGatheringState);
        if (peer.iceGatheringState === 'complete') {
          console.log('✅ ICE candidate gathering complete (answer)');
        } else if (peer.iceGatheringState === 'gathering') {
          console.log('📞 Gathering ICE candidates (answer)...');
        }
      };
      
      // Monitor ICE gathering state
      peer.onicegatheringstatechange = () => {
        console.log('📞 ICE gathering state (answer):', peer.iceGatheringState);
        if (peer.iceGatheringState === 'complete') {
          console.log('✅ ICE gathering complete');
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
    // Try multiple sources for target user ID
    const otherId = callTargetRef.current || selectedUser?._id || selectedUser?.id || caller;
    const isReceiver = receivingCall && !callActive;
    const isCaller = callActive && !receivingCall;
    const role = isReceiver ? 'RECEIVER' : (isCaller ? 'CALLER' : 'USER');
    
    console.log('📞 ========================================');
    console.log(`📞 ${role}: User ending/declining call`);
    console.log('📞 Call state - callActive:', callActive, 'receivingCall:', receivingCall);
    console.log('📞 Target user sources:', {
      callTargetRef: callTargetRef.current,
      selectedUser: selectedUser?._id || selectedUser?.id,
      caller: caller,
      finalOtherId: otherId
    });
    console.log('📞 ========================================');
    
    if (otherId) {
      console.log(`📞 ${role}: Sending end_call event to other party (${otherId})`);
      axios.post(`${API_URL}/api/calls/end`, {
        token,
        to: otherId
      })
      .then(() => {
        console.log(`✅ ${role}: End call event sent successfully to ${otherId}`);
      })
      .catch(err => {
        console.error(`❌ ${role}: Failed to send end call event:`, err);
      });
    } else {
      console.warn(`⚠️ ${role}: No target user ID available to send end_call event`);
    }
    
    // Determine appropriate status message
    let statusMessage = 'Call ended';
    if (isReceiver) {
      statusMessage = 'Call declined';
    } else if (isCaller) {
      statusMessage = 'Call ended';
    }
    
    // Show status when user ends/declines the call
    console.log(`📞 ${role}: Calling endCallCleanup with status "${statusMessage}"`);
    endCallCleanup(statusMessage);
  };

  const renderMessageContent = (msg) => {
    switch(msg.type) {
        case 'image':
            return <img src={msg.fileUrl} alt="sent" style={{ maxWidth: isMobile ? '100%' : '200px', borderRadius: '8px', cursor:'pointer' }} onClick={()=>window.open(msg.fileUrl, '_blank')} />;
        case 'audio':
            return <audio controls src={msg.fileUrl} style={{ width: isMobile ? '100%' : '200px', maxWidth: '200px' }} />;
        case 'video':
            return <video controls src={msg.fileUrl} style={{ maxWidth: isMobile ? '100%' : '200px', borderRadius: '8px' }} />;
        default:
            return <span>{msg.content}</span>;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      width: '100%', 
      position: 'relative',
      minHeight: 0,
      overflow: 'hidden'
    }}>
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
              width: isMobile ? '120px' : '200px', 
              height: isMobile ? '90px' : '150px', 
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
      <div style={{ 
        width: isMobile ? (sidebarOpen ? '100%' : '0') : '260px',
        maxWidth: isMobile ? '100%' : '260px',
        minWidth: isMobile && !sidebarOpen ? '0' : (isMobile ? '0' : '260px'),
        borderRight: isMobile && !sidebarOpen ? 'none' : '1px solid #ddd',
        background: '#f8f9fa',
        display: isMobile && !sidebarOpen ? 'none' : 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile && !sidebarOpen ? '-100%' : '0',
        top: 0,
        bottom: 0,
        zIndex: isMobile ? 1002 : 'auto',
        transition: 'left 0.3s ease, width 0.3s ease',
        overflow: isMobile && !sidebarOpen ? 'hidden' : 'visible',
        boxShadow: isMobile && sidebarOpen ? '2px 0 10px rgba(0,0,0,0.2)' : 'none'
      }}>
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

      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'fixed',
            top: '70px',
            left: '10px',
            zIndex: 1003,
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1001
          }}
        />
      )}

      {/* Chat Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'white', 
        width: isMobile && sidebarOpen ? '0' : '100%',
        minWidth: isMobile && sidebarOpen ? '0' : '0',
        overflow: isMobile && sidebarOpen ? 'hidden' : 'visible',
        position: 'relative',
        minHeight: 0,
        height: '100%'
      }}>
        
        {/* Call Banner */}
        {(callActive || receivingCall || showCallEnding) && (
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
              {receivingCall && !callActive && !showCallEnding && (
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
              {callActive && !showCallEnding && (
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
              {currentMessages.map((msg, index) => {
                // Check if message is from current user
                // Handle different message formats - sender can be object with _id/id or just a number
                let msgSenderId = null;
                
                // Try multiple ways to get sender ID (in order of preference)
                if (msg.sender) {
                  if (typeof msg.sender === 'object' && msg.sender !== null) {
                    // Sender is an object - try _id first, then id
                    msgSenderId = msg.sender._id || msg.sender.id;
                  } else if (typeof msg.sender === 'number' || typeof msg.sender === 'string') {
                    // Sender is directly the ID
                    msgSenderId = msg.sender;
                  }
                }
                
                // Fallback to sender_id field if sender object doesn't have ID
                if (!msgSenderId && msg.sender_id !== undefined && msg.sender_id !== null) {
                  msgSenderId = msg.sender_id;
                }
                
                // Normalize IDs for comparison (handle both string and number IDs)
                // Convert to number first, then to string to handle "1" === 1 cases
                const myIdNum = myId ? (typeof myId === 'string' ? parseInt(myId, 10) : Number(myId)) : null;
                const msgSenderIdNum = msgSenderId ? (typeof msgSenderId === 'string' ? parseInt(msgSenderId, 10) : Number(msgSenderId)) : null;
                
                // Create string versions for comparison and debugging
                const myIdStr = myId ? String(myId).trim() : '';
                const msgSenderIdStr = msgSenderId ? String(msgSenderId).trim() : '';
                
                // Compare IDs - use strict numeric comparison first, then string fallback
                let isMyMessage = false;
                if (myIdNum !== null && msgSenderIdNum !== null && !isNaN(myIdNum) && !isNaN(msgSenderIdNum)) {
                  // Both are valid numbers - compare numerically
                  isMyMessage = myIdNum === msgSenderIdNum;
                } else if (myId && msgSenderId) {
                  // Fallback to string comparison
                  isMyMessage = myIdStr === msgSenderIdStr;
                }
                
                // Safety check: if we can't determine, show on left (received) side
                const showAsMyMessage = isMyMessage && myId !== null && myId !== undefined;
                
                // Debug logging for first few messages to diagnose
                if (index < 3) {
                  console.log(`🔍 Message ${index} rendering:`, {
                    msgSenderId,
                    msgSenderIdNum,
                    msgSenderIdStr,
                    myId,
                    myIdNum,
                    myIdStr,
                    isMyMessage,
                    showAsMyMessage,
                    sender: msg.sender,
                    sender_id: msg.sender_id,
                    'numericComparison': `${myIdNum} === ${msgSenderIdNum} = ${myIdNum === msgSenderIdNum}`,
                    'stringComparison': `${myIdStr} === ${msgSenderIdStr} = ${myIdStr === msgSenderIdStr}`,
                    'fullMessage': JSON.stringify(msg, null, 2)
                  });
                }
                
                return (
                  <div 
                    key={msg._id || msg.id || index} 
                    style={{ 
                      display: 'flex',
                      justifyContent: showAsMyMessage ? 'flex-end' : 'flex-start',
                      marginBottom: '15px',
                      alignItems: 'flex-end',
                      gap: '8px'
                    }}
                  >
                    {/* Avatar for received messages (left side) */}
                    {!showAsMyMessage && (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#666',
                        flexShrink: 0
                      }}>
                        {msg.sender?.avatar ? (
                          <img 
                            src={msg.sender.avatar} 
                            alt={msg.sender?.username || 'User'} 
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          (msg.sender?.username || msg.sender?.nickname || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '70%',
                      alignItems: showAsMyMessage ? 'flex-end' : 'flex-start'
                    }}>
                      {/* Sender name for received messages */}
                      {!showAsMyMessage && (
                        <div style={{ 
                          fontSize: '0.75em', 
                          color: '#666', 
                          marginBottom: '4px',
                          paddingLeft: '4px',
                          fontWeight: '500'
                        }}>
                          {msg.sender?.nickname || msg.sender?.username || 'Unknown'}
                        </div>
                      )}
                      
                      <div style={{ 
                        display: 'inline-block',
                        background: showAsMyMessage ? '#007bff' : '#ffffff', 
                        color: showAsMyMessage ? '#ffffff' : '#000000',
                        padding: '10px 15px', 
                        borderRadius: showAsMyMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        textAlign: 'left',
                        wordWrap: 'break-word'
                      }}>
                        {renderMessageContent(msg)}
                      </div>
                      
                      {/* Timestamp */}
                      <div style={{ 
                        fontSize:'0.7em', 
                        color:'#999', 
                        marginTop:'4px', 
                        padding: showAsMyMessage ? '0 4px 0 0' : '0 0 0 4px'
                      }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    
                    {/* Avatar for sent messages (right side) */}
                    {showAsMyMessage && (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#007bff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#fff',
                        flexShrink: 0
                      }}>
                        {myUsername?.charAt(0).toUpperCase() || 'M'}
                      </div>
                    )}
                  </div>
                );
              })}
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
          <div style={{
            flex:1, 
            display:'flex', 
            flexDirection:'column', 
            justifyContent:'center', 
            alignItems:'center', 
            color:'#888', 
            background:'#f0f2f5',
            padding: '20px',
            textAlign: 'center',
            minHeight: '200px',
            width: '100%',
            height: '100%',
            overflow: 'auto',
            position: 'relative'
          }}>
             <div style={{ fontSize: isMobile ? '3rem' : '4rem', opacity: 0.2, marginBottom: '20px' }}>💬</div>
             <h3 style={{ margin: '10px 0', fontSize: isMobile ? '1.2rem' : '1.5rem' }}>Select a conversation to start chatting</h3>
             {isMobile && (
               <p style={{ margin: '10px 0', fontSize: '0.9rem', color: '#666' }}>
                 Tap the ☰ button to see your contacts
               </p>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
