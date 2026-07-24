import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Pencil, Loader, Check, Code2, Gamepad2, Cpu, MemoryStick, Monitor, MonitorPlay, Link2, X } from 'lucide-react';
import '../App.css';

interface ProfileStats {
    gamesPublished?: number;
    betaTesters?: number;
    avgRating?: number;
    gamesTested?: number;
    reportsField?: number;
    reputation?: string;
}

interface Squad { id: string; name: string; memberIds?: string[]; members?: string[]; }
interface CommunityItem { id: string; name: string; type: string; memberIds: string[]; }

const RadarChart: React.FC<{ labels: string[]; values: number[]; max: number; color: string; size?: number }> = ({ labels, values, max, color, size = 200 }) => {
    const center = size / 2;
    const radius = size / 2 - 28;
    const n = labels.length;
    const pointFor = (i: number, frac: number): [number, number] => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return [center + Math.cos(angle) * radius * frac, center + Math.sin(angle) * radius * frac];
    };
    const dataPoints = values.map((v, i) => pointFor(i, Math.max(0.05, v / max)));
    const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z';
    return (
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
            {[0.25, 0.5, 0.75, 1].map((f, ri) => {
                const pts = Array.from({ length: n }, (_, i) => pointFor(i, f));
                return <path key={ri} d={pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z'} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
            })}
            {Array.from({ length: n }, (_, i) => { const [x, y] = pointFor(i, 1); return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />; })}
            <path d={dataPath} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
            {dataPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={color} />)}
            {labels.map((label, i) => { const [x, y] = pointFor(i, 1.26); return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontFamily="Fira Code" fontSize="9" fill="var(--text-secondary)">{label}</text>; })}
        </svg>
    );
};

const ProficiencyRow: React.FC<{ icon: React.ReactNode; name: string; current: number; buff?: number; talent?: number }> = ({ icon, name, current, buff = 0, talent = 0 }) => {
    const total = Math.min(100, current + buff + talent);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>{icon}</div>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontFamily: 'Fira Code', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>Skill <b style={{ color: 'var(--text-primary)' }}>{current}</b></span>
                    {buff > 0 && <span style={{ color: 'var(--accent)' }}>+{buff}</span>}
                    {talent > 0 && <span style={{ color: 'var(--success)' }}>{talent}</span>}
                </div>
            </div>
            <div style={{ display: 'flex', height: 7, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${current}%`, background: 'var(--accent)', transition: 'width 0.8s ease' }} />
                <div style={{ width: `${buff}%`, background: 'var(--success)', transition: 'width 0.8s ease' }} />
                <div style={{ width: `${talent}%`, background: 'var(--warning)', transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontFamily: 'Fira Code', fontSize: '0.67rem', color: 'var(--text-muted)' }}>{total}/100</div>
        </div>
    );
};

const UserProfile: React.FC = () => {
    const { user, login, token } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [profile, setProfile] = useState({ username: user?.username ?? '', email: user?.email ?? '', portfolioUrls: user?.portfolioUrls ?? [''], skillsets: user?.skillsets ?? [] as string[], gpu: user?.hardware?.gpu ?? '', cpu: user?.hardware?.cpu ?? '', ram: user?.hardware?.ram ?? '', os: user?.hardware?.os ?? '', profilePicture: user?.profilePicture ?? '' });
    const [newSkill, setNewSkill] = useState('');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState<ProfileStats>({});
    const [squads, setSquads] = useState<Squad[]>([]);
    const [communities, setCommunities] = useState<CommunityItem[]>([]);
    const [editOpen, setEditOpen] = useState(false);

    const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

    useEffect(() => {
        if (user) setProfile({ username: user.username, email: user.email, portfolioUrls: user.portfolioUrls ?? [''], skillsets: user.skillsets ?? [], gpu: user.hardware?.gpu ?? '', cpu: user.hardware?.cpu ?? '', ram: user.hardware?.ram ?? '', os: user.hardware?.os ?? '', profilePicture: user.profilePicture ?? '' });
    }, [user]);

    useEffect(() => {
        if (!user?.id) return;
        api.get<ProfileStats>(`/users/${user.id}/stats`).then(setStats).catch(() => { });
        api.get<Squad[]>('/squads/my').then(setSquads).catch(() => { });
        api.get<CommunityItem[]>('/communities').then(list => setCommunities((list || []).filter(c => (c.memberIds || []).includes(user.id)))).catch(() => { });
    }, [user?.id]);

    const addSkill = () => {
        if (newSkill.trim() && !profile.skillsets.includes(newSkill.trim())) {
            setProfile(p => ({ ...p, skillsets: [...p.skillsets, newSkill.trim()] }));
            setNewSkill('');
        }
    };

    const handlePfpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showMsg('error:Image must be under 2MB'); return; }
        const reader = new FileReader();
        reader.onload = () => setProfile(p => ({ ...p, profilePicture: reader.result as string }));
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await api.put<any>(`/users/${user?.id}`, { username: profile.username, email: profile.email, portfolioUrls: profile.portfolioUrls.filter(Boolean), skillsets: profile.skillsets, profilePicture: profile.profilePicture || undefined, hardware: { gpu: profile.gpu, cpu: profile.cpu, ram: profile.ram, os: profile.os } });
            if (updated && token) login(token, { id: updated.id ?? user?.id ?? '', username: updated.username ?? profile.username, email: updated.email ?? user?.email ?? '', userType: updated.userType ?? user?.userType ?? 'Developer', skillsets: updated.skillsets, portfolioUrls: updated.portfolioUrls, profilePicture: updated.profilePicture, hardware: updated.hardware });
            setSaved(true); showMsg('success:Profile saved!');
            setTimeout(() => setSaved(false), 2000);
            setTimeout(() => setEditOpen(false), 600);
        } catch (e: any) { showMsg(`error:${e.message || 'Failed to save'}`); }
        setSaving(false);
    };

    const isDev = user?.userType === 'Developer';

    const statItems = isDev
        ? [{ label: 'Games Published', value: stats.gamesPublished ?? 0 }, { label: 'Beta Testers', value: stats.betaTesters ?? 0 }, { label: 'Avg Rating', value: stats.avgRating ?? 0 }, { label: 'Squads', value: squads.length }, { label: 'Communities', value: communities.length }, { label: 'Skills', value: profile.skillsets.length }]
        : [{ label: 'Games Tested', value: stats.gamesTested ?? 0 }, { label: 'Reports Filed', value: stats.reportsField ?? 0 }, { label: 'Reputation', value: stats.reputation ?? '—' }, { label: 'Squads', value: squads.length }, { label: 'Communities', value: communities.length }, { label: 'Hardware', value: [profile.gpu, profile.cpu, profile.ram, profile.os].filter(Boolean).length + '/4' }];

    const activityValues = isDev
        ? [Math.min(10, stats.gamesPublished ?? 0), Math.min(10, Math.round((stats.avgRating ?? 0) * 2)), Math.min(10, stats.betaTesters ?? 0), Math.min(10, profile.skillsets.length), Math.min(10, squads.length * 2)]
        : [Math.min(10, stats.gamesTested ?? 0), Math.min(10, stats.reportsField ?? 0), Math.min(10, squads.length * 2), Math.min(10, communities.length * 2), Math.min(10, [profile.gpu, profile.cpu, profile.ram, profile.os].filter(Boolean).length * 2.5)];
    const activityLabels = isDev ? ['Releases', 'Rating', 'Testers', 'Skills', 'Squads'] : ['Testing', 'Reports', 'Squads', 'Community', 'Setup'];
    const socialValues = [Math.min(10, communities.length * 2), Math.min(10, squads.length * 2.5), Math.min(10, profile.portfolioUrls.filter(Boolean).length * 5), Math.min(10, profile.skillsets.length), Math.min(10, (stats.avgRating ?? 0) * 2)];

    const hwItems = [{ label: 'GPU', key: 'gpu' as const, icon: <Monitor size={13} /> }, { label: 'CPU', key: 'cpu' as const, icon: <Cpu size={13} /> }, { label: 'RAM', key: 'ram' as const, icon: <MemoryStick size={13} /> }, { label: 'OS', key: 'os' as const, icon: <MonitorPlay size={13} /> }];

    return (
        <div className="container">
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>

                {message && (
                    <div className={message.startsWith('success:') ? 'success-banner' : 'error-banner'} style={{ marginBottom: '1rem' }}>
                        {message.replace(/^(success|error):/, '')}
                    </div>
                )}

                {/* ── Hero Panel ── */}
                <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden', position: 'relative', padding: '2rem' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 12% 30%, var(--accent-glow) 0%, transparent 55%), radial-gradient(circle at 88% 70%, rgba(52,211,153,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', position: 'relative', alignItems: 'center' }}>

                        {/* Avatar */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                                {profile.profilePicture
                                    ? <img src={profile.profilePicture} alt={`${profile.username || 'User'}'s profile picture`} style={{ width: 108, height: 108, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-border)', boxShadow: '0 0 30px var(--accent-glow)' }} />
                                    : <div style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--accent-soft)', border: '3px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent)', boxShadow: '0 0 30px var(--accent-glow)' }}>{profile.username[0]?.toUpperCase()}</div>
                                }
                                <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'var(--accent)', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: '2px solid var(--bg-card)' }}><Pencil size={12} /></div>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePfpChange} />
                            <span className="tag" style={{ fontSize: '0.63rem', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                                {isDev ? <Code2 size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} /> : <Gamepad2 size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />}
                                {user?.userType}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontFamily: 'Fira Code' }}>Online</span>
                            </div>
                        </div>

                        {/* Identity */}
                        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <div>
                                <div style={{ fontFamily: 'Fira Code', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.3rem' }}>Player Profile</div>
                                <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{profile.username}</h1>
                                <p style={{ color: 'var(--text-secondary)', fontFamily: 'Fira Code', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{profile.email}</p>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {(isDev ? profile.skillsets.slice(0, 5) : [profile.gpu, profile.cpu].filter(Boolean)).map((s, i) => (
                                    <span key={i} className="tag">{s}</span>
                                ))}
                                {isDev && profile.skillsets.length === 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Fira Code' }}>No skills yet</span>}
                            </div>
                            {profile.portfolioUrls.filter(Boolean)[0] && (
                                <a href={profile.portfolioUrls[0]} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)', fontSize: '0.8rem', fontFamily: 'Fira Code', textDecoration: 'none' }}>
                                    <Link2 size={13} />{profile.portfolioUrls[0]}
                                </a>
                            )}
                            <button type="button" className="btn-gradient" style={{ alignSelf: 'flex-start' }} onClick={() => setEditOpen(true)}>
                                <Pencil size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Edit Profile
                            </button>
                        </div>

                        {/* Radar charts */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontFamily: 'Fira Code', fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.4rem' }}>◆ Activity</div>
                                <RadarChart labels={activityLabels} values={activityValues} max={10} color="var(--accent)" size={190} />
                            </div>
                            <div>
                                <div style={{ fontFamily: 'Fira Code', fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.4rem' }}>◇ Social</div>
                                <RadarChart labels={['Community', 'Squads', 'Links', 'Skills', 'Rating']} values={socialValues} max={10} color="var(--success)" size={190} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Stat tiles ── */}
                <div className="rg-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {statItems.map((s, i) => (
                        <div key={i} className="stat-card" style={i === 2 ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', boxShadow: 'var(--shadow-accent)' } : {}}>
                            <div className="stat-value" style={{ fontSize: '1.45rem' }}>{s.value}</div>
                            <div className="stat-label" style={{ fontSize: '0.72rem' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Communities + Squad Proficiency ── */}
                <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Favourite Communities</h3>
                            <a href="/communities" style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'Fira Code', textDecoration: 'none' }}>View all →</a>
                        </div>
                        {communities.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No communities yet.</p>
                            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {communities.slice(0, 4).map(c => (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                                            {c.type === 'Developer' ? <Code2 size={15} /> : <Gamepad2 size={15} />}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                            <div style={{ fontFamily: 'Fira Code', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{(c.memberIds || []).length} members · {c.type}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        }
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Squad Proficiency</h3>
                            <a href="/squads" style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'Fira Code', textDecoration: 'none' }}>View all →</a>
                        </div>
                        {squads.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No squads yet.</p>
                            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {squads.slice(0, 3).map((sq, _i) => {
                                    const mc = (sq.memberIds || sq.members || []).length;
                                    return <ProficiencyRow key={sq.id} icon={<Gamepad2 size={14} />} name={sq.name} current={Math.min(70, 30 + mc * 6)} buff={Math.min(20, mc * 2)} talent={Math.min(10, mc)} />;
                                })}
                            </div>
                        }
                    </div>
                </div>

                {/* ── Edit Modal ── */}
                {editOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={() => setEditOpen(false)}>
                        <div className="card" style={{ width: '100%', maxWidth: 620, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Edit Profile</h2>
                                <button type="button" aria-label="Close edit profile" onClick={() => setEditOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                            </div>
                            <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group"><label>Username</label><input className="form-control" value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} /></div>
                                <div className="form-group"><label>Email</label><input className="form-control" value={profile.email} readOnly style={{ opacity: 0.6 }} /></div>
                            </div>
                            {isDev ? (
                                <>
                                    <div className="form-group">
                                        <label>Skills</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input className="form-control" value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="Add skill..." onKeyDown={e => e.key === 'Enter' && addSkill()} />
                                            <button type="button" className="btn-gradient" style={{ padding: '0 1.1rem', whiteSpace: 'nowrap' }} onClick={addSkill}>Add</button>
                                        </div>
                                        <div className="tag-container">
                                            {profile.skillsets.map(s => (
                                                <span key={s} className="tag">{s}
                                                    <span style={{ cursor: 'pointer', color: 'var(--danger)', marginLeft: 4 }} onClick={() => setProfile(p => ({ ...p, skillsets: p.skillsets.filter(x => x !== s) }))}>×</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group"><label>Portfolio URL</label><input className="form-control" value={profile.portfolioUrls[0] || ''} onChange={e => setProfile(p => ({ ...p, portfolioUrls: [e.target.value] }))} /></div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontFamily: 'Fira Code', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Hardware Specs</div>
                                    <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {hwItems.map(f => (
                                            <div className="form-group" key={f.key}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{f.icon}{f.label}</label>
                                                <input className="form-control" value={profile[f.key]} onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                                <button type="button" className="btn-gradient" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                                    {saving ? <><Loader size={13} style={{ display: 'inline', marginRight: 4 }} />Saving...</> : saved ? <><Check size={13} style={{ display: 'inline', marginRight: 4 }} />Saved!</> : 'Save Profile'}
                                </button>
                                <button type="button" className="btn-outline" style={{ padding: '0 1.5rem' }} onClick={() => setEditOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;