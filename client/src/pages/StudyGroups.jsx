import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, RefreshCw, X, Link as LinkIcon, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
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

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    // Form states
    const [createData, setCreateData] = useState({ name: '', class_id: '' });
    const [joinCode, setJoinCode] = useState('');

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

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createData.name.trim()) {
            toast.error('Group name is required');
            return;
        }

        try {
            haptics.medium();
            const newGroup = await api.createGroup(createData.name, createData.class_id || null);
            toast.success('Study Group created successfully!');
            setShowCreateModal(false);
            setCreateData({ name: '', class_id: '' });
            navigate(`/groups/${newGroup.id}`);
        } catch (err) {
            toast.error(err.message || 'Failed to create group');
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim()) {
            toast.error('Join code is required');
            return;
        }

        try {
            haptics.medium();
            const res = await api.joinGroup(joinCode);
            toast.success('Successfully joined group!');
            setShowJoinModal(false);
            setJoinCode('');
            navigate(`/groups/${res.group.id}`);
        } catch (err) {
            toast.error(err.message || 'Failed to join group');
        }
    };

    if (loading) {
        return (
            <div className="p-6 pt-4 pb-24 min-h-screen space-y-4">
                <div className="h-12 w-48 bg-claude-border rounded-xl animate-pulse mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[1, 2].map((_, idx) => (
                        <div key={idx} className="h-32 bg-[#fcfaf2] border border-[#d1c9b8] rounded-xl animate-pulse" />
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
                        <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Collaborate</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold italic text-botanical-parchment tracking-tighter leading-none">Study Groups</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-all tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
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
                    className="group relative overflow-hidden flex flex-col items-center justify-center p-6 min-h-[140px] glass-panel rounded-3xl tap-action transition-all duration-300 hover:-translate-y-1 hover:border-claude-accent/40 shadow-sm hover:shadow-claude-accent/10"
                >
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                    <div className="absolute top-0 right-0 w-24 h-24 bg-claude-accent/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-claude-accent/10 transition-colors duration-500" />

                    <div className="w-12 h-12 mb-3 bg-claude-accent/10 rounded-2xl flex items-center justify-center border border-claude-accent/20 group-hover:scale-110 transition-transform duration-300 ease-out">
                        <Plus className="w-6 h-6 text-claude-accent" />
                    </div>
                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-text group-hover:text-claude-accent transition-colors">Create Group</span>
                </button>

                <button
                    onClick={() => { haptics.light(); setShowJoinModal(true); }}
                    className="group relative overflow-hidden flex flex-col items-center justify-center p-6 min-h-[140px] glass-panel rounded-3xl tap-action transition-all duration-300 hover:-translate-y-1 hover:border-claude-secondary/40 shadow-sm"
                >
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

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
                    <div className="relative overflow-hidden text-center py-20 px-6 glass-panel border-dashed border-claude-border/50 rounded-3xl">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-claude-bg/50 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 mx-auto mb-5 glass-panel rounded-2xl flex items-center justify-center border border-claude-border transform -rotate-6">
                                <Users className="w-8 h-8 text-claude-accent opacity-40" />
                            </div>
                            <h3 className="font-serif italic text-2xl text-claude-text mb-2">No groups yet</h3>
                            <p className="text-claude-secondary text-[11px] font-mono uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                                Create or join a group to start studying together.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groups.map((group, i) => (
                            <motion.div
                                key={group.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                onClick={() => navigate(`/groups/${group.id}`)}
                                className="glass-panel rounded-[1.5rem] p-6 shadow-sm hover:shadow-claude-accent/5 transition-all duration-300 cursor-pointer tap-action group relative overflow-hidden hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                                <div className="flex justify-between items-start mb-6 gap-3 relative z-10">
                                    <h3 className="font-serif text-2xl font-bold text-claude-text italic group-hover:text-claude-accent transition-colors break-words line-clamp-2 leading-tight pr-8">{group.name}</h3>
                                    <div className="absolute right-0 top-1 w-8 h-8 glass-panel rounded-full flex items-center justify-center border border-claude-border group-hover:border-claude-accent/30 transition-colors">
                                        <ArrowRight className="w-4 h-4 text-claude-secondary group-hover:text-claude-accent transition-colors transform group-hover:translate-x-0.5" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 relative z-10">
                                    {group.class_name ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 glass-panel rounded-lg border border-claude-border">
                                            <Calendar className="w-3 h-3 text-claude-secondary" />
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-claude-secondary truncate max-w-[100px]">{group.class_name}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 glass-panel rounded-lg border border-claude-border">
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-claude-secondary">Independent</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-accent/5 rounded-lg border border-claude-accent/20">
                                        <Users className="w-3 h-3 text-claude-accent" />
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-claude-accent">{parseInt(group.member_count) || 1}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
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
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-botanical-forest font-bold mb-2 ml-1">Group Name</label>
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
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-botanical-forest font-bold mb-2 ml-1">Class (Optional)</label>
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
                                className="w-full mt-10 py-4 bg-claude-accent rounded-2xl text-botanical-ink font-mono font-bold uppercase tracking-[0.2em] hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-[0_0_20px_rgba(222,185,106,0.15)]"
                            >
                                Create
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            {/* Join Modal */}
            <AnimatePresence>
                {showJoinModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setShowJoinModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
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
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-botanical-forest font-bold mb-2 ml-1">Invite Code</label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                        className="w-full glass-panel border-claude-border/80 rounded-2xl px-5 py-5 font-mono text-center text-2xl tracking-[0.3em] text-claude-text focus:border-claude-accent/50 outline-none uppercase placeholder:lowercase placeholder:tracking-normal placeholder:text-xl placeholder:text-claude-secondary/30 transition-colors"
                                        placeholder="RIV-XYZ"
                                        maxLength={7}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!joinCode.trim() || joinCode.length < 3}
                                className="w-full mt-10 py-4 bg-claude-accent rounded-2xl text-botanical-ink font-mono font-bold uppercase tracking-[0.2em] hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-[0_0_20px_rgba(222,185,106,0.15)] disabled:opacity-30 disabled:shadow-none disabled:active:scale-100 disabled:cursor-not-allowed"
                            >
                                Join
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
