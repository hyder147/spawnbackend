import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Lock, AtSign, Code2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import '../App.css';

const Register: React.FC = () => {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        userType: '' as '' | 'Developer' | 'Gamer',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const setType = (type: 'Developer' | 'Gamer') => {
        setForm(prev => ({ ...prev, userType: type }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.username || !form.email || !form.password || !form.userType) {
            setError('All fields are required.'); return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.'); return;
        }
        if (form.password.length < 8) {
            setError('Password must be at least 8 characters.'); return;
        }

        setLoading(true);
        try {
            await api.post('/auth/register', {
                username: form.username,
                email: form.email,
                password: form.password,
                userType: form.userType,
            });
            // Backend sends OTP — redirect to verify page
            navigate('/verify-email', { state: { email: form.email } });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page} className="auth-page-center">
            <div style={styles.card} className="register-card">
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.logo}>⟨ SPAWN<span style={{ color: 'var(--accent)' }}>POINT</span> ⟩</div>
                    <div style={styles.tagline}>// NEW OPERATOR ENROLLMENT</div>
                    <h1 style={styles.title}>CREATE ACCOUNT</h1>
                </div>

                {error && (
                    <div style={styles.errorBox}>
                        <AlertTriangle size={14} style={{ color: 'var(--danger)', marginRight: '0.5rem', flexShrink: 0 }} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={styles.form}>
                    {/* User Type Selector */}
                    <div style={styles.field}>
                        <label style={styles.label}>OPERATOR CLASS</label>
                        <div style={styles.typeRow}>
                            {(['Developer', 'Gamer'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    style={{
                                        ...styles.typeBtn,
                                        ...(form.userType === t ? styles.typeBtnActive : {}),
                                    }}
                                >
                                    <span style={styles.typeIcon}>{t === 'Developer' ? <Code2 size={14} /> : <User size={14} />}</span>
                                    <span>{t.toUpperCase()}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Username */}
                    <div style={styles.field}>
                        <label style={styles.label}>USERNAME</label>
                        <div style={styles.inputWrap}>
                            <span style={styles.inputIcon}>@</span>
                            <input
                                name="username"
                                type="text"
                                value={form.username}
                                onChange={handleChange}
                                placeholder="your_callsign"
                                style={styles.input}
                                autoComplete="username"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div style={styles.field}>
                        <label style={styles.label}>EMAIL ADDRESS</label>
                        <div style={styles.inputWrap}>
                            <AtSign size={14} style={{ position: "absolute", left: "0.9rem", color: "var(--accent)", opacity: 0.6 }} />
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

                    {/* Password */}
                    <div style={styles.field}>
                        <label style={styles.label}>PASSWORD</label>
                        <div style={styles.inputWrap}>
                            <Lock size={14} style={{ position: "absolute", left: "0.9rem", color: "var(--accent)", opacity: 0.6 }} />
                            <input
                                name="password"
                                type={showPass ? 'text' : 'password'}
                                value={form.password}
                                onChange={handleChange}
                                placeholder="min. 8 characters"
                                style={{ ...styles.input, paddingRight: '3rem' }}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(p => !p)}
                                style={styles.eyeBtn}
                            >
                                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div style={styles.field}>
                        <label style={styles.label}>CONFIRM PASSWORD</label>
                        <div style={styles.inputWrap}>
                            <Lock size={14} style={{ position: "absolute", left: "0.9rem", color: "var(--accent)", opacity: 0.6 }} />
                            <input
                                name="confirmPassword"
                                type={showPass ? 'text' : 'password'}
                                value={form.confirmPassword}
                                onChange={handleChange}
                                placeholder="repeat password"
                                style={styles.input}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <span style={styles.spinnerRow}><span style={styles.spinner} /> CREATING ACCOUNT...</span>
                        ) : '[ ENROLL OPERATOR ]'}
                    </button>
                </form>

                <div style={styles.footer}>
                    <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
                    <Link to="/login" style={styles.link}>Sign in →</Link>
                </div>

                <div style={styles.scanline} />
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(157,78,221,0.05) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 0% 100%, rgba(255,0,127,0.04) 0%, transparent 55%), var(--bg-base)',
    },
    card: {
        position: 'relative',
        width: '100%',
        maxWidth: '460px',
        background: 'var(--gradient-card)',
        border: '1px solid var(--border-purple)',
        borderRadius: '16px',
        padding: '2.5rem 2.25rem',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
    },
    header: { textAlign: 'center', marginBottom: '2rem' },
    logo: {
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.1rem',
        fontWeight: 900,
        background: 'var(--gradient-accent)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '4px',
        marginBottom: '0.5rem',
        textShadow: 'none',
    },
    tagline: {
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        letterSpacing: '1.5px',
        marginBottom: '1rem',
    },
    title: {
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.7rem',
        fontWeight: 700,
        color: 'var(--purple-light)',
        margin: 0,
        letterSpacing: '1px',
        textTransform: 'uppercase' as const,
    },
    form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
    field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    label: {
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.7rem',
        color: 'var(--accent)',
        letterSpacing: '1.5px',
    },
    typeRow: { display: 'flex', gap: '0.75rem' },
    typeBtn: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.85rem',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        fontFamily: "'Syne', sans-serif",
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '1px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    typeBtnActive: {
        background: 'rgba(124,110,250,0.08)',
        border: '1px solid var(--accent)',
        color: 'var(--accent)',
        boxShadow: '0 0 12px rgba(0,245,212,0.15)',
    },
    typeIcon: { fontSize: '1.2rem' },
    inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
    inputIcon: {
        position: 'absolute',
        left: '0.9rem',
        color: 'var(--accent)',
        fontSize: '0.85rem',
        opacity: 0.6,
        pointerEvents: 'none',
        fontFamily: "'Fira Code', monospace",
    },
    input: {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '0.75rem 0.9rem 0.75rem 2.5rem',
        color: 'var(--text-primary)',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
    },
    eyeBtn: {
        position: 'absolute',
        right: '0.9rem',
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '1rem',
        padding: 0,
        lineHeight: 1,
    },
    submitBtn: {
        marginTop: '0.5rem',
        width: '100%',
        padding: '0.85rem',
        background: 'var(--gradient-accent)',
        border: 'none',
        borderRadius: '6px',
        color: '#000',
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        fontSize: '0.8rem',
        letterSpacing: '2px',
        cursor: 'pointer',
        transition: 'opacity 0.2s, box-shadow 0.2s',
        boxShadow: 'var(--shadow-accent)',
    },
    spinnerRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    spinner: {
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid rgba(0,0,0,0.3)',
        borderTopColor: '#000',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        fontFamily: "'Fira Code', monospace",
    },
    footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', position: 'relative', zIndex: 2 },
    link: {
        color: 'var(--accent)',
        textDecoration: 'none',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.85rem',
        position: 'relative',
        zIndex: 2,
    },
    scanline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--gradient-accent)',
        pointerEvents: 'none',
        opacity: 0.6,
    },
};

export default Register;