import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Loader } from 'lucide-react';
import '../App.css';

interface FeedbackFormProps {
    gameId: string;
    betaTesterId: string;
    onSuccess?: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ gameId, betaTesterId, onSuccess }) => {
    const { user } = useAuth();
    const [form, setForm] = useState({ rating: 3, bugDescription: '', suggestions: '', overallExperience: '', tags: [] as string[], tagInput: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Backend model ke mutabiq fields map karo
            const comment = [
                form.overallExperience && `Overall: ${form.overallExperience}`,
                form.suggestions && `Suggestions: ${form.suggestions}`,
                form.tags.length > 0 && `Tags: ${form.tags.join(', ')}`,
            ].filter(Boolean).join(' | ') || 'No comment';

            const bugReports = form.bugDescription.trim()
                ? [{
                    title: 'Bug Report',
                    description: form.bugDescription,
                    severity: 'Medium',
                    status: 'Open'
                }]
                : [];

            // api service use karo — auth header automatically lagega
            await api.post('/feedback', {
                gameId,
                gamerId: betaTesterId || user?.id,  // betaTesterId → gamerId
                rating: form.rating,
                comment,
                bugReports,
            });

            setMessage('success:Feedback submitted!');
            onSuccess?.();
        } catch {
            setMessage('error:Submission failed. Please try again.');
        }
        setLoading(false);
        setTimeout(() => setMessage(''), 3000);
    };

    const addTag = () => {
        if (form.tagInput.trim() && !form.tags.includes(form.tagInput.trim())) {
            setForm({ ...form, tags: [...form.tags, form.tagInput.trim()], tagInput: '' });
        }
    };

    return (
        <div className="card">
            <div className="ai-badge" style={{ marginBottom: '1rem' }}>Feedback Form</div>
            <h3 style={{ marginBottom: '1.5rem' }}>Submit Beta Feedback</h3>

            {message && <div className={message.startsWith('success:') ? 'success-banner' : 'error-banner'}>{message.replace(/^(success|error):/, '')}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Rating: {form.rating}/5</label>
                    <input type="range" min={1} max={5} value={form.rating}
                        onChange={e => setForm({ ...form, rating: +e.target.value })}
                        style={{ width: '100%', accentColor: 'var(--neon-cyan)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                        <span>1 — Unplayable</span><span style={{ color: 'var(--neon-cyan)' }}>{form.rating}</span><span>5 — Perfect</span>
                    </div>
                </div>

                <div className="form-group">
                    <label>Bug / Issue Description</label>
                    <textarea className="form-control" rows={3} placeholder="Describe any bugs or issues you found..."
                        value={form.bugDescription} onChange={e => setForm({ ...form, bugDescription: e.target.value })} />
                </div>

                <div className="form-group">
                    <label>Suggestions</label>
                    <textarea className="form-control" rows={3} placeholder="What could be improved?"
                        value={form.suggestions} onChange={e => setForm({ ...form, suggestions: e.target.value })} />
                </div>

                <div className="form-group">
                    <label>Overall Experience</label>
                    <textarea className="form-control" rows={2} placeholder="Summarize your experience..."
                        value={form.overallExperience} onChange={e => setForm({ ...form, overallExperience: e.target.value })} />
                </div>

                <div className="form-group">
                    <label>Tags</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input className="form-control" value={form.tagInput} onChange={e => setForm({ ...form, tagInput: e.target.value })}
                            placeholder="Add tag..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                        <button type="button" className="btn-gradient" style={{ padding: '0 1rem', whiteSpace: 'nowrap' }} onClick={addTag}>+</button>
                    </div>
                    <div className="tag-container">
                        {form.tags.map(tag => (
                            <span key={tag} className="tag">
                                {tag}
                                <span style={{ cursor: 'pointer', color: 'var(--neon-pink)', marginLeft: '4px' }} onClick={() => setForm({ ...form, tags: form.tags.filter(t => t !== tag) })}>×</span>
                            </span>
                        ))}
                    </div>
                </div>

                <button type="submit" className="btn-gradient" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                    {loading ? <><Loader size={13} style={{ display: 'inline', marginRight: 4 }} />Submitting...</> : 'Submit Feedback'}
                </button>
            </form>
        </div>
    );
};

export default FeedbackForm;