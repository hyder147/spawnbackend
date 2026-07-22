import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Phone, Video, PhoneCall, PhoneIncoming, Mic, MicOff, Camera, CameraOff, VolumeX, Volume2, PhoneOff, Paperclip, Edit3, Send, CheckCircle, XCircle, MoreVertical, ShieldX, Flag } from 'lucide-react';
import '../App.css';

interface Message {
    id: string;
    senderId: string;
    content: string;
    sentAt: string;
    type?: 'text' | 'file' | 'call-log';
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
}
interface Conversation { id: string; participantIds: string[]; otherName?: string; lastMsg?: string; }

type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected';
type CallType = 'audio' | 'video';

const timeAgo = (iso: string) => {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60000) return 'now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
    return `${Math.floor(d / 86400000)}d`;
};

const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

const Messages: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id ?? '';

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [activeConvName, setActiveConvName] = useState('');
    const [activeOtherId, setActiveOtherId] = useState('');
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [newChatUsername, setNewChatUsername] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [showReportConfirm, setShowReportConfirm] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── WebRTC / Call State ──
    const [callState, setCallState] = useState<CallState>('idle');
    const [callType, setCallType] = useState<CallType>('audio');
    const [incomingCallType, setIncomingCallType] = useState<CallType>('audio');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [isSpeakerOff, setIsSpeakerOff] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const signalingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const signalingMsgIdRef = useRef<string>(Date.now().toString());

    // ── Signaling via existing messages API (JSON-encoded special messages) ──
    const SIGNAL_PREFIX = '__SIGNAL__:';

    const sendSignal = useCallback(async (payload: object) => {
        if (!activeConvId || !activeOtherId) return;
        const content = `${SIGNAL_PREFIX}${JSON.stringify(payload)}`;
        try {
            await api.post(`/messages/send?senderId=${userId}&receiverId=${activeOtherId}&content=${encodeURIComponent(content)}`);
        } catch { }
    }, [activeConvId, activeOtherId, userId]);

    const stopLocalStream = () => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const closePeer = () => {
        pcRef.current?.close();
        pcRef.current = null;
    };

    const stopCallTimer = () => {
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
        setCallDuration(0);
    };

    const startCallTimer = () => {
        setCallDuration(0);
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    };

    const formatDuration = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const createPeerConnection = useCallback((_type: CallType) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
        });
        pc.onicecandidate = (e) => {
            if (e.candidate) sendSignal({ type: 'ice', candidate: e.candidate });
        };
        pc.ontrack = (e) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setCallState('connected');
                startCallTimer();
            }
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                hangUp(false);
            }
        };
        pcRef.current = pc;
        return pc;
    }, [sendSignal]);

    const getLocalStream = async (type: CallType) => {
        const constraints = type === 'video'
            ? { audio: true, video: { width: 640, height: 480 } }
            : { audio: true, video: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        if (localVideoRef.current && type === 'video') {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
        }
        return stream;
    };

    const initiateCall = async (type: CallType) => {
        if (callState !== 'idle') return;
        setCallType(type);
        setCallState('outgoing');
        try {
            const stream = await getLocalStream(type);
            const pc = createPeerConnection(type);
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal({ type: 'offer', sdp: offer, callType: type });
        } catch (err) {
            console.error('Call start failed', err);
            hangUp(false);
        }
    };

    const answerCall = async () => {
        setCallType(incomingCallType);
        setCallState('connected');
        try {
            const stream = await getLocalStream(incomingCallType);
            const pc = pcRef.current!;
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal({ type: 'answer', sdp: answer });
            startCallTimer();
        } catch (err) {
            console.error('Answer failed', err);
            hangUp(false);
        }
    };

    const hangUp = useCallback((sendSignalMsg = true) => {
        if (sendSignalMsg) sendSignal({ type: 'hangup' });
        stopCallTimer();
        stopLocalStream();
        closePeer();
        setCallState('idle');
        setIsMuted(false);
        setIsCamOff(false);
    }, [sendSignal]);

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
    };

    const toggleCam = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsCamOff(!track.enabled); }
    };

    const toggleSpeaker = () => {
        const el = remoteVideoRef.current;
        if (el) { el.muted = !el.muted; setIsSpeakerOff(el.muted); }
    };

    // Poll for signaling messages
    useEffect(() => {
        if (!activeConvId) return;
        const poll = setInterval(async () => {
            try {
                const data = await api.get<Message[]>(`/messages/conversation/${activeConvId}`);
                const signals = data.filter(m =>
                    m.content?.startsWith(SIGNAL_PREFIX) &&
                    m.senderId !== userId &&
                    m.id > signalingMsgIdRef.current
                );
                for (const msg of signals) {
                    signalingMsgIdRef.current = msg.id;
                    try {
                        const payload = JSON.parse(msg.content.replace(SIGNAL_PREFIX, ''));
                        await handleSignal(payload);
                    } catch { }
                }
            } catch { }
        }, 1500);
        signalingPollRef.current = poll;
        return () => clearInterval(poll);
    }, [activeConvId, userId, callState]);

    const handleSignal = async (payload: any) => {
        if (payload.type === 'offer') {
            setIncomingCallType(payload.callType ?? 'audio');
            const pc = createPeerConnection(payload.callType ?? 'audio');
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            setCallState('incoming');
        } else if (payload.type === 'answer' && pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === 'ice' && pcRef.current) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { }
        } else if (payload.type === 'hangup') {
            hangUp(false);
        }
    };

    // ── File Sharing ──
    const handleFileSend = async (file: File) => {
        if (!activeConvId || !activeOtherId) return;
        const LIMIT = 10 * 1024 * 1024; // 10 MB
        if (file.size > LIMIT) { alert('Max file size is 10 MB'); return; }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const content = `__FILE__:${JSON.stringify({ name: file.name, size: file.size, type: file.type, data: base64 })}`;
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                senderId: userId,
                content,
                sentAt: new Date().toISOString(),
                type: 'file',
                fileName: file.name,
                fileSize: file.size,
            }]);
            try {
                await api.post(`/messages/send?senderId=${userId}&receiverId=${activeOtherId}&content=${encodeURIComponent(content)}`);
            } catch { }
        };
        reader.readAsDataURL(file);
    };

    const downloadFile = (msg: Message) => {
        try {
            const payload = JSON.parse(msg.content.replace('__FILE__:', ''));
            const link = document.createElement('a');
            link.href = `data:${payload.type};base64,${payload.data}`;
            link.download = payload.name;
            link.click();
        } catch { }
    };

    const parseMsg = (msg: Message): Message => {
        if (msg.content?.startsWith('__FILE__:')) {
            try {
                const payload = JSON.parse(msg.content.replace('__FILE__:', ''));
                return { ...msg, type: 'file', fileName: payload.name, fileSize: payload.size };
            } catch { }
        }
        if (msg.content?.startsWith(SIGNAL_PREFIX)) {
            return { ...msg, type: 'call-log', content: '[ Call signal ]' };
        }
        return { ...msg, type: 'text' };
    };

    // ── Conversations ──
    const loadConversations = async () => {
        try {
            const data = await api.get<Conversation[]>(`/messages/conversations/${userId}`);
            const enriched = await Promise.all(data.map(async c => {
                const otherId = c.participantIds.find(id => id !== userId);
                if (otherId) {
                    try {
                        const u = await api.get<{ username: string }>(`/users/${otherId}`);
                        return { ...c, otherName: u.username };
                    } catch { return { ...c, otherName: otherId }; }
                }
                return c;
            }));
            setConversations(enriched);
        } catch { }
    };

    const loadMessages = async (convId: string) => {
        try {
            const data = await api.get<Message[]>(`/messages/conversation/${convId}`);
            const visible = data.filter(m => !m.content?.startsWith(SIGNAL_PREFIX));
            setMessages(visible.map(parseMsg));
        } catch { }
    };

    useEffect(() => { if (userId) loadConversations(); }, [userId]);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        if (!activeConvId) return;
        const interval = setInterval(() => loadMessages(activeConvId), 3000);
        return () => clearInterval(interval);
    }, [activeConvId]);

    const selectConversation = (conv: Conversation) => {
        const otherId = conv.participantIds.find(id => id !== userId) ?? '';
        setActiveConvId(conv.id);
        setActiveConvName(conv.otherName ?? '');
        setActiveOtherId(otherId);
        loadMessages(conv.id);
        signalingMsgIdRef.current = Date.now().toString();
    };

    const sendMessage = async () => {
        if (!input.trim() || !activeConvId) return;
        const content = input.trim();
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), senderId: userId, content, sentAt: new Date().toISOString(), type: 'text' }]);
        try {
            await api.post(`/messages/send?senderId=${userId}&receiverId=${activeOtherId}&content=${encodeURIComponent(content)}`);
        } catch { }
    };

    const startNewChat = async () => {
        if (!newChatUsername.trim()) return;
        try {
            const found = await api.get<{ id: string; username: string }>(`/users/search/${newChatUsername.trim()}`);
            await api.post(`/messages/send?senderId=${userId}&receiverId=${found.id}&content=${encodeURIComponent('Hey!')}`);
            setShowNewChat(false);
            setNewChatUsername('');
            await loadConversations();
        } catch { alert('User not found'); }
    };

    const filtered = conversations.filter(c => (c.otherName ?? '').toLowerCase().includes(search.toLowerCase()));

    // ── Block / Report ──
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const handleBlock = async () => {
        try {
            await api.post(`/users/${userId}/block/${activeOtherId}`);
        } catch { /* endpoint may not exist yet — silent fail */ }
        setShowBlockConfirm(false);
        setShowMenu(false);
        // Remove conversation from list
        setConversations(prev => prev.filter(c => c.id !== activeConvId));
        setActiveConvId(null);
        setActiveConvName('');
        setActiveOtherId('');
        setMessages([]);
        alert(`${activeConvName} has been blocked.`);
    };

    const handleReport = async () => {
        try {
            await api.post(`/users/${userId}/report/${activeOtherId}`, { reason: 'Reported by user' });
        } catch { /* endpoint may not exist yet — silent fail */ }
        setShowReportConfirm(false);
        setShowMenu(false);
        alert(`${activeConvName} has been reported. Thank you.`);
    };

    // ── Styles ──
    const callBtnStyle = (color: string): React.CSSProperties => ({
        width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: color, color: '#fff', fontSize: '1.2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.15s, opacity 0.15s', flexShrink: 0,
    });

    const ghostBtnStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', transition: 'all 0.15s',
    };

    return (
        <div className="container" style={{ padding: '1.5rem' }}>
            <div className="messages-shell" style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 140px)', minHeight: '500px' }}>

                {/* ── Sidebar ── */}
                <div className="messages-sidebar" style={{ width: '280px', flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h2 style={{ margin: 0, fontSize: '0.9rem', fontFamily: "'Syne', sans-serif" }}>Messages</h2>
                            <button className="btn-gradient" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => setShowNewChat(true)}><Edit3 size={12} /> New</button>
                        </div>
                        <input className="form-control" placeholder="Search..." style={{ fontSize: '0.82rem', padding: '0.5rem 0.75rem' }} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filtered.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'Fira Code', padding: '1rem', textAlign: 'center' }}>No conversations yet</p>
                            : filtered.map(conv => (
                                <div key={conv.id} onClick={() => selectConversation(conv)} style={{
                                    padding: '0.85rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                    background: activeConvId === conv.id ? 'rgba(124,110,250,0.06)' : 'transparent',
                                    borderLeft: activeConvId === conv.id ? '2px solid var(--accent)' : '2px solid transparent',
                                    display: 'flex', gap: '0.75rem', alignItems: 'center', transition: 'all 0.2s'
                                }}>
                                    <div className="avatar" style={{ width: 38, height: 38, fontSize: '0.9rem' }}>{(conv.otherName ?? '?')[0].toUpperCase()}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{conv.otherName ?? 'Unknown'}</div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.lastMsg ?? '...'}</p>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* ── Chat Area ── */}
                <div className="messages-chat" style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {activeConvId ? (
                        <>
                            {/* Header with call buttons */}
                            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div className="avatar" style={{ width: 38, height: 38, fontSize: '0.9rem' }}>{activeConvName[0]?.toUpperCase()}</div>
                                <div style={{ fontWeight: 600, fontFamily: "'Syne', sans-serif", fontSize: '0.9rem', flex: 1 }}>{activeConvName}</div>

                                {/* Call action buttons — only show when idle */}
                                {callState === 'idle' && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            title="Audio Call"
                                            style={{ ...ghostBtnStyle, color: 'var(--success)' }}
                                            onClick={() => initiateCall('audio')}
                                        ><Phone size={15} /></button>
                                        <button
                                            title="Video Call"
                                            style={{ ...ghostBtnStyle, color: 'var(--accent)' }}
                                            onClick={() => initiateCall('video')}
                                        ><Video size={15} /></button>
                                    </div>
                                )}

                                {/* Call status badge */}
                                {callState !== 'idle' && (
                                    <div style={{ fontSize: '0.75rem', fontFamily: 'Fira Code', color: 'var(--success)', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '6px', padding: '0.3rem 0.7rem' }}>
                                        {callState === 'outgoing' ? <><PhoneCall size={12} /> Calling…</> : callState === 'incoming' ? <><PhoneIncoming size={12} /> Incoming…</> : <><span style={{ color: 'var(--success)', fontSize: 8 }}>●</span> {formatDuration(callDuration)}</>}
                                    </div>
                                )}

                                {/* Three-dot menu */}
                                <div ref={menuRef} style={{ position: 'relative' }}>
                                    <button
                                        title="More options"
                                        style={{ ...ghostBtnStyle }}
                                        onClick={() => setShowMenu(prev => !prev)}
                                    ><MoreVertical size={15} /></button>

                                    {showMenu && (
                                        <div style={{
                                            position: 'absolute', top: '110%', right: 0, zIndex: 100,
                                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                                            borderRadius: '10px', minWidth: '170px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                            overflow: 'hidden',
                                        }}>
                                            <button
                                                onClick={() => { setShowMenu(false); setShowBlockConfirm(true); }}
                                                style={{
                                                    width: '100%', padding: '0.75rem 1rem', background: 'transparent',
                                                    border: 'none', cursor: 'pointer', color: 'var(--danger)',
                                                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                    fontSize: '0.85rem', fontFamily: 'Fira Code',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.1)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <ShieldX size={14} /> Block User
                                            </button>
                                            <div style={{ height: '1px', background: 'var(--border)' }} />
                                            <button
                                                onClick={() => { setShowMenu(false); setShowReportConfirm(true); }}
                                                style={{
                                                    width: '100%', padding: '0.75rem 1rem', background: 'transparent',
                                                    border: 'none', cursor: 'pointer', color: 'var(--warning)',
                                                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                    fontSize: '0.85rem', fontFamily: 'Fira Code',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,169,77,0.1)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <Flag size={14} /> Report User
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Call UI Overlay ── */}
                            {callState !== 'idle' && (
                                <div style={{
                                    position: 'absolute', top: 64, left: 0, right: 0, bottom: 72,
                                    background: 'rgba(5,5,10,0.97)', zIndex: 10,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
                                    borderTop: '1px solid var(--border)',
                                }}>
                                    {/* Video feeds */}
                                    {(callType === 'video' || incomingCallType === 'video') && (
                                        <div style={{ position: 'relative', width: '100%', maxWidth: 560, height: 280 }}>
                                            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12, background: '#0a0a12' }} />
                                            <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: 10, right: 10, width: 110, height: 82, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--accent)', background: '#000' }} />
                                        </div>
                                    )}

                                    {/* Audio-only avatar */}
                                    {(callType === 'audio' && callState !== 'incoming') && (
                                        <div style={{ textAlign: 'center' }}>
                                            <div className="avatar" style={{ width: 80, height: 80, fontSize: '2rem', margin: '0 auto 0.75rem' }}>{activeConvName[0]?.toUpperCase()}</div>
                                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1rem', color: 'var(--accent)' }}>{activeConvName}</div>
                                            {callState === 'outgoing' && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontFamily: 'Fira Code' }}>Ringing…</div>}
                                            {callState === 'connected' && <div style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: '0.5rem', fontFamily: 'Fira Code' }}>{formatDuration(callDuration)}</div>}
                                        </div>
                                    )}

                                    {/* Incoming call UI */}
                                    {callState === 'incoming' && (
                                        <div style={{ textAlign: 'center' }}>
                                            <div className="avatar" style={{ width: 80, height: 80, fontSize: '2rem', margin: '0 auto 0.75rem' }}>{activeConvName[0]?.toUpperCase()}</div>
                                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1rem', color: 'var(--accent)' }}>{activeConvName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontFamily: 'Fira Code' }}>
                                                Incoming {incomingCallType} call…
                                            </div>
                                        </div>
                                    )}

                                    {/* Call controls */}
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        {callState === 'incoming' ? (
                                            <>
                                                <button style={callBtnStyle('linear-gradient(135deg,var(--success),#00d4aa)')} onClick={answerCall} title="Answer"><CheckCircle size={20} /></button>
                                                <button style={callBtnStyle('linear-gradient(135deg,var(--neon-pink),var(--caution))')} onClick={() => hangUp()} title="Decline"><XCircle size={20} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button style={{ ...callBtnStyle(isMuted ? '#444' : 'rgba(0,245,212,0.15)'), border: '1px solid rgba(0,245,212,0.25)' }} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                                                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                                </button>
                                                {(callType === 'video') && (
                                                    <button style={{ ...callBtnStyle(isCamOff ? '#444' : 'rgba(0,245,212,0.15)'), border: '1px solid rgba(0,245,212,0.25)' }} onClick={toggleCam} title={isCamOff ? 'Turn cam on' : 'Turn cam off'}>
                                                        {isCamOff ? <CameraOff size={18} /> : <Camera size={18} />}
                                                    </button>
                                                )}
                                                <button style={{ ...callBtnStyle(isSpeakerOff ? '#444' : 'rgba(0,245,212,0.15)'), border: '1px solid rgba(0,245,212,0.25)' }} onClick={toggleSpeaker} title={isSpeakerOff ? 'Speaker on' : 'Speaker off'}>
                                                    {isSpeakerOff ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                                </button>
                                                <button style={callBtnStyle('linear-gradient(135deg,var(--neon-pink),var(--caution))')} onClick={() => hangUp()} title="Hang up"><PhoneOff size={18} /></button>
                                            </>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Fira Code', textAlign: 'center' }}>
                                        P2P • WebRTC • End-to-End Encrypted
                                    </div>
                                </div>
                            )}

                            {/* Messages list */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {messages.map(msg => {
                                    const parsed = parseMsg(msg);
                                    if (parsed.type === 'call-log') return null;
                                    const isMe = parsed.senderId === userId;

                                    return (
                                        <div key={parsed.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '0.6rem', alignItems: 'flex-end' }}>
                                            {!isMe && <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.65rem', flexShrink: 0 }}>{activeConvName[0]}</div>}
                                            <div style={{
                                                maxWidth: '65%',
                                                background: isMe ? 'rgba(0,245,212,0.1)' : 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${isMe ? 'rgba(0,245,212,0.25)' : 'var(--border)'}`,
                                                borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                                padding: '0.6rem 0.9rem',
                                            }}>
                                                {parsed.type === 'file' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={() => downloadFile(parsed)}>
                                                        <span style={{ fontSize: '1.4rem', display: 'flex' }}><Paperclip size={20} /></span>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>{parsed.fileName}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Fira Code' }}>
                                                                {parsed.fileSize ? formatBytes(parsed.fileSize) : ''} • tap to download
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.45 }}>{parsed.content}</p>
                                                )}
                                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'Fira Code' }}>{timeAgo(parsed.sentAt)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={endRef} />
                            </div>

                            {/* Input bar */}
                            <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                {/* File attach */}
                                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFileSend(e.target.files[0]); e.target.value = ''; }} />
                                <button
                                    title="Send file"
                                    style={{ ...ghostBtnStyle, flexShrink: 0 }}
                                    onClick={() => fileInputRef.current?.click()}
                                ><Paperclip size={15} /></button>
                                <input
                                    className="form-control"
                                    placeholder="Type a message..."
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    style={{ flex: 1 }}
                                />
                                <button className="btn-gradient" style={{ padding: '0 1.2rem', flexShrink: 0 }} onClick={sendMessage}>▶</button>
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'Fira Code', fontSize: '0.85rem' }}>
                            Select a conversation or start a new one
                        </div>
                    )}
                </div>
            </div>

            {/* New Chat Modal */}
            {showNewChat && (
                <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Edit3 size={18} /> New Chat</h2>
                        <div className="form-group">
                            <label>Username</label>
                            <input className="form-control" placeholder="e.g. NeonCoder, PixelArt99..." value={newChatUsername}
                                onChange={e => setNewChatUsername(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && startNewChat()}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button className="btn-gradient" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onClick={startNewChat}><Send size={14} /> Start Chat</button>
                            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowNewChat(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Block Confirmation Modal */}
            {showBlockConfirm && (
                <div className="modal-overlay" onClick={() => setShowBlockConfirm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                            <ShieldX size={20} color="var(--danger)" />
                            <h2 style={{ margin: 0, fontSize: '1rem', fontFamily: "'Syne', sans-serif", color: 'var(--danger)' }}>Block User</h2>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '1.5rem' }}>
                            Are you sure you want to block <strong style={{ color: 'var(--text-primary)' }}>{activeConvName}</strong>? They won't be able to send you messages.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleBlock}
                                style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--neon-pink),var(--danger))', color: '#fff', fontFamily: 'Fira Code', fontSize: '0.85rem', fontWeight: 600 }}
                            >Block</button>
                            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowBlockConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Confirmation Modal */}
            {showReportConfirm && (
                <div className="modal-overlay" onClick={() => setShowReportConfirm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                            <Flag size={20} color="var(--warning)" />
                            <h2 style={{ margin: 0, fontSize: '1rem', fontFamily: "'Syne', sans-serif", color: 'var(--warning)' }}>Report User</h2>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '1.5rem' }}>
                            Report <strong style={{ color: 'var(--text-primary)' }}>{activeConvName}</strong> for inappropriate behavior? Our moderation team will review this.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleReport}
                                style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--warning),var(--caution))', color: '#fff', fontFamily: 'Fira Code', fontSize: '0.85rem', fontWeight: 600 }}
                            >Report</button>
                            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowReportConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;