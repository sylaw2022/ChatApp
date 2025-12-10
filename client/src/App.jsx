import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = ''; 

// --- THEME CONSTANTS ---
const THEME = {
  primary: '#2563EB',    // Royal Blue
  primaryHover: '#1d4ed8',
  bgApp: '#F3F4F6',      // Cool Gray 100
  bgChat: '#E5E7EB',     // Cool Gray 200
  textMain: '#111827',   // Gray 900
  textMuted: '#6B7280',  // Gray 500
  border: '#D1D5DB',
  success: '#059669',
  danger: '#DC2626',
  msgMe: '#2563EB',      // Blue for me
  msgOther: '#FFFFFF',   // White for others
  activeItem: '#DBEAFE'  // Blue 100
};

// --- AVATAR COLOR GENERATOR ---
const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', 
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'
];

const getAvatarColor = (name) => {
  if (!name) return '#9CA3AF';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// --- ICONS ---
const IconWrapper = ({ children, onClick, color }) => (
    <div onClick={onClick} style={{ 
        cursor: onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        color: color || 'inherit', transition: '0.2s' 
    }} className="icon-hover">
        {children}
    </div>
);

const Icons = {
  Image: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Audio: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Video: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Info: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
};

// --- GLOBAL CSS ---
const GlobalStyles = () => (
    <style>{`
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: ${THEME.bgApp}; color: ${THEME.textMain}; }
        * { box-sizing: border-box; outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        .icon-hover:hover { opacity: 0.8; transform: scale(1.1); }
        button:active { transform: translateY(1px); }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
    `}</style>
);

// --- UI COMPONENTS ---

const Avatar = ({ src, alt, size = 40, onClick, style }) => {
  const bg = src ? 'transparent' : getAvatarColor(alt);
  return (
    <div onClick={onClick} style={{ 
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', 
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', 
        flexShrink: 0, cursor: onClick ? 'pointer' : 'default', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid white', ...style 
    }}>
      {src ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> 
           : <span style={{ fontSize: size/2.2, color: 'white', fontWeight: 'bold' }}>{alt?.[0]?.toUpperCase()}</span>}
    </div>
  );
};

const Button = ({ children, onClick, variant = 'primary', style, disabled }) => {
    const baseStyle = {
        padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.9rem', fontWeight: '600', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
        opacity: disabled ? 0.6 : 1, ...style
    };
    const variants = {
        primary: { background: THEME.primary, color: 'white' },
        secondary: { background: 'white', color: THEME.textMain, border: `1px solid ${THEME.border}` },
        danger: { background: THEME.danger, color: 'white' },
        ghost: { background: 'transparent', color: THEME.textMuted }
    };
    return (
        <button onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...variants[variant] }}>
            {children}
        </button>
    );
};

const Input = (props) => (
    <input {...props} style={{
        width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`,
        fontSize: '0.95rem', background: 'white', transition: '0.2s', color: THEME.textMain, ...props.style
    }} />
);

const Modal = ({ children, onClose, title }) => (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(2px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 }}>
        <div className="fade-in" style={{ background:'white', padding:'24px', borderRadius:'16px', width:'400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>{title}</h3>
                <button onClick={onClose} style={{ border:'none', background:'none', fontSize:'1.5rem', cursor:'pointer' }}>&times;</button>
            </div>
            {children}
        </div>
    </div>
);

// --- APP COMPONENT ---

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('chat'); 

  useEffect(() => {
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUser({ 
                id: payload.id, username: payload.username, role: payload.role,
                avatar: localStorage.getItem('avatar'), nickname: localStorage.getItem('nickname')
            });
        } catch(e) { logout(); }
    }
  }, [token]);

  const logout = () => { localStorage.clear(); setToken(null); setUser(null); setView('chat'); };

  if (!token) return <Auth setToken={setToken} setUser={setUser} />;
  
  // Show loading if user data is not yet available
  if (!user) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: THEME.bgApp }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <GlobalStyles />
      {/* Navbar */}
      <header style={{ 
          background: 'white', borderBottom: `1px solid ${THEME.border}`, 
          padding: '0 20px', height: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor:'pointer' }}>
            <Avatar src={user?.avatar} alt={user?.username} size={32} />
            <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{user?.nickname || user?.username}</div>
            </div>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
            <Button variant={view==='chat'?'primary':'ghost'} onClick={()=>setView('chat')}>Chat</Button>
            <Button variant={view==='profile'?'primary':'ghost'} onClick={()=>setView('profile')}>Profile</Button>
            {user?.role === 'admin' && <Button variant={view==='admin'?'primary':'ghost'} onClick={()=>setView('admin')}>Admin</Button>}
            <Button variant="ghost" onClick={logout} style={{color: THEME.danger}}>Exit</Button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: THEME.bgApp }}>
        {view === 'chat' && <ChatDashboard token={token} currentUser={user} onEditProfile={() => setView('profile')} />}
        {view === 'profile' && <ProfileSettings token={token} currentUser={user} setUser={setUser} />}
        {view === 'admin' && <AdminDashboard token={token} />}
      </div>
    </div>
  );
}

// --- AUTH ---
function Auth({ setToken, setUser }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/api/${isRegister ? 'register' : 'login'}`, formData);
      if (!isRegister) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('avatar', data.avatar || '');
        localStorage.setItem('nickname', data.nickname || '');
        setToken(data.token);
      } else { setIsRegister(false); alert('Created! Please login.'); }
    } catch (err) { 
      const errorMsg = err.response?.data?.error;
      if (typeof errorMsg === 'string') {
        alert(errorMsg);
      } else if (errorMsg) {
        alert(JSON.stringify(errorMsg));
      } else {
        alert(err.message || 'An error occurred');
      }
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: THEME.bgApp }}>
      <GlobalStyles />
      <div className="fade-in" style={{ background: 'white', padding: '40px', borderRadius: '12px', width: '350px', boxShadow:'0 10px 20px rgba(0,0,0,0.05)' }}>
        <h2 style={{ textAlign: 'center', color: THEME.primary }}>{isRegister ? 'Join Chat' : 'Welcome'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <Input placeholder="Username" onChange={e => setFormData({...formData, username: e.target.value})} required />
            <Input type="password" placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} required />
            <Button type="submit">{isRegister ? 'Sign Up' : 'Login'}</Button>
        </form>
        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: THEME.textMuted, cursor:'pointer' }} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
        </p>
      </div>
    </div>
  );
}

// --- PROFILE ---
function ProfileSettings({ token, currentUser, setUser }) {
    const [nickname, setNickname] = useState(currentUser?.nickname || '');
    const [isVisible, setIsVisible] = useState(true);
    const [avatarFile, setAvatarFile] = useState(null);

    const handleSave = async () => {
        try {
            const { data } = await axios.put(`${API_URL}/api/profile`, { token, nickname, isVisible });
            localStorage.setItem('nickname', data.nickname);
            if (avatarFile) {
                const fd = new FormData(); fd.append('file', avatarFile); fd.append('token', token);
                const res = await axios.post(`${API_URL}/api/profile/avatar`, fd);
                localStorage.setItem('avatar', res.data.fileUrl);
                data.avatar = res.data.fileUrl;
            }
            setUser(prev => ({ ...prev, ...data }));
            alert('Saved!');
        } catch (e) { 
            const errorMsg = e.response?.data?.error || e.message || 'Failed to save profile';
            alert(errorMsg);
            console.error('Profile save error:', e);
        }
    };

    return (
        <div className="fade-in" style={{ padding: '40px', maxWidth: '500px', margin: '40px auto', background: 'white', borderRadius: '12px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)' }}>
            <h2>Your Profile</h2>
            <div style={{ marginBottom: '20px', display:'flex', gap:'20px', alignItems:'center' }}>
                <Avatar src={avatarFile ? URL.createObjectURL(avatarFile) : currentUser?.avatar} size={80} />
                <div>
                    <input type="file" id="up" hidden onChange={e => setAvatarFile(e.target.files[0])} />
                    <Button variant="secondary" onClick={()=>document.getElementById('up').click()}>Upload Photo</Button>
                </div>
            </div>
            <label style={{display:'block', marginBottom:'5px', fontWeight:'bold'}}>Display Name</label>
            <Input value={nickname} onChange={e => setNickname(e.target.value)} style={{marginBottom:'20px'}} />
            
            <label style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'30px'}}>
                <input type="checkbox" checked={isVisible} onChange={e => setIsVisible(e.target.checked)} /> Public Profile
            </label>
            <Button onClick={handleSave}>Save Changes</Button>
        </div>
    );
}

// --- CHAT DASHBOARD ---
function ChatDashboard({ token, currentUser, onEditProfile }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [target, setTarget] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [previewUser, setPreviewUser] = useState(null);
  
  const messagesEndRef = useRef(null);
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);

  const fetchData = () => {
      axios.get(`${API_URL}/api/my-network`, { headers: { Authorization: `Bearer ${token}` } }).then(res => { setFriends(res.data.friends || []); setRequests(res.data.requests || []); });
      axios.get(`${API_URL}/api/groups`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setGroups(res.data || []));
      axios.get(`${API_URL}/api/users`).then(res => setAllUsers(res.data.filter(u => u._id !== currentUser.id)));
  };

  useEffect(() => {
    fetchData();
    const es = new EventSource(`${API_URL}/api/events?token=${token}`);
    es.onmessage = (e) => {
        const { type, data } = JSON.parse(e.data);
        if (type === 'receive_message') {
             setMessages(prev => {
                const ct = targetRef.current;
                const isRelevant = (ct?.type === 'user' && !data.groupId && (data.sender._id === ct.data._id || data.sender._id === currentUser.id)) ||
                                   (ct?.type === 'group' && data.groupId === ct.data._id);
                return isRelevant ? [...prev, data] : prev;
            });
        } else if (['group_created', 'friend_accepted', 'friend_request', 'group_deleted'].includes(type)) {
            fetchData();
            if(type === 'group_deleted' && targetRef.current?.data._id === data.groupId) setTarget(null);
        }
    };
    return () => es.close();
  }, [token, currentUser]);

  useEffect(() => {
    if (!target) return;
    const url = target.type === 'user' ? `${API_URL}/api/messages/${currentUser.id}/${target.data._id}` : `${API_URL}/api/groups/${target.data._id}/messages`;
    axios.get(url).then(res => setMessages(res.data));
  }, [target]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !target) return;
    await axios.post(`${API_URL}/api/message`, { token, content: input, type: 'text', recipientId: target.type==='user'?target.data._id:null, groupId: target.type==='group'?target.data._id:null });
    setInput('');
  };

  const addFriend = async (id) => { try { await axios.post(`${API_URL}/api/friends/request`, { token, toUserId: id }); alert('Sent!'); } catch(e) { alert(e.response?.data?.msg); } };
  const acceptFriend = async (id) => { await axios.post(`${API_URL}/api/friends/accept`, { token, fromUserId: id }); fetchData(); };
  const deleteGroup = async (gid) => { if(confirm("Delete Group?")) { await axios.delete(`${API_URL}/api/groups/${gid}`, { headers: { Authorization: `Bearer ${token}` } }); setShowGroupDetails(false); setTarget(null); }};
  
  const handleAvatarClick = (e, user, isGroup) => { e.stopPropagation(); isGroup ? (setTarget({ type: 'group', data: user }), setShowGroupDetails(true)) : (user._id === currentUser.id ? onEditProfile() : setPreviewUser(user)); };
  const communityUsers = allUsers.filter(u => !friends.some(f => f._id === u._id) && !requests.some(r => r._id === u._id));

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* SIDEBAR */}
      <div style={{ width: '280px', background: 'white', borderRight: `1px solid ${THEME.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px', borderBottom: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{margin:0, color: THEME.textMain}}>Messages</h4>
            <IconWrapper onClick={() => setShowCreateGroup(true)} color={THEME.primary}><Icons.Users/></IconWrapper>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
            {requests.length > 0 && requests.map(req => (
                <div key={req._id} style={{padding:'10px', background:'#FEF3C7', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', gap:'8px', alignItems:'center'}}><Avatar src={req.avatar} alt={req.username} size={28} onClick={(e)=>handleAvatarClick(e,req)}/> {req.username}</div>
                    <Button variant="success" style={{padding:'4px 8px', fontSize:'0.7rem', background:THEME.success}} onClick={()=>acceptFriend(req._id)}>Accept</Button>
                </div>
            ))}
            
            {groups.map(g => <ContactItem key={g._id} icon={g.avatar} name={g.name} active={target?.data._id === g._id} onClick={() => setTarget({type: 'group', data: g})} onAvatarClick={(e)=>handleAvatarClick(e, g, true)} isGroup />)}
            {friends.map(f => <ContactItem key={f._id} icon={f.avatar} name={f.nickname || f.username} active={target?.data._id === f._id} onClick={() => setTarget({type: 'user', data: f})} onAvatarClick={(e)=>handleAvatarClick(e, f)} />)}
            
            {communityUsers.length > 0 && <div style={{padding:'10px 15px', fontSize:'0.75rem', fontWeight:'bold', color:THEME.textMuted, marginTop:'10px'}}>SUGGESTIONS</div>}
            {communityUsers.map(u => (
                <div key={u._id} style={{padding:'8px 15px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}><Avatar src={u.avatar} alt={u.username} size={30} onClick={(e)=>handleAvatarClick(e,u)}/> {u.username}</div>
                    <IconWrapper onClick={()=>addFriend(u._id)} color={THEME.primary}><Icons.Plus/></IconWrapper>
                </div>
            ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: THEME.bgApp }}>
        {target ? (
            <>
                <div style={{ padding: '12px 20px', background: 'white', borderBottom: `1px solid ${THEME.border}`, display: 'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Avatar src={target.data.avatar} alt={target.data.name} size={40} onClick={(e) => handleAvatarClick(e, target.data, target.type === 'group')} />
                        <div>
                            <div style={{fontWeight:'700', fontSize:'1rem'}}>{target.data.name || target.data.nickname || target.data.username}</div>
                            {target.type === 'group' && <div style={{fontSize:'0.75rem', color:THEME.textMuted}}>Group Chat</div>}
                        </div>
                    </div>
                    {target.type === 'group' && <IconWrapper onClick={()=>setShowGroupDetails(true)}><Icons.Info/></IconWrapper>}
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {messages.map((msg, i) => {
                        const isMe = msg.sender._id === currentUser.id;
                        return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '75%' }}>
                                    {!isMe && <Avatar src={msg.sender.avatar} alt={msg.sender.username} size={32} onClick={(e) => handleAvatarClick(e, msg.sender)} />}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                        {target.type === 'group' && !isMe && <span style={{fontSize:'0.7rem', color:THEME.textMuted, marginLeft:'4px'}}>{msg.sender.nickname}</span>}
                                        <div style={{ 
                                            background: isMe ? THEME.msgMe : THEME.msgOther, color: isMe ? 'white' : THEME.textMain,
                                            padding: '10px 15px', borderRadius: isMe ? '15px 15px 2px 15px' : '15px 15px 15px 2px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem', border: isMe ? 'none' : `1px solid ${THEME.border}`
                                        }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: '15px', background: 'white', borderTop: `1px solid ${THEME.border}` }}>
                    <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                        <div style={{display:'flex', gap:'8px', color:THEME.textMuted, alignItems:'center'}}><Icons.Image/><Icons.Audio/></div>
                        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." style={{border:'none', background:THEME.bgApp}} />
                        <Button type="submit" style={{borderRadius:'50%', width:'40px', height:'40px', padding:0}}><Icons.Send/></Button>
                    </form>
                </div>
            </>
        ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: THEME.textMuted }}>
                <div style={{background:'white', padding:'25px', borderRadius:'50%', marginBottom:'15px', boxShadow:'0 4px 10px rgba(0,0,0,0.05)'}}><Icons.Users/></div>
                <h3>Start a conversation</h3>
            </div>
        )}
      </div>

      {showCreateGroup && <CreateGroupModal friends={friends} token={token} onClose={() => setShowCreateGroup(false)} />}
      {showGroupDetails && target?.type === 'group' && <GroupDetailsModal group={target.data} currentUser={currentUser} onDelete={deleteGroup} onClose={()=>setShowGroupDetails(false)} />}
      {previewUser && <UserProfileModal user={previewUser} onClose={() => setPreviewUser(null)} />}
    </div>
  );
}

// --- MODALS ---
function UserProfileModal({ user, onClose }) {
    return <Modal title="Profile" onClose={onClose}><div style={{textAlign:'center'}}><Avatar src={user.avatar} alt={user.username} size={100} style={{margin:'0 auto 15px'}}/><h2>{user.nickname||user.username}</h2><p>@{user.username}</p></div></Modal>;
}
function CreateGroupModal({ friends, token, onClose }) {
    const [name, setName] = useState(''); const [sel, setSel] = useState([]);
    const create = async () => { if(!name||sel.length===0) return; await axios.post(`${API_URL}/api/groups`, {token, name, members:sel}); onClose(); };
    return <Modal title="New Group" onClose={onClose}><Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:'15px'}}/><div style={{maxHeight:'200px', overflowY:'auto'}}>{friends.map(f=><div key={f._id} onClick={()=>setSel(p=>p.includes(f._id)?p.filter(i=>i!==f._id):[...p,f._id])} style={{padding:'8px', background:sel.includes(f._id)?THEME.activeItem:'white', cursor:'pointer'}}>{f.username}</div>)}</div><Button onClick={create} style={{marginTop:'15px', width:'100%'}}>Create</Button></Modal>;
}
function GroupDetailsModal({ group, currentUser, onDelete, onClose }) {
    const [d, setD] = useState(null); useEffect(()=>{axios.get(`${API_URL}/api/groups/${group._id}/details`).then(r=>setD(r.data))},[group]);
    return <Modal title="Group" onClose={onClose}>{!d?'Loading...':<><div style={{textAlign:'center', marginBottom:'15px'}}><Avatar src={d.avatar} alt={d.name} size={60} style={{margin:'0 auto'}}/><h3>{d.name}</h3></div><div>Members ({d.members.length})</div><div style={{maxHeight:'150px', overflowY:'auto', margin:'10px 0'}}>{d.members.map(m=><div key={m._id} style={{padding:'5px'}}>{m.username}</div>)}</div>{(d.admin._id===currentUser.id||currentUser.role==='admin')&&<Button variant="danger" onClick={()=>onDelete(group._id)} style={{width:'100%'}}>Delete</Button>}</>}</Modal>;
}

const ContactItem = ({ icon, name, active, onClick, onAvatarClick, isGroup }) => (
    <div onClick={onClick} style={{ padding: '12px 20px', cursor: 'pointer', background: active ? THEME.activeItem : 'transparent', borderLeft: active ? `4px solid ${THEME.primary}` : '4px solid transparent', display: 'flex', alignItems: 'center', gap: '12px', transition:'0.2s' }}>
        <Avatar src={icon} alt={name} size={38} onClick={onAvatarClick} />
        <div><div style={{ fontWeight: '600', fontSize: '0.9rem', color: active?THEME.primary:THEME.textMain }}>{name}</div>{isGroup && <div style={{ fontSize: '0.75rem', color: THEME.textMuted }}>Group</div>}</div>
    </div>
);

function AdminDashboard({ token }) { 
    const [users, setUsers] = useState([]);
    useEffect(() => { axios.get(`${API_URL}/api/admin/users`, {headers:{Authorization:`Bearer ${token}`}}).then(res=>setUsers(res.data)); }, [token]);
    return <div style={{padding:'40px'}}><h2>Admin Dashboard</h2>{users.map(u=><div key={u._id} style={{padding:'10px', borderBottom:'1px solid #ddd'}}>{u.username} ({u.role})</div>)}</div>;
}

export default App;
