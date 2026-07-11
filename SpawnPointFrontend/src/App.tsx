import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Bell, Info, CheckCircle, AlertTriangle, LayoutDashboard, Gamepad2, Users, Rss, Globe, UserPlus, MessageSquare, User, ShieldAlert, LogOut, LogIn, Ghost, Target, CreditCard, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './api';
import SpawnLogo from './components/SpawnLogo';
import Dashboard from './pages/Dashboard';
import GameListing from './pages/GameListing';
import UserProfile from './pages/UserProfile';
import SquadManagement from './pages/SquadManagement';
import Friends from './pages/Friends';
import Communities from './pages/Communities';
import Feed from './pages/Feed';
import Messages from './pages/Messages';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import GhostMode from './pages/Ghostmode';
//import Feedbackform from './pages/Feedbackform';
import CrashBounty from './pages/Crashbounty';
import Cards from './pages/Cards';
import CardPaymentResult from './pages/Cardpaymentresult';
import './App.css';

/* ─── Custom Cursor ─── */
const CustomCursor: React.FC = () => {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
    // Touch/coarse-pointer devices have no real mouse to track — skip the whole
    // effect there instead of leaving the dot/ring stuck at the top-left corner.
    const [isTouchDevice] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse), (hover: none)').matches);

    useEffect(() => {
        if (isTouchDevice) return;
        let raf: number;
        let mx = 0, my = 0, rx = 0, ry = 0;

        const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
        const onClick = (e: MouseEvent) => {
            const id = Date.now();
            setRipples(prev => [...prev, { id, x: e.clientX, y: e.clientY }]);
            setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700);
        };
        const onDown = () => {
            dotRef.current?.classList.add('clicking');
            ringRef.current?.classList.add('clicking');
        };
        const onUp = () => {
            dotRef.current?.classList.remove('clicking');
            ringRef.current?.classList.remove('clicking');
        };

        const loop = () => {
            rx += (mx - rx) * 0.15;
            ry += (my - ry) * 0.15;
            if (dotRef.current) { dotRef.current.style.left = `${mx}px`; dotRef.current.style.top = `${my}px`; }
            if (ringRef.current) { ringRef.current.style.left = `${rx}px`; ringRef.current.style.top = `${ry}px`; }
            raf = requestAnimationFrame(loop);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('click', onClick);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        raf = requestAnimationFrame(loop);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('click', onClick);
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('mouseup', onUp);
            cancelAnimationFrame(raf);
        };
    }, [isTouchDevice]);

    if (isTouchDevice) return null;

    return (
        <>
            <div ref={dotRef} className="cursor-dot" />
            <div ref={ringRef} className="cursor-ring" />
            {ripples.map(r => (
                <div key={r.id} className="cursor-ripple" style={{ left: r.x, top: r.y }} />
            ))}
        </>
    );
};

/* ─── Ambient Orbs ─── */
const AmbientOrbs: React.FC = () => (
    <>
        <div className="ambient-orb" style={{ width: 500, height: 500, background: '#C8FF00', top: '-10%', left: '-5%', animationDelay: '0s', animationDuration: '10s' }} />
        <div className="ambient-orb" style={{ width: 400, height: 400, background: '#8B5CF6', top: '60%', right: '-8%', animationDelay: '3s', animationDuration: '13s' }} />
        <div className="ambient-orb" style={{ width: 300, height: 300, background: '#00D4FF', bottom: '5%', left: '30%', animationDelay: '6s', animationDuration: '9s' }} />
    </>
);

/* ─── Scan Line Overlay ─── */
const ScanLines: React.FC = () => <div className="scanline-overlay" />;

/* ─── Toast ─── */
interface NotifProps { message: string; type: 'info' | 'success' | 'warning'; onClose: () => void; }
const NotifToast: React.FC<NotifProps> = ({ message, type, onClose }) => {
    const colors = { info: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)' };
    const icons = { info: <Info size={16} />, success: <CheckCircle size={16} />, warning: <AlertTriangle size={16} /> };
    useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
    return (
        <div className="notif-toast">
            <span style={{ color: colors[type], flexShrink: 0, marginTop: 1, display: 'flex' }}>{icons[type]}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: colors[type], fontFamily: 'JetBrains Mono', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    SPAWN.AI ALERT
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>{message}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>
    );
};

/* ─── Navbar ─── */
const navItems = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
    { to: '/games', label: 'Games', icon: <Gamepad2 size={14} /> },
    { to: '/squads', label: 'Squads', icon: <Users size={14} /> },
    { to: '/feed', label: 'Feed', icon: <Rss size={14} /> },
    { to: '/communities', label: 'Community', icon: <Globe size={14} /> },
    { to: '/friends', label: 'Friends', icon: <UserPlus size={14} /> },
    { to: '/messages', label: 'Messages', icon: <MessageSquare size={14} /> },
    { to: '/ghost', label: 'Ghost Mode', icon: <Ghost size={14} /> },
    { to: '/bounty', label: 'Bounty', icon: <Target size={14} /> },
    { to: '/cards', label: 'ID Cards', icon: <CreditCard size={14} /> },
    { to: '/profile', label: 'Profile', icon: <User size={14} /> },
];

const NavBar: React.FC<{ onNotif: () => void }> = ({ onNotif }) => {
    const location = useLocation();
    const { isLoggedIn, logout, user } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Close the mobile dropdown whenever the route changes
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Small haptic nudge on supported mobile browsers — no-op everywhere else
    const haptic = () => { try { navigator.vibrate?.(8); } catch { /* unsupported */ } };

    // Hide navbar on auth pages
    const authRoutes = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
    if (authRoutes.includes(location.pathname)) return null;

    // Use role from context user (which is loaded from localStorage on mount)
    const isAdmin = user?.role === 'admin';
    const allNavItems = isAdmin ? [...navItems, { to: '/admin', label: 'Admin', icon: <ShieldAlert size={14} /> }] : navItems;

    return (
        <nav className="navbar">
            <Link to="/" className="nav-brand">
                <SpawnLogo size={22} />
                SpawnPoint
            </Link>
            <button
                className="nav-hamburger"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => { haptic(); setMobileMenuOpen(prev => !prev); }}
            >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            {mobileMenuOpen && <div className="nav-overlay" onClick={() => setMobileMenuOpen(false)} />}
            <div className={`nav-links${mobileMenuOpen ? ' open' : ''}`}>
                {allNavItems.map(item => (
                    <Link key={item.to} to={item.to}
                        onClick={() => { haptic(); setMobileMenuOpen(false); }}
                        className={`nav-link${location.pathname === item.to ? ' active' : ''}`}
                        style={location.pathname === item.to ? { color: 'var(--accent)', borderBottomColor: 'var(--accent)', background: 'rgba(200,255,0,0.06)' } : {}}>
                        {item.icon}
                        {item.label}
                    </Link>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={onNotif} title="Notifications" style={{
                    background: 'rgba(200,255,0,0.06)', border: '1px solid var(--border)',
                    color: 'var(--accent)', borderRadius: '4px', padding: '0.45rem 0.7rem',
                    cursor: 'none', fontSize: '1rem', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><Bell size={15} /></button>
                {isLoggedIn ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="username-label" style={{
                            fontFamily: "'Rajdhani', sans-serif",
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--accent)',
                            padding: '0.4rem 0.75rem',
                            background: 'rgba(200,255,0,0.06)',
                            borderRadius: '4px',
                            border: '1px solid var(--accent-border)',
                        }}>
                            @{user?.username}
                            {isAdmin && <span style={{ color: 'var(--danger)', marginLeft: '0.4rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em' }}>ADMIN</span>}
                        </span>
                        <button
                            onClick={logout}
                            className="btn-gradient"
                            style={{ fontSize: '0.75rem', padding: '0.45rem 1rem', gap: '0.35rem' }}
                        >
                            <LogOut size={13} />
                            Logout
                        </button>
                    </div>
                ) : (
                    <Link to="/login">
                        <button className="btn-gradient" style={{ fontSize: '0.75rem', padding: '0.45rem 1rem', gap: '0.35rem' }}>
                            <LogIn size={13} />
                            Login
                        </button>
                    </Link>
                )}
            </div>
        </nav>
    );
};

/* ─── Protected Route ─── */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn } = useAuth();
    return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
};

/* ─── Admin Route ─── */
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user } = useAuth();

    // Not logged in → go to login
    if (!isLoggedIn) return <Navigate to="/login" replace />;

    // Use role from AuthContext (populated from localStorage on mount)
    // Also fallback to direct localStorage read in case context hasn't hydrated yet
    const storedUser = localStorage.getItem('spawnpoint_user');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const role = user?.role || parsedUser?.role;

    if (role !== 'admin') {
        console.warn('[AdminRoute] Access denied — role is:', role, '| user:', user);
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

/* ─── Placeholder for community/squad chat routes ─── */
const ComingSoon: React.FC<{ label: string }> = ({ label }) => (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{label}</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: 'var(--text-muted)' }}>// Coming soon</div>
    </div>
);

/* ─── Inner App (needs AuthContext) ─── */
const AppInner: React.FC = () => {
    const { user, isLoggedIn } = useAuth();
    const location = useLocation();
    const [notifQueue, setNotifQueue] = useState<{ message: string; type: 'info' | 'success' | 'warning' }[]>([]);
    const [checking, setChecking] = useState(false);

    const notif = notifQueue[0] ?? null;
    const dismissNotif = useCallback(() => setNotifQueue(prev => prev.slice(1)), []);

    interface FriendRequest { id: string; senderId: string; senderUsername?: string; status: string; }

    const fetchNotifications = useCallback(async () => {
        if (!user?.id || checking) return;
        setChecking(true);
        try {
            const requests = await api.get<FriendRequest[]>(`/friends/requests/received/${user.id}`);
            if (requests && requests.length > 0) {
                setNotifQueue(requests.slice(0, 5).map(r => ({
                    message: `${r.senderUsername || r.senderId} sent you a friend request.`,
                    type: 'info' as const,
                })));
            } else {
                setNotifQueue([{ message: 'No new notifications.', type: 'info' }]);
            }
        } catch {
            setNotifQueue([{ message: 'Could not load notifications.', type: 'warning' }]);
        } finally {
            setChecking(false);
        }
    }, [user?.id, checking]);

    // Poll periodically for new friend requests while logged in
    useEffect(() => {
        if (!isLoggedIn || !user?.id) return;
        const interval = setInterval(async () => {
            try {
                const requests = await api.get<FriendRequest[]>(`/friends/requests/received/${user.id}`);
                if (requests && requests.length > 0) {
                    setNotifQueue(prev => {
                        const existing = new Set(prev.map(n => n.message));
                        const fresh = requests
                            .map(r => ({ message: `${r.senderUsername || r.senderId} sent you a friend request.`, type: 'info' as const }))
                            .filter(n => !existing.has(n.message));
                        return [...prev, ...fresh];
                    });
                }
            } catch { /* silent */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [isLoggedIn, user?.id]);

    // Admin and Messages are dense, functional screens — the glowing
    // ambient orbs + scanline overlay look great on auth/dashboard/marketing
    // screens but compete with content on data-heavy utility screens, so
    // they're scoped out here rather than rendered globally on every route.
    const isDenseUtilityRoute = location.pathname === '/admin' || location.pathname === '/messages';

    return (
        <>
            <CustomCursor />
            {!isDenseUtilityRoute && <AmbientOrbs />}
            {!isDenseUtilityRoute && <ScanLines />}

            {notif && (
                <NotifToast message={notif.message} type={notif.type} onClose={dismissNotif} />
            )}

            <NavBar onNotif={fetchNotifications} />

            <div key={location.pathname} className="route-fade">
                <Routes>
                    {/* ─── Auth Routes (public) ─── */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* ─── Protected Routes ─── */}
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/games" element={<ProtectedRoute><GameListing /></ProtectedRoute>} />
                    <Route path="/squads" element={<ProtectedRoute><SquadManagement /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                    <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
                    <Route path="/communities" element={<ProtectedRoute><Communities /></ProtectedRoute>} />
                    <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/ghost" element={<ProtectedRoute><GhostMode /></ProtectedRoute>} />
                    <Route path="/bounty" element={<ProtectedRoute><CrashBounty /></ProtectedRoute>} />
                    <Route path="/cards" element={<ProtectedRoute><Cards /></ProtectedRoute>} />
                    <Route path="/cards/payment-result" element={<ProtectedRoute><CardPaymentResult /></ProtectedRoute>} />
                    <Route path="/communities/:id/chat" element={<ProtectedRoute><ComingSoon label="Community Chat" /></ProtectedRoute>} />
                    <Route path="/squads/:id/chat" element={<ProtectedRoute><ComingSoon label="Squad Chat" /></ProtectedRoute>} />

                    {/* ─── Admin Route ─── */}
                    <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

                    {/* ─── 404 ─── */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </>
    );
};

/* ─── App Root ─── */
const App: React.FC = () => (
    <AuthProvider>
        <Router>
            <AppInner />
        </Router>
    </AuthProvider>
);

export default App;