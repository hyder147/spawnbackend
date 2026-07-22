import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Mail, AlertTriangle, Check } from 'lucide-react';
import { api } from '../api';
import '../App.css';

const OTP_LENGTH = 6;

const VerifyEmail: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Email comes from navigation state (after register or login redirect)
    const [email, setEmail] = useState((location.state as { email?: string })?.email ?? '');
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) { setCanResend(true); return; }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleOtpChange = (index: number, value: string) => {
        // Only allow digits
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...otp];
        next[index] = digit;
        setOtp(next);
        setError('');

        // Auto-advance
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
        if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = [...otp];
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
        setOtp(next);
        // Focus the last filled or next empty
        const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < OTP_LENGTH) { setError('Please enter the complete 6-digit code.'); return; }
        if (!email) { setError('Email address is missing. Please go back and try again.'); return; }

        setLoading(true);
        setError('');
        try {
            await api.post('/auth/verify-email', { email, otp: code });
            setSuccess('Email verified! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Verification failed.');
            // Shake the inputs on error
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) { setError('Email address is missing.'); return; }
        setResending(true);
        setError('');
        try {
            await api.post('/auth/resend-verification', { email });
            setCountdown(60);
            setCanResend(false);
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
            setSuccess('A new OTP has been sent to your email.');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Could not resend OTP.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div style={styles.page} className="otp-page">
            <div style={styles.card} className="otp-card">
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.logo}>⟨ SPAWN<span style={{ color: 'var(--accent)' }}>POINT</span> ⟩</div>
                    <div style={styles.tagline}>// EMAIL VERIFICATION PROTOCOL</div>
                    <div style={styles.iconRing}>
                        <Mail size={24} style={{ color: "var(--accent)" }} />
                    </div>
                    <h1 style={styles.title}>VERIFY EMAIL</h1>
                    <p style={styles.subtitle}>
                        A 6-digit code was sent to<br />
                        <span style={{ color: 'var(--accent)', fontFamily: "'Fira Code', monospace" }}>
                            {email || 'your email'}
                        </span>
                    </p>
                </div>

                {/* Alerts */}
                {error && (
                    <div style={styles.errorBox}>
                        <AlertTriangle size={14} style={{ color: 'var(--danger)', marginRight: '0.5rem', flexShrink: 0 }} />
                        {error}
                    </div>
                )}
                {success && (
                    <div style={styles.successBox}>
                        <Check size={14} style={{ color: 'var(--success)', marginRight: '0.5rem', flexShrink: 0 }} />
                        {success}
                    </div>
                )}

                {/* Email override (if arrived without state) */}
                {!location.state?.email && (
                    <div style={styles.field}>
                        <label style={styles.label}>YOUR EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="operator@spawnpoint.gg"
                            style={{ ...styles.input, paddingLeft: '1rem' }}
                        />
                    </div>
                )}

                {/* OTP Inputs */}
                <form onSubmit={handleSubmit}>
                    <label style={{ ...styles.label, display: 'block', textAlign: 'center', marginBottom: '1rem' }}>
                        ENTER VERIFICATION CODE
                    </label>
                    <div style={styles.otpRow} className="otp-row" onPaste={handlePaste}>
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
                                className="otp-input"
                                style={{
                                    ...styles.otpInput,
                                    borderColor: digit ? 'var(--accent)' : 'var(--border)',
                                    color: digit ? 'var(--accent)' : 'var(--text-primary)',
                                    boxShadow: digit ? '0 0 10px rgba(124,110,250,0.2)' : 'none',
                                }}
                                autoFocus={i === 0}
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !!success}
                        style={{ ...styles.submitBtn, opacity: (loading || !!success) ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <span style={styles.spinnerRow}><span style={styles.spinner} /> VERIFYING...</span>
                        ) : success ? <><Check size={14} style={{ display: 'inline', marginRight: 4 }} /> VERIFIED</> : '[ CONFIRM IDENTITY ]'}
                    </button>
                </form>

                {/* Resend */}
                <div style={styles.resendRow}>
                    {canResend ? (
                        <button
                            onClick={handleResend}
                            disabled={resending}
                            style={styles.resendBtn}
                        >
                            {resending ? 'Sending...' : 'Resend Code'}
                        </button>
                    ) : (
                        <span style={styles.countdown}>
                            Resend in <span style={{ color: 'var(--accent)' }}>{countdown}s</span>
                        </span>
                    )}
                </div>

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
        maxWidth: '440px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
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
        background: 'var(--gradient-accent)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '2px',
        marginBottom: '0.5rem',
    },
    tagline: {
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
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
        background: 'rgba(124,110,250,0.06)',
        border: '1px solid var(--accent-border)',
        marginBottom: '1rem',
        boxShadow: 'var(--shadow-accent)',
    },
    icon: { fontSize: '1.75rem', color: 'var(--accent)' },
    title: {
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.5rem',
        fontWeight: 700,
        color: 'var(--accent)',
        margin: '0 0 0.75rem',
        letterSpacing: '4px',
        textShadow: '0 0 20px var(--accent-glow)',
    },
    subtitle: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        lineHeight: 1.6,
        margin: 0,
    },
    otpRow: {
        display: 'flex',
        gap: '0.6rem',
        justifyContent: 'center',
        marginBottom: '1.75rem',
    },
    otpInput: {
        width: '52px',
        height: '60px',
        textAlign: 'center',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        fontFamily: "'Syne', sans-serif",
        fontSize: '1.4rem',
        fontWeight: 700,
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s, color 0.2s',
        caretColor: 'var(--accent)',
    },
    field: { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' },
    label: {
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.65rem',
        color: 'var(--accent)',
        letterSpacing: '2px',
    },
    input: {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        color: 'var(--text-primary)',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.9rem',
        outline: 'none',
        boxSizing: 'border-box',
    },
    submitBtn: {
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
        transition: 'opacity 0.2s',
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
    resendRow: {
        textAlign: 'center',
        marginTop: '1.25rem',
    },
    resendBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--accent)',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.82rem',
        cursor: 'pointer',
        textDecoration: 'underline',
        padding: 0,
    },
    countdown: {
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
        marginBottom: '1.25rem',
        fontFamily: "'Fira Code', monospace",
    },
    successBox: {
        background: 'rgba(52,211,153,0.08)',
        border: '1px solid rgba(52,211,153,0.3)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
        marginBottom: '1.25rem',
        fontFamily: "'Fira Code', monospace",
    },
    footer: { textAlign: 'center', marginTop: '1.5rem' },
    backLink: {
        color: 'var(--text-muted)',
        textDecoration: 'none',
        fontFamily: "'Fira Code', monospace",
        fontSize: '0.78rem',
        transition: 'color 0.2s',
    },
    scanline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--gradient-accent)',
        opacity: 0.6,
    },
};

export default VerifyEmail;