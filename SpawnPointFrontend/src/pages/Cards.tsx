import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    CreditCard, Lock, CheckCircle, XCircle, Clock, Loader2, Plus, Upload,
    Download, Sparkles, ShieldCheck, RotateCcw, Code2, Camera, Briefcase,
} from 'lucide-react';
import { api } from '../api';
import '../App.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type CardType = 'Gaming' | 'Developer';

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
    id: string; cardType: CardType; status: string;
    priceUsd: number; amountPkr: number; txnRefNo: string;
    jazzCashResponseMessage?: string; paidAt?: string;
    details?: CardDetails; detailsSubmittedAt?: string;
    adminNote?: string; frontImageUrl?: string; backImageUrl?: string;
    deliveredAt?: string; createdAt: string;
}

// LemonSqueezy checkout only needs a URL to redirect to — no hidden form fields.
interface CheckoutResponse { orderId: string; checkoutUrl: string; }

const CARD_TYPES: { type: CardType; title: string; tagline: string; sample: string }[] = [
    { type: 'Gaming', title: 'Gamer ID Card', tagline: 'Your rank, K/D, stats and gamer flex — custom designed.', sample: '/gaming-card-sample.png' },
    { type: 'Developer', title: 'Developer ID Card', tagline: 'Your stack, proficiency and dev stats — custom designed.', sample: '/developer-card-sample.png' },
];

const statusMeta: Record<string, { label: string; color: string }> = {
    AwaitingPayment: { label: 'Awaiting Payment', color: 'var(--warning)' },
    PaymentFailed: { label: 'Payment Failed', color: 'var(--danger)' },
    AwaitingDetails: { label: 'Payment Received — Add Details', color: 'var(--accent)' },
    Submitted: { label: 'Submitted — In Queue', color: 'var(--accent)' },
    InProgress: { label: 'Being Designed', color: 'var(--purple, #8B5CF6)' },
    Completed: { label: 'Delivered', color: 'var(--success)' },
    Rejected: { label: 'Rejected', color: 'var(--danger)' },
};

// ─── Redirect to LemonSqueezy hosted checkout ─────────────────────────────────
// LemonSqueezy checkout is a plain hosted URL — just navigate the browser there.
// (No hidden-form POST needed like the old JazzCash flow required.)

const redirectToCheckout = (checkoutUrl: string) => {
    window.location.href = checkoutUrl;
};

// ─── Small reusable list editors ──────────────────────────────────────────────

const TagListEditor: React.FC<{
    label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; max?: number;
}> = ({ label, placeholder, values, onChange, max = 30 }) => {
    const [draft, setDraft] = useState('');
    const add = () => {
        const v = draft.trim();
        if (!v || values.includes(v) || values.length >= max) return;
        onChange([...values, v]);
        setDraft('');
    };
    return (
        <div className="form-group">
            <label>{label}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-control" placeholder={placeholder} value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
                <button type="button" className="btn-outline" onClick={add} style={{ padding: '0 0.9rem' }}><Plus size={14} /></button>
            </div>
            {values.length > 0 && (
                <div className="tag-container" style={{ marginTop: '0.5rem' }}>
                    {values.map((v, i) => (
                        <span key={i} className="tag skill-tag">
                            {v}
                            <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const KeyValueListEditor: React.FC<{
    label: string; keyPlaceholder: string; valuePlaceholder: string;
    values: CardKeyValue[]; onChange: (v: CardKeyValue[]) => void; max?: number;
}> = ({ label, keyPlaceholder, valuePlaceholder, values, onChange, max = 20 }) => {
    const [k, setK] = useState(''); const [v, setV] = useState('');
    const add = () => {
        if (!k.trim() || !v.trim() || values.length >= max) return;
        onChange([...values, { key: k.trim(), value: v.trim() }]);
        setK(''); setV('');
    };
    return (
        <div className="form-group">
            <label>{label}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-control" placeholder={keyPlaceholder} value={k} onChange={e => setK(e.target.value)} style={{ flex: 1 }} />
                <input className="form-control" placeholder={valuePlaceholder} value={v} onChange={e => setV(e.target.value)} style={{ flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
                <button type="button" className="btn-outline" onClick={add} style={{ padding: '0 0.9rem' }}><Plus size={14} /></button>
            </div>
            {values.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {values.map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.7rem', fontSize: '0.8rem', fontFamily: 'JetBrains Mono' }}>
                            <span><span style={{ color: 'var(--accent)' }}>{row.key}</span> — {row.value}</span>
                            <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatListEditor: React.FC<{ values: CardStat[]; onChange: (v: CardStat[]) => void; max?: number }> = ({ values, onChange, max = 12 }) => {
    const [label, setLabel] = useState(''); const [percent, setPercent] = useState(80);
    const add = () => {
        if (!label.trim() || values.length >= max) return;
        onChange([...values, { label: label.trim(), percent: Math.max(0, Math.min(100, percent)) }]);
        setLabel(''); setPercent(80);
    };
    return (
        <div className="form-group">
            <label>Proficiency Stats <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(skill bars, e.g. "Debugging — 93%")</span></label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-control" placeholder="Skill label" value={label} onChange={e => setLabel(e.target.value)} style={{ flex: 1 }} />
                <input className="form-control" type="number" min={0} max={100} value={percent} onChange={e => setPercent(Number(e.target.value))} style={{ width: 90 }} />
                <button type="button" className="btn-outline" onClick={add} style={{ padding: '0 0.9rem' }}><Plus size={14} /></button>
            </div>
            {values.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
                    {values.map((s, i) => (
                        <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', marginBottom: '0.25rem' }}>
                                <span>{s.label}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {s.percent}%
                                    <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
                                </span>
                            </div>
                            <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${s.percent}%` }} /></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Details form ──────────────────────────────────────────────────────────

const emptyDetails = (): CardDetails => ({
    fullName: '', roleTitle: '', specialization: '', location: '', age: '', motto: '',
    profilePicture: '', skills: [], proficiencyStats: [], quickStats: [], experience: [],
    achievements: [], tools: [], personalInfo: [], githubHandle: '', instagramHandle: '',
    linkedInHandle: '', twitterHandle: '', additionalNotes: '',
});

const CardDetailsForm: React.FC<{
    order: CardOrder; onSubmitted: (order: CardOrder) => void; onMsg: (m: string, ok: boolean) => void;
}> = ({ order, onSubmitted, onMsg }) => {
    const [form, setForm] = useState<CardDetails>(emptyDetails());
    const [saving, setSaving] = useState(false);

    const set = <K extends keyof CardDetails>(key: K, value: CardDetails[K]) => setForm(f => ({ ...f, [key]: value }));

    const handlePicture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { onMsg('Image must be under 2MB.', false); return; }
        const reader = new FileReader();
        reader.onload = () => set('profilePicture', reader.result as string);
        reader.readAsDataURL(file);
    };

    const submit = async () => {
        if (!form.fullName.trim() || !form.roleTitle.trim()) {
            onMsg('Full name and role/title are required.', false);
            return;
        }
        setSaving(true);
        try {
            const res = await api.post<{ message: string; order: CardOrder }>(`/cards/${order.id}/details`, form);
            onMsg(res.message, true);
            onSubmitted(res.order);
        } catch (e: any) {
            onMsg(e.message || 'Failed to submit card details.', false);
        }
        setSaving(false);
    };

    return (
        <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Tell us what goes on your {order.cardType} card</h3>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div style={{ flex: '1 1 240px' }}>
                    <div className="form-group">
                        <label>Full Name *</label>
                        <input className="form-control" value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Ali Hyder" />
                    </div>
                    <div className="form-group">
                        <label>Role / Title *</label>
                        <input className="form-control" value={form.roleTitle} onChange={e => set('roleTitle', e.target.value)}
                            placeholder={order.cardType === 'Gaming' ? 'GAMER | GAME DEVELOPER' : 'SOFTWARE DEVELOPER'} />
                    </div>
                    <div className="form-group">
                        <label>Specialization <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
                        <input className="form-control" value={form.specialization} onChange={e => set('specialization', e.target.value)} placeholder="Full Stack Developer" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Location</label>
                            <input className="form-control" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Pakistan" />
                        </div>
                        <div className="form-group" style={{ width: 100 }}>
                            <label>Age</label>
                            <input className="form-control" value={form.age} onChange={e => set('age', e.target.value)} placeholder="XX" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Motto</label>
                        <input className="form-control" value={form.motto} onChange={e => set('motto', e.target.value)} placeholder="Code. Play. Dominate." />
                    </div>
                </div>

                <div style={{ flex: '0 0 180px', textAlign: 'center' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Photo / Avatar</label>
                    <label className="avatar avatar-xl" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                        cursor: 'pointer', overflow: 'hidden', background: 'var(--bg-input)', border: '1px dashed var(--border)',
                    }}>
                        {form.profilePicture
                            ? <img src={form.profilePicture} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <Upload size={22} style={{ color: 'var(--text-dim)' }} />}
                        <input type="file" accept="image/*" onChange={handlePicture} style={{ display: 'none' }} />
                    </label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Max 2MB</span>
                </div>
            </div>

            <div className="divider" />

            <TagListEditor label="Skills" placeholder="C# / .NET Core" values={form.skills} onChange={v => set('skills', v)} />
            <StatListEditor values={form.proficiencyStats} onChange={v => set('proficiencyStats', v)} />
            <KeyValueListEditor label={order.cardType === 'Gaming' ? 'Gaming Stats' : 'Developer Stats'}
                keyPlaceholder={order.cardType === 'Gaming' ? 'K/D Ratio' : 'Code Commit Rate'}
                valuePlaceholder={order.cardType === 'Gaming' ? '2.45' : '1420+'}
                values={form.quickStats} onChange={v => set('quickStats', v)} />
            <KeyValueListEditor label="Experience" keyPlaceholder="4+ Years" valuePlaceholder="Backend Development"
                values={form.experience} onChange={v => set('experience', v)} />
            <TagListEditor label="Achievements" placeholder="Top Performer in Dev Team" values={form.achievements} onChange={v => set('achievements', v)} />
            <TagListEditor label="Tools & Technologies" placeholder="Docker" values={form.tools} onChange={v => set('tools', v)} />
            <KeyValueListEditor label="Personal Info" keyPlaceholder="Blood Type" valuePlaceholder="O+"
                values={form.personalInfo} onChange={v => set('personalInfo', v)} />

            <div className="divider" />

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                    <label><Code2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />GitHub</label>
                    <input className="form-control" value={form.githubHandle} onChange={e => set('githubHandle', e.target.value)} placeholder="@yourhandle" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                    <label><Camera size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Instagram</label>
                    <input className="form-control" value={form.instagramHandle} onChange={e => set('instagramHandle', e.target.value)} placeholder="@yourhandle" />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                    <label><Briefcase size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />LinkedIn</label>
                    <input className="form-control" value={form.linkedInHandle} onChange={e => set('linkedInHandle', e.target.value)} placeholder="Your Name" />
                </div>
            </div>

            <div className="form-group">
                <label>Anything else our designer should know?</label>
                <textarea className="form-control" rows={3} value={form.additionalNotes} onChange={e => set('additionalNotes', e.target.value)} placeholder="Color preference, layout notes, etc." />
            </div>

            <button className="btn-gradient" onClick={submit} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? <Loader2 size={15} className="spin" /> : <CheckCircle size={15} />}
                {saving ? 'Submitting...' : 'Submit My Card Details'}
            </button>
        </div>
    );
};

// ─── Delivered card view ──────────────────────────────────────────────────────

const DeliveredCard: React.FC<{ order: CardOrder }> = ({ order }) => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        {[{ src: order.frontImageUrl, label: 'Front' }, { src: order.backImageUrl, label: 'Back' }]
            .filter(c => c.src)
            .map(c => (
                <div key={c.label} style={{ flex: '1 1 260px' }}>
                    <img src={c.src} alt={c.label} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
                    <a href={c.src} download={`${order.cardType}-card-${c.label.toLowerCase()}.png`}
                        className="btn-outline" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', display: 'flex' }}>
                        <Download size={14} /> Download {c.label}
                    </a>
                </div>
            ))}
    </div>
);

// ─── Per-card-type block ──────────────────────────────────────────────────────

const CardTypeBlock: React.FC<{
    info: typeof CARD_TYPES[number]; order: CardOrder | null; pricing: { priceUsd: number; priceInPkr?: number } | null;
    onChanged: () => void; onMsg: (m: string, ok: boolean) => void; onPreview: (src: string) => void;
}> = ({ info, order, pricing, onChanged, onMsg, onPreview }) => {
    const [busy, setBusy] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const startCheckout = async () => {
        setBusy(true);
        try {
            const res = await api.post<CheckoutResponse>('/cards/checkout', { cardType: info.type });
            redirectToCheckout(res.checkoutUrl);
        } catch (e: any) {
            onMsg(e.message || 'Could not start checkout.', false);
            setBusy(false);
        }
    };

    const meta = order ? statusMeta[order.status] : null;

    return (
        <div className="card">
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <img src={info.sample} alt={info.title} onClick={() => onPreview(info.sample)}
                    style={{ width: 260, maxWidth: '100%', borderRadius: 10, border: '1px solid var(--border)', cursor: 'zoom-in', objectFit: 'cover' }} />

                <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ margin: 0 }}>{info.title}</h3>
                        <span className="badge">FREE PREVIEW</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 0.75rem' }}>{info.tagline}</p>

                    {order && meta && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                            <span className="status-dot" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: meta.color }}>{meta.label}</span>
                        </div>
                    )}

                    {/* ─── No order yet, or rejected → can (re)purchase ─── */}
                    {(!order || order.status === 'Rejected') && (
                        <>
                            {order?.status === 'Rejected' && order.adminNote && (
                                <div className="error-banner" style={{ marginBottom: '0.75rem' }}><XCircle size={14} /> {order.adminNote}</div>
                            )}
                            <button className="btn-gradient" onClick={startCheckout} disabled={busy}>
                                {busy ? <Loader2 size={15} className="spin" /> : <Lock size={15} />}
                                {busy ? 'Redirecting to checkout...' : `Get My Card — $${pricing?.priceUsd ?? 20}${pricing?.priceInPkr ? ` (Rs. ${pricing.priceInPkr.toLocaleString()})` : ''}`}
                            </button>
                        </>
                    )}

                    {/* ─── Payment pending / failed ─── */}
                    {order && (order.status === 'AwaitingPayment' || order.status === 'PaymentFailed') && (
                        <>
                            {order.status === 'PaymentFailed' && (
                                <div className="error-banner" style={{ marginBottom: '0.75rem' }}>
                                    <XCircle size={14} /> {order.jazzCashResponseMessage || 'Payment was not completed.'}
                                </div>
                            )}
                            <button className="btn-gradient" onClick={startCheckout} disabled={busy}>
                                {busy ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />}
                                {busy ? 'Redirecting to checkout...' : 'Complete Payment'}
                            </button>
                        </>
                    )}

                    {/* ─── Paid, needs details ─── */}
                    {order && order.status === 'AwaitingDetails' && (
                        <>
                            <div className="success-banner" style={{ marginBottom: '0.75rem' }}>
                                <ShieldCheck size={14} /> Payment received! Add your card details below.
                            </div>
                            {!showForm && (
                                <button className="btn-gradient" onClick={() => setShowForm(true)}>
                                    <Sparkles size={15} /> Fill In My Card Details
                                </button>
                            )}
                            {showForm && <CardDetailsForm order={order} onMsg={onMsg} onSubmitted={() => { setShowForm(false); onChanged(); }} />}
                        </>
                    )}

                    {/* ─── Submitted / in progress ─── */}
                    {order && (order.status === 'Submitted' || order.status === 'InProgress') && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={14} style={{ color: 'var(--text-dim)' }} />
                                {order.status === 'Submitted'
                                    ? 'Your details are in the queue — our team will start designing soon.'
                                    : 'Our team is currently designing your card.'}
                            </span>
                            {order.adminNote && (
                                <span style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', fontFamily: 'JetBrains Mono', fontSize: '0.78rem' }}>
                                    Note from admin: {order.adminNote}
                                </span>
                            )}
                        </div>
                    )}

                    {/* ─── Completed ─── */}
                    {order && order.status === 'Completed' && (
                        <div>
                            <div className="success-banner" style={{ marginBottom: '0.5rem' }}>
                                <CheckCircle size={14} /> Your card is ready!
                            </div>
                            {order.adminNote && (
                                <span style={{ display: 'block', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                                    Note from admin: {order.adminNote}
                                </span>
                            )}
                            <DeliveredCard order={order} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main page ──────────────────────────────────────────────────────────────

const Cards: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [orders, setOrders] = useState<CardOrder[]>([]);
    const [pricing, setPricing] = useState<{ priceUsd: number; priceInPkr?: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const showMsg = useCallback((text: string, ok: boolean) => {
        setMsg({ text, ok });
        setTimeout(() => setMsg(null), 5000);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [o, p] = await Promise.all([
                api.get<CardOrder[]>('/cards/my'),
                api.get<{ priceUsd: number; priceInPkr?: number }>('/cards/pricing'),
            ]);
            setOrders(o || []);
            setPricing(p);
        } catch (e: any) { showMsg(e.message || 'Failed to load card data.', false); }
        setLoading(false);
    }, [showMsg]);

    useEffect(() => { load(); }, [load]);

    // Handle redirect back from the payment-result hop
    useEffect(() => {
        const state = location.state as { paymentStatus?: string; orderId?: string; reason?: string } | null;
        if (state?.paymentStatus) {
            if (state.paymentStatus === 'success') showMsg('Payment successful! You can now add your card details.', true);
            else if (state.paymentStatus === 'failed') showMsg('Payment failed or was cancelled. You can retry below.', false);
            else showMsg('Something went wrong confirming your payment. Please contact support if money was deducted.', false);
            navigate(location.pathname, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const orderFor = (type: CardType) => orders.find(o => o.cardType === type && o.status !== 'Rejected') || orders.find(o => o.cardType === type) || null;

    return (
        <div className="container page-container">
            {preview && (
                <div className="modal-overlay" onClick={() => setPreview(null)} style={{ cursor: 'zoom-out' }}>
                    <img src={preview} alt="preview" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
                </div>
            )}

            <div className="page-header">
                <div className="page-eyebrow"><CreditCard size={13} /> Identity Cards</div>
                <h1>Build Your Gamer or Developer Card</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Browse the sample designs for free. When you're ready, pay once and our team hand-crafts your personal card.
                </p>
            </div>

            {msg && <div className={msg.ok ? 'success-banner' : 'error-banner'} style={{ marginBottom: '1.25rem' }}>
                {msg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />} {msg.text}
            </div>}

            {loading ? <div className="spinner" style={{ margin: '3rem auto' }} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {CARD_TYPES.map(info => (
                        <CardTypeBlock key={info.type} info={info} order={orderFor(info.type)} pricing={pricing}
                            onChanged={load} onMsg={showMsg} onPreview={setPreview} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Cards;