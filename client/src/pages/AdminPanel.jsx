import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { useGSAP } from '../hooks/useGSAP';
import { EASE, DURATION } from '../utils/animations';
import {
    BarChart3, Users, ShieldAlert, Megaphone, User,
    RefreshCw
} from 'lucide-react';

import { messageTitleSchema, messageContentSchema } from '../schemas/forms';
import OverviewTab from '../components/admin/OverviewTab';
import UsersTab from '../components/admin/UsersTab';
import ReportsTab from '../components/admin/ReportsTab';
import BroadcastsTab from '../components/admin/BroadcastsTab';
import AccountTab from '../components/admin/AccountTab';

const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'reports', label: 'Reports', icon: ShieldAlert },
    { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
    { id: 'account', label: 'Account', icon: User }
];

export default function AdminPanel() {
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const {
        isAdmin, isOwner, user,
        adminGetStats, getAllUsers, adminDeleteUser, adminUpdateUserRole,
        adminGetMessages, adminCreateMessage, adminUpdateMessage, adminDeleteMessage,
        adminGetReports, adminResolveReport, adminCloseReport, adminBanUser,
        toggleSimulateFree
    } = useAuth();

    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [showMessageForm, setShowMessageForm] = useState(false);
    const [messageForm, setMessageForm] = useState({ title: '', content: '', type: 'info' });
    const [formLoading, setFormLoading] = useState(false);

    // GSAP page-level animations
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

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
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
            toast.error('Failed to load admin data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [adminGetStats, getAllUsers, adminGetMessages, adminGetReports, toast]);

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

    // Skeleton loading state
    if (loading) {
        return (
            <div className="relative min-h-screen pb-24">
                <div className="pt-4 px-4 sm:px-6 space-y-6">
                    <div className="space-y-2">
                        <div className="h-4 w-16 bg-claude-border rounded animate-pulse" />
                        <div className="h-10 w-48 bg-claude-border rounded-xl animate-pulse" />
                    </div>
                    <div className="h-12 w-full bg-claude-border rounded-2xl animate-pulse" />
                    <div className="grid grid-cols-2 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-28 bg-claude-border rounded-2xl animate-pulse" />
                        ))}
                    </div>
                    <div className="h-64 bg-claude-border rounded-2xl animate-pulse" />
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 bg-claude-border rounded-2xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={container} className="relative min-h-screen pb-24">
            {/* Page Header — Riven standard */}
            <div className="gsap-header mb-6 pt-4 px-4 sm:px-6 flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">
                            System
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">
                        Admin Panel
                    </h1>
                </div>
                <button
                    onClick={() => {
                        haptics.light();
                        loadData(true);
                    }}
                    disabled={refreshing}
                    className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action disabled:opacity-50 flex items-center justify-center hover:-translate-y-1 hover:shadow-lg active:scale-95 focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                    aria-label="Refresh data"
                >
                    <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="gsap-tabs px-4 sm:px-6 mb-8">
                <div className="flex items-center gap-1.5 p-1.5 glass-panel rounded-2xl border border-claude-border overflow-x-auto no-scrollbar scroll-smooth">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    haptics.light();
                                    setActiveTab(tab.id);
                                }}
                                className={`relative flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest whitespace-nowrap transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 touch-target tap-action active:scale-[0.97] ${isActive
                                    ? 'text-botanical-ink'
                                    : 'text-claude-secondary hover:text-claude-text'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="adminActiveTab"
                                        className="absolute inset-0 bg-claude-accent rounded-xl shadow-botanical-glow"
                                        style={{ zIndex: -1 }}
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="px-4 sm:px-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {activeTab === 'overview' && (
                            <OverviewTab stats={stats} />
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
            </div>
        </div>
    );
}
