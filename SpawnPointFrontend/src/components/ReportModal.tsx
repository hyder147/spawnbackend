// ══════════════════════════════════════════════════════════════════════════════
// FILE: src/components/ReportModal.tsx  (NAYA FILE BANAO)
// Ye reusable component hai — Feed, Communities, UserProfile har jagah use karo
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { api } from '../api';

interface ReportModalProps {
    targetType: 'user' | 'community' | 'post';
    targetId: string;
    targetName?: string;          // @username ya community name (display ke liye)
    onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ targetType, targetId, targetName, onClose }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const QUICK_REASONS = [
        'Harassment ya bullying',
        'Spam ya fake account',
        'Inappropriate / offensive content',
        'Hate speech',
        'Violence ya threats',
        'Cheating ya scam',
        'Copyright violation',
    ];

    const submit = async () => {
        if (reason.trim().length < 10) {
            setError('Reason kam se kam 10 characters ka hona chahiye.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await api.post('/reports', {
                targetType,
                targetId,
                reason: reason.trim(),
            });
            setDone(true);
        } catch (e: any) {
            setError(e.message || 'Report submit nahi ho payi. Dobara try karo.');
        }
        setLoading(false);
    };

    const targetLabel = targetName
        ? (targetType === 'user' ? `@${targetName}` : targetName)
        : targetType;

    return (
        // Backdrop
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', padding: '1rem',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-dark)',
                border: '1px solid var(--border-dim)',
                borderRadius: 12,
                padding: '1.75rem',
                width: '100%',
                maxWidth: 440,
                boxShadow: '0 0 60px rgba(0,0,0,0.6)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                        <h3 style={{ fontFamily: 'Orbitron, monospace', fontSize: '1rem', color: 'var(--neon-pink)', margin: 0 }}>
                            ⚑ Report
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', margin: '0.3rem 0 0' }}>
                            {targetLabel} · {targetType}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                </div>

                {/* Success state */}
                {done ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
                        <p style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.9rem', color: 'var(--neon-green)', marginBottom: '0.5rem' }}>Report Submit Ho Gayi!</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Admin review karega aur zaroorat parne par action lega.
                        </p>
                        <button onClick={onClose} style={{
                            marginTop: '1.25rem', background: 'rgba(0,245,255,0.1)',
                            border: '1px solid var(--neon-cyan)', color: 'var(--neon-cyan)',
                            borderRadius: 8, padding: '0.5rem 1.5rem', cursor: 'pointer',
                            fontFamily: 'JetBrains Mono', fontSize: '0.82rem',
                        }}>Close</button>
                    </div>
                ) : (
                    <>
                        {/* Quick reason chips */}
                        <div style={{ marginBottom: '0.85rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                                Quick select (ya apna likho):
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {QUICK_REASONS.map(r => (
                                    <button key={r} onClick={() => setReason(r)} style={{
                                        background: reason === r ? 'rgba(255,0,110,0.15)' : 'rgba(0,0,0,0.3)',
                                        border: `1px solid ${reason === r ? 'var(--neon-pink)' : 'var(--border-dim)'}`,
                                        color: reason === r ? 'var(--neon-pink)' : 'var(--text-secondary)',
                                        borderRadius: 20, padding: '0.25rem 0.65rem',
                                        cursor: 'pointer', fontSize: '0.72rem',
                                        fontFamily: 'JetBrains Mono', transition: 'all 0.15s',
                                    }}>{r}</button>
                                ))}
                            </div>
                        </div>

                        {/* Text area */}
                        <textarea
                            value={reason}
                            onChange={e => { setReason(e.target.value); setError(''); }}
                            placeholder="Zyada detail likho — kya hua, kab hua... (min 10 chars)"
                            rows={4}
                            style={{
                                width: '100%', background: 'var(--bg-input)',
                                border: `1px solid ${error ? 'var(--neon-pink)' : 'var(--border-dim)'}`,
                                color: 'var(--text-primary)', borderRadius: 8,
                                padding: '0.65rem 0.85rem', fontSize: '0.85rem',
                                fontFamily: 'Inter, sans-serif', resize: 'vertical',
                                outline: 'none', boxSizing: 'border-box',
                                lineHeight: 1.5,
                            }}
                        />

                        {/* Error */}
                        {error && (
                            <p style={{ color: 'var(--neon-pink)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', margin: '0.4rem 0 0' }}>
                                ✗ {error}
                            </p>
                        )}

                        {/* Char count */}
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', margin: '0.3rem 0 1rem', textAlign: 'right' }}>
                            {reason.length} chars {reason.length < 10 ? `(${10 - reason.length} aur chahiye)` : '✓'}
                        </p>

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button onClick={onClose} style={{
                                background: 'transparent', border: '1px solid var(--border-dim)',
                                color: 'var(--text-secondary)', borderRadius: 8,
                                padding: '0.5rem 1rem', cursor: 'pointer',
                                fontFamily: 'JetBrains Mono', fontSize: '0.82rem',
                            }}>Cancel</button>
                            <button onClick={submit} disabled={loading || reason.trim().length < 10} style={{
                                background: loading ? 'rgba(255,0,110,0.1)' : 'rgba(255,0,110,0.15)',
                                border: '1px solid var(--neon-pink)', color: 'var(--neon-pink)',
                                borderRadius: 8, padding: '0.5rem 1.25rem',
                                cursor: loading || reason.trim().length < 10 ? 'not-allowed' : 'pointer',
                                fontFamily: 'JetBrains Mono', fontSize: '0.82rem',
                                opacity: reason.trim().length < 10 ? 0.5 : 1,
                                transition: 'all 0.2s',
                            }}>
                                {loading ? '⏳ Submitting...' : '⚑ Submit Report'}
                            </button>
                        </div>

                        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', marginTop: '0.85rem', lineHeight: 1.5 }}>
                            ℹ Reports confidential hoti hain. False reports ki report bhi ho sakti hai.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReportModal;


// ══════════════════════════════════════════════════════════════════════════════
// REPORT BUTTON — Ye chhota component use karo kisi bhi page mein
// ══════════════════════════════════════════════════════════════════════════════

export const ReportButton: React.FC<{
    targetType: 'user' | 'community' | 'post';
    targetId: string;
    targetName?: string;
    style?: React.CSSProperties;
}> = ({ targetType, targetId, targetName, style }) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                title={`Report this ${targetType}`}
                style={{
                    background: 'transparent',
                    border: '1px solid var(--border-dim)',
                    color: 'var(--text-dim)',
                    borderRadius: 6,
                    padding: '0.3rem 0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontFamily: 'JetBrains Mono',
                    transition: 'all 0.2s',
                    ...(style || {}),
                }}
                onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.borderColor = 'var(--neon-pink)';
                    (e.target as HTMLButtonElement).style.color = 'var(--neon-pink)';
                }}
                onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.borderColor = 'var(--border-dim)';
                    (e.target as HTMLButtonElement).style.color = 'var(--text-dim)';
                }}
            >
                ⚑ Report
            </button>
            {open && (
                <ReportModal
                    targetType={targetType}
                    targetId={targetId}
                    targetName={targetName}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
};