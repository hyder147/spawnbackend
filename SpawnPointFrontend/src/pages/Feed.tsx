import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Heart, MessageCircle, Share2, Trash2, Send } from 'lucide-react';
import '../App.css';

interface Comment { id: string; userId: string; content: string; createdAt: string; }
interface Post { id: string; userId: string; authorUsername: string; communityId?: string; content: string; mediaUrl?: string; likedByUserIds: string[]; comments: Comment[]; sharedByUserIds: string[]; createdAt: string; }

const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
};

const Feed: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id ?? 'guest';

    const [posts, setPosts] = useState<Post[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const loadFeed = async () => {
        setLoading(true);
        try { setPosts(await api.get<Post[]>(`/posts/feed/${userId}`)); } catch { setPosts([]); }
        setLoading(false);
    };

    useEffect(() => { loadFeed(); }, [userId]);

    const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

    const createPost = async () => {
        if (!newPostContent.trim()) return;
        try {
            const created = await api.post<Post>('/posts', { userId, content: newPostContent });
            setPosts(prev => [created, ...prev]);
            setNewPostContent('');
            showMsg('success:Post published!');
        } catch (e: any) { showMsg(`error:${e.message || 'Failed to publish'}`); }
    };

    const toggleLike = async (post: Post) => {
        const isLiked = post.likedByUserIds.includes(userId);
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likedByUserIds: isLiked ? p.likedByUserIds.filter(id => id !== userId) : [...p.likedByUserIds, userId] } : p));
        try { if (isLiked) await api.delete(`/posts/${post.id}/unlike/${userId}`); else await api.post(`/posts/${post.id}/like/${userId}`); } catch { }
    };

    const addComment = async (postId: string) => {
        const content = commentInputs[postId]?.trim();
        if (!content) return;
        const newComment: Comment = { id: Date.now().toString(), userId: user?.username ?? userId, content, createdAt: new Date().toISOString() };
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        try { await api.post(`/posts/${postId}/comment`, { userId, content }); } catch { }
    };

    const deletePost = async (postId: string) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
        try { await api.delete(`/posts/${postId}`); } catch { }
    };

    return (
        <div className="container" style={{ maxWidth: 700 }}>
            {/* Header */}
            <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: -1, left: 0, width: 80, height: 1, background: 'var(--gradient-accent)' }} />
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
                    Community
                </div>
                <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Feed</h1>
            </div>

            {/* Compose */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div className="avatar" style={{ background: 'var(--gradient-accent)', color: '#fff', flexShrink: 0 }}>{(user?.username ?? 'Y')[0].toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                        <textarea className="form-control" placeholder="What's shipping today?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} rows={3} style={{ resize: 'none', marginBottom: '0.75rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>{newPostContent.length} chars</span>
                            <button className="btn-gradient" onClick={createPost} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                <Send size={14} /> Publish
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {message && <div className={message.startsWith('success:') ? 'success-banner' : 'error-banner'} style={{ marginBottom: '1rem' }}>{message.replace(/^(success|error):/, '')}</div>}
            {loading && <div className="spinner" />}

            {!loading && posts.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.88rem' }}>No posts yet. Be the first to share something!</p>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {posts.map(post => {
                    const isLiked = post.likedByUserIds.includes(userId);
                    const isMyPost = post.userId === userId;
                    const showComments = expandedComments[post.id];
                    const postAuthor = post.authorUsername || post.userId;

                    return (
                        <div key={post.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                            {/* Accent left bar */}
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--gradient-accent)' }} />
                            <div style={{ paddingLeft: '0.75rem' }}>
                                {/* Author row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.85rem', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <div className="avatar" style={{ background: 'var(--gradient-accent)', color: '#fff' }}>{postAuthor[0].toUpperCase()}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{postAuthor}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>{timeAgo(post.createdAt)}</div>
                                        </div>
                                    </div>
                                    {isMyPost && (
                                        <button onClick={() => deletePost(post.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}>
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>

                                <p style={{ lineHeight: 1.7, margin: '0 0 1rem', fontSize: '0.93rem' }}>{post.content}</p>
                                {post.mediaUrl && <img src={post.mediaUrl} alt="post" style={{ width: '100%', borderRadius: 10, marginBottom: '1rem' }} />}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[
                                        { icon: <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />, count: post.likedByUserIds.length, action: () => toggleLike(post), active: isLiked },
                                        { icon: <MessageCircle size={14} />, count: post.comments.length, action: () => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] })), active: showComments },
                                        { icon: <Share2 size={14} />, count: post.sharedByUserIds.length, action: () => { }, active: false },
                                    ].map((btn, i) => (
                                        <button key={i} onClick={btn.action} style={{
                                            background: btn.active ? 'var(--accent-soft)' : 'transparent',
                                            border: `1px solid ${btn.active ? 'var(--accent-border)' : 'var(--border)'}`,
                                            color: btn.active ? 'var(--accent)' : 'var(--text-secondary)',
                                            padding: '0.35rem 0.85rem', borderRadius: 8, cursor: 'pointer',
                                            fontSize: '0.82rem', fontFamily: 'JetBrains Mono', transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '0.4rem'
                                        }}>{btn.icon} {btn.count}</button>
                                    ))}
                                </div>

                                {/* Comments */}
                                {showComments && (
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                                        {post.comments.length === 0
                                            ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>No comments yet.</p>
                                            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                                {post.comments.map(c => (
                                                    <div key={c.id} style={{ display: 'flex', gap: '0.6rem' }}>
                                                        <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.65rem', flexShrink: 0 }}>{c.userId[0].toUpperCase()}</div>
                                                        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '0.5rem 0.85rem', borderRadius: 10, flex: 1 }}>
                                                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent)' }}>{c.userId} </span>
                                                            <span style={{ fontSize: '0.85rem' }}>{c.content}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input className="form-control" style={{ fontSize: '0.85rem' }} placeholder="Write a comment..." value={commentInputs[post.id] || ''} onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addComment(post.id)} />
                                            <button className="btn-gradient" style={{ padding: '0 1rem' }} onClick={() => addComment(post.id)}><Send size={14} /></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Feed;