import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Zap, Swords, Brain, Joystick } from 'lucide-react';
import '../App.css';

interface Game {
    id: string;
    title: string;
    description: string;
    developerName: string;
    genre: string;
    status: string;
    screenshots?: string[];
    downloadUrl?: string;
}

const genreColor: Record<string, string> = {
    Action: 'var(--neon-pink)', RPG: 'var(--neon-purple)',
    Strategy: 'var(--neon-cyan)', Indie: 'var(--neon-green)',
    Default: 'var(--neon-yellow)'
};

const GameCard: React.FC<{ game: Game; onApply: (g: Game) => void }> = ({ game, onApply }) => {
    const [flipped, setFlipped] = useState(false);
    const c = genreColor[game.genre] || genreColor.Default;

    return (
        <div
            style={{ perspective: '1000px', cursor: 'pointer', height: '300px' }}
            onMouseEnter={() => setFlipped(true)}
            onMouseLeave={() => setFlipped(false)}
        >
            <div style={{
                position: 'relative', width: '100%', height: '100%',
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                transition: 'transform 0.5s ease',
            }}>
                {/* Front */}
                <div className="card" style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{
                            height: '110px', borderRadius: '8px', marginBottom: '1rem',
                            border: `1px solid ${c}33`, position: 'relative', overflow: 'hidden',
                        }}>
                            <img
                                src={game.screenshots?.[0] || `https://picsum.photos/seed/${game.id || game.title}/400/220`}
                                alt={game.title}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: `linear-gradient(180deg, ${c}00 40%, rgba(6,7,14,0.85) 100%)`,
                            }} />
                            <div style={{
                                position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
                                background: 'rgba(6,7,14,0.72)', border: `1px solid ${c}55`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: c, backdropFilter: 'blur(4px)'
                            }}>
                                {game.genre === 'Action' ? <Zap size={13} /> : game.genre === 'RPG' ? <Swords size={13} /> : game.genre === 'Strategy' ? <Brain size={13} /> : <Joystick size={13} />}
                            </div>
                        </div>
                        <h3 style={{ margin: '0 0 0.4rem', fontFamily: 'Orbitron, monospace', fontSize: '0.95rem' }}>{game.title}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.4, margin: 0 }}>{game.description.slice(0, 60)}...</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <span className="badge" style={{ borderColor: `${c}44`, color: c, background: `${c}11` }}>{game.genre}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>{game.status}</span>
                    </div>
                </div>

                {/* Back */}
                <div className="card" style={{
                    position: 'absolute', inset: 0,
                    backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    borderColor: `${c}66`, background: `linear-gradient(135deg, ${c}10, rgba(0,0,0,0.8))`
                }}>
                    <div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', color: c, marginBottom: '0.75rem' }}>{game.title}</div>
                        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)', margin: '0 0 1rem' }}>{game.description}</p>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>by {game.developerName}</div>
                    </div>
                    <button className="btn-gradient" style={{ width: '100%' }} onClick={e => { e.stopPropagation(); onApply(game); }}>
                        Apply for Beta
                    </button>
                </div>
            </div>
        </div>
    );
};

const GameListing: React.FC = () => {
    const { user } = useAuth();

    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('All');
    const [applyGame, setApplyGame] = useState<Game | null>(null);
    const [applyReason, setApplyReason] = useState('');
    const [message, setMessage] = useState('');
    const [newGame, setNewGame] = useState({
        title: '', description: '', genre: 'Action', status: 'Alpha', downloadUrl: ''
    });

    const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

    const fetchGames = async () => {
        setLoading(true);
        try {
            const data = await api.get<Game[]>('/games');
            setGames(data);
        } catch {
            setGames([]);
        }
        setLoading(false);
    };

    useEffect(() => { fetchGames(); }, []);

    const handleCreateGame = async () => {
        if (!newGame.title.trim() || !newGame.description.trim()) { showMsg('error:Title and description are required'); return; }
        const payload = {
            ...newGame,
            developerId: user?.id,
            developerName: user?.username ?? 'Unknown Dev',
        };
        try {
            const created = await api.post<Game>('/games', payload);
            setGames(prev => [created, ...prev]);
            setShowModal(false);
            setNewGame({ title: '', description: '', genre: 'Action', status: 'Alpha', downloadUrl: '' });
            showMsg('success:Game uploaded!');
        } catch (e: any) {
            showMsg(`error:${e.message || 'Failed to upload game'}`);
        }
    };

    const handleApply = async () => {
        if (!applyGame) return;
        try {
            await api.post(`/games/${applyGame.id}/apply`, { userId: user?.id, reason: applyReason });
            showMsg(`success:Application sent for ${applyGame.title}!`);
        } catch (e: any) {
            showMsg(`error:${e.message || 'Failed to submit application'}`);
        }
        setApplyGame(null);
        setApplyReason('');
    };

    const genres = ['All', 'Action', 'RPG', 'Strategy', 'Indie'];
    const filtered = filter === 'All' ? games : games.filter(g => g.genre === filter);

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -1, left: 0, width: 80, height: 1, background: 'var(--gradient-accent)' }} />
                <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
                        Beta Pipeline
                    </div>
                    <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>Explore Games</h1>
                    <p style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', marginTop: '0.4rem', marginBottom: 0 }}>
                        {games.length} titles available
                    </p>
                </div>
                {user?.userType === 'Developer' && (
                    <button className="btn-gradient" onClick={() => setShowModal(true)}>+ Upload Game</button>
                )}
            </div>

            {message && <div className={message.startsWith('success:') ? 'success-banner' : 'error-banner'} style={{ marginBottom: '1rem' }}>{message.replace(/^(success|error):/, '')}</div>}

            <div className="tab-bar" style={{ marginBottom: '2rem' }}>
                {genres.map(g => (
                    <button key={g} className={`tab-btn ${filter === g ? 'active' : ''}`} onClick={() => setFilter(g)}>{g}</button>
                ))}
            </div>

            {loading ? <div className="spinner" /> : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <p style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', fontSize: '0.88rem' }}>
                        No games found. {user?.userType === 'Developer' ? 'Upload your first game!' : 'Check back later!'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem', width: '100%' }}>
                    {filtered.map(game => <GameCard key={game.id} game={game} onApply={setApplyGame} />)}
                </div>
            )}

            {/* Upload Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Upload New Game</h2>
                        <div className="form-group">
                            <label>Title</label>
                            <input className="form-control" value={newGame.title} onChange={e => setNewGame({ ...newGame, title: e.target.value })} placeholder="Game title..." />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea className="form-control" value={newGame.description} onChange={e => setNewGame({ ...newGame, description: e.target.value })} rows={3} placeholder="Describe your game..." />
                        </div>
                        <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Genre</label>
                                <select className="form-control" value={newGame.genre} onChange={e => setNewGame({ ...newGame, genre: e.target.value })}>
                                    {['Action', 'RPG', 'Strategy', 'Indie'].map(g => <option key={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select className="form-control" value={newGame.status} onChange={e => setNewGame({ ...newGame, status: e.target.value })}>
                                    {['Alpha', 'Beta', 'Released'].map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Download URL (optional)</label>
                            <input className="form-control" value={newGame.downloadUrl} onChange={e => setNewGame({ ...newGame, downloadUrl: e.target.value })} placeholder="https://..." />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button className="btn-gradient" style={{ flex: 1 }} onClick={handleCreateGame}>Upload ▶</button>
                            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Modal */}
            {applyGame && (
                <div className="modal-overlay" onClick={() => setApplyGame(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '0.5rem' }}>Apply for Beta</h2>
                        <p style={{ color: 'var(--neon-cyan)', fontFamily: 'JetBrains Mono', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{applyGame.title}</p>
                        <div className="form-group">
                            <label>Why do you want to test this game?</label>
                            <textarea className="form-control" placeholder="Share your experience and motivation..." rows={4}
                                value={applyReason} onChange={e => setApplyReason(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button className="btn-gradient" style={{ flex: 1 }} onClick={handleApply}>Submit Application</button>
                            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setApplyGame(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameListing;