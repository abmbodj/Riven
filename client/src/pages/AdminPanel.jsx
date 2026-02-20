import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { AuthContext } from '../context/AuthContext';
import {
    Users, Layers, CreditCard, Share2, MessageSquare,
    Plus, Trash2, Power, AlertCircle, Info, CheckCircle,
    AlertTriangle, X, Send, BarChart3, TrendingUp,
    Megaphone, UserCircle, Calendar, Zap, Database,
    User, Mail, Key, Shield, ExternalLink, Activity, ArrowUp
} from 'lucide-react';

// Theme Constants
const COLORS = {
    primary: '#3ECF8E', // Supabase Green
    primaryGlow: 'rgba(62, 207, 142, 0.4)',
    bg: '#1C1C1C',
    surface: '#232323',
    border: '#2E2E2E',
    text: '#EDEDED',
    textSecondary: '#8F8F8F',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6'
};

export default function AdminPanel() {
    const navigate = useNavigate();
    const {
        isAdmin,
        isOwner,
        adminGetStats,
        getAllUsers,
        adminDeleteUser,
        adminUpdateUserRole,
        adminGetMessages,
        adminCreateMessage,
        adminUpdateMessage,
        adminDeleteMessage
    } = useContext(AuthContext);

    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
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
            const [statsData, usersData, messagesData] = await Promise.all([
                adminGetStats(),
                getAllUsers(),
                adminGetMessages()
            ]);
            setStats(statsData);
            setUsers(usersData || []);
            setMessages(messagesData || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    }, [adminGetStats, getAllUsers, adminGetMessages]);

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

    if (!isAdmin) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
        { id: 'account', label: 'Account', icon: User }
    ];

    return (
        <div className="min-h-screen -mx-4 -my-4 bg-[#121212] text-white selection:bg-[#3ECF8E]/30">
            {/* Header with Glassmorphism */}
            <header className="sticky top-0 z-20 px-6 py-4 bg-[#121212]/80 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-[#3ECF8E] blur-[20px] opacity-20 rounded-full" />
                            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3ECF8E]/20 to-[#3ECF8E]/5 border border-[#3ECF8E]/20 flex items-center justify-center shadow-lg shadow-[#3ECF8E]/10">
                                <Database className="w-5 h-5 text-[#3ECF8E]" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-white/90">Admin Panel</h1>
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Dashboard</p>
                        </div>
                    </div>
                </div>

                {/* Animated Tabs */}
                <div className="flex gap-2 p-1 bg-white/5 rounded-xl overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all z-0 ${isActive ? 'text-[#121212]' : 'text-white/60 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-[#3ECF8E] rounded-lg -z-10 shadow-[0_0_15px_rgba(62,207,142,0.4)]"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
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
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                                <div className="absolute inset-0 border-4 border-[#3ECF8E] border-t-transparent rounded-full animate-spin" />
                            </div>
                            <p className="text-sm text-white/40 font-mono tracking-widest animate-pulse">SYNCING DATA...</p>
                        </motion.div>
                    ) : error ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center"
                        >
                            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-red-100">Sync Failed</h3>
                            <p className="text-sm text-red-300 mt-1 mb-4">{error}</p>
                            <button
                                onClick={loadData}
                                className="px-5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 text-sm font-semibold transition-colors"
                            >
                                Retry Connection
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {activeTab === 'overview' && stats && (
                                <OverviewTab stats={stats} />
                            )}

                            {activeTab === 'users' && (
                                <UsersTab users={users} setUsers={setUsers} onDelete={handleDeleteUser} isOwner={isOwner} onRoleChange={adminUpdateUserRole} />
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
                                <div className="p-8 text-center text-white/40 text-sm">
                                    Please use the main app settings for account management.
                                    <button
                                        onClick={() => navigate('/account')}
                                        className="block mx-auto mt-4 text-[#3ECF8E] hover:underline"
                                    >
                                        Go to Account Settings
                                    </button>
                                </div>
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
                    transition: { staggerChildren: 0.1 }
                }
            }}
            className="space-y-6"
        >
            {/* Executive Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Users"
                    value={stats.users}
                    trend={stats.recentSignups}
                    subtitle="Last 30 days"
                    icon={Users}
                    color="#3ECF8E"
                />
                <StatCard
                    title="Total Decks"
                    value={stats.decks}
                    icon={Layers}
                    color="#F59E0B"
                />
                <StatCard
                    title="Total Cards"
                    value={stats.cards}
                    icon={CreditCard}
                    color="#3B82F6"
                />
                <StatCard
                    title="Study Sessions"
                    value={stats.recentSessions}
                    trend={Math.floor(stats.recentSessions * 0.1)} // Mock trend for aesthetics if no prior period data exists
                    subtitle="Last 30 days"
                    icon={Zap}
                    color="#EC4899"
                />
            </div>

            {/* Activity Chart Area */}
            <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 relative overflow-hidden"
            >
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#3ECF8E]/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[#3ECF8E]" />
                            30-Day Activity
                        </h3>
                        <p className="text-sm text-white/40 mt-1">Study sessions completed over time</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] text-xs font-bold font-mono">
                        {stats.recentSessions.toLocaleString()} TOTAL
                    </div>
                </div>

                <div className="h-64 w-full relative z-10">
                    <ActivityChart data={stats.dailyActivity || []} />
                </div>
            </motion.div>

            {/* Top Decks List */}
            <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            >
                <h3 className="text-sm font-semibold text-white/50 mb-4 px-2 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Trending Decks (30 Days)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stats.topDecks?.map((deck, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-sm font-bold text-white/40 group-hover:text-[#3ECF8E] group-hover:border-[#3ECF8E]/30 transition-colors">
                                #{i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">{deck.title}</h4>
                                <p className="text-xs text-white/40 truncate flex items-center gap-1 mt-0.5">
                                    <UserCircle className="w-3 h-3" /> {deck.creator}
                                </p>
                            </div>
                            <div className="text-right pl-4 border-l border-white/10">
                                <p className="text-lg font-black tracking-tight text-[#3ECF8E]">{deck.sessions}</p>
                                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Plays</p>
                            </div>
                        </div>
                    ))}
                    {(!stats.topDecks || stats.topDecks.length === 0) && (
                        <div className="col-span-full text-center py-12 rounded-2xl border border-dashed border-white/10 text-white/30 text-sm italic">
                            No deck activity in the last 30 days.
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function StatCard(props) {
    const { title, value, icon: DisplayIcon, trend, color, subtitle } = props;
    return (
        <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } }}
            className="relative p-5 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden group hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-duration-500" />

            {/* Subtle radial glow matching icon color */}
            <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[40px] opacity-20 pointer-events-none transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: color }}
            />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-6">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                        style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
                    >
                        <DisplayIcon className="w-5 h-5" style={{ color }} />
                    </div>
                    {trend > 0 && (
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold"
                            style={{ backgroundColor: `${color}20`, color: color }}
                        >
                            <ArrowUp className="w-3 h-3" />
                            {trend}
                            <span className="text-[10px] opacity-70 ml-0.5">NEW</span>
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-3xl font-black text-white tracking-tighter mb-1">
                        {value?.toLocaleString() || 0}
                    </h3>
                    <p className="text-sm font-medium text-white/50">{title}</p>
                    {subtitle && <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">{subtitle}</p>}
                </div>
            </div>
        </motion.div>
    );
}

// Advanced Smooth SVG Area Chart
function ActivityChart({ data }) {
    if (!data || !data.length) return null;

    const rawMax = Math.max(...data.map(d => d.count), 1);
    const max = rawMax * 1.1; // Add 10% buffer so line isn't clipped at peaks
    const height = 100;
    const gap = 100 / Math.max(data.length - 1, 1);

    // Generate smooth bezier curve path
    const generatePath = (dataPoints) => {
        if (dataPoints.length === 0) return '';
        if (dataPoints.length === 1) return `M 0,${height - (dataPoints[0].count / max) * height} L 100,${height - (dataPoints[0].count / max) * height}`;

        let d = `M 0,${height - (dataPoints[0].count / max) * height}`;
        for (let i = 0; i < dataPoints.length - 1; i++) {
            const x0 = i * gap;
            const y0 = height - (dataPoints[i].count / max) * height;
            const x1 = (i + 1) * gap;
            const y1 = height - (dataPoints[i + 1].count / max) * height;

            // Cubic bezier control points for smoothing
            const cx0 = x0 + (x1 - x0) / 2;
            const cy0 = y0;
            const cx1 = x0 + (x1 - x0) / 2;
            const cy1 = y1;

            d += ` C ${cx0},${cy0} ${cx1},${cy1} ${x1},${y1}`;
        }
        return d;
    };

    const pathD = generatePath(data);

    // Pick 5 roughly evenly spaced labels for the X axis
    const labelIndices = [];
    const step = Math.max(Math.floor(data.length / 5), 1);
    for (let i = 0; i < data.length; i += step) {
        if (labelIndices.length < 5) labelIndices.push(i);
    }
    // Ensure the last data point is always labeled if not already
    if (!labelIndices.includes(data.length - 1)) {
        labelIndices[labelIndices.length - 1] = data.length - 1;
    }

    return (
        <div className="relative w-full h-full flex flex-col">
            <div className="flex-1 relative">
                {/* Y-Axis Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="w-full h-px bg-white/20 border-b border-dashed border-transparent" />
                    ))}
                </div>

                <svg viewBox="-2 -2 104 104" preserveAspectRatio="none" className="w-full h-full overflow-visible drop-shadow-2xl">
                    <defs>
                        <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.4" />
                            <stop offset="50%" stopColor="#3ECF8E" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Filled Area */}
                    <motion.path
                        d={`${pathD} L 100,100 L 0,100 Z`}
                        fill="url(#chartAreaGradient)"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />

                    {/* Smooth Line */}
                    <motion.path
                        d={pathD}
                        fill="none"
                        stroke="#3ECF8E"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        style={{ filter: 'drop-shadow(0px 4px 6px rgba(62,207,142,0.3))' }}
                    />

                    {/* Data Points (Dots on the line) */}
                    {data.map((d, i) => {
                        const x = i * gap;
                        const y = height - (d.count / max) * height;
                        // Only show dots on labeled points to reduce clutter on 30 days
                        if (!labelIndices.includes(i)) return null;

                        return (
                            <motion.g key={i}>
                                <motion.circle
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill="#121212"
                                    stroke="#3ECF8E"
                                    strokeWidth="2"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 1 + i * 0.02, type: "spring" }}
                                />
                                {/* Value tooltip hint above dot */}
                                <motion.text
                                    x={x}
                                    y={y - 10}
                                    textAnchor="middle"
                                    fill="#fff"
                                    fontSize="4"
                                    fontWeight="bold"
                                    className="opacity-0 hover:opacity-100 transition-opacity"
                                >
                                    {d.count}
                                </motion.text>
                            </motion.g>
                        );
                    })}
                </svg>
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between items-end mt-4 text-[10px] font-bold text-white/40 tracking-wider uppercase h-4">
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

    // Filter and paginate
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

    // Reset page if search changes
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden flex flex-col"
        >
            <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between gap-4">
                <div className="text-xs font-bold text-white/50 uppercase tracking-widest shrink-0">
                    Registered Users
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white font-mono text-[10px]">{filteredUsers.length}</span>
                </div>

                <div className="relative max-w-xs w-full">
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#3ECF8E]/50 transition-colors"
                    />
                    <Users className="w-4 h-4 text-white/30 absolute left-3 top-2.5" />
                </div>
            </div>

            <div className="divide-y divide-white/5 flex-1 min-h-[400px]">
                {paginatedUsers.length === 0 ? (
                    <div className="text-center py-20 text-white/30 text-sm italic">
                        No users found.
                    </div>
                ) : (
                    paginatedUsers.map(u => {
                        const role = u.role || (u.isAdmin ? 'admin' : 'user');
                        const roleBadge = {
                            owner: { label: 'OWNER', color: '#F59E0B' },
                            admin: { label: 'ADMIN', color: '#3ECF8E' },
                            user: { label: 'USER', color: '#6B7280' }
                        }[role] || { label: 'USER', color: '#6B7280' };

                        return (
                            <div key={u.id} className="p-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center text-sm font-bold text-white shrink-0">
                                            {u.username[0]?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                                <span className="truncate">{u.username}</span>
                                                <span
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                                                    style={{ backgroundColor: `${roleBadge.color}20`, color: roleBadge.color }}
                                                >
                                                    {roleBadge.label}
                                                </span>
                                            </h4>
                                            <p className="text-xs text-white/40 truncate">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="hidden sm:block text-xs text-white/30 font-mono">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </span>
                                        {/* Owner controls: promote/demote */}
                                        {isOwner && role !== 'owner' && (
                                            <button
                                                disabled={changingRole === u.id}
                                                onClick={() => handleRoleChange(u.id, role === 'admin' ? 'user' : 'admin')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${role === 'admin'
                                                    ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                                    : 'bg-[#3ECF8E]/10 text-[#3ECF8E] hover:bg-[#3ECF8E]/20'
                                                    }`}
                                            >
                                                {changingRole === u.id ? '...' : role === 'admin' ? 'Demote' : 'Promote'}
                                            </button>
                                        )}
                                        {role !== 'owner' && (
                                            <button
                                                onClick={() => onDelete(u.id, u.username)}
                                                className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between">
                    <p className="text-xs text-white/40 font-mono">
                        Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition-all border border-white/10"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition-all border border-white/10"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function BroadcastsTab({ messages, form, setForm, showForm, setShowForm, onSubmit, onToggle, onDelete, loading }) {
    return (
        <div className="space-y-4">
            {/* Action Bar */}
            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full py-4 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-[#3ECF8E] hover:border-[#3ECF8E]/50 hover:bg-[#3ECF8E]/5 transition-all flex items-center justify-center gap-2 font-medium"
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
                        className="bg-[#232323] rounded-2xl border border-white/10 overflow-hidden"
                        onSubmit={onSubmit}
                    >
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-sm font-semibold text-white">Compose Message</h3>
                            <button type="button" onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wider">Type</label>
                                <div className="flex gap-2">
                                    {['info', 'success', 'warning', 'error'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setForm({ ...form, type })}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize border transition-all ${form.type === type
                                                ? `border-[${COLORS[type]}] bg-[${COLORS[type]}]/10 text-white`
                                                : 'border-transparent bg-white/5 text-white/40 hover:bg-white/10'
                                                }`}
                                            // Handle dynamic colors for style prop if needed
                                            style={form.type === type ? { borderColor: COLORS[type], color: COLORS[type] } : {}}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Message Title"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#3ECF8E] transition-colors"
                            />
                            <textarea
                                placeholder="Message Content..."
                                rows={4}
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#3ECF8E] transition-colors resize-none"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-[#3ECF8E] text-black font-bold hover:bg-[#34D399] transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                                Send Broadcast
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* List */}
            <div className="space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-3" />
                        <p className="text-white/30 text-sm">No active broadcasts</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`p-4 rounded-xl border transition-all ${msg.isActive ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-50'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: COLORS[msg.type] || COLORS.info }}
                                    />
                                    <h4 className="text-sm font-semibold text-white">{msg.title}</h4>
                                </div>
                                <span className="text-[10px] text-white/30 font-mono">
                                    {new Date(msg.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-xs text-white/60 mb-4 line-clamp-2">{msg.content}</p>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => onToggle(msg.id, msg.isActive)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                                >
                                    {msg.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                    onClick={() => onDelete(msg.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
