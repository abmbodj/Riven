import React, { useState, useEffect, useCallback } from 'react';
import { UserMinus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../../hooks/useToast';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';

export default function SafetySection() {
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unblockingId, setUnblockingId] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const toast = useToast();

    const fetchBlockedUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { getBlockedUsers } = await import('../../../api/authApi');
            const data = await getBlockedUsers();
            setBlockedUsers(data || []);
        } catch (err) {
            console.error('Failed to load blocked users', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchBlockedUsers();
        }
    }, [isOpen, fetchBlockedUsers]);

    const handleUnblock = async (userId) => {
        setUnblockingId(userId);
        try {
            const { unblockUser } = await import('../../../api/authApi');
            await unblockUser(userId);
            setBlockedUsers(prev => prev.filter(u => u.id !== userId));
            toast.success('User unblocked successfully.');
        } catch (err) {
            toast.error(err.message || 'Failed to unblock user.');
        } finally {
            setUnblockingId(null);
        }
    };

    return (
        <div>
            <SectionHeader
                eyebrow="Privacy"
                title="Safety controls"
                description="Review blocked accounts and manage who can reach you."
            />
            <SectionCard className="overflow-hidden transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full py-4 px-5 flex items-center gap-4 active:bg-claude-surface/40 transition-colors group"
                >
                    <div className="p-2.5 rounded-xl bg-claude-bg text-claude-text/70 shadow-sm border border-claude-border/50 group-hover:scale-110 transition-transform duration-300">
                        <UserMinus className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left z-10">
                        <p className="font-display text-[16px] tracking-wide font-medium text-claude-text group-hover:text-claude-accent transition-colors">
                            Blocked Users
                        </p>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            Manage who you've blocked
                        </p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-claude-secondary/30 transition-transform duration-300 ${isOpen ? 'rotate-90 text-claude-accent' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-claude-bg/30 border-t border-claude-border/30 overflow-hidden"
                        >
                            <div className="p-4 space-y-3">
                                {loading ? (
                                    <div className="text-center py-6 text-sm py-4 text-claude-secondary font-mono animate-pulse">
                                        Loading...
                                    </div>
                                ) : blockedUsers.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-claude-secondary italic font-body">
                                        You haven't blocked anyone.
                                    </div>
                                ) : (
                                    blockedUsers.map(u => (
                                        <div key={u.id} className="flex flex-col items-start gap-3 rounded-xl border border-claude-border/50 bg-claude-bg p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-claude-text">{u.username}</p>
                                                <p className="text-[10px] text-claude-secondary font-mono tracking-wider mt-0.5">
                                                    Blocked {new Date(u.blocked_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUnblock(u.id)}
                                                disabled={unblockingId === u.id}
                                                className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-xs font-bold text-claude-text transition-colors hover:bg-claude-surface/80 disabled:opacity-50 sm:w-auto sm:px-3 sm:py-1.5 touch-target tap-action native-press"
                                            >
                                                {unblockingId === u.id ? 'Unblocking...' : 'Unblock'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SectionCard>
        </div>
    );
}
