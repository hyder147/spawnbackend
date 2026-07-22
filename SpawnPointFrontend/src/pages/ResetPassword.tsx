import React, { useState, useRef } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, Lock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

const OTP_LENGTH = 6;

const ResetPassword: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [email, setEmail] = useState((location.state as { email?: string })?.email ?? '');
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleOtpChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...otp];
        next[index] = digit;
        setOtp(next);
        setError('');
        if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = [...otp];
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
        setOtp(next);
        inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join('');
        if (!email) { setError('Email is missing. Please go back.'); return; }
        if (code.length < OTP_LENGTH) { setError('Enter the complete 6-digit code.'); return; }
        if (!newPassword) { setError('Please enter a new password.'); return; }
        if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

        setLoading(true);
        setError('');
        try {
            await api.post('/auth/reset-password', { email, otp: code, newPassword });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Reset failed. Try again.');
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={styles.logo}>⟨ SPAWN<span style={{ color: 'var(--neon-purple)' }}>POINT</span> ⟩</div>
                        <div style={styles.successIcon}><Check size={28} /></div>
                        <h2 style={styles.successTitle}>PASSWORD RESET</h2>
                        <p style={styles.successText}>
                            Your password has been updated. Redirecting to login...
                        </p>
                        <div style={styles.progressBar}>
                            <div style={styles.progressFill} />
                        </div>
                    </div>
                    <div style={styles.scanline} />
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.logo}>⟨ SPAWN<span style={{ color: 'var(--neon-purple)' }}>POINT</span> ⟩</div>
                    <div style={styles.tagline}>// CREDENTIAL RESET SEQUENCE</div>
                    <h1 style={styles.title}>RESET PASSWORD</h1>
                    <p style={styles.subtitle}>
                        Enter the code sent to{' '}
                        <span style={{ color: 'var(--neon-cyan)', fontFamily: "'Fira Code', monospace" }}>
                            {email || 'your email'}
                        </span>
                        , then choose a new password.
                    </p>
                </div>

                {error && (
                    <div style={styles.errorBox}>
                        <AlertTriangle size={14} style={{ color: 'var(--neon-pink)', marginRight: '0.5rem', flexShrink: 0 }} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={styles.form}>
                    {/* Email if not in state */}
                    {!location.state?.email && (
                        <div style={styles.field}>
                            <label style={styles.label}>EMAIL ADDRESS</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="operator@spawnpoint.gg"
                                style={{ ...styles.input, paddingLeft: '1rem' }}
                            />
                        </div>
                    )}

                    {/* OTP */}
                    <div>
                        <label style={{ ...styles.label, display: 'block', textAlign: 'center', marginBottom: '0.75rem' }}>
                            RESET CODE
                        </label>
                        <div style={styles.otpRow} onPaste={handlePaste}>
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleKeyDown(i, e)}
                                    style={{
                                        ...styles.otpInput,
                                        borderColor: digit ? 'var(--neon-cyan)' : 'var(--border-dim)',
                                        color: digit ? 'var(--neon-cyan)' : 'var(--text-primary)',
                                        boxShadow: digit ? '0 0 10px rgba(0,245,212,0.2)' : 'none',
                                    }}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>
                    </div>

                    {/* New Password */}
                    <div style={styles.field}>
                        <label style={styles.label}>NEW PASSWORD</label>
                        <div style={styles.inputWrap}>
                            <Lock size={14} style={{ position: "absolute", left: "0.9rem", color: "var(--neon-cyan)", opacity: 0.6 }} />
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); setError(''); }}
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
                            <Lock size={14} style={{ position: "absolute", left: "0.9rem", color: "var(--neon-cyan)", opacity: 0.6 }} />
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
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
                            <span style={styles.spinnerRow}><span style={styles.spinner} /> RESETTING...</span>
                        ) : '[ RESET PASSWORD ]'}
                    </button>
                </form>

                <div style={styles.footer}>
                    <Link to="/forgot-password" style={styles.backLink}>← Resend Code</Link>
                    <span style={{ color: 'var(--text-dim)', margin: '0 0.75rem' }}>·</span>
                    <Link to="/login" style={styles.backLink}>Back to Login</Link>
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
        maxWidth: '440px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-dim)',
        borderRadius: '12px',
        padding: '2.5rem',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
    },
    header: { textAlign: 'center', marginBottom: '2rem' },
    logo: {
        fontFamily: "'Syne', sans-serif",
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
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.65rem',
        color: 'var(--text-dim)',
        letterSpacing: '2px',
        marginBottom: '1rem',
    },
    title: {
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.4rem',
        fontWeight: 700,
        color: 'var(--neon-cyan)',
        margin: '0 0 0.75rem',
        letterSpacing: '3px',
        textShadow: '0 0 20px rgba(0,245,212,0.4)',
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
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.65rem',
        color: 'var(--neon-cyan)',
        letterSpacing: '2px',
    },
    otpRow: {
        display: 'flex',
        gap: '0.6rem',
        justifyContent: 'center',
    },
    otpInput: {
        width: '52px',
        height: '58px',
        textAlign: 'center',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-dim)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.3rem',
        fontWeight: 700,
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s, color 0.2s',
        caretColor: 'var(--neon-cyan)',
    },
    inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
    inputIcon: {
        position: 'absolute',
        left: '0.9rem',
        color: 'var(--neon-cyan)',
        fontSize: '0.85rem',
        opacity: 0.6,
        pointerEvents: 'none',
    },
    input: {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-dim)',
        borderRadius: '6px',
        padding: '0.75rem 0.9rem 0.75rem 2.5rem',
        color: 'var(--text-primary)',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.9rem',
        outline: 'none',
        boxSizing: 'border-box',
    },
    eyeBtn: {
        position: 'absolute',
        right: '0.9rem',
        background: 'none',
        border: 'none',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        fontSize: '1rem',
        padding: 0,
        lineHeight: 1,
    },
    submitBtn: {
        width: '100%',
        padding: '0.85rem',
        background: 'var(--primary-gradient)',
        border: 'none',
        borderRadius: '6px',
        color: '#000',
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        fontSize: '0.8rem',
        letterSpacing: '2px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        boxShadow: '0 0 20px rgba(0,245,212,0.2)',
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
        background: 'rgba(255,0,110,0.08)',
        border: '1px solid rgba(255,0,110,0.3)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
        marginBottom: '0.5rem',
        fontFamily: "'Fira Code', monospace",
    },
    successIcon: {
        fontSize: '3rem',
        color: 'var(--neon-green)',
        marginBottom: '1rem',
        textShadow: '0 0 30px rgba(52,211,153,0.6)',
    },
    successTitle: {
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.2rem',
        fontWeight: 700,
        color: 'var(--neon-green)',
        letterSpacing: '3px',
        margin: '0 0 0.75rem',
    },
    successText: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        lineHeight: 1.6,
        marginBottom: '1.5rem',
    },
    progressBar: {
        height: '3px',
        background: 'var(--border-dim)',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: 'var(--neon-green)',
        animation: 'progress 3s linear forwards',
        boxShadow: '0 0 8px var(--neon-green)',
    },
    footer: { textAlign: 'center', marginTop: '1.5rem' },
    backLink: {
        color: 'var(--text-dim)',
        textDecoration: 'none',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.78rem',
    },
    scanline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--primary-gradient)',
        opacity: 0.6,
    },
};

export default ResetPassword;