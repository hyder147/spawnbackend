// ══════════════════════════════════════════════════════════════════════════════
// COMPLETE AdminPanel.tsx — replace the entire file
// New tabs: "Reports" and "Recovery" added
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import '../App.css';
import { MessageCircle, Gamepad2, Upload } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlatformStats {
    totalUsers: number; totalDevelopers: number; totalGamers: number;
    totalGames: number; totalPosts: number; totalCommunities: number;
    totalSquads: number; suspendedUsers: number; bannedUsers: number;
    unverifiedUsers: number;
}
interface AdminUser {
    id: string; username: string; email: string; userType: string;
    role: string; isEmailVerified: boolean; isSuspended: boolean;
    suspendReason?: string; suspendedUntil?: string; isBanned: boolean;
    banReason?: string; adminNotes?: string; createdAt: string;
}
interface AdminPost {
    id: string; userId: string; authorUsername: string; content: string;
    likedByUserIds: string[]; comments: any[]; createdAt: string;
}
interface AdminGame {
    id: string; title: string; developerName: string; genre: string;
    status: string; createdAt: string; betaTesters?: any[];
}
interface AdminLog {
    id: string; adminUsername: string; action: string; targetType: string;
    targetId: string; reason?: string; details?: string; createdAt: string;
}
interface Community { id: string; name: string; type: string; createdAt: string; memberIds: string[]; }
interface Report {
    id: string; reporterId: string; reporterUsername: string;
    targetType: string; targetId: string; targetName?: string;
    reason: string; status: string; adminNote?: string;
    reviewedByAdminId?: string; reviewedAt?: string; createdAt: string;
}
interface DeletedUserRecord {
    id: string; originalUserId: string; username: string; email: string;
    userType: string; role: string; deletedAt: string; recoveryDeadline: string;
    deletedByAdminUsername: string; deleteReason?: string;
    isRecovered: boolean; recoveredAt?: string;
    canRecover: boolean; daysLeft: number;
}
interface CardKeyValue { key: string; value: string; }
interface CardStat { label: string; percent: number; }
interface CardDetails {
    fullName: string; roleTitle: string; specialization?: string;
    location?: string; age?: string; motto?: string; profilePicture?: string;
    skills: string[]; proficiencyStats: CardStat[]; quickStats: CardKeyValue[];
    experience: CardKeyValue[]; achievements: string[]; tools: string[];
    personalInfo: CardKeyValue[]; githubHandle?: string; instagramHandle?: string;
    linkedInHandle?: string; twitterHandle?: string; additionalNotes?: string;
}
interface CardOrder {
    id: string; userId: string; username: string; email: string;
    cardType: 'Gaming' | 'Developer'; status: string;
    priceUsd: number; amountPkr: number; txnRefNo: string;
    jazzCashResponseCode?: string; jazzCashResponseMessage?: string; paidAt?: string;
    details?: CardDetails; detailsSubmittedAt?: string;
    adminNote?: string; frontImageUrl?: string; backImageUrl?: string;
    deliveredAt?: string; handledByAdminUsername?: string; createdAt: string;
}

type Tab = 'dashboard' | 'users' | 'posts' | 'games' | 'communities' | 'reports' | 'recovery' | 'logs' | 'cards';

// ─── Colour helpers ───────────────────────────────────────────────────────────
const roleColor: Record<string, string> = {
    admin: 'var(--danger)', moderator: 'var(--warning)', user: 'var(--accent)',
};
const statusColor = (u: AdminUser) => {
    if (u.isBanned) return 'var(--danger)';
    if (u.isSuspended) return 'var(--warning)';
    if (!u.isEmailVerified) return 'var(--text-dim)';
    return 'var(--success)';
};
const statusLabel = (u: AdminUser) => {
    if (u.isBanned) return 'BANNED';
    if (u.isSuspended) return 'SUSPENDED';
    if (!u.isEmailVerified) return 'UNVERIFIED';
    return 'ACTIVE';
};
const reportStatusColor: Record<string, string> = {
    pending: 'var(--warning)',
    reviewed: 'var(--accent)',
    dismissed: 'var(--text-dim)',
    actioned: 'var(--success)',
};
const cardStatusColor: Record<string, string> = {
    AwaitingPayment: 'var(--text-dim)',
    PaymentFailed: 'var(--danger)',
    AwaitingDetails: 'var(--warning)',
    Submitted: 'var(--warning)',
    InProgress: 'var(--purple, #7C5CFC)',
    Completed: 'var(--success)',
    Rejected: 'var(--danger)',
};
const actionColor: Record<string, string> = {
    ban: 'var(--danger)', unban: 'var(--success)',
    suspend: 'var(--warning)', unsuspend: 'var(--success)',
    delete_user: 'var(--danger)', delete_post: 'var(--caution)',
    delete_game: 'var(--caution)', role_change: 'var(--accent)',
    delete_community: 'var(--caution)', force_verify_email: 'var(--accent)',
    review_report: 'var(--accent)', recover_user: 'var(--success)',
    card_status_update: 'var(--accent)', card_delivered: 'var(--success)',
    card_payment_override: 'var(--warning)', card_order_deleted: 'var(--danger)',
};

const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
};

// ─── Small shared components ──────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
    <span style={{
        fontSize: '0.65rem', fontFamily: 'JetBrains Mono', letterSpacing: '1px',
        padding: '0.2rem 0.55rem', borderRadius: 4,
        border: `1px solid ${color}`, color,
        background: `${color}18`, whiteSpace: 'nowrap',
    }}>{label}</span>
);

const Btn: React.FC<{
    label: string; color: string; onClick: () => void; disabled?: boolean; small?: boolean;
}> = ({ label, color, onClick, disabled, small }) => (
    <button onClick={onClick} disabled={disabled} style={{
        background: disabled ? 'rgba(255,255,255,0.04)' : `${color}18`,
        border: `1px solid ${disabled ? 'var(--border)' : color}`,
        color: disabled ? 'var(--text-dim)' : color,
        borderRadius: 6, padding: small ? '0.25rem 0.6rem' : '0.35rem 0.75rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.72rem', fontFamily: 'JetBrains Mono',
        transition: 'all 0.2s', whiteSpace: 'nowrap',
    }}>{label}</button>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className="form-control" style={{ fontSize: '0.85rem', ...(props.style || {}) }} />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} style={{
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', borderRadius: 6,
        padding: '0.5rem 0.75rem', fontSize: '0.85rem',
        fontFamily: 'JetBrains Mono', cursor: 'pointer', ...(props.style || {}),
    }} />
);

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal: React.FC<{
    title: string; onClose: () => void; children: React.ReactNode;
}> = ({ title, onClose, children }) => (
    <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)', padding: '1rem',
    }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="responsive-modal-card" style={{
            background: 'var(--bg-dark)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '1.75rem', minWidth: 'min(340px, 100%)', maxWidth: 480, width: '100%',
            boxShadow: '0 0 60px rgba(0,245,255,0.08)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent)', margin: '0 0 0.5rem' }}>{title}</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
            </div>
            {children}
        </div>
    </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; ok: boolean; onClose: () => void }> = ({ msg, ok, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
    return (
        <div style={{
            position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 99999,
            background: 'var(--bg-dark)', border: `1px solid ${ok ? 'var(--success)' : 'var(--danger)'}`,
            color: ok ? 'var(--success)' : 'var(--danger)',
            borderRadius: 8, padding: '0.75rem 1.25rem', fontFamily: 'JetBrains Mono',
            fontSize: '0.82rem', maxWidth: 360, boxShadow: '0 0 30px rgba(0,0,0,0.5)',
        }}>
            {ok ? '✓' : '✗'} {msg}
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: number; color: string; icon: string }> = ({ label, value, color, icon }) => (
    <div className="stat-card" style={{ cursor: 'default' }}>
        <div style={{ fontSize: '1.4rem', marginBottom: '0.6rem', color }}>{icon}</div>
        <div style={{
            fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 900,
            background: `linear-gradient(135deg,${color},${color}88)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>{value.toLocaleString()}</div>
        <div className="stat-label">{label}</div>
    </div>
);

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination: React.FC<{ page: number; totalPages: number; onChange: (p: number) => void }> = ({ page, totalPages, onChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '1.25rem' }}>
            <Btn label="«" color="var(--accent)" onClick={() => onChange(1)} disabled={page === 1} small />
            <Btn label="‹" color="var(--accent)" onClick={() => onChange(page - 1)} disabled={page === 1} small />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.3rem 0.75rem', alignSelf: 'center' }}>
                {page} / {totalPages}
            </span>
            <Btn label="›" color="var(--accent)" onClick={() => onChange(page + 1)} disabled={page === totalPages} small />
            <Btn label="»" color="var(--accent)" onClick={() => onChange(totalPages)} disabled={page === totalPages} small />
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ════════════════════════════════════════════════════════════════════════════
const DashboardTab: React.FC<{ stats: PlatformStats | null; loading: boolean }> = ({ stats, loading }) => {
    if (loading) return <div className="spinner" style={{ margin: '3rem auto' }} />;
    if (!stats) return <p style={{ color: 'var(--danger)', textAlign: 'center', marginTop: '2rem' }}>Failed to load stats.</p>;
    return (
        <>
            <div className="grid" style={{ marginBottom: '1.5rem' }}>
                <StatCard label="Total Users" value={stats.totalUsers} color="var(--accent)" icon="◈" />
                <StatCard label="Developers" value={stats.totalDevelopers} color="var(--accent)" icon="⟨/⟩" />
                <StatCard label="Gamers" value={stats.totalGamers} color="var(--success)" icon="◆" />
                <StatCard label="Games" value={stats.totalGames} color="var(--warning)" icon="▲" />
            </div>
            <div className="grid" style={{ marginBottom: '1.5rem' }}>
                <StatCard label="Posts" value={stats.totalPosts} color="var(--accent)" icon="◉" />
                <StatCard label="Communities" value={stats.totalCommunities} color="var(--accent)" icon="◎" />
                <StatCard label="Squads" value={stats.totalSquads} color="var(--success)" icon="◇" />
                <StatCard label="Suspended" value={stats.suspendedUsers} color="var(--warning)" icon="⏸" />
            </div>
            <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="card">
                    <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>Account Status Breakdown</h3>
                    {[
                        { label: 'Active Users', val: stats.totalUsers - stats.suspendedUsers - stats.bannedUsers - stats.unverifiedUsers, color: 'var(--success)' },
                        { label: 'Unverified', val: stats.unverifiedUsers, color: 'var(--text-dim)' },
                        { label: 'Suspended', val: stats.suspendedUsers, color: 'var(--warning)' },
                        { label: 'Banned', val: stats.bannedUsers, color: 'var(--danger)' },
                    ].map(row => (
                        <div key={row.label} style={{ marginBottom: '0.7rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                <span style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono', color: row.color }}>{row.label}</span>
                                <span style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono', color: row.color }}>{Math.max(0, row.val)}</span>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, height: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 4, width: `${stats.totalUsers > 0 ? (Math.max(0, row.val) / stats.totalUsers * 100) : 0}%`, background: `linear-gradient(90deg,${row.color},${row.color}88)`, transition: 'width 1s ease' }} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="card">
                    <h3 style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: 1 }}>Platform Summary</h3>
                    {[
                        { k: 'Developer / Gamer ratio', v: stats.totalDevelopers && stats.totalGamers ? `${stats.totalDevelopers}:${stats.totalGamers}` : 'N/A' },
                        { k: 'Avg posts per user', v: stats.totalUsers > 0 ? (stats.totalPosts / stats.totalUsers).toFixed(1) : '0' },
                        { k: 'Community count', v: stats.totalCommunities },
                        { k: 'Banned accounts', v: stats.bannedUsers },
                    ].map(row => (
                        <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{row.k}</span>
                            <span style={{ fontSize: '0.82rem', fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>{row.v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// USER DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════
const UserDrawer: React.FC<{
    user: AdminUser; onClose: () => void;
    onAction: (action: string, userId: string, extra?: any) => void;
}> = ({ user, onClose, onAction }) => {
    const [notes, setNotes] = useState(user.adminNotes || '');
    const [suspendHours, setSuspendHours] = useState('');
    const [suspendReason, setSuspendReason] = useState('');
    const [banReason, setBanReason] = useState('');
    const [roleVal, setRoleVal] = useState(user.role);

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 8888, display: 'flex', justifyContent: 'flex-end',
            backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div className="admin-detail-drawer" onClick={e => e.stopPropagation()} style={{
                width: 420, height: '100vh', overflowY: 'auto',
                background: 'var(--bg-dark)', borderLeft: '1px solid var(--border)',
                padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)', marginBottom: '0.3rem' }}>@{user.username}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>{user.email}</div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            <Badge label={user.userType.toUpperCase()} color="var(--accent)" />
                            <Badge label={roleColor[user.role] ? user.role.toUpperCase() : 'USER'} color={roleColor[user.role] || 'var(--accent)'} />
                            <Badge label={statusLabel(user)} color={statusColor(user)} />
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>

                <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Account Info</div>
                    {[
                        { k: 'User ID', v: user.id },
                        { k: 'Joined', v: new Date(user.createdAt).toLocaleDateString() },
                        { k: 'Email Verified', v: user.isEmailVerified ? 'Yes' : 'No' },
                        ...(user.suspendReason ? [{ k: 'Suspend Reason', v: user.suspendReason }] : []),
                        ...(user.suspendedUntil ? [{ k: 'Suspended Until', v: new Date(user.suspendedUntil).toLocaleString() }] : []),
                        ...(user.banReason ? [{ k: 'Ban Reason', v: user.banReason }] : []),
                    ].map(row => (
                        <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{row.k}</span>
                            <span style={{ fontSize: '0.78rem', fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{row.v}</span>
                        </div>
                    ))}
                </div>

                <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Role Change</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Select value={roleVal} onChange={e => setRoleVal(e.target.value)} style={{ flex: 1 }}>
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                        </Select>
                        <Btn label="Apply" color="var(--accent)" onClick={() => onAction('role', user.id, { role: roleVal })} />
                    </div>
                </div>

                {!user.isSuspended && !user.isBanned && (
                    <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Suspend Account</div>
                        <Input placeholder="Reason (optional)" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} style={{ marginBottom: '0.5rem', width: '100%' }} />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Input placeholder="Hours (empty = permanent)" type="number" min="1" value={suspendHours} onChange={e => setSuspendHours(e.target.value)} style={{ flex: 1 }} />
                            <Btn label="Suspend" color="var(--warning)" onClick={() => onAction('suspend', user.id, { reason: suspendReason, durationHours: suspendHours ? parseFloat(suspendHours) : null })} />
                        </div>
                    </div>
                )}
                {user.isSuspended && <Btn label="⟳ Unsuspend" color="var(--success)" onClick={() => onAction('unsuspend', user.id)} />}

                {!user.isBanned && (
                    <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--danger)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Permanent Ban</div>
                        <Input placeholder="Ban reason" value={banReason} onChange={e => setBanReason(e.target.value)} style={{ marginBottom: '0.5rem', width: '100%' }} />
                        <Btn label="Ban User" color="var(--danger)" onClick={() => onAction('ban', user.id, { reason: banReason })} />
                    </div>
                )}
                {user.isBanned && <Btn label="⟳ Unban" color="var(--success)" onClick={() => onAction('unban', user.id)} />}

                {!user.isEmailVerified && <Btn label="✓ Force Verify Email" color="var(--accent)" onClick={() => onAction('verify', user.id)} />}

                <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>Admin Notes</div>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes (not visible to the user)..." rows={3}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontFamily: 'Inter,sans-serif', resize: 'vertical', outline: 'none', marginBottom: '0.5rem' }} />
                    <Btn label="Save Notes" color="var(--accent)" onClick={() => onAction('notes', user.id, { notes })} />
                </div>

                <div style={{ borderTop: '1px solid var(--danger)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontFamily: 'JetBrains Mono' }}>
                        ⚠ Danger Zone — a 30-day recovery window will be provided
                    </div>
                    <Btn label="Delete User (recoverable 30d)" color="var(--danger)" onClick={() => onAction('delete', user.id)} />
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// USERS TAB
// ════════════════════════════════════════════════════════════════════════════
const UsersTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [userType, setUserType] = useState('');
    const [status, setStatus] = useState('');
    const [selected, setSelected] = useState<AdminUser | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ msg: string; onConfirm: () => void } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '15', ...(search ? { search } : {}), ...(userType ? { userType } : {}), ...(status ? { status } : {}) });
            const res = await api.get<any>(`/admin/users?${params}`);
            setUsers(res.users || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, search, userType, status, onToast]);

    useEffect(() => { load(); }, [load]);

    const handleAction = async (action: string, userId: string, extra?: any) => {
        const u = users.find(u => u.id === userId) || selected;
        const doAction = async () => {
            try {
                let msg = '';
                if (action === 'suspend') { await api.post(`/admin/users/${userId}/suspend`, extra); msg = `@${u?.username} suspended`; }
                else if (action === 'unsuspend') { await api.post(`/admin/users/${userId}/unsuspend`, {}); msg = `@${u?.username} unsuspended`; }
                else if (action === 'ban') { await api.post(`/admin/users/${userId}/ban`, extra); msg = `@${u?.username} permanently banned`; }
                else if (action === 'unban') { await api.post(`/admin/users/${userId}/unban`, {}); msg = `@${u?.username} unbanned`; }
                else if (action === 'delete') {
                    await api.delete(`/admin/users/${userId}/permanent`);
                    msg = `User deleted — recoverable within 30 days`;
                    setSelected(null);
                }
                else if (action === 'role') { await api.post(`/admin/users/${userId}/role`, extra); msg = `Role updated successfully`; }
                else if (action === 'notes') { await api.put(`/admin/users/${userId}/notes`, extra); msg = 'Notes saved'; }
                else if (action === 'verify') { await api.post(`/admin/users/${userId}/verify-email`, {}); msg = 'Email verified'; }
                onToast(msg, true);
                load();
            } catch (e: any) { onToast(e.message, false); }
        };

        if (action === 'delete' || action === 'ban') {
            setConfirmModal({
                msg: action === 'delete'
                    ? `@${u?.username}'s account will be deleted. It can be restored from the Recovery tab within 30 days. Confirm?`
                    : `Are you sure you want to permanently ban @${u?.username}?`,
                onConfirm: () => { setConfirmModal(null); doAction(); },
            });
        } else { doAction(); }
    };

    return (
        <>
            {confirmModal && (
                <Modal title="Confirm Action" onClose={() => setConfirmModal(null)}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>{confirmModal.msg}</p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <Btn label="Cancel" color="var(--text-dim)" onClick={() => setConfirmModal(null)} />
                        <Btn label="Confirm" color="var(--danger)" onClick={confirmModal.onConfirm} />
                    </div>
                </Modal>
            )}
            {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} onAction={handleAction} />}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <Input placeholder="Search username or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 180 }} />
                <Select value={userType} onChange={e => { setUserType(e.target.value); setPage(1); }}>
                    <option value="">All Types</option>
                    <option value="Developer">Developer</option>
                    <option value="Gamer">Gamer</option>
                </Select>
                <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                    <option value="unverified">Unverified</option>
                </Select>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>{total} users</span>
            </div>
            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {users.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'JetBrains Mono' }}>No users found.</p>}
                        {users.map(u => (
                            <div key={u.id} className="kanban-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem 1rem' }} onClick={() => setSelected(u)}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${statusColor(u)}22`, border: `1px solid ${statusColor(u)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: statusColor(u) }}>
                                    {u.username[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.88rem', color: 'var(--text-primary)' }}>@{u.username}</span>
                                        <Badge label={u.userType} color="var(--accent)" />
                                        <Badge label={statusLabel(u)} color={statusColor(u)} />
                                        {u.role !== 'user' && <Badge label={u.role.toUpperCase()} color={roleColor[u.role]} />}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>{u.email}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    {!u.isSuspended && !u.isBanned && <Btn label="Suspend" color="var(--warning)" small onClick={() => handleAction('suspend', u.id, { reason: 'Admin action', durationHours: null })} />}
                                    {u.isSuspended && <Btn label="Unsuspend" color="var(--success)" small onClick={() => handleAction('unsuspend', u.id)} />}
                                    {!u.isBanned && <Btn label="Ban" color="var(--danger)" small onClick={() => handleAction('ban', u.id, { reason: 'Admin action' })} />}
                                    {u.isBanned && <Btn label="Unban" color="var(--success)" small onClick={() => handleAction('unban', u.id)} />}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// POSTS TAB
// ════════════════════════════════════════════════════════════════════════════
const PostsTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '15', ...(search ? { search } : {}) });
            const res = await api.get<any>(`/admin/posts?${params}`);
            setPosts(res.posts || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, search, onToast]);

    useEffect(() => { load(); }, [load]);

    const deletePost = async (id: string) => {
        try {
            await api.delete(`/admin/posts/${id}`);
            onToast('Post deleted', true);
            setDeleteTarget(null);
            load();
        } catch (e: any) { onToast(e.message, false); }
    };

    return (
        <>
            {deleteTarget && (
                <Modal title="Delete Post" onClose={() => setDeleteTarget(null)}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>This post will be permanently deleted. Confirm?</p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <Btn label="Cancel" color="var(--text-dim)" onClick={() => setDeleteTarget(null)} />
                        <Btn label="Delete" color="var(--danger)" onClick={() => deletePost(deleteTarget)} />
                    </div>
                </Modal>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <Input placeholder="Search content..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1 }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>{total} posts</span>
            </div>
            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {posts.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'JetBrains Mono' }}>No posts found.</p>}
                        {posts.map(p => (
                            <div key={p.id} className="kanban-item" style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>@{p.authorUsername || p.userId}</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>{timeAgo(p.createdAt)}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>{p.content.length > 160 ? p.content.slice(0, 160) + '...' : p.content}</p>
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>{p.likedByUserIds?.length || 0} likes</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}><MessageCircle size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{p.comments?.length || 0}</span>
                                        </div>
                                    </div>
                                    <Btn label="Delete" color="var(--danger)" small onClick={() => setDeleteTarget(p.id)} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// GAMES TAB
// ════════════════════════════════════════════════════════════════════════════
const GamesTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [games, setGames] = useState<AdminGame[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>(`/admin/games?page=${page}&limit=15`);
            setGames(res.games || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, onToast]);

    useEffect(() => { load(); }, [load]);

    const setStatus = async (id: string, status: string) => {
        try { await api.put(`/admin/games/${id}/status`, { status }); onToast(`Game status set to '${status}'`, true); load(); }
        catch (e: any) { onToast(e.message, false); }
    };
    const deleteGame = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete the game '${title}'?`)) return;
        try { await api.delete(`/admin/games/${id}`); onToast('Game deleted', true); load(); }
        catch (e: any) { onToast(e.message, false); }
    };

    const gameStatusColor: Record<string, string> = { Alpha: 'var(--warning)', Beta: 'var(--accent)', Released: 'var(--success)', Suspended: 'var(--danger)' };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>{total} games</span>
            </div>
            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {games.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'JetBrains Mono' }}>No games found.</p>}
                        {games.map(g => (
                            <div key={g.id} className="kanban-item" style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{g.title}</span>
                                            <Badge label={g.status} color={gameStatusColor[g.status] || 'var(--text-dim)'} />
                                            <Badge label={g.genre} color="var(--accent)" />
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>By {g.developerName} · {timeAgo(g.createdAt)} · {g.betaTesters?.length || 0} testers</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                        {g.status !== 'Suspended' && <Btn label="Suspend" color="var(--warning)" small onClick={() => setStatus(g.id, 'Suspended')} />}
                                        {g.status === 'Suspended' && <Btn label="Restore" color="var(--success)" small onClick={() => setStatus(g.id, 'Alpha')} />}
                                        <Btn label="Delete" color="var(--danger)" small onClick={() => deleteGame(g.id, g.title)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// COMMUNITIES TAB
// ════════════════════════════════════════════════════════════════════════════
const CommunitiesTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>(`/admin/communities?page=${page}&limit=15`);
            setCommunities(res.communities || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, onToast]);

    useEffect(() => { load(); }, [load]);

    const deleteCommunity = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the community '${name}'?`)) return;
        try { await api.delete(`/admin/communities/${id}`); onToast('Community deleted', true); load(); }
        catch (e: any) { onToast(e.message, false); }
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{total} communities</span>
            </div>
            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {communities.map(c => (
                            <div key={c.id} className="kanban-item" style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{c.name}</span>
                                            <Badge label={c.type} color="var(--accent)" />
                                        </div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>{c.memberIds?.length || 0} members · {timeAgo(c.createdAt)}</div>
                                    </div>
                                    <Btn label="Delete" color="var(--danger)" small onClick={() => deleteCommunity(c.id, c.name)} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// 🆕 REPORTS TAB — User/Community reports
// ════════════════════════════════════════════════════════════════════════════
const ReportsTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [total, setTotal] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [typeFilter, setTypeFilter] = useState('');
    const [reviewModal, setReviewModal] = useState<Report | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [reviewStatus, setReviewStatus] = useState('reviewed');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '20', ...(statusFilter ? { status: statusFilter } : {}), ...(typeFilter ? { targetType: typeFilter } : {}) });
            const res = await api.get<any>(`/admin/reports?${params}`);
            setReports(res.reports || []);
            setTotal(res.total || 0);
            setPendingCount(res.pendingCount || 0);
            setTotalPages(Math.ceil((res.total || 0) / 20));
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, statusFilter, typeFilter, onToast]);

    useEffect(() => { load(); }, [load]);

    const submitReview = async () => {
        if (!reviewModal) return;
        try {
            await api.put(`/admin/reports/${reviewModal.id}/status`, { status: reviewStatus, adminNote: reviewNote });
            onToast(`Report marked as "${reviewStatus}"`, true);
            setReviewModal(null);
            setReviewNote('');
            load();
        } catch (e: any) { onToast(e.message, false); }
    };

    const deleteReport = async (id: string) => {
        try { await api.delete(`/admin/reports/${id}`); onToast('Report deleted', true); load(); }
        catch (e: any) { onToast(e.message, false); }
    };

    const targetTypeColor: Record<string, string> = { user: 'var(--accent)', community: 'var(--accent)', post: 'var(--warning)' };

    return (
        <>
            {reviewModal && (
                <Modal title={`Review Report — ${reviewModal.targetType} @${reviewModal.targetName || reviewModal.targetId}`} onClose={() => setReviewModal(null)}>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', marginBottom: '0.4rem' }}>Reporter: @{reviewModal.reporterUsername}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.75rem', borderRadius: 6, fontFamily: 'JetBrains Mono', marginBottom: '1rem' }}>
                            "{reviewModal.reason}"
                        </div>
                        <Select value={reviewStatus} onChange={e => setReviewStatus(e.target.value)} style={{ width: '100%', marginBottom: '0.75rem' }}>
                            <option value="reviewed">Reviewed (seen, no action taken)</option>
                            <option value="actioned">Actioned (action is being taken)</option>
                            <option value="dismissed">Dismissed (fake/invalid report)</option>
                        </Select>
                        <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Admin note (optional)..." rows={3}
                            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontFamily: 'Inter,sans-serif', resize: 'vertical', outline: 'none', marginBottom: '0.5rem' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <Btn label="Cancel" color="var(--text-dim)" onClick={() => setReviewModal(null)} />
                        <Btn label="Submit Review" color="var(--accent)" onClick={submitReview} />
                    </div>
                </Modal>
            )}

            {/* Header + filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="actioned">Actioned</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="">All Reports</option>
                </Select>
                <Select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
                    <option value="">All Types</option>
                    <option value="user">User Reports</option>
                    <option value="community">Community Reports</option>
                    <option value="post">Post Reports</option>
                </Select>
                {pendingCount > 0 && (
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--warning)', background: 'rgba(255,210,0,0.1)', border: '1px solid var(--warning)', borderRadius: 20, padding: '0.2rem 0.6rem' }}>
                        ⚠ {pendingCount} pending
                    </span>
                )}
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{total} reports</span>
            </div>

            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {reports.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'JetBrains Mono' }}>No reports found.</p>}
                        {reports.map(r => (
                            <div key={r.id} className="kanban-item" style={{ padding: '0.85rem 1rem', borderLeft: `3px solid ${reportStatusColor[r.status] || 'var(--border)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                            <Badge label={r.targetType.toUpperCase()} color={targetTypeColor[r.targetType] || 'var(--text-dim)'} />
                                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                                {r.targetName ? `@${r.targetName}` : r.targetId.slice(-10)}
                                            </span>
                                            <Badge label={r.status.toUpperCase()} color={reportStatusColor[r.status] || 'var(--text-dim)'} />
                                        </div>
                                        <p style={{ margin: '0 0 0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                            "{r.reason.length > 120 ? r.reason.slice(0, 120) + '...' : r.reason}"
                                        </p>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                                            Reported by @{r.reporterUsername} · {timeAgo(r.createdAt)}
                                            {r.adminNote && <span style={{ color: 'var(--accent)' }}> · Note: {r.adminNote}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                        {r.status === 'pending' && (
                                            <Btn label="Review" color="var(--accent)" small onClick={() => { setReviewModal(r); setReviewNote(r.adminNote || ''); }} />
                                        )}
                                        <Btn label="Delete" color="var(--danger)" small onClick={() => deleteReport(r.id)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// 🆕 RECOVERY TAB — Restore deleted accounts
// ════════════════════════════════════════════════════════════════════════════
const RecoveryTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [deletedUsers, setDeletedUsers] = useState<DeletedUserRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [recoverableOnly, setRecoverableOnly] = useState(true);
    const [recoverModal, setRecoverModal] = useState<DeletedUserRecord | null>(null);
    const [recoverReason, setRecoverReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '20', ...(recoverableOnly ? { recoverable: 'true' } : {}) });
            const res = await api.get<any>(`/admin/deleted-users?${params}`);
            setDeletedUsers(res.users || []);
            setTotal(res.total || 0);
            setTotalPages(Math.ceil((res.total || 0) / 20));
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, recoverableOnly, onToast]);

    useEffect(() => { load(); }, [load]);

    const submitRecover = async () => {
        if (!recoverModal) return;
        try {
            const res = await api.post<any>(`/admin/deleted-users/${recoverModal.id}/recover`, { reason: recoverReason });
            onToast(`@${res.username}'s account has been recovered!`, true);
            setRecoverModal(null);
            setRecoverReason('');
            load();
        } catch (e: any) { onToast(e.message, false); }
    };

    return (
        <>
            {recoverModal && (
                <Modal title={`Recover @${recoverModal.username}`} onClose={() => setRecoverModal(null)}>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontFamily: 'JetBrains Mono', fontSize: '0.78rem' }}>
                            <div style={{ color: 'var(--accent)', marginBottom: '0.3rem' }}>@{recoverModal.username}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{recoverModal.email}</div>
                            <div style={{ color: 'var(--text-dim)', marginTop: '0.3rem' }}>Deleted by: {recoverModal.deletedByAdminUsername} · {timeAgo(recoverModal.deletedAt)}</div>
                            {recoverModal.deleteReason && <div style={{ color: 'var(--warning)', marginTop: '0.2rem' }}>Reason: {recoverModal.deleteReason}</div>}
                            <div style={{ color: recoverModal.daysLeft <= 3 ? 'var(--danger)' : 'var(--success)', marginTop: '0.4rem', fontWeight: 700 }}>
                                ⏱ {recoverModal.daysLeft} days remaining
                            </div>
                        </div>
                        <Input placeholder="Recovery reason (optional)..." value={recoverReason} onChange={e => setRecoverReason(e.target.value)} style={{ width: '100%', marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', margin: 0 }}>
                            ⚠ A new account will be created for the user. Previous data (posts, friends) cannot be recovered.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <Btn label="Cancel" color="var(--text-dim)" onClick={() => setRecoverModal(null)} />
                        <Btn label="✓ Recover Account" color="var(--success)" onClick={submitRecover} />
                    </div>
                </Modal>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'JetBrains Mono', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={recoverableOnly} onChange={e => { setRecoverableOnly(e.target.checked); setPage(1); }}
                        style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                    Show only recoverable (within 30-day window)
                </label>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{total} records</span>
            </div>

            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    {deletedUsers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
                            No deleted accounts found.
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {deletedUsers.map(d => (
                            <div key={d.id} className="kanban-item" style={{ padding: '0.85rem 1rem', borderLeft: `3px solid ${d.canRecover ? (d.daysLeft <= 3 ? 'var(--warning)' : 'var(--success)') : 'var(--border)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', color: d.isRecovered ? 'var(--success)' : 'var(--text-primary)' }}>@{d.username}</span>
                                            <Badge label={d.userType} color="var(--accent)" />
                                            {d.isRecovered && <Badge label="RECOVERED" color="var(--success)" />}
                                            {!d.isRecovered && d.canRecover && (
                                                <Badge label={`${d.daysLeft}d left`} color={d.daysLeft <= 3 ? 'var(--warning)' : 'var(--accent)'} />
                                            )}
                                            {!d.isRecovered && !d.canRecover && <Badge label="EXPIRED" color="var(--text-dim)" />}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                                            {d.email} · Deleted {timeAgo(d.deletedAt)} by {d.deletedByAdminUsername}
                                            {d.deleteReason && <span> · "{d.deleteReason}"</span>}
                                        </div>
                                    </div>
                                    {d.canRecover && !d.isRecovered && (
                                        <Btn label="⟳ Recover" color="var(--success)" small onClick={() => setRecoverModal(d)} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// CARDS TAB — review paid Gaming/Developer card requests
// ════════════════════════════════════════════════════════════════════════════
const CardsTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [orders, setOrders] = useState<CardOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('Submitted');
    const [typeFilter, setTypeFilter] = useState('');

    const [detailModal, setDetailModal] = useState<CardOrder | null>(null);
    const [statusNote, setStatusNote] = useState('');

    const [deliverModal, setDeliverModal] = useState<CardOrder | null>(null);
    const [frontImg, setFrontImg] = useState('');
    const [backImg, setBackImg] = useState('');
    const [deliverNote, setDeliverNote] = useState('');
    const [delivering, setDelivering] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(), limit: '20',
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(typeFilter ? { cardType: typeFilter } : {}),
            });
            const res = await api.get<any>(`/admin/cards?${params}`);
            setOrders(res.orders || []);
            setTotal(res.total || 0);
            setPendingCount(res.pendingCount || 0);
            setTotalPages(Math.max(1, Math.ceil((res.total || 0) / 20)));
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, statusFilter, typeFilter, onToast]);

    useEffect(() => { load(); }, [load]);

    const moveToInProgress = async (o: CardOrder) => {
        try {
            await api.put(`/admin/cards/${o.id}/status`, { status: 'InProgress', adminNote: o.adminNote || undefined });
            onToast('Marked as in progress', true);
            load();
        } catch (e: any) { onToast(e.message, false); }
    };

    const submitStatus = async (status: 'InProgress' | 'Rejected') => {
        if (!detailModal) return;
        try {
            await api.put(`/admin/cards/${detailModal.id}/status`, { status, adminNote: statusNote || undefined });
            onToast(`Card request ${status === 'Rejected' ? 'rejected' : 'moved to in-progress'}.`, true);
            setDetailModal(null); setStatusNote('');
            load();
        } catch (e: any) { onToast(e.message, false); }
    };

    const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>, target: 'front' | 'back') => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { onToast('Image must be under 5MB.', false); return; }
        const reader = new FileReader();
        reader.onload = () => { target === 'front' ? setFrontImg(reader.result as string) : setBackImg(reader.result as string); };
        reader.readAsDataURL(file);
    };

    const submitDeliver = async () => {
        if (!deliverModal) return;
        if (!frontImg) { onToast('Front card image is required.', false); return; }
        setDelivering(true);
        try {
            await api.post(`/admin/cards/${deliverModal.id}/deliver`, { frontImageUrl: frontImg, backImageUrl: backImg || undefined, adminNote: deliverNote || undefined });
            onToast('Card delivered to user!', true);
            setDeliverModal(null); setFrontImg(''); setBackImg(''); setDeliverNote('');
            load();
        } catch (e: any) { onToast(e.message, false); }
        setDelivering(false);
    };

    return (
        <>
            {/* ── Review / Reject modal ── */}
            {detailModal && (
                <Modal title={`${detailModal.cardType} Card — @${detailModal.username}`} onClose={() => setDetailModal(null)}>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '1rem', fontSize: '0.82rem', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>
                        {!detailModal.details ? <p>No details submitted yet.</p> : (
                            <>
                                <p><b style={{ color: 'var(--accent)' }}>Name:</b> {detailModal.details.fullName}</p>
                                <p><b style={{ color: 'var(--accent)' }}>Role:</b> {detailModal.details.roleTitle}</p>
                                {detailModal.details.specialization && <p><b style={{ color: 'var(--accent)' }}>Specialization:</b> {detailModal.details.specialization}</p>}
                                {detailModal.details.location && <p><b style={{ color: 'var(--accent)' }}>Location:</b> {detailModal.details.location} {detailModal.details.age ? `· Age ${detailModal.details.age}` : ''}</p>}
                                {detailModal.details.motto && <p><b style={{ color: 'var(--accent)' }}>Motto:</b> "{detailModal.details.motto}"</p>}
                                {detailModal.details.profilePicture && <img src={detailModal.details.profilePicture} alt={`${detailModal.details.fullName || 'User'}'s profile picture`} style={{ width: 90, height: 90, borderRadius: 10, objectFit: 'cover', margin: '0.4rem 0' }} />}
                                {detailModal.details.skills?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Skills:</b> {detailModal.details.skills.join(', ')}</p>}
                                {detailModal.details.proficiencyStats?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Proficiency:</b> {detailModal.details.proficiencyStats.map(s => `${s.label} ${s.percent}%`).join(', ')}</p>}
                                {detailModal.details.quickStats?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Stats:</b> {detailModal.details.quickStats.map(s => `${s.key}: ${s.value}`).join(', ')}</p>}
                                {detailModal.details.experience?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Experience:</b> {detailModal.details.experience.map(s => `${s.key} — ${s.value}`).join(', ')}</p>}
                                {detailModal.details.achievements?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Achievements:</b> {detailModal.details.achievements.join(', ')}</p>}
                                {detailModal.details.tools?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Tools:</b> {detailModal.details.tools.join(', ')}</p>}
                                {detailModal.details.personalInfo?.length > 0 && <p><b style={{ color: 'var(--accent)' }}>Personal Info:</b> {detailModal.details.personalInfo.map(s => `${s.key}: ${s.value}`).join(', ')}</p>}
                                <p><b style={{ color: 'var(--accent)' }}>Socials:</b> {[detailModal.details.githubHandle && `GitHub ${detailModal.details.githubHandle}`, detailModal.details.instagramHandle && `Insta ${detailModal.details.instagramHandle}`, detailModal.details.linkedInHandle && `LinkedIn ${detailModal.details.linkedInHandle}`].filter(Boolean).join(' · ') || '—'}</p>
                                {detailModal.details.additionalNotes && <p><b style={{ color: 'var(--accent)' }}>Notes:</b> {detailModal.details.additionalNotes}</p>}
                            </>
                        )}
                    </div>
                    <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Admin note (optional, visible to user)..." rows={2}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontFamily: 'Inter,sans-serif', resize: 'vertical', outline: 'none', marginBottom: '0.75rem' }} />
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Btn label="Reject" color="var(--danger)" onClick={() => submitStatus('Rejected')} />
                        <Btn label="Mark In Progress" color="var(--accent)" onClick={() => submitStatus('InProgress')} />
                    </div>
                </Modal>
            )}

            {/* ── Deliver modal ── */}
            {deliverModal && (
                <Modal title={`Deliver Card — @${deliverModal.username}`} onClose={() => setDeliverModal(null)}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Front *</label>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 110, borderRadius: 8, border: '1px dashed var(--border)', cursor: 'pointer', overflow: 'hidden', background: 'var(--bg-input)' }}>
                                {frontImg ? <img src={frontImg} alt="ID card front side" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Upload size={18} style={{ color: 'var(--text-dim)' }} />}
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImagePick(e, 'front')} />
                            </label>
                        </div>
                        <div style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Back</label>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 110, borderRadius: 8, border: '1px dashed var(--border)', cursor: 'pointer', overflow: 'hidden', background: 'var(--bg-input)' }}>
                                {backImg ? <img src={backImg} alt="ID card back side" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Upload size={18} style={{ color: 'var(--text-dim)' }} />}
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImagePick(e, 'back')} />
                            </label>
                        </div>
                    </div>
                    <textarea value={deliverNote} onChange={e => setDeliverNote(e.target.value)} placeholder="Note to user (optional)..." rows={2}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontFamily: 'Inter,sans-serif', resize: 'vertical', outline: 'none', marginBottom: '0.75rem' }} />
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <Btn label="Cancel" color="var(--text-dim)" onClick={() => setDeliverModal(null)} />
                        <Btn label={delivering ? 'Delivering...' : 'Mark Completed & Deliver'} color="var(--success)" onClick={submitDeliver} disabled={delivering} />
                    </div>
                </Modal>
            )}

            {/* Header + filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="Submitted">Submitted</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                    <option value="AwaitingPayment">Awaiting Payment</option>
                    <option value="AwaitingDetails">Awaiting Details</option>
                    <option value="">All</option>
                </Select>
                <Select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
                    <option value="">All Types</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Developer">Developer</option>
                </Select>
                {pendingCount > 0 && (
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--warning)', background: 'rgba(255,210,0,0.1)', border: '1px solid var(--warning)', borderRadius: 20, padding: '0.2rem 0.6rem' }}>
                        ⚠ {pendingCount} awaiting review
                    </span>
                )}
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{total} requests</span>
            </div>

            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {orders.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'JetBrains Mono' }}>No card requests found.</p>}
                        {orders.map(o => (
                            <div key={o.id} className="kanban-item" style={{ padding: '0.85rem 1rem', borderLeft: `3px solid ${cardStatusColor[o.status] || 'var(--border)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                            <Badge label={o.cardType.toUpperCase()} color={o.cardType === 'Gaming' ? 'var(--accent)' : 'var(--purple, #7C5CFC)'} />
                                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', color: 'var(--text-primary)' }}>@{o.username}</span>
                                            <Badge label={o.status} color={cardStatusColor[o.status] || 'var(--text-dim)'} />
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>
                                            {o.email} · Rs. {o.amountPkr?.toLocaleString()} (${o.priceUsd}) · {o.txnRefNo}
                                        </div>
                                        {o.details?.fullName && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                                                "{o.details.fullName}" — {o.details.roleTitle}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {o.status === 'Submitted' && <Btn label="Review" color="var(--accent)" small onClick={() => setDetailModal(o)} />}
                                        {o.status === 'Submitted' && <Btn label="→ In Progress" color="var(--purple, #7C5CFC)" small onClick={() => moveToInProgress(o)} />}
                                        {(o.status === 'Submitted' || o.status === 'InProgress') && <Btn label="Deliver" color="var(--success)" small onClick={() => setDeliverModal(o)} />}
                                        {(o.status === 'Submitted' || o.status === 'InProgress') && <Btn label="View" color="var(--text-secondary)" small onClick={() => setDetailModal(o)} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};


const LogsTab: React.FC<{ onToast: (msg: string, ok: boolean) => void }> = ({ onToast }) => {
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>(`/admin/logs?page=${page}&limit=30`);
            setLogs(res.logs || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
        } catch (e: any) { onToast(e.message, false); }
        setLoading(false);
    }, [page, onToast]);

    useEffect(() => { load(); }, [load]);

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Admin Activity Audit Trail — {total} entries</span>
                <Btn label="↺ Refresh" color="var(--accent)" small onClick={load} />
            </div>
            {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {logs.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'JetBrains Mono' }}>No actions logged yet.</p>}
                        {logs.map(log => {
                            const c = actionColor[log.action] || 'var(--text-secondary)';
                            return (
                                <div key={log.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', borderLeft: `3px solid ${c}`, borderRadius: 6, padding: '0.65rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${c}` }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: c, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{log.action.replace(/_/g, ' ')}</span>
                                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'var(--text-dim)' }}>by @{log.adminUsername}</span>
                                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>{timeAgo(log.createdAt)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>
                                            {log.targetType} <span style={{ color: 'var(--accent)' }}>{log.targetId.slice(-8)}</span>
                                            {log.reason && <span style={{ color: 'var(--text-dim)' }}> — {log.reason}</span>}
                                            {log.details && <span style={{ color: 'var(--text-dim)' }}> · {log.details}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
            )}
        </>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN PANEL
// ════════════════════════════════════════════════════════════════════════════
const AdminPanel: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<any>(null);
    const [pendingReports, setPendingReports] = useState(0);
    const [pendingCards, setPendingCards] = useState(0);

    useEffect(() => {
        const stored = localStorage.getItem('spawnpoint_user');
        if (!stored) { navigate('/login'); return; }
        const u = JSON.parse(stored);
        if (u.role !== 'admin' && u.userType !== 'admin') navigate('/');
    }, [navigate]);

    useEffect(() => {
        const load = async () => {
            setStatsLoading(true);
            try {
                const res = await api.get<PlatformStats>('/admin/stats');
                setStats(res);
            } catch (e: any) { setToast({ msg: e.message, ok: false }); }
            setStatsLoading(false);
        };
        load();
        // Fetch pending reports badge count
        api.get<any>('/admin/reports?status=pending&limit=1')
            .then(res => setPendingReports(res.pendingCount || 0))
            .catch(() => { });
        // Fetch pending card-review badge count
        api.get<any>('/admin/cards?status=Submitted&limit=1')
            .then(res => setPendingCards(res.pendingCount || 0))
            .catch(() => { });
    }, []);

    const showToast = useCallback((msg: string, ok: boolean) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const doSearch = async () => {
        if (!searchQ.trim() || searchQ.length < 2) return;
        try {
            const res = await api.get<any>(`/admin/search?q=${encodeURIComponent(searchQ)}`);
            setSearchResults(res);
        } catch (e: any) { showToast(e.message, false); }
    };

    const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: '◈' },
        { id: 'users', label: 'Users', icon: '◉' },
        { id: 'posts', label: 'Posts', icon: '◎' },
        { id: 'games', label: 'Games', icon: '▲' },
        { id: 'communities', label: 'Communities', icon: '◇' },
        { id: 'reports', label: 'Reports', icon: '!', badge: pendingReports },
        { id: 'cards', label: 'ID Cards', icon: '$', badge: pendingCards },
        { id: 'recovery', label: 'Recovery', icon: '⟳' },
        { id: 'logs', label: 'Audit Logs', icon: '≡' },
    ];

    return (
        <div className="container">
            {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: 'var(--danger)', letterSpacing: '2px', textTransform: 'uppercase' }}>Admin Mode Active</span>
                </div>
                <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem', letterSpacing: '-0.5px' }}>Admin Panel</h1>
                <p style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', margin: 0 }}>
                    Logged in as @{user?.username} · Full platform access
                </p>
            </div>

            {/* Search */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Global Search</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Input placeholder="Search users, emails, or games..." value={searchQ} onChange={e => { setSearchQ(e.target.value); if (!e.target.value.trim()) setSearchResults(null); }} onKeyDown={e => e.key === 'Enter' && doSearch()} style={{ flex: 1 }} />
                    <Btn label="Search" color="var(--accent)" onClick={doSearch} />
                    {searchResults && <Btn label="Clear" color="var(--text-muted)" onClick={() => { setSearchResults(null); setSearchQ(''); }} />}
                </div>
                {searchResults && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {searchResults.users?.length > 0 && searchResults.users.map((u: any) => (
                            <div key={u.id} style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', padding: '0.4rem 0.75rem', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 6 }}>
                                <span style={{ color: 'var(--accent)' }}>@{u.username}</span> · {u.email} · <span style={{ color: statusColor(u) }}>{statusLabel(u)}</span>
                            </div>
                        ))}
                        {searchResults.games?.length > 0 && searchResults.games.map((g: any) => (
                            <div key={g.id} style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6 }}>
                                <span style={{ color: 'var(--accent)' }}><Gamepad2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{g.title}</span> · {g.developerName} · {g.status}
                            </div>
                        ))}
                        {!searchResults.users?.length && !searchResults.games?.length && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>No results found.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{tab.icon}</span> {tab.label}
                        {tab.badge && tab.badge > 0 ? (
                            <span style={{ background: 'var(--warning)', color: '#000', borderRadius: 99, fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', marginLeft: '0.15rem' }}>{tab.badge}</span>
                        ) : null}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && <DashboardTab stats={stats} loading={statsLoading} />}
            {activeTab === 'users' && <UsersTab onToast={showToast} />}
            {activeTab === 'posts' && <PostsTab onToast={showToast} />}
            {activeTab === 'games' && <GamesTab onToast={showToast} />}
            {activeTab === 'communities' && <CommunitiesTab onToast={showToast} />}
            {activeTab === 'reports' && <ReportsTab onToast={showToast} />}
            {activeTab === 'cards' && <CardsTab onToast={showToast} />}
            {activeTab === 'recovery' && <RecoveryTab onToast={showToast} />}
            {activeTab === 'logs' && <LogsTab onToast={showToast} />}
        </div>
    );
};

export default AdminPanel;