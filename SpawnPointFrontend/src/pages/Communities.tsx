import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Code2, Gamepad2, Globe, Users, User, Camera, Video, Mic, Terminal, Joystick } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Community {
    id: string;
    name: string;
    description: string;
    type: string;
    gameId?: string;
    createdBy: string;
    memberIds: string[];
    createdAt: string;
}

interface Message {
    id: string;
    communityId: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: string;
    type: 'text' | 'system';
}

interface CallState {
    active: boolean;
    type: 'audio' | 'video' | null;
    participants: string[];
    muted: boolean;
    videoOff: boolean;
    duration: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const typeColors: Record<string, string> = {
    Developer: 'var(--neon-cyan)',
    Gamer: 'var(--neon-green)',
    Game: 'var(--neon-purple)',
    General: 'var(--neon-yellow)',
};

const typeIcons: Record<string, React.ReactNode> = {
    Developer: <Code2 size={16} />,
    Gamer: <Gamepad2 size={16} />,
    Game: <span style={{ fontSize: '0.7rem' }}>●</span>,
    General: <Globe size={16} />,
};

// ─── Mock messages ────────────────────────────────────────────────────────────

const MOCK_MESSAGES: Message[] = [
    { id: '1', communityId: '', senderId: 'sys', senderName: 'System', content: 'Welcome to the community!', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'system' },
    { id: '2', communityId: '', senderId: 'u1', senderName: 'NeonRider', content: 'Hey everyone!', timestamp: new Date(Date.now() - 1800000).toISOString(), type: 'text' },
    { id: '3', communityId: '', senderId: 'u2', senderName: 'CyberDev', content: 'What are you all working on today?', timestamp: new Date(Date.now() - 900000).toISOString(), type: 'text' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

// ─── CommunityChat Component ──────────────────────────────────────────────────

const CommunityChat: React.FC<{ community: Community; onClose: () => void }> = ({ community, onClose }) => {
    const { user } = useAuth();
    const userId = user?.id ?? '';
    const userName = (user as any)?.username ?? (user as any)?.name ?? 'You';

    const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES.map(m => ({ ...m, communityId: community.id })));
    const [input, setInput] = useState('');
    const [callState, setCallState] = useState<CallState>({ active: false, type: null, participants: [], muted: false, videoOff: false, duration: 0 });
    const [showCallPrompt, setShowCallPrompt] = useState<'audio' | 'video' | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const color = typeColors[community.type] || 'var(--neon-cyan)';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (callState.active) {
            timerRef.current = setInterval(() =>
                setCallState(prev => ({ ...prev, duration: prev.duration + 1 })), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [callState.active]);

    useEffect(() => {
        const poll = setInterval(async () => {
            try {
                const data = await api.get<Message[]>(`/communities/${community.id}/messages`);
                if (data?.length) setMessages(data);
            } catch { }
        }, 5000);
        return () => clearInterval(poll);
    }, [community.id]);

    const sendMessage = async () => {
        const content = input.trim();
        if (!content) return;
        const msg: Message = {
            id: Date.now().toString(),
            communityId: community.id,
            senderId: userId,
            senderName: userName,
            content,
            timestamp: new Date().toISOString(),
            type: 'text',
        };
        setMessages(prev => [...prev, msg]);
        setInput('');
        try { await api.post(`/communities/${community.id}/messages`, msg); } catch { }
    };

    const startCall = (type: 'audio' | 'video') => {
        setShowCallPrompt(null);
        setCallState({ active: true, type, participants: [userName, 'NeonRider'], muted: false, videoOff: false, duration: 0 });
        setMessages(prev => [...prev, {
            id: Date.now().toString(), communityId: community.id,
            senderId: 'sys', senderName: 'System',
            content: `${userName} started a ${type} call`,
            timestamp: new Date().toISOString(), type: 'system',
        }]);
    };

    const endCall = () => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(), communityId: community.id,
            senderId: 'sys', senderName: 'System',
            content: `Call ended — ${formatDuration(callState.duration)}`,
            timestamp: new Date().toISOString(), type: 'system',
        }]);
        setCallState({ active: false, type: null, participants: [], muted: false, videoOff: false, duration: 0 });
    };

    return (
        <div style={styles.overlay}>
            <div className="ai-floating-panel" style={styles.panel}>

                {/* ── Header ── */}
                <div style={{ ...styles.header, borderColor: `${color}40` }}>
                    <div style={styles.headerLeft}>
                        <div style={{ ...styles.iconBox, background: `${color}18`, border: `1px solid ${color}33` }}>
                            <span style={{ fontSize: '1.1rem' }}>{typeIcons[community.type] || <span style={{ fontSize: '0.7rem' }}>●</span>}</span>
                        </div>
                        <div>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {community.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'Fira Code' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Users size={13} /> {community.memberIds.length} members</span>
                            </div>
                        </div>
                    </div>
                    <div style={styles.headerActions}>
                        <button style={{ ...styles.iconBtn, color: 'var(--neon-green)' }} title="Start audio call" onClick={() => setShowCallPrompt('audio')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006.94 6.94l1.51-1.51a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                            </svg>
                        </button>
                        <button style={{ ...styles.iconBtn, color: 'var(--neon-cyan)' }} title="Start video call" onClick={() => setShowCallPrompt('video')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                        </button>
                        <button style={{ ...styles.iconBtn, color: 'var(--text-dim)' }} onClick={onClose} title="Close chat">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── Active Call Bar ── */}
                {callState.active && (
                    <div style={{ ...styles.callBar, borderColor: callState.type === 'video' ? 'var(--neon-cyan)40' : 'var(--neon-green)40', background: callState.type === 'video' ? 'rgba(0,255,255,0.05)' : 'rgba(52,211,153,0.05)' }}>
                        {callState.type === 'video' && (
                            <div style={styles.videoArea}>
                                <div style={styles.videoMain}>
                                    {callState.videoOff
                                        ? <div style={styles.videoOff}><User size={32} /><span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'Fira Code', marginTop: '0.4rem' }}>Camera off</span></div>
                                        : <div style={styles.videoFeed}><div style={styles.videoScanline} /><span style={{ color: 'var(--neon-cyan)', fontSize: '0.7rem', fontFamily: 'Fira Code', opacity: 0.7 }}>LIVE</span></div>
                                    }
                                    <div style={styles.videoLabel}>NeonRider</div>
                                </div>
                                <div style={styles.videoSelf}>
                                    {callState.videoOff
                                        ? <div style={{ ...styles.videoOff, fontSize: '0.8rem' }}><Camera size={16} /></div>
                                        : <div style={{ ...styles.videoFeed, background: 'linear-gradient(135deg, #0d1117 0%, #1a0533 100%)' }}><div style={styles.videoScanline} /></div>
                                    }
                                    <div style={{ ...styles.videoLabel, fontSize: '0.65rem' }}>You</div>
                                </div>
                            </div>
                        )}
                        <div style={styles.callControls}>
                            <div style={styles.callInfo}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: callState.type === 'video' ? 'var(--neon-cyan)' : 'var(--neon-green)', display: 'inline-block', marginRight: '0.5rem', boxShadow: `0 0 6px ${callState.type === 'video' ? 'var(--neon-cyan)' : 'var(--neon-green)'}`, animation: 'pulse 1.5s infinite' }} />
                                <span style={{ fontFamily: 'Fira Code', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>{callState.type === 'video' ? <><Video size={13} /> Video</> : <><Mic size={13} /> Audio</>} Call · {formatDuration(callState.duration)}</span>
                                </span>
                                <span style={{ fontFamily: 'Fira Code', fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: '0.75rem' }}>
                                    {callState.participants.join(', ')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    style={{ ...styles.callBtn, background: callState.muted ? 'rgba(255,0,85,0.2)' : 'rgba(255,255,255,0.06)', color: callState.muted ? 'var(--neon-pink)' : 'var(--text-secondary)' }}
                                    onClick={() => setCallState(p => ({ ...p, muted: !p.muted }))}
                                    title={callState.muted ? 'Unmute' : 'Mute'}
                                >
                                    <Mic size={14} />
                                </button>
                                {callState.type === 'video' && (
                                    <button
                                        style={{ ...styles.callBtn, background: callState.videoOff ? 'rgba(255,0,85,0.2)' : 'rgba(255,255,255,0.06)', color: callState.videoOff ? 'var(--neon-pink)' : 'var(--text-secondary)' }}
                                        onClick={() => setCallState(p => ({ ...p, videoOff: !p.videoOff }))}
                                        title={callState.videoOff ? 'Turn camera on' : 'Turn camera off'}
                                    >
                                        <Video size={14} />
                                    </button>
                                )}
                                <button
                                    style={{ ...styles.callBtn, background: 'rgba(255,0,85,0.25)', color: 'var(--neon-pink)', border: '1px solid rgba(255,0,85,0.4)' }}
                                    onClick={endCall} title="End call"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Messages ── */}
                <div style={styles.messages}>
                    {messages.map((msg, i) => {
                        const isOwn = msg.senderId === userId;
                        const isSystem = msg.type === 'system';
                        const prevMsg = messages[i - 1];
                        const showSender = !isSystem && (!prevMsg || prevMsg.senderId !== msg.senderId || prevMsg.type === 'system');

                        if (isSystem) return (
                            <div key={msg.id} style={styles.systemMsg}>
                                <span style={{ opacity: 0.4, fontSize: '0.7rem', margin: '0 0.5rem' }}>—</span>
                                {msg.content}
                                <span style={{ opacity: 0.4, fontSize: '0.7rem', margin: '0 0.5rem' }}>—</span>
                            </div>
                        );

                        return (
                            <div key={msg.id} style={{ ...styles.msgRow, justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: showSender ? '0.75rem' : '0.2rem' }}>
                                {!isOwn && showSender && <div style={styles.avatar}>{msg.senderName.slice(0, 2).toUpperCase()}</div>}
                                {!isOwn && !showSender && <div style={{ width: 32, flexShrink: 0 }} />}
                                <div style={{ maxWidth: '68%' }}>
                                    {showSender && !isOwn && <div style={styles.senderName}>{msg.senderName}</div>}
                                    <div style={{ ...styles.bubble, ...(isOwn ? styles.bubbleOwn : styles.bubbleOther) }}>
                                        {msg.content}
                                        <span style={styles.msgTime}>{formatTime(msg.timestamp)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* ── Input ── */}
                <div style={{ ...styles.inputRow, borderColor: `${color}25` }}>
                    <input
                        style={styles.input}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={`Message ${community.name}...`}
                    />
                    <button
                        style={{ ...styles.sendBtn, background: input.trim() ? `linear-gradient(135deg, ${color}, ${color}99)` : 'rgba(255,255,255,0.06)', cursor: input.trim() ? 'pointer' : 'default' }}
                        onClick={sendMessage}
                        disabled={!input.trim()}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#000' : 'var(--text-dim)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Call Prompt Modal ── */}
            {showCallPrompt && (
                <div style={styles.promptOverlay} onClick={() => setShowCallPrompt(null)}>
                    <div style={styles.promptBox} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{showCallPrompt === 'video' ? <Video size={20} /> : <Mic size={20} />}</span>
                        </div>
                        <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            Start {showCallPrompt} call?
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'Fira Code', marginBottom: '1.5rem' }}>
                            This will notify all members of {community.name}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn-gradient" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => startCall(showCallPrompt)}>Start</button>
                            <button className="btn-outline" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => setShowCallPrompt(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
                @keyframes scanline { 0%{top:-100%}100%{top:100%} }
            `}</style>
        </div>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    overlay: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '1rem', pointerEvents: 'none' },
    panel: { pointerEvents: 'all', width: '420px', height: '600px', display: 'flex', flexDirection: 'column', background: 'var(--bg-card, #0d1117)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderBottom: '1px solid', background: 'rgba(255,255,255,0.02)', flexShrink: 0 },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    headerActions: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
    iconBox: { width: 38, height: 38, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    iconBtn: { width: 34, height: 34, borderRadius: '8px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' },
    callBar: { borderBottom: '1px solid', background: 'rgba(0,0,0,0.2)', flexShrink: 0, overflow: 'hidden' },
    videoArea: { display: 'flex', gap: '0.5rem', padding: '0.75rem 0.75rem 0', height: '150px' },
    videoMain: { flex: 1, borderRadius: '10px', overflow: 'hidden', position: 'relative', background: '#080c12', border: '1px solid rgba(0,255,255,0.15)' },
    videoSelf: { width: '80px', borderRadius: '8px', overflow: 'hidden', position: 'relative', background: '#080c12', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 },
    videoFeed: { width: '100%', height: '100%', background: 'linear-gradient(135deg, #0a1628 0%, #0d1117 50%, #1a0533 100%)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    videoScanline: { position: 'absolute', left: 0, right: 0, height: '30%', background: 'linear-gradient(180deg, transparent, rgba(0,255,255,0.04), transparent)', animation: 'scanline 3s linear infinite' },
    videoOff: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0d13' },
    videoLabel: { position: 'absolute', bottom: 6, left: 8, fontSize: '0.7rem', fontFamily: 'Fira Code', color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: '4px' },
    callControls: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', gap: '0.5rem' },
    callInfo: { display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' },
    callBtn: { width: 30, height: 30, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' },
    messages: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem 1rem 0.5rem', display: 'flex', flexDirection: 'column' },
    systemMsg: { textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'Fira Code', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.75rem 0' },
    msgRow: { display: 'flex', alignItems: 'flex-end', gap: '0.5rem' },
    avatar: { width: 28, height: 28, borderRadius: '8px', flexShrink: 0, background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#000', fontFamily: 'Fira Code', marginBottom: 2 },
    senderName: { fontSize: '0.72rem', fontFamily: 'Fira Code', color: 'var(--text-dim)', marginBottom: '0.2rem', marginLeft: '0.25rem' },
    bubble: { padding: '0.55rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', lineHeight: 1.5, wordBreak: 'break-word', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' },
    bubbleOther: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', borderBottomLeftRadius: 4 },
    bubbleOwn: { background: 'linear-gradient(135deg, rgba(0,255,255,0.18), rgba(0,255,255,0.08))', border: '1px solid rgba(0,255,255,0.2)', color: 'var(--text-primary)', borderBottomRightRadius: 4 },
    msgTime: { fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'Fira Code', marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end' },
    inputRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid', background: 'rgba(255,255,255,0.02)', flexShrink: 0 },
    input: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.55rem 0.85rem', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none' },
    sendBtn: { width: 36, height: 36, borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 },
    promptOverlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    promptBox: { background: 'var(--bg-card, #0d1117)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', textAlign: 'center', width: '300px', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' },
};

// ─── Communities Main Page ────────────────────────────────────────────────────

const Communities: React.FC = () => {
    const { user } = useAuth();
    const [communities, setCommunities] = useState<Community[]>([]);
    const [active, setActive] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newType, setNewType] = useState('General');
    const [creating, setCreating] = useState(false);
    const [requestingId, setRequestingId] = useState<string | null>(null);
    // ── pendingSet: communityIds where the user's request is pending ──
    const [pendingSet, setPendingSet] = useState<Set<string>>(new Set());

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.get<Community[]>('/communities');
            const all = data || [];
            setCommunities(all);

            // Check pending requests for each non-member community
            const pendingIds: string[] = [];
            await Promise.all(
                all
                    .filter(c => !(c.memberIds || []).includes(user?.id ?? '') && c.createdBy !== user?.id)
                    .map(async (c) => {
                        try {
                            const reqs = await api.get<{ userId: string; status: string }[]>(`/communities/${c.id}/join-requests`);
                            const hasPending = (reqs || []).some(r => r.userId === user?.id && r.status === 'Pending');
                            if (hasPending) pendingIds.push(c.id);
                        } catch { }
                    })
            );
            if (pendingIds.length > 0) {
                setPendingSet(new Set(pendingIds));
            }
        } catch {
            setCommunities([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.id]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const c = await api.post<Community>('/communities', {
                name: newName.trim(), description: newDesc.trim(),
                type: newType, createdBy: user?.id, memberIds: [user?.id],
            });
            setCommunities(p => [...p, c]);
            setShowCreate(false); setNewName(''); setNewDesc(''); setNewType('General');
        } catch { }
        setCreating(false);
    };

    const handleJoin = async (c: Community) => {
        if (!user?.id) return;

        // Already a member — open chat directly
        if ((c.memberIds || []).includes(user.id) || c.createdBy === user.id) {
            setActive(c);
            return;
        }

        // Request is already pending
        if (pendingSet.has(c.id)) return;

        setRequestingId(c.id);
        try {
            await api.post(`/communities/${c.id}/join-request`, {
                userId: user.id,
                username: (user as any).username ?? (user as any).name ?? 'User',
            });
            setPendingSet(prev => new Set([...prev, c.id]));
            alert(`Join request has been sent for "${c.name}"! Wait for the admin to approve.`);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? '';
            if (msg.toLowerCase().includes('already')) {
                setPendingSet(prev => new Set([...prev, c.id]));
            } else {
                alert('An error occurred while sending the request. Please try again.');
            }
        }
        setRequestingId(null);
    };

    if (active) return <CommunityChat community={active} onClose={() => { setActive(null); load(); }} />;

    const typeAccents: Record<string, string> = { Developer: 'var(--accent)', Gamer: 'var(--success)', General: 'var(--warning)', Game: 'var(--info)' };
    const typeIconMap: Record<string, React.ReactNode> = { Developer: <Terminal size={14} />, Gamer: <Gamepad2 size={14} />, General: <Globe size={14} />, Game: <Joystick size={14} /> };

    return (
        <div className="container" style={{ maxWidth: 1050, margin: '0 auto' }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -1, left: 0, width: 80, height: 1, background: 'var(--gradient-accent)' }} />
                <div>
                    <div style={{ fontFamily: 'Fira Code', fontSize: '0.62rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
                        Communities
                    </div>
                    <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>All Communities</h1>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-gradient">+ Create</button>
            </div>

            {/* ── Create Modal ── */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreate(false)}>
                    <div className="card responsive-modal-card" style={{ width: 420, padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>Create Community</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input className="form-control" placeholder="Community Name" value={newName} onChange={e => setNewName(e.target.value)} />
                            <textarea className="form-control" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} style={{ resize: 'none' }} />
                            <select className="form-control" value={newType} onChange={e => setNewType(e.target.value)}>
                                <option>General</option><option>Developer</option><option>Gamer</option>
                            </select>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={handleCreate} disabled={creating} className="btn-gradient" style={{ flex: 1 }}>{creating ? 'Creating...' : 'Create'}</button>
                                <button onClick={() => setShowCreate(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Community Grid ── */}
            {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Fira Code', padding: '4rem' }}>Loading communities...</div>
            ) : communities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', border: '1px dashed var(--border)', borderRadius: 16 }}>
                    <Globe size={48} style={{ marginBottom: '1rem', color: 'var(--text-dim)' }} />
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>No Communities Yet</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Create the first community!</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                    {communities.map(c => {
                        const member = (c.memberIds || []).includes(user?.id ?? '') || c.createdBy === user?.id;
                        const isPending = pendingSet.has(c.id);
                        const isRequesting = requestingId === c.id;
                        const accent = typeAccents[c.type] || 'var(--accent)';
                        const communityIcon = typeIconMap[c.type] || <Globe size={14} />;
                        const memberCount = (c.memberIds || []).length;

                        return (
                            <div key={c.id} className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>

                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                                <div style={{ position: 'absolute', top: 0, right: 0, width: 130, height: 130, borderRadius: '50%', background: accent, opacity: 0.04, filter: 'blur(35px)', pointerEvents: 'none' }} />

                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}18`, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>{communityIcon}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{c.name}</div>
                                            <span style={{ fontFamily: 'Fira Code', fontSize: '0.63rem', color: accent, background: `${accent}15`, border: `1px solid ${accent}35`, padding: '2px 7px', borderRadius: 5 }}>{c.type}</span>
                                        </div>
                                    </div>
                                    {member && <span style={{ fontSize: '0.63rem', fontFamily: 'Fira Code', background: 'var(--success-soft)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '2px 8px', borderRadius: 6 }}>Joined</span>}
                                </div>

                                {/* Description */}
                                {c.description && (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</p>
                                )}

                                {/* Member bar */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <span style={{ fontFamily: 'Fira Code', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Members</span>
                                        <span style={{ fontFamily: 'Fira Code', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{memberCount}</span>
                                    </div>
                                    <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.min(100, memberCount * 10)}%`, background: accent, borderRadius: 99, transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>

                                {/* Action */}
                                <div style={{ marginTop: 'auto' }}>
                                    {member ? (
                                        <button onClick={() => setActive(c)} className="btn-gradient" style={{ width: '100%' }}>Open Chat →</button>
                                    ) : isPending ? (
                                        <div style={{ textAlign: 'center', padding: '0.6rem', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 8, color: 'var(--warning)', fontFamily: 'Fira Code', fontSize: '0.75rem' }}>⏳ Pending Approval</div>
                                    ) : (
                                        <button onClick={() => handleJoin(c)} disabled={isRequesting} className="btn-outline" style={{ width: '100%' }}>{isRequesting ? 'Sending...' : 'Request to Join'}</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export { Communities as default };