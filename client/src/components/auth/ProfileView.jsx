import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    LogOut, Edit3, Settings, User, Mail,
    MessageCircle, Users, ChevronRight, Leaf, Shield, Crown, Sparkles, Award
} from 'lucide-react';
import { motion } from 'motion/react';
import { getManagementPortalUrl } from '../../api/stripe';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import Avatar from '../Avatar';
import LoadingSpinner from '../LoadingSpinner';
import * as authApi from '../../api/authApi';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

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

    if (!user) return <div className="min-h-screen flex items-center justify-center bg-claude-bg"><LoadingSpinner /></div>;

    return (
        <div className="min-h-screen bg-claude-bg pb-24 font-sans text-claude-text">
            {/* Profile Header with Atmospheric Glassmorphism */}
            <div className="relative mb-20 z-10 w-full max-w-xl mx-auto">
                {/* Atmospheric Deep Header */}
                <div className="h-44 overflow-hidden relative rounded-b-[3rem] shadow-sm">
                    <div className="absolute inset-0 bg-[#0f2026] rounded-b-[3rem]"></div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.2 }}
                        transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                        className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.15),transparent_60%)] blur-3xl rounded-b-[3rem]"
                    />
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>

                    {/* Floating Leaves */}
                    <motion.div animate={{ y: [0, -10, 0], rotate: [12, 15, 12] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
                        <Leaf className="absolute -bottom-8 -right-8 w-40 h-40 text-botanical-forest/5" />
                    </motion.div>
                    <motion.div animate={{ y: [0, 10, 0], rotate: [-12, -15, -12] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
                        <Leaf className="absolute -top-4 -left-6 w-32 h-32 text-botanical-forest/5 opacity-40" />
                    </motion.div>
                </div>

                {/* Avatar */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 z-20">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                        className="relative group cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-botanical-forest/20 rounded-full blur-xl scale-110 group-hover:scale-125 transition-transform duration-500 opacity-0 group-hover:opacity-100"></div>
                        <Avatar src={user?.avatar} size="4xl" className="border-[6px] border-claude-bg shadow-2xl relative z-10 bg-claude-surface" />
                        {isAdmin && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.3 }}
                                className={`absolute bottom-1 right-1 w-8 h-8 ${isOwner ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-red-500 to-orange-500'} rounded-full flex items-center justify-center border-2 border-claude-bg shadow-md z-20`}
                                title={isOwner ? "Owner" : "Admin"}
                            >
                                <Shield className="w-4 h-4 text-white" />
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="max-w-md mx-auto px-5"
            >
                {/* User Info */}
                <motion.div variants={itemVariants} className="text-center mb-8 mt-4">
                    <h1 className="text-3xl font-display font-bold text-claude-text tracking-tight mb-1 flex items-center justify-center gap-2">
                        {user?.displayName || user?.username}
                        {user?.subscription_tier === 'lifetime' && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center">
                                <Crown className="w-5 h-5 text-amber-500" strokeWidth={2.5} />
                            </motion.div>
                        )}
                        {user?.subscription_tier === 'supporter' && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center">
                                <Sparkles className="w-5 h-5 text-claude-accent" strokeWidth={2.5} />
                            </motion.div>
                        )}
                    </h1>
                    <div className="flex flex-col items-center justify-center gap-1 mb-4">
                        <div className="flex items-center gap-2">
                            <p className="text-botanical-forest/80 text-[13px] font-mono tracking-widest font-semibold flex items-center gap-1">
                                <User className="w-3 h-3" />
                                @{user?.username}
                            </p>
                            {user?.subscription_tier !== 'free' && (
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-widest font-bold ${user?.subscription_tier === 'lifetime' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-claude-accent/10 text-claude-accent border-claude-accent/20'}`}>
                                    {user?.subscription_tier}
                                </span>
                            )}
                        </div>
                    </div>
                    {user?.bio && (
                        <div className="relative inline-block">
                            <span className="absolute -top-2 -left-3 text-2xl text-botanical-sepia/20 font-serif">"</span>
                            <p className="text-[15px] text-claude-secondary max-w-xs mx-auto italic font-serif leading-relaxed px-4">
                                {user.bio}
                            </p>
                            <span className="absolute -bottom-4 -right-3 text-2xl text-botanical-sepia/20 font-serif">"</span>
                        </div>
                    )}
                </motion.div>

                {/* Stats / Quick Actions - Bento Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 mb-10">
                    <Link
                        to="/friends"
                        onClick={() => haptics.light()}
                        className="group relative overflow-hidden glass-panel rounded-[2rem] p-5 flex flex-col justify-center items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 active:scale-95"
                    >
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-botanical-forest/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="w-12 h-12 rounded-full bg-claude-bg flex items-center justify-center border border-botanical-sepia/5 shadow-inner group-hover:scale-110 transition-transform duration-300 z-10">
                            <Users className="w-5 h-5 text-botanical-forest" />
                        </div>
                        <div className="text-center z-10">
                            <span className="block text-2xl font-display font-bold text-claude-text">
                                {stats.loading ? <div className="w-6 h-6 border-2 border-botanical-forest border-t-transparent rounded-full animate-spin mx-auto my-1"></div> : stats.friends}
                            </span>
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia">
                                Friends
                            </span>
                        </div>
                    </Link>

                    <Link
                        to="/messages"
                        onClick={() => haptics.light()}
                        className="group relative overflow-hidden glass-panel rounded-[2rem] p-5 flex flex-col justify-center items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 active:scale-95"
                    >
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0ea5e9]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="w-12 h-12 rounded-full bg-claude-bg flex items-center justify-center border border-botanical-sepia/5 shadow-inner group-hover:scale-110 transition-transform duration-300 z-10 relative">
                            <MessageCircle className="w-5 h-5 text-[#0ea5e9]" />
                            {!stats.loading && stats.unread > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-claude-bg shadow-sm"
                                >
                                    {stats.unread}
                                </motion.span>
                            )}
                        </div>
                        <div className="text-center z-10">
                            <span className="block text-2xl font-display font-bold text-claude-text">
                                {stats.loading ? <div className="w-6 h-6 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin mx-auto my-1"></div> : stats.unread}
                            </span>
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia">
                                Messages
                            </span>
                        </div>
                    </Link>
                </motion.div>

                {/* Menu List - Premium List */}
                <motion.div variants={itemVariants} className="glass-panel rounded-[2rem] overflow-hidden shadow-sm">
                    {(isAdmin || isOwner) && (
                        <Link
                            to="/admin"
                            onClick={() => haptics.light()}
                            className="flex items-center gap-4 p-4 border-b border-botanical-sepia/10 hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0 border border-amber-500/20">
                                <Shield className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-display tracking-wide text-[16px] text-amber-700/80 group-hover:text-amber-600 font-semibold transition-colors">Admin Panel</p>
                                <p className="text-[11px] font-mono text-amber-700/50">Manage users and content</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-amber-500/30 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                        </Link>
                    )}

                    <Link
                        to="/edit-profile"
                        onClick={() => haptics.light()}
                        className="flex items-center gap-4 p-4 border-b border-botanical-sepia/10 hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-claude-bg shadow-sm border border-botanical-sepia/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                            <Edit3 className="w-5 h-5 text-claude-text/70" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-display tracking-wide text-[16px] text-claude-text group-hover:text-botanical-forest transition-colors">Edit Profile</p>
                            <p className="text-[11px] font-mono text-botanical-sepia">Update your avatar and bio</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-all" />
                    </Link>

                    <Link
                        to="/settings"
                        onClick={() => haptics.light()}
                        className="flex items-center gap-4 p-4 hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-claude-bg shadow-sm border border-botanical-sepia/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                            <Settings className="w-5 h-5 text-claude-text/70" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-display tracking-wide text-[16px] text-claude-text group-hover:text-botanical-forest transition-colors">Settings</p>
                            <p className="text-[11px] font-mono text-botanical-sepia">Security, notifications, integrations</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-all" />
                    </Link>

                    {user?.subscription_tier && user.subscription_tier !== 'free' && (
                        <button
                            onClick={() => {
                                haptics.medium();
                                getManagementPortalUrl().then(url => {
                                    if (url) window.location.href = url;
                                    else toast.error('Failed to open management portal');
                                });
                            }}
                            className="w-full flex items-center gap-4 p-4 border-t border-botanical-sepia/10 hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0 border border-indigo-500/20">
                                <Shield className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-display tracking-wide text-[16px] text-claude-text group-hover:text-indigo-600 transition-colors">Manage Subscription</p>
                                <p className="text-[11px] font-mono text-botanical-sepia">Update or cancel your plan</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-botanical-sepia/30 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                        </button>
                    )}
                </motion.div>

                {/* Sign Out Button */}
                <motion.div variants={itemVariants} className="mt-6">
                    <button
                        onClick={handleSignOut}
                        className="w-full bg-red-500/5 hover:bg-red-500/10 active:bg-red-500/20 border border-red-500/10 p-4 rounded-[2rem] flex items-center justify-center gap-3 transition-colors group"
                    >
                        <LogOut className="w-5 h-5 text-red-500/70 group-hover:text-red-500 transition-colors" />
                        <span className="font-display tracking-wide font-medium text-red-500/80 group-hover:text-red-500 transition-colors">Sign Out</span>
                    </button>
                </motion.div>

                <motion.div variants={itemVariants} className="mt-8 text-center text-[10px] text-botanical-sepia/40 font-mono tracking-widest uppercase flex flex-col items-center gap-2">
                    <Leaf className="w-4 h-4 opacity-50" />
                    <span>Riven OS v1.0.0</span>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default ProfileView;
