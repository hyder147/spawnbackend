import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Search, TrendingUp, Bug, Users, Star, Send, X, CheckCircle2, Sparkles, Loader } from 'lucide-react';
import { api } from '../api';

/* ─────────────────────────────────────────────────────────────────────────
   SCOUT MODE
   The pivot: verified in-app activity (bugs caught, squads led, feedback
   quality) becomes a public, ranked talent profile that studios can browse
   and directly recruit from — no resume, no interview gatekeeping.
   Data is served live from GET /api/scout/talent (see ScoutController.cs).
   ───────────────────────────────────────────────────────────────────────── */

interface ScoutProfile
{
    id: string;
    username: string;
    roleTrack: 'QA' | 'Community' | 'Design' | 'Production';
    bugsCaught: number;
    accuracy: number;      // % of reports that were valid / non-duplicate
    squadsLed: number;
    signalScore: number;   // 0-100 composite ranking, computed server-side
    topBadge: string;
    blurb: string;
    available: boolean;
}

const roleMeta: Record < ScoutProfile['roleTrack'], { color: string; label: string }> = {
QA: { color: 'var(--cyan, #22E5E5)', label: 'QA / Bug Hunting' },
    Community: { color: 'var(--purple)', label: 'Community Mgmt' },
    Design: { color: 'var(--accent)', label: 'Game Design' },
    Production: { color: 'var(--warning)', label: 'Production' },
}
;

const ScoutMode: React.FC = () => {
    const [profiles, setProfiles] = useState<ScoutProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState < string | null > (null);
    const [filter, setFilter] = useState < 'All' | ScoutProfile['roleTrack'] > ('All');
    const [query, setQuery] = useState('');
    const [offerTarget, setOfferTarget] = useState < ScoutProfile | null > (null);
    const [offerNote, setOfferNote] = useState('');
    const [sending, setSending] = useState(false);
    const [offerSent, setOfferSent] = useState < string | null > (null);

    const loadTalent = async () => {
        setLoading(true);
        setError(null);
        try
        {
            const params = new URLSearchParams();
            if (filter !== 'All') params.set('role', filter);
            if (query.trim()) params.set('search', query.trim());
            const data = await api.get<ScoutProfile[]>(`/ scout / talent ?${params.toString()}`);
            setProfiles(data);
        }
        catch (e)
        {
            setError(e instanceof Error ? e.message : 'Failed to load Scout Mode talent.');
        }
        finally
        {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(loadTalent, 250); // debounce search/filter changes
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, query]);

    const filtered = useMemo(() => [...profiles].sort((a, b) => b.signalScore - a.signalScore), [profiles]);

    const sendOffer = async(p: ScoutProfile) => {
        setSending(true);
        try
        {
            await api.post(`/ scout / offer /${ p.id}`, { note: offerNote || undefined });
            setOfferTarget(null);
            setOfferNote('');
            setOfferSent(p.username);
            setTimeout(() => setOfferSent(null), 3500);
        }
        catch (e)
        {
            setError(e instanceof Error ? e.message : 'Failed to send offer.');
        }
        finally
        {
            setSending(false);
        }
    }
    ;

    return (
        < div style ={ { maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' } }>
            {/* Hero */}
            < div style ={
        {
        borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '2rem',
                background: 'var(--gradient-hero)', border: '1px solid var(--border-accent)', position: 'relative', overflow: 'hidden'
            }
    }>
                < div style ={ { display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontFamily: 'JetBrains Mono', fontSize: '0.75rem', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '0.6rem' } }>
                    < Sparkles size ={ 14} /> New · Career Pipeline
                </ div >
                < h1 style ={ { fontFamily: 'Orbitron, monospace', fontSize: '1.8rem', margin: '0 0 0.6rem' } }> Scout Mode </ h1 >
                < p style ={ { color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.6, margin: 0 } }>
                    Every bug you've caught, every squad you've led, every piece of feedback you've written — it's already a verified track record.
                    Studios browse ranked talent here and recruit directly. No resume. No cold applications.
                </ p >
            </ div >

            {/* Filters */}
            < div style ={ { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' } }>
                < div style ={ { position: 'relative', flex: '1 1 220px' } }>
                    < Search size ={ 14}
    style ={ { position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' } } />
                    < input
                        value ={ query}
    onChange ={ e => setQuery(e.target.value)}
    placeholder = "Search testers..."
                        style ={
        {
        width: '100%', padding: '0.6rem 0.8rem 0.6rem 2.1rem', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.85rem'
                        }
    }
                    />
                </ div >
                {
        (['All', 'QA', 'Community', 'Design', 'Production'] as const).map(f => (
                    < button
                        key ={ f}
        onClick ={ () => setFilter(f)}
        style ={
            {
            padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 600,
                            border: `1px solid ${ filter === f ? 'var(--accent-border)' : 'var(--border)'}`,
                            background: filter === f ? 'var(--accent-soft)' : 'transparent',
                            color: filter === f ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer'
                        }
        }
                    >
                        { f === 'All' ? 'All Roles' : roleMeta[f].label}
                    </ button >
                ))}
            </ div >

            {/* Loading / error states */}
    {
        loading && (

        < div style ={ { display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '2rem 0', justifyContent: 'center' } }>

            < Loader size ={ 16}
        className = "spin" /> Loading talent board...
                </ div >
            )}
    {
        !loading && error && (

        < div style ={ { color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem', fontSize: '0.85rem' } }>
                    { error}
                </ div >
            )}

    {/* Talent grid */}
    {
        !loading && (

    < div style ={ { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' } }>
                {
            filtered.map(p => {
            const meta = roleMeta[p.roleTrack];
            return (

                < div key ={ p.id}
            style ={
                {
                background: 'var(--gradient-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                            padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: 'var(--shadow-card)'
                        }
            }>
                            < div style ={ { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }>
                                < div >
                                    < div style ={ { fontFamily: 'Orbitron, monospace', fontSize: '1rem' } }>@{ p.username}</ div >
                                    < div style ={ { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: meta.color, marginTop: '0.3rem', fontFamily: 'JetBrains Mono' } }>
                                        < span style ={ { width: 6, height: 6, borderRadius: '50%', background: meta.color, display: 'inline-block' } } />
                                        { meta.label}
                                    </ div >
                                </ div >
                                < div style ={ { textAlign: 'right' } }>
                                    < div style ={ { fontFamily: 'Orbitron, monospace', fontSize: '1.3rem', color: 'var(--accent)' } }>{ p.signalScore}</ div >
                                    < div style ={ { fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' } }> Signal Score </ div >
                                </ div >
                            </ div >

                            < p style ={ { fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 } }>{ p.blurb}</ p >

                            < div style ={ { display: 'flex', gap: '0.9rem', fontSize: '0.75rem', color: 'var(--text-secondary)' } }>
                                < span style ={ { display: 'flex', alignItems: 'center', gap: '0.3rem' } }>< Bug size ={ 12} /> { p.bugsCaught}</ span >
                                < span style ={ { display: 'flex', alignItems: 'center', gap: '0.3rem' } }>< TrendingUp size ={ 12} /> { p.accuracy}%</ span >
                                < span style ={ { display: 'flex', alignItems: 'center', gap: '0.3rem' } }>< Users size ={ 12} /> { p.squadsLed}
            squads </ span >
                            </ div >

                            < div style ={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' } }>
                                < span style ={
                {
                fontSize: '0.68rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-full)',
                                    background: 'var(--warning-soft)', color: 'var(--warning)', fontFamily: 'JetBrains Mono'
                                }
            }>
                                    < Star size ={ 10}
            style ={ { verticalAlign: '-1px', marginRight: '0.25rem' } } />{ p.topBadge}
                                </ span >
                                {
                p.available ? (
                                    < button onClick ={ () => setOfferTarget(p)}
                className = "btn-gradient" style ={ { fontSize: '0.72rem', padding: '0.45rem 0.85rem', gap: '0.35rem' } }>
                                        < Send size ={ 12} /> Send Offer
                                    </ button >
                                ) : (
                                    < span style ={ { fontSize: '0.7rem', color: 'var(--text-muted)' } }> Not open to offers </ span >
                                )}
                            </ div >
                        </ div >
                    );
    })}
                {
    filtered.length === 0 && (
                    < div style ={ { gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' } }> No testers match that search.</ div >
                )}
            </ div >
            )}

            {/* Offer modal */}
{
    offerTarget && (

    < div style ={
        {
        position: 'fixed', inset: 0, background: 'rgba(6,7,14,0.75)', backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
                }
    }
    onClick ={ () => { setOfferTarget(null); setOfferNote(''); }}>
                    < div onClick ={ e => e.stopPropagation()}
    style ={
        {
        background: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-lg)',
                        padding: '1.5rem', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-accent)'
                    }
    }>
                        < div style ={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' } }>
                            < h3 style ={ { margin: 0, fontFamily: 'Orbitron, monospace', fontSize: '1rem' } }>
                                < Briefcase size ={ 16}
    style ={ { verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' } } />
                                Offer @{ offerTarget.username}
                            </ h3 >
                            < button onClick ={ () => { setOfferTarget(null); setOfferNote(''); }}
    style ={ { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' } }>< X size ={ 18} /></ button >
                        </ div >
                        < p style ={ { fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 } }>
                            This sends a direct interview/ internship offer using their verified { roleMeta[offerTarget.roleTrack].label}
    track record — signal score { offerTarget.signalScore}/ 100.
                        </ p >
                        < textarea
                            value ={ offerNote}
    onChange ={ e => setOfferNote(e.target.value)}
    placeholder = "Add a short note (optional)..."
                            rows ={ 3}
    style ={
        {
        width: '100%', marginTop: '0.5rem', padding: '0.6rem', borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.82rem', resize: 'vertical'
                            }
    }
                        />
                        < button disabled ={ sending}
    onClick ={ () => sendOffer(offerTarget)}
    className = "btn-gradient" style ={ { width: '100%', marginTop: '1rem', justifyContent: 'center', gap: '0.4rem', opacity: sending ? 0.7 : 1 } }>
                            { sending ? < Loader size ={ 14} className = "spin" /> : < Send size ={ 14} />}
    { sending ? 'Sending...' : 'Send Offer'}
                        </ button >
                    </ div >
                </ div >
            )}

{/* Toast */}
{
    offerSent && (

    < div style ={
        {
        position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'var(--bg-panel)',
                    border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.1rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-lg)', zIndex: 200
                }
    }>
                    < CheckCircle2 size ={ 16}
    color = "var(--success)" />
                    < span style ={ { fontSize: '0.82rem' } }> Offer sent to @{ offerSent}</ span >
                </ div >
            )}
        </ div >
    );
};

export default ScoutMode;