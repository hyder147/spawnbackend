import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ghost, Radio, Clock, CheckCircle, Play, Square, Wifi, WifiOff } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Game {
    id: string;
    title: string;
    genre: string;
    status: string;
    developerId: string;
}

interface LiveTester {
    testerId: string;
    testerUsername: string;
    sessionStart: string;
    lastPing: string;
    minutesPlaying: number;
}

interface SessionHistoryItem {
    testerUsername: string;
    sessionStart: string;
    endedAt: string | null;
    isActive: boolean;
    isGhosted: boolean;
    endedCleanly: boolean;
    minutesPlayed: number;
}

interface GhostEntry {
    id: string;
    username: string;
    ghostCount: number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const GhostMode: React.FC = () => {
    const { user } = useAuth();
    const isDeveloper = user?.userType === 'Developer';
    const isGamer = user?.userType === 'Gamer';

    // Developer state
    const [myGames, setMyGames] = useState<Game[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<string>('');
    const [liveTesters, setLiveTesters] = useState<LiveTester[]>([]);
    const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
    const [ghostList, setGhostList] = useState<GhostEntry[]>([]);
    const [activeTab, setActiveTab] = useState<'live' | 'history' | 'ghosts'>('live');

    // Gamer (tester) state
    const [testerGames, setTesterGames] = useState<Game[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(
        localStorage.getItem('spawn_session_id')
    );
    const [activeGameTitle, setActiveGameTitle] = useState<string>(
        localStorage.getItem('spawn_session_game') || ''
    );
    const [isSessionRunning, setIsSessionRunning] = useState<boolean>(!!localStorage.getItem('spawn_session_id'));
    const [pingStatus, setPingStatus] = useState<'ok' | 'error' | 'idle'>('idle');

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const liveRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 4000);
    };

    // ── Developer: load their games ─────────────────────────────────────────
    useEffect(() => {
        if (!isDeveloper) return;
        api.get<Game[]>('/games').then(games => {
            const mine = games.filter(g => g.developerId === user?.id);
            setMyGames(mine);
            if (mine.length > 0) setSelectedGameId(mine[0].id);
        }).catch(() => { });
    }, [isDeveloper, user?.id]);

    // ── Developer: fetch live + history when game selected ──────────────────
    const fetchLive = useCallback(async () => {
        if (!selectedGameId) return;
        try {
            const data = await api.get<{ liveCount: number; testers: LiveTester[] }>(
                `/session/live/${selectedGameId}`
            );
            setLiveTesters(data.testers);
        } catch { }
    }, [selectedGameId]);

    const fetchHistory = useCallback(async () => {
        if (!selectedGameId) return;
        try {
            const data = await api.get<SessionHistoryItem[]>(`/session/history/${selectedGameId}`);
            setSessionHistory(data);
        } catch { }
    }, [selectedGameId]);

    const fetchGhosts = useCallback(async () => {
        try {
            const data = await api.get<GhostEntry[]>('/session/ghosts');
            setGhostList(data);
        } catch { }
    }, []);

    useEffect(() => {
        if (!isDeveloper || !selectedGameId) return;
        fetchLive();
        fetchHistory();
        fetchGhosts();

        // Auto-refresh live room every 15 seconds
        liveRefreshInterval.current = setInterval(fetchLive, 15000);
        return () => {
            if (liveRefreshInterval.current) clearInterval(liveRefreshInterval.current);
        };
    }, [isDeveloper, selectedGameId, fetchLive, fetchHistory, fetchGhosts]);

    // ── Gamer: load approved games ──────────────────────────────────────────
    useEffect(() => {
        if (!isGamer) return;
        api.get<Game[]>('/games').then(setTesterGames).catch(() => { });
    }, [isGamer]);

    // ── Gamer: heartbeat ping every 30s ────────────────────────────────────
    useEffect(() => {
        if (!isGamer || !activeSessionId) return;

        const sendPing = async () => {
            try {
                await api.post('/session/ping', { sessionId: activeSessionId });
                setPingStatus('ok');
            } catch {
                setPingStatus('error');
            }
        };

        sendPing(); // immediate first ping
        pingInterval.current = setInterval(sendPing, 30000);

        return () => {
            if (pingInterval.current) clearInterval(pingInterval.current);
        };
    }, [activeSessionId, isGamer]);

    // ── Gamer: Start Session ────────────────────────────────────────────────
    const handleStartSession = async (game: Game) => {
        setLoading(true);
        try {
            const res = await api.post<{ sessionId: string }>('/session/start', { gameId: game.id });
            setActiveSessionId(res.sessionId);
            setActiveGameTitle(game.title);
            setIsSessionRunning(true);
            setPingStatus('ok');
            localStorage.setItem('spawn_session_id', res.sessionId);
            localStorage.setItem('spawn_session_game', game.title);
            showMsg('success', `Session started for "${game.title}". Heartbeat is active.`);
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Gamer: End Session ──────────────────────────────────────────────────
    const handleEndSession = async (submittedFeedback: boolean) => {
        if (!activeSessionId) return;
        setLoading(true);
        try {
            const res = await api.post<{ message: string }>('/session/end', {
                sessionId: activeSessionId,
                submittedFeedback
            });
            setActiveSessionId(null);
            setActiveGameTitle('');
            setIsSessionRunning(false);
            setPingStatus('idle');
            localStorage.removeItem('spawn_session_id');
            localStorage.removeItem('spawn_session_game');
            if (pingInterval.current) clearInterval(pingInterval.current);
            showMsg('success', res.message);
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── UI ────────────────────────────────────────────────────────────────────

    return (
        <div className="page-shell" style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'JetBrains Mono, monospace' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Ghost size={32} color="var(--neon-cyan)" />
                <div>
                    <h1 style={{ margin: 0, fontFamily: 'Orbitron, monospace', fontSize: '1.6rem', color: 'var(--accent)' }}>
                        GHOST MODE
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {isDeveloper ? 'See who is live testing your games right now' : 'Track your active testing session'}
                    </p>
                </div>
            </div>

            {/* Toast */}
            {msg && (
                <div style={{
                    padding: '0.75rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem',
                    background: msg.type === 'success' ? 'rgba(0,255,128,0.1)' : 'rgba(255,60,60,0.1)',
                    border: `1px solid ${msg.type === 'success' ? 'var(--neon-cyan)' : '#ff3c3c'}`,
                    color: msg.type === 'success' ? 'var(--neon-cyan)' : '#ff3c3c',
                    fontSize: '0.9rem'
                }}>
                    {msg.text}
                </div>
            )}

            {/* ── DEVELOPER VIEW ────────────────────────────────────────────────── */}
            {isDeveloper && (
                <div>
                    {/* Game Selector */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                            Select Game
                        </label>
                        <select
                            value={selectedGameId}
                            onChange={e => setSelectedGameId(e.target.value)}
                            style={{
                                background: 'var(--card-bg)', border: '1px solid var(--border)',
                                color: 'var(--text)', padding: '0.6rem 1rem', borderRadius: '8px',
                                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', minWidth: '260px'
                            }}
                        >
                            {myGames.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                        </select>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {(['live', 'history', 'ghosts'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none',
                                    cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
                                    background: activeTab === tab ? 'var(--accent)' : 'var(--card-bg)',
                                    color: activeTab === tab ? '#000' : 'var(--text)',
                                    textTransform: 'uppercase', letterSpacing: '0.05em'
                                }}
                            >
                                {tab === 'live' && <><Radio size={13} style={{ marginRight: '0.4rem' }} />Live</>}
                                {tab === 'history' && <><Clock size={13} style={{ marginRight: '0.4rem' }} />History</>}
                                {tab === 'ghosts' && <><Ghost size={13} style={{ marginRight: '0.4rem' }} />Ghost List</>}
                            </button>
                        ))}
                    </div>

                    {/* Live Tab */}
                    {activeTab === 'live' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <span style={{
                                    display: 'inline-block', width: '10px', height: '10px',
                                    borderRadius: '50%', background: '#00ff88',
                                    boxShadow: '0 0 8px #00ff88', animation: 'pulse 1.5s infinite'
                                }} />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {liveTesters.length} tester{liveTesters.length !== 1 ? 's' : ''} playing right now · auto-refreshes every 15s
                                </span>
                            </div>

                            {liveTesters.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                                    <Ghost size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                    <p>No one is playing right now.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {liveTesters.map(t => (
                                        <div key={t.testerId} style={{
                                            background: 'var(--card-bg)', border: '1px solid rgba(0,255,136,0.3)',
                                            borderRadius: '10px', padding: '1rem 1.25rem',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: '#00ff88', display: 'inline-block',
                                                    boxShadow: '0 0 6px #00ff88'
                                                }} />
                                                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{t.testerUsername}</span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                Playing for <strong style={{ color: 'var(--accent)' }}>{t.minutesPlaying} min</strong>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div>
                            {sessionHistory.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No sessions recorded yet.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.6rem' }}>
                                    {sessionHistory.map((s, i) => (
                                        <div key={i} style={{
                                            background: 'var(--card-bg)',
                                            border: `1px solid ${s.isGhosted ? 'rgba(255,60,60,0.4)' : s.endedCleanly ? 'rgba(0,255,136,0.2)' : 'var(--border)'}`,
                                            borderRadius: '8px', padding: '0.85rem 1.1rem',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                {s.isGhosted
                                                    ? <Ghost size={16} color="#ff3c3c" />
                                                    : s.endedCleanly
                                                        ? <CheckCircle size={16} color="#00ff88" />
                                                        : <Clock size={16} color="var(--text-muted)" />
                                                }
                                                <span style={{ color: 'var(--text)' }}>{s.testerUsername}</span>
                                                {s.isGhosted && (
                                                    <span style={{
                                                        fontSize: '0.7rem', background: 'rgba(255,60,60,0.15)',
                                                        color: '#ff3c3c', padding: '0.15rem 0.5rem', borderRadius: '4px'
                                                    }}>
                                                        GHOSTED
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                {s.minutesPlayed} min
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ghost List Tab */}
                    {activeTab === 'ghosts' && (
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                Testers who left without submitting feedback — sorted by ghost count.
                            </p>
                            {ghostList.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No ghosts found. Your testers are reliable!</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.6rem' }}>
                                    {ghostList.map((g, i) => (
                                        <div key={g.id} style={{
                                            background: 'var(--card-bg)', border: '1px solid rgba(255,60,60,0.25)',
                                            borderRadius: '8px', padding: '0.85rem 1.1rem',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '24px' }}>#{i + 1}</span>
                                                <Ghost size={15} color="#ff3c3c" />
                                                <span style={{ color: 'var(--text)' }}>{g.username}</span>
                                            </div>
                                            <span style={{ color: '#ff3c3c', fontWeight: 700 }}>
                                                {g.ghostCount}x ghost
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── GAMER / TESTER VIEW ───────────────────────────────────────────── */}
            {isGamer && (
                <div>
                    {/* Active Session Banner */}
                    {isSessionRunning && (
                        <div style={{
                            background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.4)',
                            borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '2rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                                        {pingStatus === 'ok'
                                            ? <Wifi size={16} color="#00ff88" />
                                            : <WifiOff size={16} color="#ff3c3c" />
                                        }
                                        <span style={{ color: '#00ff88', fontWeight: 700 }}>SESSION ACTIVE</span>
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Testing: <strong style={{ color: 'var(--text)' }}>{activeGameTitle}</strong>
                                        &nbsp;· Heartbeat sending every 30s
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => handleEndSession(true)}
                                        disabled={loading}
                                        style={{
                                            padding: '0.55rem 1.1rem', borderRadius: '8px', border: '1px solid #00ff88',
                                            background: 'transparent', color: '#00ff88', cursor: 'pointer',
                                            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem'
                                        }}
                                    >
                                        <CheckCircle size={13} style={{ marginRight: '0.4rem' }} />
                                        End + Feedback Submitted
                                    </button>
                                    <button
                                        onClick={() => handleEndSession(false)}
                                        disabled={loading}
                                        style={{
                                            padding: '0.55rem 1.1rem', borderRadius: '8px', border: '1px solid #ff3c3c',
                                            background: 'transparent', color: '#ff3c3c', cursor: 'pointer',
                                            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem'
                                        }}
                                    >
                                        <Square size={13} style={{ marginRight: '0.4rem' }} />
                                        End Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Game List to Start Session */}
                    {!isSessionRunning && (
                        <div>
                            <h2 style={{ fontFamily: 'Orbitron, monospace', fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                START A TESTING SESSION
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                                Click Start when you launch the game. The platform will track your session and remind you to submit feedback when done.
                            </p>
                            {testerGames.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No games available to test right now.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {testerGames.map(game => (
                                        <div key={game.id} style={{
                                            background: 'var(--card-bg)', border: '1px solid var(--border)',
                                            borderRadius: '10px', padding: '1rem 1.25rem',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.25rem' }}>{game.title}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{game.genre} · {game.status}</div>
                                            </div>
                                            <button
                                                onClick={() => handleStartSession(game)}
                                                disabled={loading}
                                                className="btn-gradient"
                                                style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                            >
                                                <Play size={14} />
                                                Start Testing
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GhostMode;