import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import {
    Users, Layers, CreditCard, Share2, MessageSquare,
    Plus, Trash2, Power, AlertCircle, Info, CheckCircle,
    AlertTriangle, X, Send, BarChart3, TrendingUp,
    Megaphone, UserCircle, Calendar, Zap, Database,
    User, Mail, Key, Shield, ExternalLink, Activity, ArrowUp,
    Leaf, BookOpen, Feather, ShieldAlert, CheckCircle2
} from 'lucide-react';

export default function AdminPanel() {
    const navigate = useNavigate();
    const {
        isAdmin,
        isOwner,
        user,
        adminGetStats,
        getAllUsers,
        adminDeleteUser,
        adminUpdateUserRole,
        adminGetMessages,
        adminCreateMessage,
        adminUpdateMessage,
        adminDeleteMessage,
        adminGetReports,
        adminResolveReport,
        adminCloseReport,
        adminBanUser,
        toggleSimulateFree
    } = useAuth();

    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Message form state
    const [showMessageForm, setShowMessageForm] = useState(false);
    const [messageForm, setMessageForm] = useState({
        title: '',
        content: '',
        type: 'info'
    });
    const [formLoading, setFormLoading] = useState(false);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, usersData, messagesData, reportsData] = await Promise.all([
                adminGetStats(),
                getAllUsers(),
                adminGetMessages(),
                adminGetReports()
            ]);
            setStats(statsData);
            setUsers(usersData || []);
            setMessages(messagesData || []);
            setReports(reportsData || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    }, [adminGetStats, getAllUsers, adminGetMessages, adminGetReports]);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }
        loadData();
    }, [isAdmin, navigate, loadData]);

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`Delete user "${username}"? This action cannot be undone.`)) return;
        try {
            await adminDeleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to delete user');
        }
    };

    const handleCreateMessage = async (e) => {
        e.preventDefault();
        if (!messageForm.title.trim() || !messageForm.content.trim()) {
            setError('Title and content are required');
            return;
        }
        setFormLoading(true);
        try {
            const newMessage = await adminCreateMessage(
                messageForm.title.trim(),
                messageForm.content.trim(),
                messageForm.type
            );
            setMessages([newMessage, ...messages]);
            setMessageForm({ title: '', content: '', type: 'info' });
            setShowMessageForm(false);
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to create message');
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleMessage = async (id, currentActive) => {
        try {
            await adminUpdateMessage(id, { isActive: !currentActive });
            setMessages(messages.map(m => m.id === id ? { ...m, isActive: !currentActive } : m));
        } catch {
            setError('Failed to update message');
        }
    };

    const handleDeleteMessage = async (id) => {
        if (!confirm('Delete this broadcast?')) return;
        try {
            await adminDeleteMessage(id);
            setMessages(messages.filter(m => m.id !== id));
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to delete message');
        }
    };

    const handleResolveReport = async (reportId) => {
        try {
            await adminResolveReport(reportId);
            setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
        } catch {
            setError('Failed to resolve report');
        }
    };

    const handleCloseReport = async (reportId) => {
        try {
            await adminCloseReport(reportId);
            setReports(reports.map(r => r.id === reportId ? { ...r, status: 'closed' } : r));
        } catch {
            setError('Failed to close report');
        }
    };

    const handleBanUserFromReport = async (userId, reportId) => {
        if (!confirm('Are you sure you want to completely ban this user? They will lose all access to social features.')) return;
        try {
            await adminBanUser(userId);
            setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));

            // Re-fetch users to reflect ban status if we are on the users tab
            const newUsersData = await getAllUsers();
            setUsers(newUsersData || []);
        } catch {
            setError('Failed to ban user: You might not have permission, or they are an owner.');
        }
    };

    if (!isAdmin) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'reports', label: 'Reports', icon: ShieldAlert },
        { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
        { id: 'account', label: 'Account', icon: User }
    ];

    return (
        <div className="min-h-screen -mx-4 -my-4 bg-claude-bg text-claude-text selection:bg-claude-accent/30">
            {/* Header with botanical glassmorphism */}
            <header className="sticky top-0 z-20 px-5 pt-4 pb-3 header-blur safe-area-top">
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-claude-accent blur-[16px] opacity-15 rounded-full" />
                        <div className="relative w-10 h-10 rounded-xl glass-panel flex items-center justify-center border-claude-accent/20">
                            <Leaf className="w-5 h-5 text-claude-accent" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-lg font-display tracking-tight text-claude-text">Admin Panel</h1>
                        <p className="text-[11px] font-mono text-claude-secondary uppercase tracking-[0.2em]">Dashboard</p>
                    </div>
                </div>

                {/* Segmented Control Tabs */}
                <div className="segmented-control">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`segmented-item relative flex items-center justify-center gap-1.5 touch-target tap-action ${isActive ? 'segmented-item-active' : 'text-claude-secondary'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="adminActiveTab"
                                        className="absolute inset-0 bg-claude-accent rounded-lg -z-10 shadow-botanical-glow"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <tab.icon className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-semibold tracking-wide">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Content Area */}
            <main className="p-4 safe-area-bottom pb-28">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-32 text-center"
                        >
                            <div className="relative w-16 h-16 mb-4">
                                <div className="absolute inset-0 border-4 border-claude-border rounded-full" />
                                <div className="absolute inset-0 border-4 border-claude-accent border-t-transparent rounded-full animate-spin" />
                            </div>
                            <p className="text-sm text-claude-secondary font-mono tracking-widest animate-pulse">SYNCING DATA…</p>
                        </motion.div>
                    ) : error ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 rounded-2xl bg-red-900/20 border border-red-500/20 text-center"
                        >
                            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                            <h3 className="text-lg font-display text-red-200">Sync Failed</h3>
                            <p className="text-sm text-red-300/70 mt-1 mb-4">{error}</p>
                            <button
                                onClick={() => { setError(''); loadData(); }}
                                className="px-5 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-200 text-sm font-semibold transition-colors touch-target tap-action native-press"
                            >
                                Retry Connection
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="space-y-5"
                        >
                            {activeTab === 'overview' && stats && (
                                <OverviewTab stats={stats} />
                            )}

                            {activeTab === 'users' && (
                                <UsersTab users={users} setUsers={setUsers} onDelete={handleDeleteUser} isOwner={isOwner} onRoleChange={adminUpdateUserRole} />
                            )}

                            {activeTab === 'reports' && (
                                <ReportsTab reports={reports} onResolve={handleResolveReport} onClose={handleCloseReport} onBan={handleBanUserFromReport} />
                            )}

                            {activeTab === 'broadcasts' && (
                                <BroadcastsTab
                                    messages={messages}
                                    form={messageForm}
                                    setForm={setMessageForm}
                                    showForm={showMessageForm}
                                    setShowForm={setShowMessageForm}
                                    onSubmit={handleCreateMessage}
                                    onToggle={handleToggleMessage}
                                    onDelete={handleDeleteMessage}
                                    loading={formLoading}
                                />
                            )}

                            {activeTab === 'account' && (
                                <AccountTab user={user} isOwner={isOwner} toggleSimulateFree={toggleSimulateFree} />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

function OverviewTab({ stats }) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08 }
                }
            }}
            className="space-y-5"
        >
            {/* Stat Cards — 2-col bento grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    title="Total Users"
                    value={stats.users}
                    trend={stats.recentSignups}
                    subtitle="Last 30 days"
                    icon={Users}
                    accentClass="text-claude-accent"
                    glowColor="var(--accent-color)"
                />
                <StatCard
                    title="Total Decks"
                    value={stats.decks}
                    icon={Layers}
                    accentClass="text-botanical-forest"
                    glowColor="var(--botanical-forest)"
                />
                <StatCard
                    title="Total Cards"
                    value={stats.cards}
                    icon={BookOpen}
                    accentClass="text-botanical-sepia"
                    glowColor="var(--botanical-sepia)"
                />
                <StatCard
                    title="Sessions"
                    value={stats.recentSessions}
                    trend={Math.floor(stats.recentSessions * 0.1)}
                    subtitle="Last 30 days"
                    icon={Feather}
                    accentClass="text-claude-accent"
                    glowColor="var(--accent-color)"
                />
            </div>

            {/* Activity Chart */}
            <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                className="p-5 rounded-2xl glass-panel relative overflow-hidden"
            >
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(222,185,106,0.08) 0%, transparent 70%)' }} />

                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <h3 className="text-base font-display text-claude-text flex items-center gap-2">
                            <Activity className="w-4 h-4 text-claude-accent" />
                            30-Day Activity
                        </h3>
                        <p className="text-xs text-claude-secondary mt-0.5">Study sessions over time</p>
                    </div>
                    <div className="px-2.5 py-1 rounded-lg bg-claude-accent/10 border border-claude-accent/20 text-claude-accent text-[10px] font-bold font-mono tracking-wider">
                        {stats.recentSessions.toLocaleString()} TOTAL
                    </div>
                </div>

                <div className="h-48 w-full relative z-10">
                    <ActivityChart data={stats.dailyActivity || []} />
                </div>
            </motion.div>

            {/* Trending Decks */}
            <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            >
                <h3 className="text-xs font-semibold text-claude-secondary mb-3 px-1 uppercase tracking-[0.15em] flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> Trending Decks
                </h3>
                <div className="space-y-2">
                    {stats.topDecks?.map((deck, i) => (
                        <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl botanical-card">
                            <div className="w-9 h-9 rounded-lg bg-claude-bg/60 border border-claude-border flex items-center justify-center text-xs font-display font-bold text-claude-secondary">
                                #{i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-claude-text truncate">{deck.title}</h4>
                                <p className="text-[11px] text-claude-secondary truncate flex items-center gap-1 mt-0.5">
                                    <UserCircle className="w-3 h-3" /> {deck.creator}
                                </p>
                            </div>
                            <div className="text-right pl-3 border-l border-claude-border">
                                <p className="text-lg font-display font-bold tracking-tight text-claude-accent">{deck.sessions}</p>
                                <p className="text-[9px] font-mono text-claude-secondary uppercase tracking-widest">Plays</p>
                            </div>
                        </div>
                    ))}
                    {(!stats.topDecks || stats.topDecks.length === 0) && (
                        <div className="text-center py-10 rounded-2xl border border-dashed border-claude-border text-claude-secondary text-sm italic font-body">
                            No deck activity in the last 30 days.
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function StatCard({ title, value, icon: DisplayIcon, trend, accentClass, glowColor, subtitle }) {
    return (
        <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
            className="relative p-4 rounded-2xl glass-panel overflow-hidden group active:scale-[0.97] transition-transform duration-100"
        >
            {/* Subtle radial glow */}
            <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[30px] opacity-15 pointer-events-none"
                style={{ backgroundColor: glowColor }}
            />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center bg-claude-bg/50 border border-claude-border"
                    >
                        <DisplayIcon className={`w-4 h-4 ${accentClass}`} />
                    </div>
                    {trend > 0 && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-botanical-forest/15 text-botanical-forest">
                            <ArrowUp className="w-2.5 h-2.5" />
                            {trend}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-2xl font-display font-bold text-claude-text tracking-tight mb-0.5">
                        {value?.toLocaleString() || 0}
                    </h3>
                    <p className="text-[11px] font-medium text-claude-secondary">{title}</p>
                    {subtitle && <p className="text-[9px] text-claude-secondary/60 mt-0.5 uppercase tracking-wider font-mono">{subtitle}</p>}
                </div>
            </div>
        </motion.div>
    );
}

// Smooth SVG Area Chart — gold accent
function ActivityChart({ data }) {
    if (!data || !data.length) return null;

    const rawMax = Math.max(...data.map(d => d.count), 1);
    const max = rawMax * 1.1;
    const height = 100;
    const gap = 100 / Math.max(data.length - 1, 1);

    const generatePath = (dataPoints) => {
        if (dataPoints.length === 0) return '';
        if (dataPoints.length === 1) return `M 0,${height - (dataPoints[0].count / max) * height} L 100,${height - (dataPoints[0].count / max) * height}`;

        let d = `M 0,${height - (dataPoints[0].count / max) * height}`;
        for (let i = 0; i < dataPoints.length - 1; i++) {
            const x0 = i * gap;
            const y0 = height - (dataPoints[i].count / max) * height;
            const x1 = (i + 1) * gap;
            const y1 = height - (dataPoints[i + 1].count / max) * height;

            const cx0 = x0 + (x1 - x0) / 2;
            const cy0 = y0;
            const cx1 = x0 + (x1 - x0) / 2;
            const cy1 = y1;

            d += ` C ${cx0},${cy0} ${cx1},${cy1} ${x1},${y1}`;
        }
        return d;
    };

    const pathD = generatePath(data);

    const labelIndices = [];
    const step = Math.max(Math.floor(data.length / 5), 1);
    for (let i = 0; i < data.length; i += step) {
        if (labelIndices.length < 5) labelIndices.push(i);
    }
    if (!labelIndices.includes(data.length - 1)) {
        labelIndices[labelIndices.length - 1] = data.length - 1;
    }

    return (
        <div className="relative w-full h-full flex flex-col">
            <div className="flex-1 relative">
                {/* Y-Axis Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="w-full h-px bg-claude-border" />
                    ))}
                </div>

                <svg viewBox="-2 -2 104 104" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="chartAreaGradientBotanical" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.35" />
                            <stop offset="50%" stopColor="var(--accent-color)" stopOpacity="0.08" />
                            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Filled Area */}
                    <motion.path
                        d={`${pathD} L 100,100 L 0,100 Z`}
                        fill="url(#chartAreaGradientBotanical)"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />

                    {/* Line */}
                    <motion.path
                        d={pathD}
                        fill="none"
                        stroke="var(--accent-color)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        style={{ filter: 'drop-shadow(0px 3px 6px rgba(222,185,106,0.25))' }}
                    />

                    {/* Dots on labeled points */}
                    {data.map((d, i) => {
                        const x = i * gap;
                        const y = height - (d.count / max) * height;
                        if (!labelIndices.includes(i)) return null;

                        return (
                            <motion.g key={i}>
                                <motion.circle
                                    cx={x}
                                    cy={y}
                                    r="3.5"
                                    fill="var(--bg-color)"
                                    stroke="var(--accent-color)"
                                    strokeWidth="2"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 1 + i * 0.02, type: "spring" }}
                                />
                            </motion.g>
                        );
                    })}
                </svg>
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between items-end mt-3 text-[9px] font-mono text-claude-secondary tracking-wider uppercase h-4">
                {labelIndices.map((idx, i) => {
                    const d = data[idx];
                    if (!d) return <span key={i} className="flex-1 text-center" />;
                    const date = new Date(d.date);
                    const formatted = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;

                    return (
                        <span
                            key={i}
                            className="flex-1 text-center first:text-left last:text-right"
                        >
                            {formatted}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

function UsersTab({ users, setUsers, onDelete, isOwner, onRoleChange }) {
    const [changingRole, setChangingRole] = React.useState(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [searchTerm, setSearchTerm] = React.useState("");
    const itemsPerPage = 20;

    const filteredUsers = React.useMemo(() => {
        if (!searchTerm) return users;
        const lower = searchTerm.toLowerCase();
        return users.filter(u =>
            (u.username && u.username.toLowerCase().includes(lower)) ||
            (u.email && u.email.toLowerCase().includes(lower))
        );
    }, [users, searchTerm]);

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleRoleChange = async (userId, newRole) => {
        setChangingRole(userId);
        try {
            await onRoleChange(userId, newRole);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, isAdmin: newRole === 'admin', isOwner: false } : u));
        } catch (err) {
            const errorMessage = err?.message || 'Failed to change role';
            alert(errorMessage);
        } finally {
            setChangingRole(null);
        }
    };

    const ROLE_STYLES = {
        owner: { label: 'OWNER', cls: 'bg-claude-accent/15 text-claude-accent' },
        admin: { label: 'ADMIN', cls: 'bg-botanical-forest/15 text-botanical-forest' },
        user: { label: 'USER', cls: 'bg-claude-secondary/15 text-claude-secondary' }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl glass-panel overflow-hidden flex flex-col"
        >
            {/* Header with search */}
            <div className="px-4 py-3 border-b border-white/5 bg-claude-surface/30 flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold text-claude-secondary uppercase tracking-[0.15em] shrink-0 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Users
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-claude-border text-claude-text font-mono text-[9px]">{filteredUsers.length}</span>
                </div>

                <div className="relative max-w-[200px] w-full">
                    <input
                        type="text"
                        placeholder="Search…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-claude-bg/60 border border-claude-border rounded-xl text-xs text-claude-text placeholder-claude-secondary/50 focus:outline-none focus:border-claude-accent/50 transition-colors"
                    />
                    <Users className="w-3.5 h-3.5 text-claude-secondary absolute left-2.5 top-2.5" />
                </div>
            </div>

            {/* User List */}
            <div className="divide-y divide-claude-border/50 flex-1 min-h-[300px]">
                {paginatedUsers.length === 0 ? (
                    <div className="text-center py-16 text-claude-secondary text-sm italic font-body">
                        No users found.
                    </div>
                ) : (
                    paginatedUsers.map(u => {
                        const role = u.role || (u.isAdmin ? 'admin' : 'user');
                        const badge = ROLE_STYLES[role] || ROLE_STYLES.user;

                        return (
                            <div key={u.id} className="p-4 active:bg-claude-surface/40 transition-colors tap-action">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-claude-surface border border-claude-border flex items-center justify-center text-sm font-display font-bold text-claude-accent shrink-0">
                                            {u.username[0]?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-medium text-claude-text flex items-center gap-2">
                                                <span className="truncate">{u.username}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </h4>
                                            <p className="text-[11px] text-claude-secondary truncate">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Owner controls: promote/demote */}
                                        {isOwner && role !== 'owner' && (
                                            <button
                                                disabled={changingRole === u.id}
                                                onClick={() => handleRoleChange(u.id, role === 'admin' ? 'user' : 'admin')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all touch-target tap-action native-press ${role === 'admin'
                                                    ? 'bg-claude-accent/10 text-claude-accent'
                                                    : 'bg-botanical-forest/10 text-botanical-forest'
                                                    }`}
                                            >
                                                {changingRole === u.id ? '…' : role === 'admin' ? 'Demote' : 'Promote'}
                                            </button>
                                        )}
                                        {role !== 'owner' && (
                                            <button
                                                onClick={() => onDelete(u.id, u.username)}
                                                className="p-2 rounded-lg text-claude-secondary/40 hover:text-red-400 active:bg-red-400/10 transition-colors touch-target tap-action"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-claude-border/50 bg-claude-bg/30 flex items-center justify-between">
                    <p className="text-[10px] text-claude-secondary font-mono">
                        Page <span className="text-claude-text font-bold">{currentPage}</span> of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-claude-surface/50 text-claude-text disabled:opacity-30 transition-all border border-claude-border touch-target tap-action native-press"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-claude-surface/50 text-claude-text disabled:opacity-30 transition-all border border-claude-border touch-target tap-action native-press"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

const MSG_TYPE_COLORS = {
    info: { bg: 'bg-botanical-sepia/15', text: 'text-botanical-sepia', dot: 'bg-botanical-sepia' },
    success: { bg: 'bg-botanical-forest/15', text: 'text-botanical-forest', dot: 'bg-botanical-forest' },
    warning: { bg: 'bg-claude-accent/15', text: 'text-claude-accent', dot: 'bg-claude-accent' },
    error: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' }
};

function BroadcastsTab({ messages, form, setForm, showForm, setShowForm, onSubmit, onToggle, onDelete, loading }) {
    return (
        <div className="space-y-4">
            {/* Create Button */}
            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full py-4 rounded-xl border border-dashed border-claude-border text-claude-secondary hover:text-claude-accent active:text-claude-accent active:border-claude-accent/50 active:bg-claude-accent/5 transition-all flex items-center justify-center gap-2 font-medium touch-target tap-action native-press"
                >
                    <Plus className="w-5 h-5" />
                    Create New Broadcast
                </button>
            )}

            {/* Create Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="rounded-2xl glass-panel overflow-hidden"
                        onSubmit={onSubmit}
                    >
                        <div className="p-4 border-b border-claude-border/50 flex justify-between items-center bg-claude-surface/30">
                            <h3 className="text-sm font-display text-claude-text">Compose Message</h3>
                            <button type="button" onClick={() => setShowForm(false)} className="text-claude-secondary hover:text-claude-text touch-target tap-action">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-[10px] text-claude-secondary mb-2 block uppercase tracking-[0.15em] font-mono">Type</label>
                                <div className="flex gap-2">
                                    {['info', 'success', 'warning', 'error'].map(type => {
                                        const isSelected = form.type === type;
                                        const colors = MSG_TYPE_COLORS[type];
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setForm({ ...form, type })}
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-medium capitalize border transition-all touch-target tap-action ${isSelected
                                                    ? `${colors.bg} ${colors.text} border-current`
                                                    : 'border-transparent bg-claude-surface/40 text-claude-secondary active:bg-claude-surface/60'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Message Title"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-claude-bg/60 border border-claude-border text-claude-text placeholder-claude-secondary/40 focus:outline-none focus:border-claude-accent/50 transition-colors"
                            />
                            <textarea
                                placeholder="Message Content…"
                                rows={4}
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-claude-bg/60 border border-claude-border text-claude-text placeholder-claude-secondary/40 focus:outline-none focus:border-claude-accent/50 transition-colors resize-none"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl bg-claude-accent text-botanical-ink font-bold transition-colors flex items-center justify-center gap-2 touch-target tap-action native-press shadow-botanical-glow"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-botanical-ink/30 border-t-botanical-ink rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                                Send Broadcast
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Message List */}
            <div className="space-y-2">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <MessageSquare className="w-12 h-12 text-claude-border mx-auto mb-3" />
                        <p className="text-claude-secondary text-sm font-body italic">No active broadcasts</p>
                    </div>
                ) : (
                    messages.map(msg => {
                        const colors = MSG_TYPE_COLORS[msg.type] || MSG_TYPE_COLORS.info;
                        return (
                            <div key={msg.id} className={`p-4 rounded-xl transition-all ${msg.isActive ? 'botanical-card' : 'bg-claude-surface/20 border border-claude-border/30 opacity-50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                        <h4 className="text-sm font-medium text-claude-text">{msg.title}</h4>
                                    </div>
                                    <span className="text-[9px] text-claude-secondary font-mono tracking-wider">
                                        {new Date(msg.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs text-claude-secondary mb-4 line-clamp-2">{msg.content}</p>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => onToggle(msg.id, msg.isActive)}
                                        className="px-3 py-2 rounded-lg text-[11px] font-medium bg-claude-surface/40 active:bg-claude-surface/60 text-claude-secondary transition-colors touch-target tap-action native-press"
                                    >
                                        {msg.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => onDelete(msg.id)}
                                        className="px-3 py-2 rounded-lg text-[11px] font-medium bg-red-500/10 active:bg-red-500/20 text-red-400 transition-colors touch-target tap-action native-press"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function AccountTab({ user, isOwner, toggleSimulateFree }) {
    const [toggling, setToggling] = React.useState(false);
    const simulatingFree = !!user?.simulate_free_tier;
    const currentTier = user?.subscription_tier || 'free';

    const handleToggle = async () => {
        setToggling(true);
        try {
            await toggleSimulateFree();
        } catch (err) {
            console.error(err);
        } finally {
            setToggling(false);
        }
    };

    const tierStyles = {
        lifetime: 'text-claude-accent',
        supporter: 'text-botanical-forest',
        free: 'text-claude-secondary'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Subscription Status */}
            <div className="p-5 rounded-2xl glass-panel relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(222,185,106,0.08) 0%, transparent 70%)' }} />
                <div className="relative z-10">
                    <h3 className="text-[10px] font-mono text-claude-secondary uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-claude-accent" />
                        Subscription Status
                    </h3>
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`text-2xl font-display font-bold tracking-tight capitalize ${tierStyles[currentTier] || tierStyles.free}`}>
                            {currentTier}
                        </span>
                        {isOwner && !simulatingFree && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-claude-accent/15 text-claude-accent uppercase tracking-widest font-mono">
                                Owner
                            </span>
                        )}
                        {simulatingFree && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 uppercase tracking-widest font-mono animate-pulse">
                                Simulated
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-claude-secondary leading-relaxed">
                        {simulatingFree
                            ? 'You are currently experiencing Riven as a free-tier user.'
                            : 'As the owner, you have permanent Lifetime access.'}
                    </p>
                </div>
            </div>

            {/* Simulate Free Toggle (Owner Only) */}
            {isOwner && (
                <div className="p-5 rounded-2xl glass-panel relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-sm font-display text-claude-text tracking-tight mb-1 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-claude-accent" />
                                    Simulate Free User
                                </h3>
                                <p className="text-[11px] text-claude-secondary leading-relaxed">
                                    Toggle to experience Riven as a free-tier user — limited hearts, AI caps, theme locks, and group restrictions apply.
                                </p>
                            </div>
                            <button
                                onClick={handleToggle}
                                disabled={toggling}
                                className={`relative w-14 h-8 rounded-full transition-all duration-300 shrink-0 tap-action ${simulatingFree
                                    ? 'bg-claude-accent shadow-botanical-glow'
                                    : 'bg-claude-border'
                                    } ${toggling ? 'opacity-50' : ''}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${simulatingFree ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {simulatingFree && (
                            <div className="mt-4 p-3 rounded-xl bg-red-900/15 border border-red-500/20 text-red-300/80 text-[11px] flex items-start gap-2 leading-relaxed">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                                <span>Free mode is active. You will see hearts, limits, and paywalls. Toggle off to restore Lifetime access.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function ReportsTab({ reports, onResolve, onClose, onBan }) {
    const [filter, setFilter] = useState('pending'); // 'pending', 'resolved', 'closed', 'all'

    const filteredReports = React.useMemo(() => {
        if (filter === 'all') return reports;
        return reports.filter(r => r.status === filter);
    }, [reports, filter]);

    const STATUS_COLORS = {
        pending: 'bg-claude-accent/20 text-claude-accent border-claude-accent/30',
        resolved: 'bg-botanical-forest/20 text-botanical-forest border-botanical-forest/30',
        closed: 'bg-claude-secondary/20 text-claude-secondary border-claude-secondary/30'
    };

    return (
        <div className="space-y-4">
            {/* Filter Toggle */}
            <div className="flex items-center gap-2 p-1.5 glass-panel rounded-xl overflow-x-auto no-scrollbar scroll-smooth">
                {['pending', 'resolved', 'closed', 'all'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`capitalize px-4 py-2 rounded-lg text-[11px] font-bold tracking-widest font-mono transition-all whitespace-nowrap touch-target tap-action ${filter === status
                            ? 'bg-claude-accent text-botanical-ink shadow-botanical-glow'
                            : 'text-claude-secondary hover:text-claude-text'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Reports List */}
            <div className="space-y-3">
                {filteredReports.length === 0 ? (
                    <div className="text-center py-16 text-claude-secondary text-sm italic font-body glass-panel rounded-2xl">
                        No {filter !== 'all' ? filter : ''} reports found.
                    </div>
                ) : (
                    filteredReports.map(report => (
                        <div key={report.id} className="p-4 rounded-xl botanical-card flex flex-col gap-3 group relative overflow-hidden">
                            {/* Card Header: Reporter & Target */}
                            <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${STATUS_COLORS[report.status] || STATUS_COLORS.pending}`}>
                                            {report.status}
                                        </span>
                                        <span className="text-[10px] font-mono text-claude-secondary uppercase tracking-[0.1em]">
                                            Type: {report.content_type}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-display text-claude-text truncate">
                                        Reported: <span className="text-claude-accent">{report.reported_username}</span>
                                    </h4>
                                    <p className="text-[11px] text-claude-secondary truncate">
                                        Reported by {report.reporter_username} on {new Date(report.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Report Details */}
                            <div className="bg-claude-surface/30 rounded-lg p-3 border border-claude-border/50">
                                <p className="text-sm font-semibold text-claude-text mb-1">Reason: {report.reason}</p>
                                <p className="text-xs text-claude-secondary whitespace-pre-wrap font-mono">
                                    {report.details || '(No additional details provided)'}
                                </p>
                            </div>

                            {/* Actions (Only for pending reports generally, but available all time as fallback) */}
                            {report.status === 'pending' && (
                                <div className="flex flex-wrap items-center gap-2 mt-2 pt-3 border-t border-claude-border/50">
                                    <button
                                        onClick={() => onResolve(report.id)}
                                        className="flex-1 min-w-[100px] py-2 rounded-lg text-[11px] font-bold font-mono tracking-widest bg-botanical-forest/15 hover:bg-botanical-forest/25 text-botanical-forest border border-botanical-forest/30 transition-colors flex items-center justify-center gap-1.5 touch-target tap-action native-press"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                                    </button>
                                    <button
                                        onClick={() => onClose(report.id)}
                                        className="flex-1 min-w-[100px] py-2 rounded-lg text-[11px] font-bold font-mono tracking-widest bg-claude-surface/60 hover:bg-claude-surface/80 text-claude-secondary transition-colors flex items-center justify-center gap-1.5 touch-target tap-action native-press"
                                    >
                                        <X className="w-3.5 h-3.5" /> Close Return
                                    </button>
                                    <button
                                        onClick={() => onBan(report.reported_user_id, report.id)}
                                        className="w-full sm:w-auto px-4 py-2 rounded-lg text-[11px] font-bold font-mono tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors flex items-center justify-center gap-1.5 touch-target tap-action native-press"
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" /> Ban User
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
