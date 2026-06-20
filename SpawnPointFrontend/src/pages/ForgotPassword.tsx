import React, { useState } from 'react';
import { AlertTriangle, Mail, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) { setError('Please enter your email address.'); return; }
        setLoading(true);
        setError('');
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.logo}>⟨ SPAWN<span style={{ color: 'var(--neon-purple)' }}>POINT</span> ⟩</div>
                    <div style={styles.tagline}>// PASSWORD RECOVERY PROTOCOL</div>
                    <div style={styles.iconRing}>
                        <Mail size={24} style={{ color: "var(--neon-cyan)" }} />
                    </div>
                    <h1 style={styles.title}>FORGOT PASSWORD</h1>
                    {!sent && (
                        <p style={styles.subtitle}>
                            Enter your registered email and we'll send a reset code.
                        </p>
                    )}
                </div>

                {sent ? (
                    <div style={styles.sentBox}>
                        <div style={styles.sentIcon}><Check size={28} /></div>
                        <p style={styles.sentTitle}>CODE DISPATCHED</p>
                        <p style={styles.sentText}>
                            If <span style={{ color: 'var(--neon-cyan)', fontFamily: "'JetBrains Mono', monospace" }}>{email}</span> is registered,
                            a reset code has been sent. Check your inbox.
                        </p>
                        <button
                            onClick={() => navigate('/reset-password', { state: { email } })}
                            style={styles.submitBtn}
                        >
                            [ ENTER RESET CODE ]
                        </button>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div style={styles.errorBox}>
                                <AlertTriangle size={14} style={{ color: 'var(--neon-pink)', marginRight: '0.5rem', flexShrink: 0 }} />
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} style={styles.form}>
                            <div style={styles.field}>
                                <label style={styles.label}>EMAIL ADDRESS</label>
                                <div style={styles.inputWrap}>
                                    <span style={styles.inputIcon}>◈</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(''); }}
                                        placeholder="operator@spawnpoint.gg"
                                        style={styles.input}
                                        autoComplete="email"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
                            >
                                {loading ? (
                                    <span style={styles.spinnerRow}><span style={styles.spinner} /> SENDING...</span>
                                ) : '[ SEND RESET CODE ]'}
                            </button>
                        </form>
                    </>
                )}

                <div style={styles.footer}>
                    <Link to="/login" style={styles.backLink}>← Back to Login</Link>
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
    },
    card: {
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-dim)',
        borderRadius: '12px',
        padding: '2.5rem',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
    },
    header: { textAlign: 'center', marginBottom: '2rem' },
    logo: {
        fontFamily: "'Orbitron', monospace",
        fontSize: '1.1rem',
        fontWeight: 900,
        background: 'var(--primary-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '2px',
        marginBottom: '0.5rem',
    },
    tagline: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.65rem',
        color: 'var(--text-dim)',
        letterSpacing: '2px',
        marginBottom: '1.25rem',
    },
    iconRing: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(191,0,255,0.06)',
        border: '1px solid var(--border-purple)',
        marginBottom: '1rem',
        boxShadow: '0 0 24px rgba(191,0,255,0.12)',
    },
    icon: { fontSize: '1.75rem', color: 'var(--neon-purple)' },
    title: {
        fontFamily: "'Orbitron', monospace",
        fontSize: '1.3rem',
        fontWeight: 700,
        color: 'var(--neon-purple)',
        margin: '0 0 0.75rem',
        letterSpacing: '3px',
        textShadow: '0 0 20px rgba(191,0,255,0.4)',
    },
    subtitle: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        lineHeight: 1.6,
        margin: 0,
    },
    form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
    field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    label: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.65rem',
        color: 'var(--neon-purple)',
        letterSpacing: '2px',
    },
    inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
    inputIcon: {
        position: 'absolute',
        left: '0.9rem',
        color: 'var(--neon-purple)',
        fontSize: '0.85rem',
        opacity: 0.6,
        pointerEvents: 'none',
    },
    input: {
        width: '100%',
        background: 'rgba(191,0,255,0.04)',
        border: '1px solid var(--border-purple)',
        borderRadius: '6px',
        padding: '0.75rem 0.9rem 0.75rem 2.5rem',
        color: 'var(--text-primary)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.9rem',
        outline: 'none',
        boxSizing: 'border-box',
    },
    submitBtn: {
        width: '100%',
        padding: '0.85rem',
        background: 'linear-gradient(135deg, #bf00ff 0%, #7700bb 100%)',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        fontFamily: "'Orbitron', monospace",
        fontWeight: 700,
        fontSize: '0.8rem',
        letterSpacing: '2px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        boxShadow: '0 0 20px rgba(191,0,255,0.25)',
    },
    spinnerRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    spinner: {
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
    errorBox: {
        background: 'rgba(255,0,110,0.08)',
        border: '1px solid rgba(255,0,110,0.3)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        fontFamily: "'JetBrains Mono', monospace",
    },
    sentBox: { textAlign: 'center', padding: '0.5rem 0' },
    sentIcon: {
        fontSize: '2.5rem',
        color: 'var(--neon-green)',
        marginBottom: '0.75rem',
        textShadow: '0 0 20px rgba(0,255,136,0.5)',
    },
    sentTitle: {
        fontFamily: "'Orbitron', monospace",
        fontSize: '1rem',
        fontWeight: 700,
        color: 'var(--neon-green)',
        letterSpacing: '3px',
        margin: '0 0 0.75rem',
    },
    sentText: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        lineHeight: 1.6,
        marginBottom: '1.5rem',
    },
    footer: { textAlign: 'center', marginTop: '1.5rem' },
    backLink: {
        color: 'var(--text-dim)',
        textDecoration: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.78rem',
    },
    scanline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(135deg, #bf00ff 0%, #7700bb 100%)',
        opacity: 0.6,
    },
};

export default ForgotPassword;