import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { User, Video, Mic } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Squad {
    id: string;
    name: string;
    projectId: string;
    members: string[];
    vacancyRoles: string[];
    createdBy?: string;
}

interface Message {
    id: string;
    squadId: string;
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

const roleColors = [
    'var(--neon-cyan)',
    'var(--neon-purple)',
    'var(--neon-green)',
    'var(--neon-pink)',
    'var(--neon-yellow)',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

const MOCK_MESSAGES: Message[] = [
    { id: '1', squadId: '', senderId: 'sys', senderName: 'System', content: "Squad channel initialised. Let's build something great.", timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'system' },
    { id: '2', squadId: '', senderId: 'u1', senderName: 'PixelForge', content: "Hey team! Ready for today's sprint!", timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'text' },
    { id: '3', squadId: '', senderId: 'u2', senderName: 'VoidCraft', content: 'Yep, finishing up the shader module now', timestamp: new Date(Date.now() - 1800000).toISOString(), type: 'text' },
];

// ─── SquadChat Component ──────────────────────────────────────────────────────

const SquadChat: React.FC<{ squad: Squad; onClose: () => void }> = ({ squad, onClose }) => {
    const { user } = useAuth();
    const userId = user?.id ?? '';
    const userName = (user as any)?.username ?? (user as any)?.name ?? 'You';

    const [messages, setMessages] = useState<Message[]>(
        MOCK_MESSAGES.map(m => ({ ...m, squadId: squad.id }))
    );
    const [input, setInput] = useState('');
    const [callState, setCallState] = useState<CallState>({
        active: false, type: null, participants: [],
        muted: false, videoOff: false, duration: 0,
    });
    const [showCallPrompt, setShowCallPrompt] = useState<'audio' | 'video' | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (callState.active) {
            timerRef.current = setInterval(() =>
                setCallState(p => ({ ...p, duration: p.duration + 1 })), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [callState.active]);

    useEffect(() => {
        const poll = setInterval(async () => {
            try {
                const data = await api.get<Message[]>(`/squads/${squad.id}/messages`);
                if (data?.length) setMessages(data);
            } catch { }
        }, 5000);
        return () => clearInterval(poll);
    }, [squad.id]);

    const sendMessage = async () => {
        const content = input.trim();
        if (!content) return;
        const msg: Message = {
            id: Date.now().toString(),
            squadId: squad.id,
            senderId: userId,
            senderName: userName,
            content,
            timestamp: new Date().toISOString(),
            type: 'text',
        };
        setMessages(prev => [...prev, msg]);
        setInput('');
        try { await api.post(`/squads/${squad.id}/messages`, msg); } catch { }
    };

    const startCall = (type: 'audio' | 'video') => {
        setShowCallPrompt(null);
        setCallState({ active: true, type, participants: [userName, ...squad.members.slice(0, 2)], muted: false, videoOff: false, duration: 0 });
        setMessages(prev => [...prev, {
            id: Date.now().toString(), squadId: squad.id,
            senderId: 'sys', senderName: 'System',
            content: `${userName} started a ${type} call`,
            timestamp: new Date().toISOString(), type: 'system',
        }]);
    };

    const endCall = () => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(), squadId: squad.id,
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
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <div style={styles.avatarStack}>
                            {squad.members.slice(0, 3).map((m, i) => (
                                <div key={i} style={{
                                    ...styles.stackAvatar,
                                    background: roleColors[i % roleColors.length],
                                    left: i * 18,
                                    zIndex: 3 - i,
                                    boxShadow: `0 0 0 2px var(--bg-card, #0d1117), 0 0 8px ${roleColors[i % roleColors.length]}55`,
                                }}>
                                    {m[0].toUpperCase()}
                                </div>
                            ))}
                        </div>
                        <div style={{ marginLeft: squad.members.length > 0 ? `${Math.min(squad.members.length, 3) * 18 + 8}px` : '0.75rem' }}>
                            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {squad.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                                #{squad.projectId} · {squad.members.length} members
                            </div>
                        </div>
                    </div>
                    <div style={styles.headerActions}>
                        <button style={{ ...styles.iconBtn, color: 'var(--neon-green)' }} title="Audio call" onClick={() => setShowCallPrompt('audio')}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006.94 6.94l1.51-1.51a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                            </svg>
                        </button>
                        <button style={{ ...styles.iconBtn, color: 'var(--neon-cyan)' }} title="Video call" onClick={() => setShowCallPrompt('video')}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                        </button>
                        <button style={{ ...styles.iconBtn, color: 'var(--text-dim)' }} title="Close" onClick={onClose}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── Active Call Bar ── */}
                {callState.active && (
                    <div style={{
                        ...styles.callBar,
                        borderColor: callState.type === 'video' ? 'rgba(0,255,255,0.25)' : 'rgba(0,255,136,0.25)',
                        background: callState.type === 'video' ? 'rgba(0,255,255,0.04)' : 'rgba(0,255,136,0.04)',
                    }}>
                        {callState.type === 'video' && (
                            <div style={styles.videoArea}>
                                <div style={styles.videoMain}>
                                    {callState.videoOff
                                        ? <div style={styles.videoOff}><User size={32} /><span style={styles.videoOffLabel}>Camera off</span></div>
                                        : <div style={styles.videoFeed}><div style={styles.scanline} /><span style={styles.liveBadge}>LIVE</span></div>
                                    }
                                    <div style={styles.videoLabel}>{callState.participants[1] ?? 'Member'}</div>
                                </div>
                                <div style={styles.videoSelf}>
                                    {callState.videoOff
                                        ? <div style={{ ...styles.videoOff, fontSize: '0.8rem' }}><User size={16} /></div>
                                        : <div style={{ ...styles.videoFeed, background: 'linear-gradient(135deg,#0d1117,#1a0533)' }}><div style={styles.scanline} /></div>
                                    }
                                    <div style={{ ...styles.videoLabel, fontSize: '0.64rem' }}>You</div>
                                </div>
                            </div>
                        )}
                        <div style={styles.callControls}>
                            <div style={styles.callInfo}>
                                <span style={{
                                    width: 7, height: 7, borderRadius: '50%', display: 'inline-block', marginRight: '0.5rem', flexShrink: 0,
                                    background: callState.type === 'video' ? 'var(--neon-cyan)' : 'var(--neon-green)',
                                    boxShadow: `0 0 6px ${callState.type === 'video' ? 'var(--neon-cyan)' : 'var(--neon-green)'}`,
                                    animation: 'sqPulse 1.5s infinite',
                                }} />
                                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>{callState.type === 'video' ? <><Video size={13} /> Video</> : <><Mic size={13} /> Audio</>} · {formatDuration(callState.duration)}</span>
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                    style={{ ...styles.callBtn, background: callState.muted ? 'rgba(255,0,85,0.2)' : 'rgba(255,255,255,0.06)', color: callState.muted ? 'var(--neon-pink)' : 'var(--text-secondary)', border: `1px solid ${callState.muted ? 'rgba(255,0,85,0.35)' : 'rgba(255,255,255,0.1)'}` }}
                                    onClick={() => setCallState(p => ({ ...p, muted: !p.muted }))}
                                    title={callState.muted ? 'Unmute' : 'Mute'}
                                >
                                    <Mic size={13} />
                                </button>
                                {callState.type === 'video' && (
                                    <button
                                        style={{ ...styles.callBtn, background: callState.videoOff ? 'rgba(255,0,85,0.2)' : 'rgba(255,255,255,0.06)', color: callState.videoOff ? 'var(--neon-pink)' : 'var(--text-secondary)', border: `1px solid ${callState.videoOff ? 'rgba(255,0,85,0.35)' : 'rgba(255,255,255,0.1)'}` }}
                                        onClick={() => setCallState(p => ({ ...p, videoOff: !p.videoOff }))}
                                        title={callState.videoOff ? 'Camera on' : 'Camera off'}
                                    >
                                        <Video size={13} />
                                    </button>
                                )}
                                <button
                                    style={{ ...styles.callBtn, background: 'rgba(255,0,85,0.25)', color: 'var(--neon-pink)', border: '1px solid rgba(255,0,85,0.4)' }}
                                    onClick={endCall} title="End call"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                                    </svg>
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
                        const prev = messages[i - 1];
                        const showSender = !isSystem && (!prev || prev.senderId !== msg.senderId || prev.type === 'system');
                        const memberIdx = squad.members.indexOf(msg.senderName);
                        const avatarColor = memberIdx >= 0 ? roleColors[memberIdx % roleColors.length] : roleColors[0];

                        if (isSystem) return (
                            <div key={msg.id} style={styles.systemMsg}>
                                <span style={{ opacity: 0.35, margin: '0 0.5rem', fontSize: '0.68rem' }}>◈</span>
                                {msg.content}
                                <span style={{ opacity: 0.35, margin: '0 0.5rem', fontSize: '0.68rem' }}>◈</span>
                            </div>
                        );

                        return (
                            <div key={msg.id} style={{ ...styles.msgRow, justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: showSender ? '0.8rem' : '0.2rem' }}>
                                {!isOwn && showSender && (
                                    <div style={{ ...styles.avatar, background: avatarColor, boxShadow: `0 0 8px ${avatarColor}44` }}>
                                        {msg.senderName.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                {!isOwn && !showSender && <div style={{ width: 30, flexShrink: 0 }} />}
                                <div style={{ maxWidth: '68%' }}>
                                    {showSender && !isOwn && (
                                        <div style={{ ...styles.senderName, color: avatarColor }}>{msg.senderName}</div>
                                    )}
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
                <div style={styles.inputRow}>
                    <input
                        style={styles.input}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={`Message ${squad.name}...`}
                    />
                    <button
                        style={{ ...styles.sendBtn, background: input.trim() ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' : 'rgba(255,255,255,0.06)', cursor: input.trim() ? 'pointer' : 'default' }}
                        onClick={sendMessage}
                        disabled={!input.trim()}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#000' : 'var(--text-dim)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Call Prompt ── */}
            {showCallPrompt && (
                <div style={styles.promptOverlay} onClick={() => setShowCallPrompt(null)}>
                    <div style={styles.promptBox} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{showCallPrompt === 'video' ? <Video size={20} /> : <Mic size={20} />}</span>
                        </div>
                        <h3 style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                            Start {showCallPrompt} call?
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', marginBottom: '1.5rem' }}>
                            Notifies all {squad.members.length} members of {squad.name}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn-gradient" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => startCall(showCallPrompt)}>
                                Start
                            </button>
                            <button className="btn-outline" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => setShowCallPrompt(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes sqPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
                @keyframes sqScanline { 0%{top:-100%} 100%{top:100%} }
            `}</style>
        </div>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        padding: '1rem', pointerEvents: 'none',
    },
    panel: {
        pointerEvents: 'all',
        width: '420px', height: '600px',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card, #0d1117)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)', flexShrink: 0,
    },
    headerLeft: { display: 'flex', alignItems: 'center', position: 'relative', flex: 1 },
    headerActions: { display: 'flex', alignItems: 'center', gap: '0.2rem' },
    avatarStack: { position: 'relative', height: 34, width: 70, flexShrink: 0 },
    stackAvatar: {
        position: 'absolute', top: 0,
        width: 28, height: 28, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6rem', fontWeight: 800, color: '#000',
        fontFamily: 'Orbitron, monospace',
    },
    iconBtn: {
        width: 32, height: 32, borderRadius: '8px',
        border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
    },
    callBar: { borderBottom: '1px solid', flexShrink: 0, overflow: 'hidden' },
    videoArea: { display: 'flex', gap: '0.5rem', padding: '0.75rem 0.75rem 0', height: '148px' },
    videoMain: {
        flex: 1, borderRadius: '10px', overflow: 'hidden',
        position: 'relative', background: '#080c12',
        border: '1px solid rgba(0,255,255,0.15)',
    },
    videoSelf: {
        width: '76px', borderRadius: '8px', overflow: 'hidden',
        position: 'relative', background: '#080c12',
        border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
    },
    videoFeed: {
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg,#0a1628,#0d1117 50%,#150528)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    scanline: {
        position: 'absolute', left: 0, right: 0, height: '30%',
        background: 'linear-gradient(180deg,transparent,rgba(0,255,255,0.04),transparent)',
        animation: 'sqScanline 3s linear infinite',
    },
    liveBadge: {
        position: 'absolute', top: 6, left: 8,
        color: 'var(--neon-cyan)', fontSize: '0.65rem',
        fontFamily: 'JetBrains Mono', opacity: 0.8,
        background: 'rgba(0,0,0,0.45)', padding: '1px 5px', borderRadius: '3px',
    },
    videoOff: {
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0a0d13',
    },
    videoOffLabel: { fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', marginTop: '0.4rem' },
    videoLabel: {
        position: 'absolute', bottom: 5, left: 7,
        fontSize: '0.68rem', fontFamily: 'JetBrains Mono',
        color: 'rgba(255,255,255,0.65)',
        background: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: '3px',
    },
    callControls: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.55rem 0.75rem', gap: '0.5rem',
    },
    callInfo: { display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' },
    callBtn: {
        width: 28, height: 28, borderRadius: '7px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
    },
    messages: {
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '0.75rem 1rem 0.5rem',
        display: 'flex', flexDirection: 'column',
    },
    systemMsg: {
        textAlign: 'center', fontSize: '0.7rem',
        color: 'var(--text-dim)', fontFamily: 'JetBrains Mono',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0.75rem 0', letterSpacing: '0.03em',
    },
    msgRow: { display: 'flex', alignItems: 'flex-end', gap: '0.45rem' },
    avatar: {
        width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.58rem', fontWeight: 800, color: '#000',
        fontFamily: 'Orbitron, monospace', marginBottom: 2,
    },
    senderName: {
        fontSize: '0.7rem', fontFamily: 'JetBrains Mono',
        marginBottom: '0.2rem', marginLeft: '0.2rem',
    },
    bubble: {
        padding: '0.52rem 0.72rem',
        borderRadius: '12px', fontSize: '0.84rem', lineHeight: 1.5,
        wordBreak: 'break-word',
        display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexWrap: 'wrap',
    },
    bubbleOther: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-primary)', borderBottomLeftRadius: 4,
    },
    bubbleOwn: {
        background: 'linear-gradient(135deg,rgba(180,0,255,0.18),rgba(0,255,255,0.1))',
        border: '1px solid rgba(180,0,255,0.25)',
        color: 'var(--text-primary)', borderBottomRightRadius: 4,
    },
    msgTime: {
        fontSize: '0.63rem', color: 'var(--text-dim)',
        fontFamily: 'JetBrains Mono', marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end',
    },
    inputRow: {
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.7rem',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)', flexShrink: 0,
    },
    input: {
        flex: 1, background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px', padding: '0.52rem 0.82rem',
        color: 'var(--text-primary)', fontFamily: 'inherit',
        fontSize: '0.84rem', outline: 'none',
    },
    sendBtn: {
        width: 34, height: 34, borderRadius: '10px',
        border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', flexShrink: 0,
    },
    promptOverlay: {
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    promptBox: {
        background: 'var(--bg-card,#0d1117)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '2rem',
        textAlign: 'center', width: '300px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
    },
};

// ─── SquadManagement Main Page ───────────────────────────────────────────────

const SquadManagement: React.FC = () => {
    const { user } = useAuth();
    const [squads, setSquads] = useState<Squad[]>([]);
    const [activeSquad, setActiveSquad] = useState<Squad | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newProjectId, setNewProjectId] = useState('');
    const [creating, setCreating] = useState(false);
    // ── Join request state ──
    const [requestingId, setRequestingId] = useState<string | null>(null);
    // pendingSet: squadIds where the user's request is already pending
    const [pendingSet, setPendingSet] = useState<Set<string>>(new Set());

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.get<Squad[]>('/squads');
            const allSquads = data || [];
            setSquads(allSquads);

            // Check join-requests for each squad — if the user's request is pending, add it to pendingSet
            const pendingIds: string[] = [];
            await Promise.all(
                allSquads
                    .filter(s => !((s.members || []).includes(user?.id ?? '') || s.createdBy === user?.id))
                    .map(async (s) => {
                        try {
                            const reqs = await api.get<{ userId: string; status: string }[]>(`/squads/${s.id}/join-requests`);
                            const hasPending = (reqs || []).some(r => r.userId === user?.id && r.status === 'Pending');
                            if (hasPending) pendingIds.push(s.id);
                        } catch { }
                    })
            );
            if (pendingIds.length > 0) {
                setPendingSet(new Set(pendingIds));
            }
        } catch {
            setSquads([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.id]);

    // ── Check whether the user is a member of a squad ──
    const isMember = (squad: Squad) =>
        (squad.members || []).includes(user?.id ?? '') ||
        (squad as any).createdBy === user?.id;

    // ── Submit a join request ──
    const handleJoin = async (squad: Squad) => {
        if (!user?.id) return;

        // If already a member, open chat directly
        if (isMember(squad)) {
            setActiveSquad(squad);
            return;
        }

        // If the request is already pending
        if (pendingSet.has(squad.id)) return;

        setRequestingId(squad.id);
        try {
            await api.post(`/squads/${squad.id}/join-request`, {
                userId: user.id,
                username: (user as any).username ?? (user as any).name ?? 'User',
            });
            // Mark as pending in local state
            setPendingSet(prev => new Set([...prev, squad.id]));
            alert(`Join request sent for "${squad.name}"! Please wait for admin approval.`);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? '';
            if (msg.toLowerCase().includes('already')) {
                // Backend says already pending — show as pending in UI too
                setPendingSet(prev => new Set([...prev, squad.id]));
            } else {
                alert('Error sending request. Please try again.');
            }
        }
        setRequestingId(null);
    };

    const handleCreate = async () => {
        if (!newName.trim() || !newProjectId.trim()) return;
        setCreating(true);
        try {
            const squad = await api.post<Squad>('/squads', {
                name: newName.trim(),
                projectId: newProjectId.trim(),
                createdBy: user?.id,
                members: [user?.id],
                vacancyRoles: [],
            });
            setSquads(prev => [...prev, squad]);
            setNewName(''); setNewProjectId('');
            setShowCreate(false);
        } catch { }
        setCreating(false);
    };

    if (activeSquad) return <SquadChat squad={activeSquad} onClose={() => { setActiveSquad(null); load(); }} />;

    const accentColors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--info)'];

    return (
        <div className="container" style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* ── Page Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -1, left: 0, width: 80, height: 1, background: 'var(--gradient-accent)' }} />
                <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
                        Squad Management
                    </div>
                    <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>My Squads</h1>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-gradient">+ Create Squad</button>
            </div>

            {/* ── Create Modal ── */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreate(false)}>
                    <div className="card responsive-modal-card" style={{ width: 400, padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>Create Squad</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input className="form-control" placeholder="Squad Name" value={newName} onChange={e => setNewName(e.target.value)} />
                            <input className="form-control" placeholder="Project ID (e.g. PROJ-001)" value={newProjectId} onChange={e => setNewProjectId(e.target.value)} />
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={handleCreate} disabled={creating} className="btn-gradient" style={{ flex: 1 }}>{creating ? 'Creating...' : 'Create'}</button>
                                <button onClick={() => setShowCreate(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Squad Grid ── */}
            {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', padding: '4rem' }}>Loading squads...</div>
            ) : squads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', border: '1px dashed var(--border)', borderRadius: 16 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚔️</div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>No Squads Yet</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Create a squad to start collaborating</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                    {squads.map((squad, idx) => {
                        const member = isMember(squad);
                        const isPending = pendingSet.has(squad.id);
                        const isRequesting = requestingId === squad.id;
                        const accent = accentColors[idx % accentColors.length];
                        const memberCount = (squad.members || []).length;
                        const fillPct = Math.min(100, memberCount * 20);

                        return (
                            <div key={squad.id} className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>

                                {/* Accent bar */}
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                                {/* Glow bg */}
                                <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderRadius: '50%', background: accent, opacity: 0.04, filter: 'blur(30px)', pointerEvents: 'none' }} />

                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${accent}18`, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⚔️</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{squad.name}</div>
                                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: accent }}>#{squad.projectId}</div>
                                        </div>
                                    </div>
                                    {member && <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono', background: 'var(--success-soft)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '2px 8px', borderRadius: 6 }}>Member</span>}
                                </div>

                                {/* Member capacity bar */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Team Size</span>
                                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{memberCount} members</span>
                                    </div>
                                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${fillPct}%`, background: accent, borderRadius: 99, transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>

                                {/* Vacancy roles */}
                                {squad.vacancyRoles?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        {squad.vacancyRoles.slice(0, 4).map((role, i) => (
                                            <span key={i} style={{ fontFamily: 'JetBrains Mono', fontSize: '0.63rem', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--text-accent)', padding: '2px 8px', borderRadius: 6 }}>{role}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Action */}
                                <div style={{ marginTop: 'auto' }}>
                                    {member ? (
                                        <button onClick={() => setActiveSquad(squad)} className="btn-gradient" style={{ width: '100%' }}>Open Chat →</button>
                                    ) : isPending ? (
                                        <div style={{ textAlign: 'center', padding: '0.6rem', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 8, color: 'var(--warning)', fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>⏳ Pending Approval</div>
                                    ) : (
                                        <button onClick={() => handleJoin(squad)} disabled={isRequesting} className="btn-outline" style={{ width: '100%' }}>{isRequesting ? 'Sending...' : 'Request to Join'}</button>
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

export { SquadManagement as default };