import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Users, Inbox, Send, UserPlus, CheckCircle, XCircle, Clock, Code2, Gamepad2 } from 'lucide-react';
import '../App.css';

interface Friend { id: string; username: string; userType: string; }
interface FriendRequest { id: string; senderId: string; receiverId: string; status: string; createdAt: string; }

const Friends: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id ?? '';

    const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent' | 'add'>('friends');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [received, setReceived] = useState<FriendRequest[]>([]);
    const [sent, setSent] = useState<FriendRequest[]>([]);
    const [searchInput, setSearchInput] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

    const loadFriends = async () => {
        setLoading(true);
        try { setFriends(await api.get<Friend[]>(`/friends/list/${userId}`)); } catch { }
        setLoading(false);
    };

    const loadReceived = async () => { try { setReceived(await api.get<FriendRequest[]>(`/friends/requests/received/${userId}`)); } catch { } };
    const loadSent = async () => { try { setSent(await api.get<FriendRequest[]>(`/friends/requests/sent/${userId}`)); } catch { } };

    useEffect(() => { loadFriends(); loadReceived(); loadSent(); }, [userId]);

    const sendRequest = async () => {
        const username = searchInput.trim();
        if (!username) return;
        if (username.toLowerCase() === user?.username.toLowerCase()) { showMsg('error:You cannot add yourself!'); return; }
        try {
            const found = await api.get<{ id: string; username: string }>(`/users/search/${username}`);
            await api.post(`/friends/send/${userId}/${found.id}`);
            showMsg(`success:Request sent to ${found.username}!`);
            setSearchInput(''); loadSent();
        } catch (e: any) { showMsg(`error:${e.message || 'User not found'}`); }
    };

    const acceptRequest = async (requestId: string) => {
        try { await api.put(`/friends/accept/${requestId}`); showMsg('success:Request accepted!'); loadReceived(); loadFriends(); } catch { }
    };

    const rejectRequest = async (requestId: string) => {
        try { await api.put(`/friends/reject/${requestId}`); showMsg('Request rejected.'); loadReceived(); } catch { }
    };

    const removeFriend = async (friendId: string) => {
        setFriends(prev => prev.filter(f => f.id !== friendId));
        try { await api.delete(`/friends/remove/${userId}/${friendId}`); } catch { }
        showMsg('Friend removed.');
    };

    const tabs = [
        { key: 'friends', label: 'Friends', icon: <Users size={13} />, badge: friends.length },
        { key: 'received', label: 'Received', icon: <Inbox size={13} />, badge: received.length },
        { key: 'sent', label: 'Sent', icon: <Send size={13} />, badge: sent.length },
        { key: 'add', label: 'Add Friend', icon: <UserPlus size={13} />, badge: 0 },
    ];

    return (
        <div className="container">
            {/* Header */}
            <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -1, left: 0, width: 80, height: 1, background: 'var(--gradient-accent)' }} />
                <div style={{ fontFamily: 'Fira Code', fontSize: '0.62rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
                    Social
                </div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Friends</h1>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
                {tabs.map(t => (
                    <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key as any)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {t.icon} {t.label}
                        {t.badge > 0 && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.6rem', borderRadius: 99, padding: '1px 6px', fontWeight: 700 }}>{t.badge}</span>}
                    </button>
                ))}
            </div>

            {message && <div className={message.startsWith('success:') ? 'success-banner' : 'error-banner'} style={{ marginBottom: '1rem' }}>{message.replace(/^(success|error):/, '')}</div>}
            {loading && <div className="spinner" />}

            {/* Friends List */}
            {activeTab === 'friends' && (
                <div className="friends-list">
                    {friends.length === 0
                        ? <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                            <Users size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                            <p style={{ color: 'var(--text-muted)', fontFamily: 'Fira Code', fontSize: '0.85rem' }}>No friends yet. Send some requests!</p>
                        </div>
                        : friends.map(f => (
                            <div key={f.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: f.userType === 'Developer' ? 'var(--gradient-accent)' : 'linear-gradient(90deg, var(--success), transparent)' }} />
                                <div className="avatar" style={{ background: f.userType === 'Developer' ? 'var(--gradient-accent)' : 'linear-gradient(135deg, var(--success), var(--info))', color: '#fff' }}>{f.username[0].toUpperCase()}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.username}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Fira Code', marginTop: '0.15rem' }}>
                                        {f.userType === 'Developer' ? <Code2 size={11} /> : <Gamepad2 size={11} />} {f.userType}
                                    </div>
                                </div>
                                <button className="btn-outline" style={{ fontSize: '0.78rem', padding: '0.3rem 0.9rem', borderColor: 'var(--danger)', color: 'var(--danger)', flexShrink: 0 }} onClick={() => removeFriend(f.id)}>Remove</button>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Received Requests */}
            {activeTab === 'received' && (
                <div className="friends-list">
                    {received.length === 0
                        ? <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontFamily: 'Fira Code', fontSize: '0.85rem' }}>No pending requests.</p>
                        </div>
                        : received.map(r => (
                            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="avatar" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', color: 'var(--warning)' }}>{r.senderId[0].toUpperCase()}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{r.senderId}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--warning)', fontFamily: 'Fira Code', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}><Clock size={11} /> Pending</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-gradient" style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => acceptRequest(r.id)}><CheckCircle size={13} /> Accept</button>
                                    <button className="btn-outline" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => rejectRequest(r.id)}><XCircle size={13} /></button>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Sent */}
            {activeTab === 'sent' && (
                <div className="friends-list">
                    {sent.length === 0
                        ? <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontFamily: 'Fira Code', fontSize: '0.85rem' }}>No sent requests.</p>
                        </div>
                        : sent.map(r => (
                            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="avatar">{r.receiverId[0].toUpperCase()}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{r.receiverId}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--warning)', fontFamily: 'Fira Code', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}><Clock size={11} /> Awaiting response</div>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Add Friend */}
            {activeTab === 'add' && (
                <div className="card" style={{ maxWidth: 500 }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>Send Friend Request</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Search by exact username to connect with someone.</p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input className="form-control" placeholder="Enter username..." value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendRequest()} style={{ flex: 1 }} />
                        <button className="btn-gradient" style={{ padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={sendRequest}><UserPlus size={14} /> Send</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Friends;