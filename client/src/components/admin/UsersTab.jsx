import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
    ChevronLeft,
    ChevronRight,
    Crown,
    Search,
    Shield,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Users,
} from 'lucide-react';

const ROLE_STYLES = {
    owner: { label: 'Owner', cls: 'bg-claude-accent/15 text-claude-accent border border-claude-accent/25', icon: Crown },
    admin: { label: 'Admin', cls: 'bg-botanical-forest/15 text-botanical-forest border border-botanical-forest/25', icon: Shield },
    friends: { label: 'Friend', cls: 'bg-purple-500/15 text-purple-300 border border-purple-500/25', icon: Sparkles },
    user: { label: 'User', cls: 'bg-claude-secondary/10 text-claude-secondary border border-claude-border/70', icon: Users },
};

const ROLE_FILTERS = [
    { id: 'all', label: 'All roles' },
    { id: 'owner', label: 'Owners' },
    { id: 'admin', label: 'Admins' },
    { id: 'friends', label: 'Friends' },
    { id: 'user', label: 'Users' },
];

const TIER_FILTERS = [
    { id: 'all', label: 'All tiers' },
    { id: 'free', label: 'Free' },
    { id: 'supporter', label: 'Supporter' },
    { id: 'lifetime', label: 'Lifetime' },
];

const itemsPerPage = 20;

const normalizeRole = (user) => user.role || (user.isAdmin ? 'admin' : 'user');

const formatDate = (value) => {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

function FilterButton({ active, label, count, onClick }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={`tap-action inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${
                active
                    ? 'bg-claude-accent text-botanical-ink shadow-botanical-glow'
                    : 'border border-white/10 bg-claude-bg/35 text-claude-secondary hover:text-claude-text'
            }`}
        >
            {label}
            {typeof count === 'number' && (
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${
                    active ? 'bg-botanical-ink/15 text-botanical-ink' : 'bg-white/5 text-claude-secondary'
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function RoleBadge({ role }) {
    const badge = ROLE_STYLES[role] || ROLE_STYLES.user;
    const Icon = badge.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${badge.cls}`}>
            <Icon className="h-3 w-3" />
            {badge.label}
        </span>
    );
}

function TierBadge({ tier }) {
    const tierValue = tier || 'free';
    const className = tierValue === 'lifetime'
        ? 'border-claude-accent/25 bg-claude-accent/12 text-claude-accent'
        : tierValue === 'supporter'
            ? 'border-botanical-forest/25 bg-botanical-forest/12 text-botanical-forest'
            : 'border-white/10 bg-claude-bg/35 text-claude-secondary';

    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${className}`}>
            {tierValue}
        </span>
    );
}

export default function UsersTab({ users, setUsers, onDelete, isOwner, onRoleChange, toast, haptics }) {
    const [changingRole, setChangingRole] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [tierFilter, setTierFilter] = useState('all');

    const roleCounts = useMemo(() => users.reduce((acc, user) => {
        const role = normalizeRole(user);
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, { all: users.length }), [users]);

    const filteredUsers = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        return users.filter((user) => {
            const role = normalizeRole(user);
            const tier = user.subscriptionTier || user.subscription_tier || 'free';
            const matchesSearch = !lower
                || (user.username && user.username.toLowerCase().includes(lower))
                || (user.email && user.email.toLowerCase().includes(lower))
                || String(user.shareCode || '').toLowerCase().includes(lower);
            const matchesRole = roleFilter === 'all' || role === roleFilter;
            const matchesTier = tierFilter === 'all' || tier === tierFilter;
            return matchesSearch && matchesRole && matchesTier;
        });
    }, [roleFilter, searchTerm, tierFilter, users]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, tierFilter]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

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
        <div className="space-y-5">
            <section className="glass-panel-premium rounded-[1.6rem] p-4">
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <label className="relative flex-1">
                            <span className="sr-only">Search users</span>
                            <input
                                type="text"
                                placeholder="Search users, email, or share code..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-claude-bg/45 py-3 pl-11 pr-4 text-sm text-claude-text placeholder-claude-secondary/45 transition-colors focus:outline-none focus:border-claude-accent/50 focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                            />
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-claude-secondary" />
                        </label>

                        <div className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-claude-bg/45 px-4 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            <SlidersHorizontal className="h-4 w-4 text-claude-accent" />
                            {filteredUsers.length} shown
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {ROLE_FILTERS.map((filter) => (
                                <FilterButton
                                    key={filter.id}
                                    active={roleFilter === filter.id}
                                    label={filter.label}
                                    count={roleCounts[filter.id] || 0}
                                    onClick={() => {
                                        haptics?.light();
                                        setRoleFilter(filter.id);
                                    }}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {TIER_FILTERS.map((filter) => (
                                <FilterButton
                                    key={filter.id}
                                    active={tierFilter === filter.id}
                                    label={filter.label}
                                    onClick={() => {
                                        haptics?.light();
                                        setTierFilter(filter.id);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="glass-panel-premium overflow-hidden rounded-[1.75rem]">
                <div className="relative z-10 hidden border-b border-white/10 px-4 py-3 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary md:grid md:grid-cols-[minmax(0,1.4fr)_120px_120px_120px_minmax(220px,auto)] md:items-center md:gap-4">
                    <span>User</span>
                    <span>Role</span>
                    <span>Tier</span>
                    <span>Joined</span>
                    <span className="text-right">Actions</span>
                </div>

                {paginatedUsers.length === 0 ? (
                    <div className="relative z-10 px-6 py-16 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                            <Users className="h-6 w-6 text-claude-secondary" />
                        </div>
                        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary">
                            No users found
                        </p>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-claude-secondary/75">
                            Adjust search or filters to widen the directory.
                        </p>
                    </div>
                ) : (
                    <div className="relative z-10 divide-y divide-white/10">
                        {paginatedUsers.map((user, index) => {
                            const role = normalizeRole(user);
                            const tier = user.subscriptionTier || user.subscription_tier || 'free';
                            const initial = user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
                            const canChangeRole = isOwner && role !== 'owner';
                            const canDelete = role !== 'owner' && (isOwner || role !== 'admin');

                            return (
                                <motion.article
                                    key={user.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                    className="p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-white/[0.03]"
                                >
                                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_120px_120px_120px_minmax(220px,auto)] md:items-center">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/50 text-sm font-serif font-bold italic text-claude-accent">
                                                {initial}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="truncate text-sm font-semibold text-claude-text">{user.username || 'Unnamed user'}</h4>
                                                <p className="truncate text-[11px] font-mono text-claude-secondary">{user.email || 'No email'}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <RoleBadge role={role} />
                                        </div>

                                        <div>
                                            <TierBadge tier={tier} />
                                        </div>

                                        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                                            {formatDate(user.createdAt)}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                            {canChangeRole && (
                                                <button
                                                    disabled={changingRole === user.id}
                                                    onClick={() => {
                                                        haptics?.light();
                                                        handleRoleChange(user.id, role === 'admin' ? 'user' : 'admin');
                                                    }}
                                                    className={`tap-action min-h-[36px] rounded-xl px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] disabled:opacity-50 ${
                                                        role === 'admin'
                                                            ? 'border border-claude-accent/20 bg-claude-accent/10 text-claude-accent'
                                                            : 'border border-botanical-forest/20 bg-botanical-forest/10 text-botanical-forest'
                                                    }`}
                                                >
                                                    {changingRole === user.id ? '...' : role === 'admin' ? 'Demote' : 'Promote'}
                                                </button>
                                            )}

                                            {canChangeRole && role !== 'admin' && (
                                                <button
                                                    disabled={changingRole === user.id}
                                                    onClick={() => {
                                                        haptics?.light();
                                                        handleRoleChange(user.id, role === 'friends' ? 'user' : 'friends');
                                                    }}
                                                    className={`tap-action min-h-[36px] rounded-xl border border-purple-500/20 px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] disabled:opacity-50 ${
                                                        role === 'friends'
                                                            ? 'bg-purple-500/15 text-purple-300'
                                                            : 'bg-purple-500/10 text-purple-300/70'
                                                    }`}
                                                >
                                                    {changingRole === user.id ? '...' : role === 'friends' ? 'Unfriend' : 'Friend'}
                                                </button>
                                            )}

                                            {canDelete ? (
                                                <button
                                                    onClick={() => {
                                                        haptics?.medium();
                                                        onDelete(user.id, user.username);
                                                    }}
                                                    className="tap-action inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-red-400 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-red-500/15 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                                    aria-label={`Delete ${user.username || 'user'}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </button>
                                            ) : (
                                                <span className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-white/10 bg-claude-bg/35 px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                    Protected
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                )}
            </section>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary">
                        Page <span className="font-bold text-claude-text">{currentPage}</span> of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="tap-action rounded-xl border border-white/10 bg-claude-bg/45 p-2.5 text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-30"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="tap-action rounded-xl border border-white/10 bg-claude-bg/45 p-2.5 text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-30"
                            aria-label="Next page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
