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
            {/* Desktop: two-column layout for profile. Mobile: stacked single column */}
            <div className="relative mb-20 lg:mb-16 z-10 w-full max-w-xl lg:max-w-3xl mx-auto lg:pt-8 bg-transparent">
                {/* Atmospheric Deep Header */}
                <div className="mx-4 lg:mx-0 mt-4 lg:mt-0 h-44 lg:h-52 overflow-hidden relative rounded-[3rem] shadow-sm md:shadow-lg border border-white/5 lg:border-white/5">
                    {user?.banner ? (
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${user.banner})` }}>
                            <div className="absolute inset-0 bg-black/20"></div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-[#0f2026]"></div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1.2 }}
                                transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                                className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.15),transparent_60%)] blur-3xl"
                            />
                            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] md:mix-blend-overlay"></div>

                            {/* Floating Leaves */}
                            <motion.div animate={{ y: [0, -10, 0], rotate: [12, 15, 12] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
                                <Leaf className="absolute -bottom-8 -right-8 w-40 h-40 text-botanical-forest/5" />
                            </motion.div>
                            <motion.div animate={{ y: [0, 10, 0], rotate: [-12, -15, -12] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
                                <Leaf className="absolute -top-4 -left-6 w-32 h-32 text-botanical-forest/5 opacity-40" />
                            </motion.div>
                        </>
                    )}
                </div>

                {/* Avatar */}
                <div className="absolute -bottom-14 lg:-bottom-12 left-0 w-full z-20 pointer-events-none">
                    <div className="max-w-md lg:max-w-3xl mx-auto px-5 lg:px-10 w-full pointer-events-auto flex justify-center lg:justify-start">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                            className="relative group cursor-pointer lg:ml-5"
                        >
                            <div className="absolute inset-0 bg-botanical-forest/20 rounded-full blur-xl scale-110 group-hover:scale-125 transition-transform duration-500 opacity-0 group-hover:opacity-100"></div>
                            <Avatar src={user?.avatar} size="4xl" className="border-[6px] border-claude-bg shadow-md md:shadow-2xl relative z-10 bg-claude-surface" />
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
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="max-w-md lg:max-w-3xl mx-auto px-5 lg:px-10"
            >
                <div className="lg:flex lg:gap-12 lg:items-start">

                    {/* Left Column: Identity & Stats */}
                    <div className="lg:w-[45%] flex flex-col">
                        {/* User Info */}
                        <motion.div variants={itemVariants} className="text-center lg:text-left mb-8 lg:mb-10 mt-4 lg:mt-2 lg:ml-5">
                            <h1 className="text-3xl font-display font-bold text-claude-text tracking-tight mb-1 flex items-center justify-center lg:justify-start gap-2">
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
                            <div className="flex flex-col items-center lg:items-start justify-center lg:justify-start gap-1 mb-4">
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
                                <div className="mt-2 text-center lg:text-left">
                                    <p className="text-[15px] text-claude-secondary max-w-xs mx-auto lg:mx-0 italic font-serif leading-relaxed px-2 lg:px-0">
                                        &ldquo;{user.bio}&rdquo;
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        {/* Stats / Quick Actions - Bento Grid */}
                        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 mb-8 lg:mb-0">
                            <Link
                                to="/friends"
                                onClick={() => haptics.light()}
                                className="group relative overflow-hidden glass-panel rounded-[2rem] p-5 flex flex-col justify-center items-center gap-3 shadow-sm hover:shadow-md transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 active:scale-95"
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
                                className="group relative overflow-hidden glass-panel rounded-[2rem] p-5 flex flex-col justify-center items-center gap-3 shadow-sm hover:shadow-md transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 active:scale-95"
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
                    </div>{/* End Left Column */}

                    {/* Right Column: Menu */}
                    <div className="lg:w-[55%] flex flex-col">
                        {/* Menu List - Premium List */}
                        <motion.div variants={itemVariants} className="glass-panel lg:bg-transparent lg:border-none lg:shadow-none lg:p-0 rounded-[2rem] overflow-hidden shadow-sm mb-6 lg:mb-0 lg:space-y-2">
                            {(isAdmin || isOwner) && (
                                <Link
                                    to="/admin"
                                    onClick={() => haptics.light()}
                                    className="flex items-center gap-4 p-4 border-b lg:border-none lg:rounded-[1.5rem] lg:bg-white/[0.02] border-botanical-sepia/10 lg:hover:bg-amber-500/[0.04] lg:hover:border-amber-500/20 transition-all hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 group relative lg:hover:translate-x-1 lg:hover:shadow-[0_8px_32px_rgba(245,158,11,0.1)] lg:border lg:border-white/[0.04]"
                                >
                                    <div className="absolute inset-0 transition-opacity duration-300 opacity-0 lg:group-hover:opacity-100 bg-gradient-to-r from-amber-500/10 to-transparent pointer-events-none lg:rounded-[1.5rem]"></div>
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center lg:group-hover:scale-110 lg:group-hover:bg-amber-500/20 transition-all duration-300 shrink-0 border border-amber-500/20 relative z-10 lg:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                        <Shield className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div className="flex-1 text-left relative z-10">
                                        <p className="font-display tracking-wide text-[16px] text-amber-500 group-hover:text-amber-400 font-semibold transition-colors">Admin Panel</p>
                                        <p className="text-[11px] font-mono text-amber-500/50 group-hover:text-amber-500/70 transition-colors">Manage users and content</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-amber-500/30 group-hover:text-amber-500 group-hover:translate-x-1 transition-[transform,opacity,color,background-color,border-color,box-shadow] relative z-10" />
                                </Link>
                            )}

                            <Link
                                to="/edit-profile"
                                onClick={() => haptics.light()}
                                className="flex items-center gap-4 p-4 border-b lg:border-none lg:rounded-[1.5rem] lg:bg-white/[0.02] border-botanical-sepia/10 lg:hover:bg-white/[0.04] transition-all hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 group relative lg:hover:translate-x-1 lg:hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] lg:border lg:border-white/[0.04]"
                            >
                                <div className="absolute inset-0 transition-opacity duration-300 opacity-0 lg:group-hover:opacity-100 bg-gradient-to-r from-botanical-forest/5 to-transparent pointer-events-none lg:rounded-[1.5rem]"></div>
                                <div className="w-10 h-10 rounded-xl bg-claude-bg lg:bg-white/5 shadow-sm border border-botanical-sepia/5 lg:border-white/10 flex items-center justify-center lg:group-hover:scale-110 transition-all duration-300 shrink-0 relative z-10 lg:group-hover:border-botanical-forest/30 lg:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                    <Edit3 className="w-5 h-5 text-claude-text/70 lg:group-hover:text-botanical-forest" />
                                </div>
                                <div className="flex-1 text-left relative z-10">
                                    <p className="font-display tracking-wide text-[16px] text-claude-text lg:group-hover:text-white group-hover:text-botanical-forest transition-colors">Edit Profile</p>
                                    <p className="text-[11px] font-mono text-botanical-sepia lg:group-hover:text-claude-secondary">Update your avatar and bio</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-botanical-sepia/30 lg:text-white/20 group-hover:text-botanical-forest lg:group-hover:text-white group-hover:translate-x-1 transition-[transform,opacity,color,background-color,border-color,box-shadow] relative z-10" />
                            </Link>

                            <Link
                                to="/settings"
                                onClick={() => haptics.light()}
                                className="flex items-center gap-4 p-4 border-b lg:border-none lg:rounded-[1.5rem] lg:bg-white/[0.02] border-botanical-sepia/10 lg:hover:bg-white/[0.04] transition-all hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 group relative lg:hover:translate-x-1 lg:hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] lg:border lg:border-white/[0.04]"
                            >
                                <div className="absolute inset-0 transition-opacity duration-300 opacity-0 lg:group-hover:opacity-100 bg-gradient-to-r from-botanical-forest/5 to-transparent pointer-events-none lg:rounded-[1.5rem]"></div>
                                <div className="w-10 h-10 rounded-xl bg-claude-bg lg:bg-white/5 shadow-sm border border-botanical-sepia/5 lg:border-white/10 flex items-center justify-center lg:group-hover:scale-110 transition-all duration-300 shrink-0 relative z-10 lg:group-hover:border-botanical-forest/30 lg:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                    <Settings className="w-5 h-5 text-claude-text/70 lg:group-hover:text-botanical-forest" />
                                </div>
                                <div className="flex-1 text-left relative z-10">
                                    <p className="font-display tracking-wide text-[16px] text-claude-text lg:group-hover:text-white group-hover:text-botanical-forest transition-colors">Settings</p>
                                    <p className="text-[11px] font-mono text-botanical-sepia lg:group-hover:text-claude-secondary">Security, notifications, integrations</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-botanical-sepia/30 lg:text-white/20 group-hover:text-botanical-forest lg:group-hover:text-white group-hover:translate-x-1 transition-[transform,opacity,color,background-color,border-color,box-shadow] relative z-10" />
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
                                    className="w-full flex items-center gap-4 p-4 border-b lg:border-none lg:rounded-[1.5rem] lg:bg-white/[0.02] border-botanical-sepia/10 lg:hover:bg-indigo-500/[0.04] lg:hover:border-indigo-500/20 transition-all hover:bg-botanical-sepia/5 active:bg-botanical-sepia/10 group relative lg:hover:translate-x-1 lg:hover:shadow-[0_8px_32px_rgba(99,102,241,0.1)] lg:border lg:border-white/[0.04]"
                                >
                                    <div className="absolute inset-0 transition-opacity duration-300 opacity-0 lg:group-hover:opacity-100 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none lg:rounded-[1.5rem]"></div>
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center lg:group-hover:scale-110 lg:group-hover:bg-indigo-500/20 transition-all duration-300 shrink-0 border border-indigo-500/20 relative z-10 lg:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                        <Shield className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div className="flex-1 text-left relative z-10">
                                        <p className="font-display tracking-wide text-[16px] text-claude-text group-hover:text-indigo-400 transition-colors">Manage Subscription</p>
                                        <p className="text-[11px] font-mono text-botanical-sepia lg:group-hover:text-indigo-400/70 transition-colors">Update or cancel your plan</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-botanical-sepia/30 group-hover:text-indigo-400 group-hover:translate-x-1 transition-[transform,opacity,color,background-color,border-color,box-shadow] relative z-10" />
                                </button>
                            )}

                            <button
                                onClick={handleSignOut}
                                className={`w-full flex items-center gap-4 p-4 hover:bg-red-500/5 active:bg-red-500/10 transition-all group relative lg:border-none lg:rounded-[1.5rem] lg:bg-white/[0.02] lg:hover:bg-red-500/[0.04] lg:hover:border-red-500/20 lg:hover:translate-x-1 lg:hover:shadow-[0_8px_32px_rgba(239,68,68,0.1)] lg:border lg:border-white/[0.04]`}
                            >
                                <div className="absolute inset-0 transition-opacity duration-300 opacity-0 lg:group-hover:opacity-100 bg-gradient-to-r from-red-500/10 lg:from-red-500/5 to-transparent pointer-events-none lg:rounded-[1.5rem]"></div>
                                <div className="w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center lg:group-hover:scale-110 lg:group-hover:bg-red-500/10 transition-all duration-300 shrink-0 border border-red-500/10 relative z-10 shadow-sm lg:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                    <LogOut className="w-5 h-5 text-red-500/70 group-hover:text-red-500 transition-colors" />
                                </div>
                                <div className="flex-1 text-left relative z-10">
                                    <p className="font-display tracking-wide text-[16px] text-red-500/80 lg:text-red-500/70 group-hover:text-red-500 font-medium transition-colors">Sign Out</p>
                                    <p className="text-[11px] font-mono text-red-500/40 group-hover:text-red-500/60 transition-colors">End your current session</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-red-500/20 group-hover:text-red-500 group-hover:translate-x-1 transition-[transform,opacity,color,background-color,border-color,box-shadow] relative z-10" />
                            </button>

                        </motion.div>
                    </div>{/* End Right Column */}
                </div>{/* End Flex Layout */}

                <motion.div variants={itemVariants} className="mt-8 lg:mt-16 text-center text-[10px] text-botanical-sepia/20 font-mono tracking-widest uppercase flex flex-col items-center gap-2">
                    <Leaf className="w-4 h-4 opacity-30" />
                    <span className="opacity-50">Riven OS v1.0.0</span>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default ProfileView;
