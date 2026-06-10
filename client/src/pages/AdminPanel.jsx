import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { useGSAP } from '../hooks/useGSAP';
import { EASE, DURATION } from '../utils/animations';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Clock3,
    Crown,
    Megaphone,
    MessageSquare,
    RefreshCw,
    ShieldAlert,
    User,
    Users,
} from 'lucide-react';

import { messageTitleSchema, messageContentSchema } from '../schemas/forms';
import OverviewTab from '../components/admin/OverviewTab';
import UsersTab from '../components/admin/UsersTab';
import ReportsTab from '../components/admin/ReportsTab';
import BroadcastsTab from '../components/admin/BroadcastsTab';
import AccountTab from '../components/admin/AccountTab';
import FeedbackTab from '../components/admin/FeedbackTab';

const BASE_TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3, hint: 'Platform health' },
    { id: 'users', label: 'Users', icon: Users, hint: 'Directory' },
    { id: 'reports', label: 'Reports', icon: ShieldAlert, hint: 'Moderation' },
    { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone, hint: 'System messages' },
    { id: 'account', label: 'Account', icon: User, hint: 'Operator' },
];

const sortFeedbackEntries = (entries = []) => [...entries].sort((left, right) => {
    const leftRank = left.isFavorited ? 0 : 1;
    const rightRank = right.isFavorited ? 0 : 1;

    if (leftRank !== rightRank) {
        return leftRank - rightRank;
    }

    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
});

const formatUpdatedAt = (value) => {
    if (!value) return 'Pending';
    return value.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
};

function AdminLoadingSkeleton() {
    return (
        <div className="relative min-h-screen pb-24">
            <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pt-4 sm:px-6 lg:px-8">
                <div className="glass-panel-premium rounded-[2rem] p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-5">
                        <div className="space-y-3">
                            <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                            <div className="h-10 w-56 animate-pulse rounded-2xl bg-white/10" />
                            <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-white/10" />
                        </div>
                        <div className="hidden h-14 w-14 animate-pulse rounded-2xl bg-white/10 sm:block" />
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="glass-panel-premium h-28 animate-pulse rounded-[1.5rem]" />
                    ))}
                </div>
                <div className="glass-panel-premium h-16 animate-pulse rounded-[1.35rem]" />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
                    <div className="glass-panel-premium h-80 animate-pulse rounded-[1.75rem]" />
                    <div className="glass-panel-premium h-80 animate-pulse rounded-[1.75rem]" />
                </div>
            </div>
        </div>
    );
}

function SignalCard({ icon: Icon, label, value, tone = 'neutral' }) {
    const toneClass = tone === 'warning'
        ? 'border-amber-500/25 text-amber-300'
        : tone === 'danger'
            ? 'border-red-500/25 text-red-300'
            : tone === 'good'
                ? 'border-botanical-forest/30 text-botanical-forest'
                : 'border-white/10 text-claude-text';

    return (
        <div className={`glass-panel-premium rounded-[1.35rem] border px-4 py-3 ${toneClass}`}>
            <div className="relative z-10 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary">
                        {label}
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-tight">
                        {value}
                    </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
}

export default function AdminPanel() {
    const navigate = useNavigate();
    const toast = useToast();
    const toastRef = React.useRef(toast);
    const haptics = useHaptics();
    const {
        isAdmin, isOwner, user,
        adminGetStats, getAllUsers, adminDeleteUser, adminUpdateUserRole,
        adminGetMessages, adminCreateMessage, adminUpdateMessage, adminDeleteMessage,
        adminGetFeedback, adminToggleFeedbackFavorite, adminDeleteFeedback, adminThankFeedback,
        adminGetReports, adminResolveReport, adminCloseReport, adminBanUser,
        toggleSimulateFree
    } = useAuth();

    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [feedbackLoadError, setFeedbackLoadError] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

    const [showMessageForm, setShowMessageForm] = useState(false);
    const [messageForm, setMessageForm] = useState({ title: '', content: '', type: 'info' });
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const { container } = useGSAP(({ selector }) => {
        const header = selector('.gsap-header');
        const tabs = selector('.gsap-tabs');

        if (header.length) {
            import('gsap').then(({ default: gsap }) => {
                gsap.from(header, {
                    y: -20, opacity: 0,
                    duration: DURATION.normal,
                    ease: EASE.organic,
                    clearProps: 'all',
                });
            });
        }
        if (tabs.length) {
            import('gsap').then(({ default: gsap }) => {
                gsap.from(tabs, {
                    y: 10, opacity: 0,
                    duration: DURATION.normal,
                    ease: EASE.organic,
                    delay: 0.1,
                    clearProps: 'all',
                });
            });
        }
    }, [loading]);

    const tabs = useMemo(() => (
        isOwner
            ? [
                ...BASE_TABS.slice(0, 4),
                { id: 'feedback', label: 'Feedback', icon: MessageSquare, hint: 'Owner inbox' },
                BASE_TABS[4],
            ]
            : BASE_TABS
    ), [isOwner]);

    const adminSignals = useMemo(() => {
        const pendingReports = reports.filter((report) => report.status === 'pending').length;
        const activeMessages = messages.filter((message) => message.isActive).length;
        const openFeedback = feedback.filter((entry) => !entry.consideringNotifiedAt).length;
        const totalUsers = stats?.users ?? users.length;

        return {
            pendingReports,
            activeMessages,
            openFeedback,
            totalUsers,
        };
    }, [feedback, messages, reports, stats?.users, users.length]);

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [
                statsResult,
                usersResult,
                messagesResult,
                feedbackResult,
                reportsResult,
            ] = await Promise.allSettled([
                adminGetStats(),
                getAllUsers(),
                adminGetMessages(),
                isOwner ? adminGetFeedback() : Promise.resolve([]),
                adminGetReports(),
            ]);

            const rejectUnlessAuth = (result, label) => {
                if (result.status === 'fulfilled') return result.value;
                if (result.reason?.status === 401 || result.reason?.status === 403) {
                    throw result.reason;
                }
                console.error(`[AdminPanel] Failed to load ${label}:`, result.reason);
                return null;
            };

            const statsData = rejectUnlessAuth(statsResult, 'stats');
            const usersData = rejectUnlessAuth(usersResult, 'users');
            const messagesData = rejectUnlessAuth(messagesResult, 'messages');
            const reportsData = rejectUnlessAuth(reportsResult, 'reports');

            if (statsData) setStats(statsData);
            if (usersData) setUsers(usersData);
            if (messagesData) setMessages(messagesData);
            if (reportsData) setReports(reportsData);

            if (feedbackResult.status === 'fulfilled') {
                setFeedback(sortFeedbackEntries(feedbackResult.value || []));
                setFeedbackLoadError(null);
            } else if (isOwner) {
                console.error('[AdminPanel] Failed to load feedback:', feedbackResult.reason);
                setFeedback([]);
                setFeedbackLoadError(
                    feedbackResult.reason?.message || 'Could not load feedback'
                );
            } else {
                setFeedback([]);
                setFeedbackLoadError(null);
            }

            setLastUpdatedAt(new Date());

            const coreFailed = [statsResult, usersResult, messagesResult, reportsResult]
                .some((result) => result.status === 'rejected');
            if (coreFailed) {
                toastRef.current.error('Failed to load admin data');
            }
        } catch (err) {
            console.error(err);
            toastRef.current.error('Failed to load admin data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [adminGetStats, getAllUsers, adminGetMessages, adminGetFeedback, adminGetReports, isOwner]);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }
        loadData();
    }, [isAdmin, navigate, loadData]);

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`Delete user "${username}"? This action cannot be undone.`)) return;
        haptics.medium();
        try {
            await adminDeleteUser(userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            const newStats = await adminGetStats();
            setStats(newStats);
            toast.success('User deleted');
        } catch {
            toast.error('Failed to delete user');
        }
    };

    const handleCreateMessage = async (e) => {
        e.preventDefault();
        const titleResult = messageTitleSchema.safeParse(messageForm.title.trim());
        const contentResult = messageContentSchema.safeParse(messageForm.content.trim());
        if (!titleResult.success) {
            toast.error(titleResult.error.errors[0]?.message || 'Title is required');
            return;
        }
        if (!contentResult.success) {
            toast.error(contentResult.error.errors[0]?.message || 'Content is required');
            return;
        }
        setFormLoading(true);
        try {
            const newMessage = await adminCreateMessage(
                titleResult.data,
                contentResult.data,
                messageForm.type
            );
            setMessages(prev => [newMessage, ...prev]);
            setMessageForm({ title: '', content: '', type: 'info' });
            setShowMessageForm(false);
            toast.success('Broadcast sent');
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            toast.error('Failed to create message');
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleMessage = async (id, currentActive) => {
        try {
            await adminUpdateMessage(id, { isActive: !currentActive });
            setMessages(prev => prev.map(m => m.id === id ? { ...m, isActive: !currentActive } : m));
        } catch {
            toast.error('Failed to update message');
        }
    };

    const handleDeleteMessage = async (id) => {
        if (!confirm('Delete this broadcast?')) return;
        haptics.medium();
        try {
            await adminDeleteMessage(id);
            setMessages(prev => prev.filter(m => m.id !== id));
            const newStats = await adminGetStats();
            setStats(newStats);
            toast.success('Broadcast deleted');
        } catch {
            toast.error('Failed to delete message');
        }
    };

    const handleToggleFeedbackFavorite = async (feedbackId, nextFavorite) => {
        try {
            const updatedFeedback = await adminToggleFeedbackFavorite(feedbackId, nextFavorite);
            setFeedback(prev => sortFeedbackEntries(prev.map((entry) => (
                entry.id === feedbackId ? updatedFeedback : entry
            ))));
        } catch (error) {
            console.error(error);
            toast.error('Failed to update favorite');
        }
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!confirm('Delete this feedback submission?')) return;
        try {
            await adminDeleteFeedback(feedbackId);
            setFeedback(prev => prev.filter((entry) => entry.id !== feedbackId));
            toast.success('Feedback deleted');
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete feedback');
        }
    };

    const handleThankFeedback = async (feedbackId) => {
        try {
            const updatedFeedback = await adminThankFeedback(feedbackId);
            setFeedback(prev => sortFeedbackEntries(prev.map((entry) => (
                entry.id === feedbackId ? updatedFeedback : entry
            ))));
            toast.success('User notified that their feedback is being considered');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Failed to thank user');
        }
    };

    const handleResolveReport = async (reportId) => {
        try {
            await adminResolveReport(reportId);
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
            toast.success('Report resolved');
        } catch {
            toast.error('Failed to resolve report');
        }
    };

    const handleCloseReport = async (reportId) => {
        try {
            await adminCloseReport(reportId);
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'closed' } : r));
        } catch {
            toast.error('Failed to close report');
        }
    };

    const handleBanUserFromReport = async (userId, reportId) => {
        if (!confirm('Are you sure you want to completely ban this user? They will lose all access to social features.')) return;
        haptics.heavy();
        try {
            await adminBanUser(userId);
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
            const newUsersData = await getAllUsers();
            setUsers(newUsersData || []);
            toast.success('User banned');
        } catch {
            toast.error('Failed to ban user. You might not have permission, or they are an owner.');
        }
    };

    if (!isAdmin) return null;

    if (loading) {
        return <AdminLoadingSkeleton />;
    }

    const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

    return (
        <div ref={container} className="relative min-h-screen pb-24">
            <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
                <section className="gsap-header glass-panel-premium overflow-hidden rounded-[2rem] p-5 sm:p-6 lg:p-7">
                    <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-claude-accent/25 bg-claude-accent/12 px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.24em] text-claude-accent">
                                    <Activity className="h-3 w-3" />
                                    System
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-claude-bg/45 px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
                                    {isOwner ? <Crown className="h-3 w-3 text-claude-accent" /> : <ShieldAlert className="h-3 w-3" />}
                                    {isOwner ? 'Owner Console' : 'Admin Console'}
                                </span>
                            </div>
                            <h1 className="text-4xl font-serif font-bold italic leading-none tracking-tight text-claude-text sm:text-5xl">
                                Admin Panel
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-claude-secondary">
                                Operational control for users, moderation, broadcasts, feedback, and platform health.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-claude-bg/45 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                <Clock3 className="h-4 w-4 text-claude-accent" />
                                Updated {formatUpdatedAt(lastUpdatedAt)}
                            </div>
                            <button
                                onClick={() => {
                                    haptics.light();
                                    loadData(true);
                                }}
                                disabled={refreshing}
                                className="tap-action inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-claude-accent/20 bg-claude-accent/12 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-claude-accent/18 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                aria-label="Refresh admin data"
                            >
                                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>
                </section>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SignalCard icon={Users} label="Users" value={(adminSignals.totalUsers || 0).toLocaleString()} />
                    <SignalCard
                        icon={ShieldAlert}
                        label="Pending Reports"
                        value={adminSignals.pendingReports}
                        tone={adminSignals.pendingReports > 0 ? 'warning' : 'good'}
                    />
                    <SignalCard icon={Megaphone} label="Live Broadcasts" value={adminSignals.activeMessages} />
                    <SignalCard
                        icon={MessageSquare}
                        label={isOwner ? 'Open Feedback' : 'Feedback'}
                        value={isOwner ? (feedbackLoadError ? 'Issue' : adminSignals.openFeedback) : 'Owner'}
                        tone={feedbackLoadError ? 'danger' : 'neutral'}
                    />
                </div>

                {feedbackLoadError && isOwner && (
                    <div className="glass-panel-premium rounded-[1.35rem] border border-amber-500/25 px-4 py-3">
                        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                                <div>
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300">
                                        Feedback inbox unavailable
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-claude-secondary">
                                        Core admin data loaded. The owner feedback inbox can be retried from its tab.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => loadData(true)}
                                className="tap-action inline-flex items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-amber-300 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                <div className="gsap-tabs sticky top-2 z-20">
                    <div className="glass-panel-premium overflow-hidden rounded-[1.35rem] p-1.5">
                        <div className="relative z-10 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
                            {tabs.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            haptics.light();
                                            setActiveTab(tab.id);
                                        }}
                                        aria-label={tab.label}
                                        className={`tap-action relative flex min-h-[44px] min-w-fit items-center justify-center gap-2 rounded-[1rem] px-3.5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 active:scale-[0.97] sm:flex-1 ${
                                            isActive
                                                ? 'text-botanical-ink'
                                                : 'text-claude-secondary hover:text-claude-text'
                                        }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="adminActiveTab"
                                                className="absolute inset-0 rounded-[1rem] bg-claude-accent shadow-botanical-glow"
                                                style={{ zIndex: -1 }}
                                                initial={false}
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mt-2 hidden px-2 text-[9px] font-mono uppercase tracking-[0.22em] text-claude-secondary lg:block">
                        {activeTabMeta.hint}
                    </div>
                </div>

                <main>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {activeTab === 'overview' && (
                                <OverviewTab
                                    stats={stats}
                                    reports={reports}
                                    messages={messages}
                                    feedback={feedback}
                                    feedbackLoadError={feedbackLoadError}
                                    isOwner={isOwner}
                                />
                            )}

                            {activeTab === 'users' && (
                                <UsersTab
                                    users={users}
                                    setUsers={setUsers}
                                    onDelete={handleDeleteUser}
                                    isOwner={isOwner}
                                    onRoleChange={adminUpdateUserRole}
                                    toast={toast}
                                    haptics={haptics}
                                />
                            )}

                            {activeTab === 'reports' && (
                                <ReportsTab
                                    reports={reports}
                                    onResolve={handleResolveReport}
                                    onClose={handleCloseReport}
                                    onBan={handleBanUserFromReport}
                                    toast={toast}
                                    haptics={haptics}
                                />
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
                                    haptics={haptics}
                                />
                            )}

                            {activeTab === 'feedback' && isOwner && (
                                <FeedbackTab
                                    feedback={feedback}
                                    loadError={feedbackLoadError}
                                    onRetry={() => loadData(true)}
                                    onToggleFavorite={handleToggleFeedbackFavorite}
                                    onDelete={handleDeleteFeedback}
                                    onThank={handleThankFeedback}
                                    haptics={haptics}
                                />
                            )}

                            {activeTab === 'account' && (
                                <AccountTab
                                    user={user}
                                    isOwner={isOwner}
                                    toggleSimulateFree={toggleSimulateFree}
                                    toast={toast}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
