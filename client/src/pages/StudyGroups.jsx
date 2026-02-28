import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, RefreshCw, X, Link as LinkIcon, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';

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
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-claude-border rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-all tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="px-4 sm:px-6 mb-8 grid grid-cols-2 gap-4">
                <button
                    onClick={() => { haptics.light(); setShowCreateModal(true); }}
                    className="flex flex-col items-center justify-center py-6 px-4 bg-claude-accent/10 border border-claude-accent/30 rounded-2xl text-claude-accent hover:bg-claude-accent/20 transition-all tap-action group"
                >
                    <Plus className="w-8 h-8 mb-2 opacity-80 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#162a31]">Create Group</span>
                </button>
                <button
                    onClick={() => { haptics.light(); setShowJoinModal(true); }}
                    className="flex flex-col items-center justify-center py-6 px-4 bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-claude-border rounded-2xl text-botanical-parchment hover:border-claude-accent/30 transition-all tap-action group"
                >
                    <LinkIcon className="w-8 h-8 mb-2 opacity-60 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary">Join via Code</span>
                </button>
            </div>

            {/* Groups List */}
            <div className="px-4 sm:px-6">
                {groups.length === 0 ? (
                    <div className="text-center py-16 bg-[color-mix(in_srgb,var(--surface-color)_10%,transparent)] border-2 border-dashed border-[color-mix(in_srgb,var(--border-color)_20%,transparent)] rounded-3xl">
                        <Users className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                        <h3 className="font-serif italic text-xl text-botanical-parchment opacity-40">No Study Groups</h3>
                        <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Create or join a group to collaborate.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groups.map((group, i) => (
                            <motion.div
                                key={group.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => navigate(`/groups/${group.id}`)}
                                className="bg-[#fcfaf2] border border-[#d1c9b8] rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer tap-action group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-serif text-2xl font-bold text-[#1a1c1d] italic group-hover:text-claude-accent transition-colors truncate">{group.name}</h3>
                                    <ArrowRight className="w-5 h-5 text-claude-secondary opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                                </div>

                                <div className="flex flex-col gap-2 mt-4">
                                    {group.class_name && (
                                        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5d6466] truncate">
                                            <Calendar className="w-3.5 h-3.5 opacity-60 shrink-0" />
                                            <span className="truncate">{group.class_name}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5d6466] truncate mt-1">
                                        <Users className="w-3.5 h-3.5 opacity-60 shrink-0" />
                                        <span className="truncate">{parseInt(group.member_count) || 1} Members</span>
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
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleCreate}
                            className="relative bg-claude-bg w-full max-w-lg p-8 rounded-t-[3rem] sm:rounded-[3rem] border border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">Create Group</h3>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 text-claude-secondary hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Group Name</label>
                                    <input
                                        type="text"
                                        value={createData.name}
                                        onChange={e => setCreateData({ ...createData, name: e.target.value })}
                                        className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none"
                                        placeholder="e.g. Bio 101 Squad"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Class (Optional)</label>
                                    <div className="relative">
                                        <select
                                            value={createData.class_id}
                                            onChange={e => setCreateData({ ...createData, class_id: e.target.value })}
                                            className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-sm text-botanical-parchment focus:border-claude-accent/50 outline-none appearance-none"
                                        >
                                            <option value="">No Class</option>
                                            {classes.map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full mt-8 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-lg shadow-claude-accent/20"
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
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJoinModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleJoin}
                            className="relative bg-claude-bg w-full max-w-lg p-8 rounded-t-[3rem] sm:rounded-[3rem] border border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">Join Group</h3>
                                <button type="button" onClick={() => setShowJoinModal(false)} className="p-2 text-claude-secondary hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#7a9e72] font-bold mb-2 ml-1">Join Code</label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                        className="w-full bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] rounded-2xl px-5 py-4 font-mono text-center text-xl tracking-[0.2em] text-botanical-parchment focus:border-claude-accent/50 outline-none uppercase placeholder:lowercase placeholder:tracking-normal"
                                        placeholder="e.g. RIV-XYZ"
                                        autoFocus
                                    />
                                    <p className="text-center font-mono text-[9px] text-claude-secondary mt-3">Ask your group admin for the 6-character code.</p>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!joinCode.trim()}
                                className="w-full mt-6 py-4 bg-claude-accent rounded-2xl text-[#162a31] font-mono font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all active:scale-[0.98] tap-action shadow-lg shadow-claude-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Join
                            </button>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
