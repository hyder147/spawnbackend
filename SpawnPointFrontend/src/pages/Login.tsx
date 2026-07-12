import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Lock, AtSign, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import SpawnLogo from '../components/SpawnLogo';
import '../App.css';

interface LoginResponse {
    token: string;
    user: {
        id: string;
        username: string;
        email: string;
        userType: 'Developer' | 'Gamer';
        role?: string;
    };
}

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.email || !form.password) { setError('All fields are required.'); return; }
        setLoading(true);
        try {
            const res = await api.post<LoginResponse>('/auth/login', form);
            login(res.token, res.user);
            localStorage.setItem('spawnpoint_token', res.token);
            localStorage.setItem('spawnpoint_user', JSON.stringify(res.user));
            navigate('/');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Login failed.';
            if (msg.toLowerCase().includes('verify')) {
                navigate('/verify-email', { state: { email: form.email } });
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page} className="auth-page">
            {/* Background grid lines */}
            <div style={styles.bgGrid} />

            {/* Left panel — branding (hidden on phones, see .auth-left in App.css) */}
            <div style={styles.leftPanel} className="auth-left">
                <div style={styles.leftInner}>
                    <div style={styles.brandRow}>
                        <SpawnLogo size={48} />
                        <div style={styles.brandName} className="auth-brand-name">
                            <span style={{ color: 'var(--accent)' }}>SPAWN</span>
                            <span style={{ color: '#fff' }}>POINT</span>
                        </div>
                    </div>

                    <div style={styles.heroText}>
                        <div style={styles.heroEyebrow}>// GAMING PLATFORM</div>
                        <h1 style={styles.heroHeadline} className="auth-hero-headline">Level Up<br />Your Game</h1>
                        <p style={styles.heroSub}>Connect with developers, join squads, discover indie games, and build your gaming legacy.</p>
                    </div>

                    <div style={styles.statRow} className="auth-stat-row">
                        {[
                            { value: '10K+', label: 'Players' },
                            { value: '500+', label: 'Games' },
                            { value: '2K+', label: 'Squads' },
                        ].map(s => (
                            <div key={s.label} style={styles.statItem}>
                                <div style={styles.statValue}>{s.value}</div>
                                <div style={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Decorative orbs */}
                <div style={{ position: 'absolute', top: '20%', right: '-60px', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,62,165,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '15%', left: '10%', width: 150, height: 150, borderRadius: '50%', background: 'rgba(124,92,252,0.07)', filter: 'blur(50px)', pointerEvents: 'none' }} />
            </div>

            {/* Right panel — form */}
            <div style={styles.rightPanel} className="auth-right">
                <div style={styles.card} className="auth-card">
                    {/* Top accent line */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--purple), transparent)', borderRadius: '16px 16px 0 0' }} />

                    {/* Logo — only shown on phones/tablets where the left branding panel is hidden */}
                    <div style={styles.mobileBrand} className="auth-mobile-brand">
                        <SpawnLogo size={36} />
                        <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', fontWeight: 900, letterSpacing: '4px', color: 'var(--accent)' }}>SPAWNPOINT</span>
                    </div>

                    {/* Header */}
                    <div style={styles.header}>
                        <div style={styles.tagline}>// IDENTITY VERIFICATION</div>
                        <h2 style={styles.title}>SIGN IN</h2>
                        <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', margin: 0 }}>Enter your credentials to access your account</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={styles.errorBox}>
                            <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.field}>
                            <label style={styles.label}>EMAIL ADDRESS</label>
                            <div style={styles.inputWrap}>
                                <AtSign size={14} style={{ position: 'absolute', left: '0.9rem', color: 'var(--accent)', opacity: 0.5, pointerEvents: 'none' }} />
                                <input
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="operator@spawnpoint.gg"
                                    style={styles.input}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div style={styles.field}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={styles.label}>PASSWORD</label>
                                <Link to="/forgot-password" style={{ ...styles.linkSmall, position: 'relative', zIndex: 2 }}>Forgot password?</Link>
                            </div>
                            <div style={styles.inputWrap}>
                                <Lock size={14} style={{ position: 'absolute', left: '0.9rem', color: 'var(--accent)', opacity: 0.5, pointerEvents: 'none' }} />
                                <input
                                    name="password"
                                    type={showPass ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="••••••••••••"
                                    style={{ ...styles.input, paddingRight: '3rem' }}
                                    autoComplete="current-password"
                                />
                                <button type="button" onClick={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.75 : 1 }}>
                            {loading
                                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <span style={styles.spinner} /> AUTHENTICATING...
                                </span>
                                : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Zap size={15} /> INITIALIZE SESSION
                                </span>
                            }
                        </button>
                    </form>

                    {/* Footer */}
                    <div style={styles.footer}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No account? </span>
                        <Link to="/register" style={{ ...styles.link, position: 'relative', zIndex: 2 }}>Create one →</Link>
                    </div>

                    <div style={styles.scanline} />
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-base)',
        position: 'relative',
        overflow: 'hidden',
    },
    bgGrid: {
        position: 'absolute',
        inset: 0,
        backgroundImage: `
            linear-gradient(rgba(255,62,165,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,62,165,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
        zIndex: 0,
    },

    /* Left branding panel */
    leftPanel: {
        flex: '0 0 48%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 3.5rem',
        background: 'linear-gradient(135deg, rgba(255,62,165,0.03) 0%, transparent 60%)',
        borderRight: '1px solid rgba(255,62,165,0.06)',
        position: 'relative',
        zIndex: 1,
    } as React.CSSProperties,
    leftInner: {
        maxWidth: 420,
    },
    brandRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '3.5rem',
    },
    brandName: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '1.3rem',
        fontWeight: 900,
        letterSpacing: '5px',
        textTransform: 'uppercase' as const,
        textShadow: '0 0 30px rgba(255,62,165,0.4)',
    },
    heroEyebrow: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.68rem',
        color: 'var(--accent)',
        letterSpacing: '3px',
        marginBottom: '1rem',
        opacity: 0.8,
    },
    heroText: {
        marginBottom: '3rem',
    },
    heroHeadline: {
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '3.8rem',
        fontWeight: 800,
        lineHeight: 1.0,
        color: '#fff',
        textTransform: 'uppercase' as const,
        letterSpacing: '-1px',
        marginBottom: '1.2rem',
    },
    heroSub: {
        color: 'var(--text-secondary)',
        fontSize: '0.92rem',
        lineHeight: 1.7,
        maxWidth: 340,
    },
    statRow: {
        display: 'flex',
        gap: '2.5rem',
    },
    statItem: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.2rem',
    },
    statValue: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '1.6rem',
        fontWeight: 700,
        color: 'var(--accent)',
        lineHeight: 1,
        textShadow: '0 0 20px rgba(255,62,165,0.3)',
    },
    statLabel: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        letterSpacing: '2px',
        textTransform: 'uppercase' as const,
    },

    /* Right form panel */
    rightPanel: {
        flex: '0 0 52%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
        zIndex: 1,
    },
    card: {
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        background: 'linear-gradient(160deg, #16162A 0%, #111120 100%)',
        border: '1px solid rgba(255,62,165,0.10)',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 0 80px rgba(255,62,165,0.05), 0 0 0 1px rgba(255,62,165,0.03), 0 32px 80px rgba(0,0,0,0.8)',
        overflow: 'hidden',
    },
    mobileBrand: {
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        marginBottom: '2rem',
    },
    header: {
        marginBottom: '2rem',
    },
    tagline: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        letterSpacing: '3px',
        marginBottom: '0.5rem',
    },
    title: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '1.8rem',
        fontWeight: 700,
        color: 'var(--accent)',
        margin: '0 0 0.4rem',
        letterSpacing: '4px',
        textShadow: '0 0 24px rgba(255,62,165,0.35)',
    },
    form: { display: 'flex', flexDirection: 'column' as const, gap: '1.1rem' },
    field: { display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' },
    label: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.62rem',
        color: 'var(--accent)',
        letterSpacing: '2px',
        textTransform: 'uppercase' as const,
        opacity: 0.8,
    },
    inputWrap: {
        position: 'relative' as const,
        display: 'flex',
        alignItems: 'center',
    },
    input: {
        width: '100%',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '0.8rem 0.9rem 0.8rem 2.5rem',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box' as const,
    },
    eyeBtn: {
        position: 'absolute' as const,
        right: '0.9rem',
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: 0,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
    },
    submitBtn: {
        marginTop: '0.75rem',
        width: '100%',
        padding: '0.9rem',
        background: 'var(--gradient-accent)',
        border: 'none',
        borderRadius: '8px',
        color: '#000',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '2px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 0 24px rgba(255,62,165,0.20)',
    },
    spinner: {
        display: 'inline-block',
        width: '13px',
        height: '13px',
        border: '2px solid rgba(0,0,0,0.25)',
        borderTopColor: '#000',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
    errorBox: {
        background: 'rgba(255,68,68,0.08)',
        border: '1px solid rgba(255,68,68,0.25)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        fontSize: '0.82rem',
        color: 'var(--danger)',
        marginBottom: '0.5rem',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    footer: {
        textAlign: 'center' as const,
        marginTop: '1.5rem',
        fontSize: '0.85rem',
        position: 'relative' as const,
        zIndex: 2,
    },
    link: {
        color: 'var(--accent)',
        textDecoration: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.82rem',
        fontWeight: 600,
    },
    linkSmall: {
        color: 'var(--text-muted)',
        textDecoration: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.68rem',
        transition: 'color 0.2s',
    },
    scanline: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--gradient-accent)',
        opacity: 0.5,
        pointerEvents: 'none' as const,
    },
};

export default Login;