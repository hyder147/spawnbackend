import React, { useState, useEffect } from 'react';
import { Target, Trophy, Plus, ChevronDown, ChevronUp, Send, Lock, Unlock, Star, Medal, Rocket, Megaphone } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Game {
    id: string;
    title: string;
    developerId: string;
}

interface Bounty {
    id: string;
    gameId: string;
    symptom: string;
    rewardType: string;
    status: string;
    createdAt: string;
    // Developer-only fields
    privateContext?: string;
    claimedByUsername?: string;
    claimedAt?: string;
}

interface Submission {
    id: string;
    testerUsername: string;
    reproSteps: string;
    evidenceUrl?: string;
    status: string;
    submittedAt: string;
    isDuplicate: boolean;
}

interface LeaderboardEntry {
    rank: number;
    id: string;
    username: string;
    bountiesClaimed: number;
    badges: string[];
}

// ─── Badge color map ────────────────────────────────────────────────────────────

const badgeStyle: Record<string, { bg: string; color: string }> = {
    EliteHunter: { bg: 'rgba(255,200,0,0.15)', color: 'var(--warning)' },
    GoldTester: { bg: 'rgba(255,165,0,0.15)', color: '#ffa500' },
    PriorityTester: { bg: 'rgba(34,229,229,0.15)', color: '#22e5e5' },
    BugHunter: { bg: 'rgba(0,255,136,0.12)', color: 'var(--success)' },
};

const rewardLabels: Record<string, string> = {
    EliteBadge: 'Elite Badge',
    GoldBadge: 'Gold Badge',
    PriorityAccess: 'Priority Access',
    Shoutout: 'Shoutout',
};

export const rewardIcons: Record<string, React.ReactNode> = {
    EliteBadge: <Star size={14} />,
    GoldBadge: <Medal size={14} />,
    PriorityAccess: <Rocket size={14} />,
    Shoutout: <Megaphone size={14} />,
};

// ─── Component ─────────────────────────────────────────────────────────────────

const CrashBounty: React.FC = () => {
    const { user } = useAuth();
    const isDeveloper = user?.userType === 'Developer';
    const isGamer = user?.userType === 'Gamer';

    const [activeTab, setActiveTab] = useState<'bounties' | 'leaderboard'>('bounties');

    // Developer state
    const [myGames, setMyGames] = useState<Game[]>([]);
    const [myBounties, setMyBounties] = useState<Bounty[]>([]);
    const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({
        gameId: '', symptom: '', privateContext: '', rewardType: 'GoldBadge'
    });

    // Gamer state
    const [allBounties, setAllBounties] = useState<Bounty[]>([]);
    const [expandedBountyId, setExpandedBountyId] = useState<string | null>(null);
    const [submitForm, setSubmitForm] = useState<Record<string, { reproSteps: string; evidenceUrl: string }>>({});

    // Shared state
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 4500);
    };

    // ── Load on mount ─────────────────────────────────────────────────────────

    useEffect(() => {
        api.get<LeaderboardEntry[]>('/bounty/leaderboard').then(setLeaderboard).catch(() => { });

        if (isDeveloper) {
            api.get<Game[]>('/games').then(games => {
                const mine = games.filter(g => g.developerId === user?.id);
                setMyGames(mine);
                if (mine.length > 0) setCreateForm(f => ({ ...f, gameId: mine[0].id }));
            }).catch(() => { });

            api.get<Bounty[]>('/bounty/mine').then(setMyBounties).catch(() => { });
        }

        if (isGamer) {
            api.get<Game[]>('/games').then(async (games) => {
                // Fetch open bounties for each game
                const allB: Bounty[] = [];
                for (const g of games) {
                    try {
                        const bounties = await api.get<Bounty[]>(`/bounty/game/${g.id}`);
                        allB.push(...bounties);
                    } catch { }
                }
                setAllBounties(allB);
            }).catch(() => { });
        }
    }, [isDeveloper, isGamer, user?.id]);

    // ── Developer: load submissions for selected bounty ───────────────────────

    useEffect(() => {
        if (!isDeveloper || !selectedBountyId) return;
        api.get<Submission[]>(`/bounty/${selectedBountyId}/submissions`)
            .then(setSubmissions)
            .catch(() => { });
    }, [isDeveloper, selectedBountyId]);

    // ── Developer: Create Bounty ───────────────────────────────────────────────

    const handleCreateBounty = async () => {
        if (!createForm.gameId || createForm.symptom.trim().length < 20) {
            showMsg('error', 'Symptom must be at least 20 characters.');
            return;
        }
        setLoading(true);
        try {
            await api.post('/bounty', createForm);
            showMsg('success', 'Bounty posted! Testers will see it now.');
            setShowCreateForm(false);
            setCreateForm(f => ({ ...f, symptom: '', privateContext: '' }));
            const updated = await api.get<Bounty[]>('/bounty/mine');
            setMyBounties(updated);
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Developer: Accept Submission ──────────────────────────────────────────

    const handleAccept = async (bountyId: string, submissionId: string, _testerUsername: string) => {
        setLoading(true);
        try {
            const res = await api.post<{ message: string }>(`/bounty/${bountyId}/accept/${submissionId}`, {});
            showMsg('success', res.message);
            const updated = await api.get<Bounty[]>('/bounty/mine');
            setMyBounties(updated);
            setSubmissions([]);
            setSelectedBountyId(null);
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Developer: Close Bounty ───────────────────────────────────────────────

    const handleClose = async (bountyId: string) => {
        setLoading(true);
        try {
            await api.post(`/bounty/${bountyId}/close`, {});
            showMsg('success', 'Bounty closed.');
            const updated = await api.get<Bounty[]>('/bounty/mine');
            setMyBounties(updated);
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Gamer: Submit Solution ────────────────────────────────────────────────

    const handleSubmit = async (bountyId: string) => {
        const form = submitForm[bountyId];
        if (!form || form.reproSteps.trim().length < 30) {
            showMsg('error', 'Reproduction steps must be at least 30 characters.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post<{ isDuplicate: boolean; message: string }>(
                `/bounty/${bountyId}/submit`,
                { reproSteps: form.reproSteps, evidenceUrl: form.evidenceUrl || undefined }
            );
            showMsg(res.isDuplicate ? 'error' : 'success', res.message);
            if (!res.isDuplicate) {
                setExpandedBountyId(null);
                setSubmitForm(f => ({ ...f, [bountyId]: { reproSteps: '', evidenceUrl: '' } }));
            }
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── UI ─────────────────────────────────────────────────────────────────────

    return (
        <div className="page-shell" style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'JetBrains Mono, monospace' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Target size={32} color="var(--neon-cyan)" />
                <div>
                    <h1 style={{ margin: 0, fontFamily: 'Orbitron, monospace', fontSize: '1.6rem', color: 'var(--accent)' }}>
                        CRASH BOUNTY
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {isDeveloper ? 'Post bug bounties — testers race to find them' : 'Hunt bugs, earn badges'}
                    </p>
                </div>
            </div>

            {/* Toast */}
            {msg && (
                <div style={{
                    padding: '0.75rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem',
                    background: msg.type === 'success' ? 'rgba(0,255,128,0.1)' : 'rgba(255,60,60,0.1)',
                    border: `1px solid ${msg.type === 'success' ? 'var(--neon-cyan)' : 'var(--danger)'}`,
                    color: msg.type === 'success' ? 'var(--neon-cyan)' : 'var(--danger)', fontSize: '0.9rem'
                }}>
                    {msg.text}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                {(['bounties', 'leaderboard'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', textTransform: 'uppercase',
                        background: activeTab === tab ? 'var(--accent)' : 'var(--card-bg)',
                        color: activeTab === tab ? '#000' : 'var(--text)'
                    }}>
                        {tab === 'bounties' ? <><Target size={13} style={{ marginRight: '0.4rem' }} />Bounties</> : <><Trophy size={13} style={{ marginRight: '0.4rem' }} />Leaderboard</>}
                    </button>
                ))}
            </div>

            {/* ── LEADERBOARD TAB ─────────────────────────────────────────────── */}
            {activeTab === 'leaderboard' && (
                <div>
                    <h2 style={{ fontFamily: 'Orbitron, monospace', fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        TOP BUG HUNTERS
                    </h2>
                    {leaderboard.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No bounties claimed yet. Be the first!</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {leaderboard.map(entry => (
                                <div key={entry.id} style={{
                                    background: 'var(--card-bg)', border: '1px solid var(--border)',
                                    borderRadius: '10px', padding: '1rem 1.25rem',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{
                                            color: entry.rank <= 3 ? 'var(--accent)' : 'var(--text-muted)',
                                            fontWeight: 700, fontSize: entry.rank <= 3 ? '1.1rem' : '0.9rem', minWidth: '28px'
                                        }}>
                                            #{entry.rank}
                                        </span>
                                        <div>
                                            <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.3rem' }}>{entry.username}</div>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                {entry.badges.map((b, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                                                        background: badgeStyle[b]?.bg || 'rgba(255,255,255,0.08)',
                                                        color: badgeStyle[b]?.color || 'var(--text-muted)'
                                                    }}>
                                                        {b}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem' }}>
                                        {entry.bountiesClaimed}
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.3rem' }}>claimed</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── BOUNTIES TAB — DEVELOPER ────────────────────────────────────── */}
            {activeTab === 'bounties' && isDeveloper && (
                <div>
                    {/* Create Bounty Button */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="btn-gradient"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Plus size={16} />
                            Post New Bounty
                        </button>
                    </div>

                    {/* Create Form */}
                    {showCreateForm && (
                        <div style={{
                            background: 'var(--card-bg)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem'
                        }}>
                            <h3 style={{ margin: '0 0 1.25rem', fontFamily: 'Orbitron, monospace', fontSize: '0.95rem', color: 'var(--accent)' }}>
                                NEW BOUNTY
                            </h3>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>Game</label>
                                    <select value={createForm.gameId} onChange={e => setCreateForm(f => ({ ...f, gameId: e.target.value }))}
                                        style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {myGames.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
                                        <Unlock size={12} style={{ marginRight: '0.3rem' }} />
                                        Public Symptom (testers will see this — describe only the symptom, not the cause)
                                    </label>
                                    <textarea value={createForm.symptom} onChange={e => setCreateForm(f => ({ ...f, symptom: e.target.value }))}
                                        placeholder="e.g. Game freezes when entering Level 3 under a specific condition..."
                                        rows={3} style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.7rem', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
                                        <Lock size={12} style={{ marginRight: '0.3rem' }} />
                                        Private Notes (only you can see this)
                                    </label>
                                    <textarea value={createForm.privateContext} onChange={e => setCreateForm(f => ({ ...f, privateContext: e.target.value }))}
                                        placeholder="Your internal notes about what might be causing it..."
                                        rows={2} style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.7rem', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>Reward Type</label>
                                    <select value={createForm.rewardType} onChange={e => setCreateForm(f => ({ ...f, rewardType: e.target.value }))}
                                        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {Object.entries(rewardLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={handleCreateBounty} disabled={loading} className="btn-gradient" style={{ flex: 1 }}>
                                        {loading ? 'Posting...' : 'Post Bounty'}
                                    </button>
                                    <button onClick={() => setShowCreateForm(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* My Bounties List */}
                    <h3 style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        YOUR BOUNTIES ({myBounties.length})
                    </h3>
                    {myBounties.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No bounties posted yet.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {myBounties.map(b => (
                                <div key={b.id} style={{
                                    background: 'var(--card-bg)',
                                    border: `1px solid ${b.status === 'Open' ? 'rgba(0,255,136,0.25)' : b.status === 'Claimed' ? 'rgba(255,200,0,0.3)' : 'var(--border)'}`,
                                    borderRadius: '10px', overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                                                <span style={{
                                                    fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                                                    background: b.status === 'Open' ? 'rgba(0,255,136,0.12)' : b.status === 'Claimed' ? 'rgba(255,200,0,0.12)' : 'rgba(255,255,255,0.06)',
                                                    color: b.status === 'Open' ? 'var(--success)' : b.status === 'Claimed' ? 'var(--warning)' : 'var(--text-muted)'
                                                }}>
                                                    {b.status.toUpperCase()}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{rewardLabels[b.rewardType]}</span>
                                            </div>
                                            <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.9rem' }}>{b.symptom}</p>
                                            {b.status === 'Claimed' && b.claimedByUsername && (
                                                <p style={{ margin: '0.4rem 0 0', color: 'var(--warning)', fontSize: '0.8rem' }}>
                                                    ✓ Claimed by {b.claimedByUsername}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                                            {b.status === 'Open' && (
                                                <>
                                                    <button onClick={() => setSelectedBountyId(selectedBountyId === b.id ? null : b.id)}
                                                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                                                        {selectedBountyId === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        &nbsp;Submissions
                                                    </button>
                                                    <button onClick={() => handleClose(b.id)} disabled={loading}
                                                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                                                        Close
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Submissions Panel */}
                                    {selectedBountyId === b.id && (
                                        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                                            {submissions.length === 0 ? (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No submissions yet.</p>
                                            ) : (
                                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                    {submissions.map(sub => (
                                                        <div key={sub.id} style={{
                                                            background: 'var(--card-bg)', border: '1px solid var(--border)',
                                                            borderRadius: '8px', padding: '0.85rem 1rem'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                                <span style={{ color: 'var(--neon-cyan)', fontWeight: 600, fontSize: '0.88rem' }}>{sub.testerUsername}</span>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                                                    {new Date(sub.submittedAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <p style={{ margin: '0 0 0.75rem', color: 'var(--text)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{sub.reproSteps}</p>
                                                            {sub.evidenceUrl && (
                                                                <a href={sub.evidenceUrl} target="_blank" rel="noreferrer"
                                                                    style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem' }}>View Evidence →</a>
                                                            )}
                                                            {sub.status === 'Pending' && (
                                                                <button onClick={() => handleAccept(b.id, sub.id, sub.testerUsername)}
                                                                    disabled={loading}
                                                                    style={{ marginTop: '0.75rem', padding: '0.4rem 0.9rem', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#000', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                    ✓ Accept & Award
                                                                </button>
                                                            )}
                                                            {sub.status === 'Accepted' && (
                                                                <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>✓ Winner</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── BOUNTIES TAB — GAMER ────────────────────────────────────────── */}
            {activeTab === 'bounties' && isGamer && (
                <div>
                    <h3 style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        OPEN BOUNTIES ({allBounties.length})
                    </h3>
                    {allBounties.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <Target size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>No open bounties right now. Check back later.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {allBounties.map(b => {
                                const form = submitForm[b.id] || { reproSteps: '', evidenceUrl: '' };
                                const isExpanded = expandedBountyId === b.id;
                                return (
                                    <div key={b.id} style={{
                                        background: 'var(--card-bg)', border: '1px solid rgba(0,255,136,0.2)',
                                        borderRadius: '10px', overflow: 'hidden'
                                    }}>
                                        <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                                                    <span style={{ color: 'var(--success)', fontSize: '0.75rem', background: 'rgba(0,255,136,0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                                        OPEN
                                                    </span>
                                                    <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>{rewardLabels[b.rewardType]}</span>
                                                </div>
                                                <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.9rem' }}>{b.symptom}</p>
                                            </div>
                                            <button onClick={() => setExpandedBountyId(isExpanded ? null : b.id)}
                                                style={{ marginLeft: '1rem', padding: '0.45rem 0.9rem', borderRadius: '6px', border: '1px solid var(--neon-cyan)', background: 'transparent', color: 'var(--neon-cyan)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                {isExpanded ? <ChevronUp size={13} /> : <><Send size={13} style={{ marginRight: '0.35rem' }} />Submit</>}
                                            </button>
                                        </div>

                                        {/* Submit Form */}
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid var(--border)', padding: '1.1rem 1.25rem', background: 'rgba(0,0,0,0.15)' }}>
                                                <div style={{ display: 'grid', gap: '0.85rem' }}>
                                                    <div>
                                                        <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
                                                            Reproduction Steps (step-by-step, min 30 chars)
                                                        </label>
                                                        <textarea
                                                            value={form.reproSteps}
                                                            onChange={e => setSubmitForm(f => ({ ...f, [b.id]: { ...form, reproSteps: e.target.value } }))}
                                                            placeholder="1. Launch the game&#10;2. Go to Level 3&#10;3. ..."
                                                            rows={5}
                                                            style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.7rem', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
                                                    </div>
                                                    <div>
                                                        <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
                                                            Evidence URL (optional — screen recording or screenshot)
                                                        </label>
                                                        <input
                                                            type="url"
                                                            value={form.evidenceUrl}
                                                            onChange={e => setSubmitForm(f => ({ ...f, [b.id]: { ...form, evidenceUrl: e.target.value } }))}
                                                            placeholder="https://..."
                                                            style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                                                    </div>
                                                    <button onClick={() => handleSubmit(b.id)} disabled={loading}
                                                        className="btn-gradient" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <Send size={14} />
                                                        {loading ? 'Submitting...' : 'Submit Solution'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CrashBounty;