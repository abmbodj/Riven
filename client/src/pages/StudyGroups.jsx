import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, RefreshCw, X, Link as LinkIcon, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import * as authApi from '../api/authApi';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { useAuth } from '../hooks/useAuth';
import PricingModal from '../components/ui/PricingModal';

export default function StudyGroups() {
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [groups, setGroups] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSessions, setActiveSessions] = useState({});

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    // Form states
    const [createData, setCreateData] = useState({ name: '', class_id: '' });
    const [joinCode, setJoinCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auth & Monetization
    const { user } = useAuth();
    const [pricingOpen, setPricingOpen] = useState(false);

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [fetchedGroups, fetchedClasses] = await Promise.all([
                api.getGroups(),
                api.getClasses()
            ]);
            setGroups(fetchedGroups || []);
            setClasses(fetchedClasses || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load study groups');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Subscribe to realtime session events for all groups
    useEffect(() => {
        if (groups.length === 0) return;

        // Fetch active sessions for all groups
        const fetchAllSessions = async () => {
            const sessionMap = {};
            await Promise.all(
                groups.map(async (group) => {
                    try {
                        const sessions = await api.getGroupSessions(group.id);
                        const active = (sessions || []).filter(s => s.status === 'active');
                        if (active.length > 0) sessionMap[group.id] = active.length;
                    } catch { /* silently fail for individual groups */ }
                })
            );
            setActiveSessions(sessionMap);
        };
        fetchAllSessions();

        // Subscribe to each group's session events
        const unsubscribers = groups.map((group) =>
            authApi.subscribeToGroupSessionEvents(group.id, {
                onStarted: () => {
                    setActiveSessions(prev => ({
                        ...prev,
                        [group.id]: (prev[group.id] || 0) + 1,
                    }));
                },
                onEnded: () => {
                    setActiveSessions(prev => {
                        const newCount = (prev[group.id] || 1) - 1;
                        if (newCount <= 0) {
                            const { [group.id]: _, ...rest } = prev;
                            return rest;
                        }
                        return { ...prev, [group.id]: newCount };
                    });
                },
            })
        );

        return () => unsubscribers.forEach(unsub => unsub());
    }, [groups]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createData.name.trim() || isSubmitting) {
            if (!createData.name.trim()) toast.error('Group name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            haptics.medium();
            const newGroup = await api.createGroup(createData.name, createData.class_id || null);
            toast.success('Study Group created successfully!');
            setShowCreateModal(false);
            setCreateData({ name: '', class_id: '' });
            navigate(`/groups/${newGroup.id}`);
        } catch (err) {
            toast.error(err.message || 'Failed to create group');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim() || joinCode.length < 3 || isSubmitting) {
            if (!joinCode.trim()) toast.error('Join code is required');
            return;
        }

        setIsSubmitting(true);
        try {
            haptics.medium();
            const res = await api.joinGroup(joinCode);
            toast.success('Successfully joined group!');
            setShowJoinModal(false);
            setJoinCode('');
            navigate(`/groups/${res.group.id}`);
        } catch (err) {
            toast.error(err.message || 'Failed to join group');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 pt-4 pb-24 min-h-screen space-y-4">
                <div className="h-12 w-48 bg-claude-border rounded-xl animate-pulse mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[1, 2].map((_, idx) => (
                        <div key={idx} className="h-32 bg-claude-surface border border-claude-border rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen pb-24">
            {/* Header */}
            <div className="mb-6 pt-4 px-4 sm:px-6 flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-claude-text text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Collaborate</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Study Groups</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Action Buttons (Bento Grid Style) */}
            <div className="px-4 sm:px-6 mb-10 grid grid-cols-2 gap-4">
                <button
                    onClick={() => {
                        haptics.light();
                        // Check subscription tier for group limits
                        const tier = user?.subscription_tier || 'free';
                        // Assuming the API returns groups where the user is a member OR owner.
                        // For simplicity, let's limit total joined/owned groups to 1 for free users, 
                        // or at least creating a new group when you already have 1 group requires PRO.
                        if (tier === 'free' && groups.length >= 1) {
                            setPricingOpen(true);
                            return;
                        }
                        setShowCreateModal(true);
                    }}
                    className="group relative overflow-hidden flex flex-col items-center justify-center p-6 min-h-[140px] glass-panel rounded-3xl tap-action transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-claude-accent/40 shadow-sm hover:shadow-claude-accent/10"
                >
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                    <div className="absolute top-0 right-0 w-24 h-24 bg-claude-accent/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-claude-accent/10 transition-colors duration-500" />

                    <div className="w-12 h-12 mb-3 bg-claude-accent/10 rounded-2xl flex items-center justify-center border border-claude-accent/20 group-hover:scale-110 transition-transform duration-300 ease-out">
                        <Plus className="w-6 h-6 text-claude-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-text group-hover:text-claude-accent transition-colors">Create Group</span>
                </button>

                <button
                    onClick={() => { haptics.light(); setShowJoinModal(true); }}
                    className="group relative overflow-hidden flex flex-col items-center justify-center p-6 min-h-[140px] glass-panel rounded-3xl tap-action transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-claude-secondary/40 shadow-sm"
                >
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                    <div className="w-12 h-12 mb-3 bg-claude-surface rounded-2xl flex items-center justify-center border border-claude-border group-hover:scale-110 transition-transform duration-300 ease-out">
                        <LinkIcon className="w-6 h-6 text-claude-secondary group-hover:text-claude-text transition-colors" />
                    </div>
                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary group-hover:text-claude-text transition-colors">Join Code</span>
                </button>
            </div>

            {/* Groups List */}
            <div className="px-4 sm:px-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif italic text-xl text-claude-secondary">Your Groups</h2>
                </div>

                {groups.length === 0 ? (
                    <div className="relative overflow-hidden text-center py-20 px-6 glass-panel border-dashed border-claude-border/60 rounded-[2rem] group/empty">
                        <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-claude-accent/5 rounded-full blur-[60px] pointer-events-none" />
                        <div className="relative z-10">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6, type: 'spring' }}
                                className="w-20 h-20 mx-auto mb-6 relative"
                            >
                                <div className="absolute inset-0 bg-claude-accent/10 rounded-full blur-xl animate-pulse" />
                                <div className="w-full h-full glass-panel rounded-[1.5rem] flex items-center justify-center border border-claude-accent/20 transform -rotate-6 shadow-sm group-hover/empty:rotate-0 transition-transform duration-500">
                                    <Users className="w-8 h-8 text-claude-accent/70" />
                                </div>
                            </motion.div>
                            <h3 className="font-serif italic text-2xl text-claude-text mb-3">No Groups Found</h3>
                            <p className="text-claude-secondary text-[11px] font-mono uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed opacity-80">
                                Create a new vault or enter a Cipher code to begin collaborating.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groups.map((group, i) => {
                            // Mocking members if not returned by list API, or using real counts
                            const mockMembersCount = parseInt(group.member_count) || 1;
                            // Display up to 3 avatars visually
                            const avatarsToShow = Math.min(mockMembersCount, 3);
                            const extraMembers = mockMembersCount - 3;

                            return (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                    onClick={() => navigate(`/groups/${group.id}`)}
                                    className="glass-panel rounded-[1.5rem] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(222,185,106,0.1)] hover:border-claude-accent/30 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 cursor-pointer tap-action group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
                                >
                                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                                    {/* Subtle gradient hover effect */}
                                    <div className="absolute -right-20 -bottom-20 w-40 h-40 bg-claude-accent/5 rounded-full blur-2xl group-hover:bg-claude-accent/10 transition-colors duration-500 pointer-events-none" />

                                    <div className="flex justify-between items-start mb-4 gap-3 relative z-10">
                                        <h3 className="font-serif text-2xl font-bold text-claude-text italic group-hover:text-claude-accent transition-colors break-words line-clamp-2 leading-tight pr-8">{group.name}</h3>
                                        <div className="absolute right-0 top-0 w-8 h-8 bg-claude-bg/50 rounded-full flex items-center justify-center border border-claude-border/50 group-hover:border-claude-accent/40 group-hover:bg-claude-accent/5 transition-colors">
                                            <ArrowRight className="w-4 h-4 text-claude-secondary group-hover:text-claude-accent transition-colors transform group-hover:translate-x-0.5" />
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between relative z-10 mt-auto pt-4 border-t border-claude-border/30">
                                        <div className="flex items-center gap-2">
                                            {group.class_name ? (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-claude-surface/50 rounded-md border border-claude-border/80">
                                                    <Calendar className="w-3 h-3 text-claude-secondary" />
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-claude-secondary truncate max-w-[100px]">{group.class_name}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-claude-surface/50 rounded-md border border-claude-border/80">
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-claude-secondary">Independent</span>
                                                </div>
                                            )}
                                            {activeSessions[group.id] > 0 && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 rounded-md border border-red-500/20">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                                    </span>
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-red-500">Live</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Avatar Cluster */}
                                        <div className="flex items-center -space-x-2">
                                            {Array.from({ length: avatarsToShow }).map((_, idx) => (
                                                <div key={idx} className="w-7 h-7 rounded-full bg-claude-accent/20 border-2 border-claude-bg flex items-center justify-center overflow-hidden z-[3] relative" style={{ zIndex: 10 - idx }}>
                                                    <img
                                                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${group.id}_${idx}`}
                                                        alt="Member"
                                                        loading="lazy"
                                                        className="w-full h-full object-cover opacity-80"
                                                    />
                                                </div>
                                            ))}
                                            {extraMembers > 0 && (
                                                <div className="w-7 h-7 rounded-full bg-claude-surface border-2 border-claude-bg flex items-center justify-center z-[1] relative ml-[-12px]">
                                                    <span className="text-[8px] font-mono font-bold text-claude-secondary">+{extraMembers}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/60 md:backdrop-blur-sm" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onSubmit={handleCreate}
                            className="relative bg-claude-surface w-full max-w-lg p-8 rounded-t-[2.5rem] sm:rounded-3xl border border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-3xl font-serif italic font-bold text-claude-text">Create Group</h3>
                                    <p className="text-claude-secondary font-mono text-[10px] uppercase tracking-widest mt-1">Start a new study group</p>
                                </div>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-claude-secondary hover:text-white transition-colors border border-claude-border">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-claude-accent font-bold mb-2 ml-1">Group Name</label>
                                    <input
                                        type="text"
                                        value={createData.name}
                                        onChange={e => setCreateData({ ...createData, name: e.target.value })}
                                        className="w-full glass-panel border-claude-border/80 rounded-2xl px-5 py-4 font-serif text-xl italic text-claude-text focus:border-claude-accent/50 outline-none transition-colors placeholder:text-claude-secondary/40 placeholder:not-italic"
                                        placeholder="e.g. Origins of Life"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-claude-accent font-bold mb-2 ml-1">Class (Optional)</label>
                                    <div className="relative">
                                        <select
                                            value={createData.class_id}
                                            onChange={e => setCreateData({ ...createData, class_id: e.target.value })}
                                            className="w-full glass-panel border-claude-border/80 rounded-2xl px-5 py-4 font-mono text-sm text-claude-text focus:border-claude-accent/50 outline-none appearance-none transition-colors"
                                        >
                                            <option value="">Independent Study</option>
                                            {classes.map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-10 py-4 bg-claude-accent rounded-2xl text-claude-text font-mono font-bold uppercase tracking-[0.2em] hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action shadow-[0_0_20px_rgba(222,185,106,0.15)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isSubmitting ? <span className="w-5 h-5 border-2 border-claude-text border-t-transparent rounded-full animate-spin" /> : 'Create Vault'}
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            {/* Join Modal */}
            <AnimatePresence>
                {showJoinModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setShowJoinModal(false)} className="absolute inset-0 bg-black/60 md:backdrop-blur-sm" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onSubmit={handleJoin}
                            className="relative bg-claude-surface w-full max-w-lg p-8 rounded-t-[2.5rem] sm:rounded-3xl border border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-3xl font-serif italic font-bold text-claude-text">Join Group</h3>
                                    <p className="text-claude-secondary font-mono text-[10px] uppercase tracking-widest mt-1">Enter an invite code to join</p>
                                </div>
                                <button type="button" onClick={() => setShowJoinModal(false)} className="w-10 h-10 glass-panel rounded-full flex items-center justify-center text-claude-secondary hover:text-white transition-colors border border-claude-border">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-claude-accent font-bold mb-2 ml-1">Invite Code</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={joinCode}
                                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                            className="w-full glass-panel border-claude-border/80 rounded-2xl px-5 py-5 font-mono text-center text-2xl tracking-[0.3em] text-claude-text focus:border-claude-accent/50 outline-none uppercase placeholder:lowercase placeholder:tracking-normal placeholder:text-xl placeholder:text-claude-secondary/30 transition-colors"
                                            placeholder="RIV-XYZ"
                                            maxLength={7}
                                            autoFocus
                                        />
                                        {joinCode.length > 0 && joinCode.length < 3 && (
                                            <span className="absolute -bottom-5 right-2 text-[9px] font-mono text-red-400 uppercase tracking-widest">Too short</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!joinCode.trim() || joinCode.length < 3 || isSubmitting}
                                className="w-full mt-10 py-4 bg-claude-accent rounded-2xl text-claude-text font-mono font-bold uppercase tracking-[0.2em] hover:bg-opacity-90 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] tap-action shadow-[0_0_20px_rgba(222,185,106,0.15)] disabled:opacity-30 disabled:shadow-none disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isSubmitting ? <span className="w-5 h-5 border-2 border-claude-text border-t-transparent rounded-full animate-spin" /> : 'Join Vault'}
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            <PricingModal
                isOpen={pricingOpen}
                onClose={() => setPricingOpen(false)}
                currentTier={user?.subscription_tier || 'free'}
            />
        </div>
    );
}
