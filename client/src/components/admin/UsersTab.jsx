import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ROLE_STYLES = {
    owner: { label: 'OWNER', cls: 'bg-claude-accent/15 text-claude-accent border border-claude-accent/20' },
    admin: { label: 'ADMIN', cls: 'bg-botanical-forest/15 text-botanical-forest border border-botanical-forest/20' },
    friends: { label: 'FRIEND', cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/20' },
    user: { label: 'USER', cls: 'bg-claude-secondary/10 text-claude-secondary border border-claude-border' }
};

export default function UsersTab({ users, setUsers, onDelete, isOwner, onRoleChange, toast, haptics }) {
    const [changingRole, setChangingRole] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const itemsPerPage = 20;

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const lower = searchTerm.toLowerCase();
        return users.filter(u =>
            (u.username && u.username.toLowerCase().includes(lower)) ||
            (u.email && u.email.toLowerCase().includes(lower))
        );
    }, [users, searchTerm]);

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleRoleChange = async (userId, newRole) => {
        setChangingRole(userId);
        try {
            await onRoleChange(userId, newRole);
            setUsers(prev => prev.map(u => u.id === userId ? {
                ...u,
                role: newRole,
                isAdmin: newRole === 'admin',
                isOwner: false,
                subscriptionTier: newRole === 'friends' ? 'lifetime' : (u.role === 'friends' ? 'free' : u.subscriptionTier)
            } : u));
        } catch (err) {
            const errorMessage = err?.message || 'Failed to change role';
            toast.error(errorMessage);
        } finally {
            setChangingRole(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search Header */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-claude-bg/60 border border-claude-border rounded-2xl text-sm text-claude-text placeholder-claude-secondary/40 focus:outline-none focus:border-claude-accent/50 focus-visible:ring-2 focus-visible:ring-claude-accent/60 transition-colors"
                    />
                    <Search className="w-4 h-4 text-claude-secondary absolute left-3.5 top-3.5" />
                </div>
                <div className="px-3 py-2.5 glass-panel rounded-2xl border border-claude-border text-[9px] font-mono font-bold uppercase tracking-widest text-claude-secondary shrink-0">
                    {filteredUsers.length} Users
                </div>
            </div>

            {/* User List */}
            <div className="glass-panel rounded-2xl border border-claude-border overflow-hidden">
                {paginatedUsers.length === 0 ? (
                    <div className="relative overflow-hidden text-center py-16 px-6">
                        <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                        <div className="relative z-10">
                            <Users className="w-8 h-8 text-claude-border mx-auto mb-3" />
                            <p className="text-claude-secondary text-[11px] font-mono uppercase tracking-widest">
                                No users found
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-claude-border/30">
                        {paginatedUsers.map(u => {
                            const role = u.role || (u.isAdmin ? 'admin' : 'user');
                            const badge = ROLE_STYLES[role] || ROLE_STYLES.user;

                            return (
                                <div
                                    key={u.id}
                                    className="p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:bg-claude-surface/20 tap-action"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-claude-bg/60 border border-claude-border flex items-center justify-center text-sm font-serif font-bold italic text-claude-accent shrink-0">
                                                {u.username?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-medium text-claude-text truncate">{u.username}</h4>
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest shrink-0 ${badge.cls}`}>
                                                        {badge.label}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-claude-secondary truncate font-mono">{u.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isOwner && role !== 'owner' && (
                                                <button
                                                    disabled={changingRole === u.id}
                                                    onClick={() => {
                                                        haptics.light();
                                                        handleRoleChange(u.id, role === 'admin' ? 'user' : 'admin');
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97] ${role === 'admin'
                                                        ? 'bg-claude-accent/10 text-claude-accent'
                                                        : 'bg-botanical-forest/10 text-botanical-forest'
                                                    }`}
                                                >
                                                    {changingRole === u.id ? '...' : role === 'admin' ? 'Demote' : 'Promote'}
                                                </button>
                                            )}
                                            {isOwner && role !== 'owner' && role !== 'admin' && (
                                                <button
                                                    disabled={changingRole === u.id}
                                                    onClick={() => {
                                                        haptics.light();
                                                        handleRoleChange(u.id, role === 'friends' ? 'user' : 'friends');
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97] ${role === 'friends'
                                                        ? 'bg-purple-500/10 text-purple-400'
                                                        : 'bg-purple-500/10 text-purple-400/50'
                                                    }`}
                                                >
                                                    {changingRole === u.id ? '...' : role === 'friends' ? 'Unfriend' : 'Friend'}
                                                </button>
                                            )}
                                            {role !== 'owner' && (
                                                <button
                                                    onClick={() => {
                                                        haptics.medium();
                                                        onDelete(u.id, u.username);
                                                    }}
                                                    className="p-2 rounded-lg text-claude-secondary/40 hover:text-red-400 hover:bg-red-400/5 active:scale-[0.97] transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                                    aria-label={`Delete ${u.username}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-[9px] text-claude-secondary font-mono uppercase tracking-widest">
                        Page <span className="text-claude-text font-bold">{currentPage}</span> of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2.5 rounded-xl glass-panel border border-claude-border text-claude-text disabled:opacity-30 transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97] hover:-translate-y-0.5"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2.5 rounded-xl glass-panel border border-claude-border text-claude-text disabled:opacity-30 transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97] hover:-translate-y-0.5"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
