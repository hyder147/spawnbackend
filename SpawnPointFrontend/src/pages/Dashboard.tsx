import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Heart, MessageCircle, TrendingUp, Gamepad2, BarChart2, Loader, FileText, Inbox, Swords, Users } from 'lucide-react';
import '../App.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Post { id: string; userId: string; content: string; createdAt: string; likedByUserIds: string[]; comments: any[]; }
interface Friend { id: string; username: string; userType: string; }
interface Squad { id: string; name: string; memberIds: string[]; }
interface FriendRequest { id: string; senderId: string; status: string; }

const typeColor: Record<string, string> = {
    post: 'var(--neon-cyan)', friend: 'var(--neon-green)',
    request: 'var(--neon-yellow)', squad: 'var(--neon-purple)',
};

const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
};

// ─── AI helper — calls our backend ───────────────────────────────────────────
const callAI = async (message: string): Promise<string> => {
    try {
        const res = await api.post<{ content: { type: string; text: string }[] }>('/ai/chat', { message });
        return res.content?.map((c) => c.text || '').join('') || 'No response.';
    } catch {
        return 'AI service unavailable.';
    }
};

// ─── SPAWN.AI Panel ───────────────────────────────────────────────────────────
const SpawnAI: React.FC = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: string; text: string }[]>([
        { role: 'ai', text: 'SPAWN.AI online. Ask me anything about your game data, feedback trends, or squad recommendations.' }
    ]);
    const [loading, setLoading] = useState(false);

    const send = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);
        const reply = await callAI(userMsg);
        setMessages(prev => [...prev, { role: 'ai', text: reply }]);
        setLoading(false);
    };

    return (
        <div className="ai-panel" style={{ height: '100%' }}>
            <div className="ai-badge">SPAWN.AI</div>
            <div style={{ height: '280px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: m.role === 'user' ? 'var(--accent-soft)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${m.role === 'user' ? 'var(--accent-border)' : 'var(--border)'}`,
                        borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        padding: '0.65rem 0.9rem', fontSize: '0.85rem', lineHeight: 1.5,
                        color: m.role === 'user' ? 'var(--accent)' : 'var(--text-primary)',
                    }}>
                        {m.text}
                    </div>
                ))}
                {loading && <div style={{ alignSelf: 'flex-start', color: 'var(--neon-purple)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Loader size={12} />Processing...</div>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-control" style={{ fontSize: '0.85rem' }}
                    placeholder="Ask about feedback, squad, game health..."
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()} />
                <button className="btn-gradient" style={{ padding: '0 1rem', whiteSpace: 'nowrap' }} onClick={send}>▶</button>
            </div>
        </div>
    );
};

// ─── Release Score ────────────────────────────────────────────────────────────
const ReleaseScore: React.FC<{ postCount: number; friendCount: number; squadCount: number }> = ({ postCount, friendCount, squadCount }) => {
    const [score, setScore] = useState<number | null>(null);
    const [verdict, setVerdict] = useState('');
    const [loading, setLoading] = useState(false);

    const calc = async () => {
        setLoading(true);
        const result = await callAI(`Game data: ${postCount} posts, ${friendCount} friends, ${squadCount} squads. Return ONLY JSON: {"score": 72, "verdict": "2-sentence assessment"}`);
        try {
            const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
            setScore(parsed.score);
            setVerdict(parsed.verdict);
        } catch {
            setScore(Math.min(100, Math.round(40 + postCount * 2 + friendCount * 3 + squadCount * 5)));
            setVerdict('Score calculated from your platform activity.');
        }
        setLoading(false);
    };

    useEffect(() => { calc(); }, [postCount, friendCount, squadCount]);

    const color = score !== null ? (score >= 75 ? 'var(--neon-green)' : score >= 50 ? 'var(--neon-yellow)' : 'var(--neon-pink)') : 'var(--neon-cyan)';

    return (
        <div className="ai-panel">
            <div className="ai-badge" style={{ marginBottom: '1rem' }}>Release Readiness Score</div>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '3.5rem', fontWeight: 900, color, filter: `drop-shadow(0 0 16px ${color})`, lineHeight: 1 }}>
                    {loading ? '...' : score !== null ? score : '--'}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '1px', marginTop: '0.3rem' }}>/ 100</div>
            </div>
            <div className="progress-bar-wrap" style={{ marginBottom: '1rem' }}>
                <div className="progress-bar-fill" style={{ width: `${score ?? 0}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
            </div>
            {verdict && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{verdict}</div>}
        </div>
    );
};

// ─── Activity Graph ───────────────────────────────────────────────────────────
const ActivityGraph: React.FC<{ posts: Post[] }> = ({ posts }) => {
    const days = 14;

    // Build daily post counts for the last 14 days
    const dailyCounts = Array.from({ length: days }, (_, i) => {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - (days - 1 - i));
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const count = posts.filter(p => {
            const d = new Date(p.createdAt);
            return d >= dayStart && d <= dayEnd;
        }).length;
        return { date: dayStart, count };
    });

    const W = 700, H = 220, padX = 30, padY = 24;
    const maxVal = Math.max(1, ...dailyCounts.map(d => d.count));
    const stepX = (W - padX * 2) / (days - 1);

    const points = dailyCounts.map((d, i) => {
        const x = padX + i * stepX;
        const y = H - padY - (d.count / maxVal) * (H - padY * 2);
        return { x, y, ...d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - padY} L ${points[0].x} ${H - padY} Z`;

    const totalPosts = dailyCounts.reduce((sum, d) => sum + d.count, 0);

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Activity — Last 14 Days</h3>
                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.85rem', color: 'var(--neon-cyan)', textShadow: '0 0 8px var(--neon-cyan)' }}>{totalPosts} posts</span>
            </div>
            <style>{`
                @keyframes spawn-draw-line {
                    from { stroke-dashoffset: 1000; }
                    to { stroke-dashoffset: 0; }
                }
                @keyframes spawn-fade-area {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes spawn-pop-dot {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes spawn-pulse-glow {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                .spawn-activity-line {
                    stroke-dasharray: 1000;
                    animation: spawn-draw-line 1.4s ease-out forwards;
                }
                .spawn-activity-area {
                    animation: spawn-fade-area 1s ease-out 0.6s forwards;
                    opacity: 0;
                }
                .spawn-activity-dot {
                    animation: spawn-pop-dot 0.4s ease-out backwards;
                    transform-origin: center;
                }
                .spawn-activity-dot-glow {
                    animation: spawn-pulse-glow 2s ease-in-out infinite;
                }
            `}</style>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                <defs>
                    <linearGradient id="spawnActivityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0.25, 0.5, 0.75, 1].map((f, i) => (
                    <line key={i}
                        x1={padX} x2={W - padX}
                        y1={padY + (H - padY * 2) * (1 - f)} y2={padY + (H - padY * 2) * (1 - f)}
                        stroke="var(--border-dim)" strokeWidth="1" strokeDasharray="4 4"
                    />
                ))}

                {/* Area fill */}
                <path d={areaPath} fill="url(#spawnActivityGradient)" className="spawn-activity-area" />

                {/* Line */}
                <path d={linePath} fill="none" stroke="var(--neon-cyan)" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ filter: 'drop-shadow(0 0 6px var(--neon-cyan))' }}
                    className="spawn-activity-line"
                />

                {/* Dots */}
                {points.map((p, i) => (
                    <g key={i} className="spawn-activity-dot" style={{ animationDelay: `${0.8 + i * 0.05}s` }}>
                        {p.count > 0 && (
                            <circle cx={p.x} cy={p.y} r="9" fill="var(--neon-cyan)" opacity="0.15" className="spawn-activity-dot-glow" />
                        )}
                        <circle cx={p.x} cy={p.y} r="4" fill={p.count > 0 ? 'var(--neon-cyan)' : 'var(--bg-card)'}
                            stroke="var(--neon-cyan)" strokeWidth="1.5"
                            style={{ cursor: 'pointer' }}
                        >
                            <title>{`${p.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${p.count} post${p.count === 1 ? '' : 's'}`}</title>
                        </circle>
                    </g>
                ))}

                {/* X-axis labels */}
                {points.map((p, i) => (
                    (i % 2 === 0 || i === points.length - 1) && (
                        <text key={i} x={p.x} y={H - 4} textAnchor="middle"
                            fontFamily="JetBrains Mono" fontSize="9" fill="var(--text-dim)">
                            {p.date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </text>
                    )
                ))}
            </svg>
        </div>
    );
};

// ─── Sentiment Widget ─────────────────────────────────────────────────────────
const SentimentAnalyzerWidget: React.FC<{ posts: Post[] }> = ({ posts }) => {
    const [data, setData] = useState<{ positive: number; neutral: number; negative: number } | null>(null);
    const [loading, setLoading] = useState(false);

    const analyze = async () => {
        if (posts.length === 0) { setData({ positive: 0, neutral: 100, negative: 0 }); return; }
        setLoading(true);
        const sample = posts.slice(0, 10).map(p => p.content).join(' | ');
        const result = await callAI(`Analyze sentiment of these posts: "${sample}". Return ONLY JSON: {"positive": 52, "neutral": 28, "negative": 20}. Numbers must add to 100.`);
        try {
            setData(JSON.parse(result.replace(/```json|```/g, '').trim()));
        } catch {
            setData({ positive: 50, neutral: 30, negative: 20 });
        }
        setLoading(false);
    };

    useEffect(() => { if (posts.length > 0) analyze(); }, [posts.length]);

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><TrendingUp size={13} /> Sentiment Tracker</div>
                <button onClick={analyze} style={{ background: 'none', border: '1px solid var(--border-dim)', color: 'var(--neon-cyan)', borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>{loading ? <><Loader size={11} /> Refreshing</> : 'Refresh'}</button>
            </div>
            {data ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {[
                        { label: 'Positive', val: data.positive, color: 'var(--neon-green)' },
                        { label: 'Neutral', val: data.neutral, color: 'var(--neon-yellow)' },
                        { label: 'Negative', val: data.negative, color: 'var(--neon-pink)' },
                    ].map(row => (
                        <div key={row.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.8rem', color: row.color, fontFamily: 'JetBrains Mono' }}>{row.label}</span>
                                <span style={{ fontSize: '0.8rem', color: row.color, fontFamily: 'JetBrains Mono' }}>{row.val}%</span>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, height: 7, border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 4, width: `${row.val}%`, background: `linear-gradient(90deg, ${row.color}, ${row.color}88)`, transition: 'width 1s ease' }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : <div className="spinner" style={{ margin: '0.5rem auto' }} />}
        </div>
    );
};

// ─── Play Coach Widget ────────────────────────────────────────────────────────
const PlayCoachWidget: React.FC = () => {
    const [advice, setAdvice] = useState('');
    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState('retention');
    const topics = [{ key: 'retention', label: 'Retention' }, { key: 'onboarding', label: 'Onboarding' }, { key: 'difficulty', label: 'Difficulty' }, { key: 'monetization', label: 'Monetize' }];

    const getAdvice = async (t: string) => {
        setLoading(true);
        setAdvice('');
        const result = await callAI(`Give 3 bullet points (→) for indie game ${t} advice. Max 100 words.`);
        setAdvice(result);
        setLoading(false);
    };

    useEffect(() => { setAdvice('Click a topic to get AI coaching advice.'); }, []);

    return (
        <div style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.04), rgba(0,245,255,0.03))', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 12, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, var(--neon-green), var(--neon-cyan))' }} />
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--neon-green)' }}>● PLAY COACH AI</div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Gamepad2 size={15} /> Personalized Insights</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                {topics.map(t => (
                    <button key={t.key} onClick={() => { setTopic(t.key); getAdvice(t.key); }} style={{
                        background: topic === t.key ? 'rgba(0,255,136,0.12)' : 'transparent',
                        border: `1px solid ${topic === t.key ? 'rgba(0,255,136,0.4)' : 'var(--border-dim)'}`,
                        color: topic === t.key ? 'var(--neon-green)' : 'var(--text-secondary)',
                        borderRadius: 6, padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'JetBrains Mono', transition: 'all 0.2s'
                    }}>{t.label}</button>
                ))}
            </div>
            {loading
                ? <div style={{ color: 'var(--neon-green)', fontSize: '0.82rem', fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Loader size={12} /> Analyzing...</div>
                : <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{advice}</div>}
        </div>
    );
};

// ─── Weekly Digest ────────────────────────────────────────────────────────────
const WeeklyDigestWidget: React.FC<{ postCount: number; friendCount: number }> = ({ postCount, friendCount }) => {
    const [digest, setDigest] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const generate = async () => {
        setLoading(true);
        const result = await callAI(`Write weekly dev digest with 3 sections: [Wins], [Concerns], [Priority]. Stats: ${postCount} posts this week, ${friendCount} friends. Max 140 words.`);
        setDigest(result);
        setDone(true);
        setLoading(false);
    };

    return (
        <div className="digest-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--ai-accent)' }}>● WEEKLY AI DIGEST</div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><BarChart2 size={15} /> Dev Summary</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                        Week of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                </div>
                <button onClick={generate} style={{ background: 'rgba(191,0,255,0.12)', border: '1px solid rgba(191,0,255,0.35)', color: 'var(--ai-accent)', borderRadius: 8, padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>
                    {loading ? <><Loader size={12} style={{ display: 'inline' }} /></> : done ? '↺ Regen' : 'Generate'}
                </button>
            </div>
            {digest
                ? <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{digest}</div>
                : <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Click <strong style={{ color: 'var(--ai-accent)' }}>Generate</strong> for your AI-powered weekly summary.</div>
            }
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
    const { user } = useAuth();

    const [posts, setPosts] = useState<Post[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [squads, setSquads] = useState<Squad[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const loadAll = async () => {
            setLoading(true);
            await Promise.allSettled([
                api.get<Post[]>(`/posts/feed/${user.id}`).then(setPosts).catch(() => { }),
                api.get<Friend[]>(`/friends/list/${user.id}`).then(setFriends).catch(() => { }),
                api.get<Squad[]>('/squads/my').then(setSquads).catch(() => { }),
                api.get<FriendRequest[]>(`/friends/requests/received/${user.id}`).then(setRequests).catch(() => { }),
            ]);
            setLoading(false);
        };
        loadAll();
    }, [user?.id]);

    // Build recent activity feed from real data
    const recentActivity = [
        ...posts.slice(0, 2).map(p => ({
            time: timeAgo(p.createdAt),
            text: 'You published a new post',
            type: 'post'
        })),
        ...requests.slice(0, 2).map(r => ({
            time: 'recently',
            text: `${r.senderId} sent you a friend request`,
            type: 'request'
        })),
        ...friends.slice(0, 2).map(f => ({
            time: 'recently',
            text: `You are friends with ${f.username}`,
            type: 'friend'
        })),
    ].slice(0, 5);

    const stats = [
        { label: 'My Posts', value: posts.length.toString(), icon: <FileText size={24} />, color: 'var(--neon-cyan)' },
        { label: 'Friends', value: friends.length.toString(), icon: <Users size={24} />, color: 'var(--neon-green)' },
        { label: 'Pending Requests', value: requests.length.toString(), icon: <Inbox size={24} />, color: 'var(--neon-purple)' },
        { label: 'My Squads', value: squads.length.toString(), icon: <Swords size={24} />, color: 'var(--neon-pink)' },
    ];

    return (
        <div className="container">
            {/* Hero header */}
            <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -1, left: 0, width: 100, height: 1, background: 'var(--gradient-accent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase' }}>System Online</span>
                </div>
                <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.6rem', fontWeight: 800, margin: '0 0 0.4rem', letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                    Welcome back, <span style={{ color: 'var(--accent)', textShadow: '0 0 30px rgba(200,255,0,0.3)' }}>{user?.username ?? 'Developer'}</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', margin: 0, letterSpacing: '1px' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {loading ? <div className="spinner" /> : (
                <>
                    {/* Stats */}
                    <div className="grid-4" style={{ marginBottom: '2rem' }}>
                        {stats.map((s, i) => (
                            <div key={i} className={`stat-card${i === 0 ? ' highlight' : ''}`}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.icon}</div>
                                <div className="stat-value" style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{s.value}</div>
                                <div className="stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="rg-main-side" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Activity graph using real post data */}
                            <ActivityGraph posts={posts} />

                            {/* Recent activity from real data */}
                            <div className="card">
                                <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Recent Activity</h3>
                                {recentActivity.length === 0
                                    ? <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No activity yet. Create a post or add some friends!</p>
                                    : recentActivity.map((a, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border-dim)' : 'none' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor[a.type], flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${typeColor[a.type]}` }} />
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.4 }}>{a.text}</p>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>{a.time}</span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>

                            {/* Recent posts list */}
                            <div className="card">
                                <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>My Recent Posts</h3>
                                {posts.length === 0
                                    ? <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No posts yet. Head to the Feed to get started!</p>
                                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {posts.slice(0, 5).map(p => (
                                            <div key={p.id} className="kanban-item">
                                                <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.4 }}>{p.content.slice(0, 100)}{p.content.length > 100 ? '...' : ''}</p>
                                                <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>{timeAgo(p.createdAt)}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <Heart size={11} /> {p.likedByUserIds.length}
                                                        <MessageCircle size={11} /> {p.comments.length}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                }
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <SpawnAI />
                            <ReleaseScore postCount={posts.length} friendCount={friends.length} squadCount={squads.length} />

                            {/* Squad heartbeat using real squad data */}
                            <div className="card">
                                <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Squad Heartbeat</h3>
                                {squads.length === 0
                                    ? <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No squads yet. Visit the Squads page to join one!</p>
                                    : squads.slice(0, 3).map((squad, _i) => {
                                        const pct = Math.min(100, (squad.memberIds ?? []).length * 10); const c = pct > 70 ? 'var(--neon-green)' : pct > 40 ? 'var(--neon-yellow)' : 'var(--neon-pink)';
                                        return (
                                            <div key={squad.id} style={{ marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                                    <span style={{ fontSize: '0.85rem' }}>{squad.name}</span>
                                                    <span style={{ fontSize: '0.8rem', color: c, fontFamily: 'JetBrains Mono' }}>{(squad.memberIds ?? []).length} members</span>
                                                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}, ${c}66)`, boxShadow: `0 0 8px ${c}` }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>

                            {/* Sentiment analysis on real posts */}
                            <SentimentAnalyzerWidget posts={posts} />
                        </div>
                    </div>

                    <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                        <PlayCoachWidget />
                        <WeeklyDigestWidget postCount={posts.length} friendCount={friends.length} />
                    </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;