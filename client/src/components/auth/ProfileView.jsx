import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    LogOut, Edit3, Settings, User, Mail,
    MessageCircle, Users, ChevronRight, Leaf, Shield
} from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import Avatar from '../Avatar';
import LoadingSpinner from '../LoadingSpinner';
import * as authApi from '../../api/authApi';

const ProfileView = () => {
    const { user, isOwner, isAdmin, signOut } = useAuth();
    const toast = useToast();
    const haptics = useHaptics();

    // Stats State
    const [stats, setStats] = useState({ friends: 0, unread: 0, loading: true });

    // Load Stats
    useEffect(() => {
        let mounted = true;
        const loadStats = async () => {
            try {
                const [friends, unread] = await Promise.all([
                    authApi.getFriends().catch(() => []),
                    authApi.getUnreadCount().catch(() => ({ count: 0 }))
                ]);
                if (mounted) {
                    setStats({
                        friends: Array.isArray(friends) ? friends.filter(f => f.status === 'accepted').length : 0,
                        unread: unread.count || 0,
                        loading: false
                    });
                }
            } catch (err) {
                console.warn('Failed to load stats', err);
                if (mounted) setStats(prev => ({ ...prev, loading: false }));
            }
        };
        loadStats();
        return () => { mounted = false; };
    }, []);

    const handleSignOut = () => {
        haptics.medium();
        toast.success('Signed out');
        signOut();
    };

    if (!user) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-claude-bg pb-24 animate-in fade-in duration-300">
            {/* Profile Header */}
            <div className="relative mb-6">
                {/* Atmospheric Deep Header */}
                <div className="h-40 overflow-hidden relative rounded-b-[3rem]">
                    <div className="absolute inset-0 bg-[#0f2026] rounded-b-[3rem]"></div>
                    <div className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.1),transparent_60%)] blur-3xl rounded-b-[3rem]" />
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>

                    <Leaf className="absolute -bottom-8 -right-8 w-40 h-40 text-botanical-forest/5 rotate-12" />
                    <Leaf className="absolute -top-4 -left-6 w-32 h-32 text-botanical-forest/5 -rotate-12 opacity-40" />
                </div>

                {/* Avatar */}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="relative"
                    >
                        <Avatar src={user?.avatar} size="3xl" className="border-4 border-claude-bg shadow-xl" />
                        {isAdmin && (
                            <div className={`absolute -bottom-1 -right-1 w-8 h-8 ${isOwner ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-red-500 to-orange-500'} rounded-full flex items-center justify-center border-2 border-claude-bg shadow-sm`}>
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* User Info */}
            <div className="text-center mt-14 mb-8 px-4">
                <h1 className="text-2xl font-display font-bold text-claude-text mb-1">
                    {user?.username}
                </h1>
                <p className="text-botanical-sepia text-sm font-mono mb-3">{user?.email}</p>
                {user?.bio && (
                    <p className="text-sm text-claude-secondary max-w-xs mx-auto italic">
                        "{user.bio}"
                    </p>
                )}
            </div>

            {/* Stats / Quick Actions */}
            <div className="grid grid-cols-2 gap-4 px-4 mb-8 max-w-md mx-auto">
                <Link
                    to="/friends"
                    className="botanical-card p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform group"
                    onClick={() => haptics.light()}
                >
                    <div className="w-10 h-10 rounded-full bg-botanical-forest/10 flex items-center justify-center group-hover:bg-botanical-forest/20 transition-colors">
                        <Users className="w-5 h-5 text-botanical-forest" />
                    </div>
                    <div className="text-center">
                        <span className="block text-xl font-display font-bold text-claude-text">
                            {stats.loading ? '-' : stats.friends}
                        </span>
                        <span className="text-xs font-mono uppercase tracking-wider text-botanical-sepia">
                            Friends
                        </span>
                    </div>
                </Link>

                <Link
                    to="/messages"
                    className="botanical-card p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform group"
                    onClick={() => haptics.light()}
                >
                    <div className="w-10 h-10 rounded-full bg-botanical-forest/10 flex items-center justify-center group-hover:bg-botanical-forest/20 transition-colors relative">
                        <MessageCircle className="w-5 h-5 text-botanical-forest" />
                        {!stats.loading && stats.unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-claude-bg">
                                {stats.unread}
                            </span>
                        )}
                    </div>
                    <div className="text-center">
                        <span className="block text-xl font-display font-bold text-claude-text">
                            {stats.loading ? '-' : stats.unread}
                        </span>
                        <span className="text-xs font-mono uppercase tracking-wider text-botanical-sepia">
                            Messages
                        </span>
                    </div>
                </Link>
            </div>

            {/* Menu List */}
            <div className="px-4 max-w-md mx-auto space-y-3">
                {(isAdmin || isOwner) && (
                    <Link
                        to="/admin"
                        className="botanical-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all group border-amber-500/20"
                        onClick={() => haptics.light()}
                    >
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-medium text-claude-text">Admin Panel</p>
                            <p className="text-xs text-botanical-sepia">Manage users and content</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-claude-border group-hover:text-claude-secondary transition-colors" />
                    </Link>
                )}
                <Link
                    to="/edit-profile"
                    className="botanical-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all group"
                    onClick={() => haptics.light()}
                >
                    <div className="p-2 bg-claude-surface rounded-lg">
                        <Edit3 className="w-5 h-5 text-claude-secondary" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium text-claude-text">Edit Profile</p>
                        <p className="text-xs text-botanical-sepia">Update your avatar and bio</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-claude-border group-hover:text-claude-secondary transition-colors" />
                </Link>

                <Link
                    to="/settings"
                    className="botanical-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all group"
                    onClick={() => haptics.light()}
                >
                    <div className="p-2 bg-claude-surface rounded-lg">
                        <Settings className="w-5 h-5 text-claude-secondary" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium text-claude-text">Settings</p>
                        <p className="text-xs text-botanical-sepia">Security, notifications, and more</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-claude-border group-hover:text-claude-secondary transition-colors" />
                </Link>

                <button
                    onClick={handleSignOut}
                    className="w-full botanical-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all group mt-6 border-red-500/20"
                >
                    <div className="p-2 bg-red-500/10 rounded-lg">
                        <LogOut className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-medium text-red-500">Sign Out</p>
                    </div>
                </button>
            </div>

            <div className="mt-8 text-center text-xs text-botanical-sepia/50 font-mono">
                Riven v1.0.0
            </div>
        </div>
    );
};

export default ProfileView;
