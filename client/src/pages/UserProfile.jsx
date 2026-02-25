import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, MessageCircle, UserPlus, UserMinus, Check, X,
    Clock, Layers, Calendar, Copy, Share2, Shield, Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import * as authApi from '../api/authApi';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function UserProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/account');
            return;
        }

        const loadProfile = async () => {
            try {
                const data = await authApi.getUserProfile(userId);
                setProfile(data);
            } catch {
                toast.error('Failed to load profile');
                navigate(-1);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [userId, isLoggedIn, navigate, toast]);

    const handleSendRequest = async () => {
        setActionLoading(true);
        haptics.light();
        try {
            await authApi.sendFriendRequest(profile.id);
            setProfile(prev => ({ ...prev, friendshipStatus: 'pending', friendshipDirection: 'outgoing' }));
            toast.success('Friend request sent');
            haptics.success();
        } catch (err) {
            haptics.error();
            const errorMessage = err?.message || 'Failed to send friend request';
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptRequest = async () => {
        setActionLoading(true);
        haptics.success();
        try {
            await authApi.acceptFriendRequest(profile.id);
            setProfile(prev => ({ ...prev, friendshipStatus: 'accepted' }));
            toast.success(`You're now friends with ${profile.username}`);
        } catch (err) {
            haptics.error();
            const errorMessage = err?.message || 'Failed to accept friend request';
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFriend = async () => {
        setActionLoading(true);
        haptics.medium();
        try {
            await authApi.removeFriend(profile.id);
            setProfile(prev => ({ ...prev, friendshipStatus: null, friendshipDirection: null }));
            toast.success('Friend removed');
        } catch (err) {
            haptics.error();
            const errorMessage = err?.message || 'Failed to remove friend';
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const copyShareCode = () => {
        if (profile?.shareCode) {
            navigator.clipboard.writeText(profile.shareCode);
            setCopied(true);
            haptics.success();
            toast.success('Share code copied');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[70vh] bg-claude-bg">
                <div className="w-10 h-10 border-4 border-botanical-forest border-t-transparent rounded-full animate-spin shadow-lg" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-20 bg-claude-bg min-h-screen">
                <Leaf className="w-12 h-12 text-botanical-sepia/20 mx-auto mb-4" />
                <p className="text-claude-secondary font-display text-xl tracking-wide">Journal not found</p>
                <button onClick={() => navigate(-1)} className="mt-6 text-sm font-mono text-botanical-forest uppercase tracking-widest pl-2 border-l-2 border-botanical-forest hover:text-botanical-solid transition-colors">Return</button>
            </div>
        );
    }

    const isFriend = profile.friendshipStatus === 'accepted';
    const isPendingOutgoing = profile.friendshipStatus === 'pending' && profile.friendshipDirection === 'outgoing';
    const isPendingIncoming = profile.friendshipStatus === 'pending' && profile.friendshipDirection === 'incoming';

    return (
        <div className="min-h-screen bg-claude-bg pb-24 font-sans text-claude-text">
            {/* Same Atmospheric Glassmorphism Header as ProfileView */}
            <div className="relative mb-20 z-10 w-full max-w-xl mx-auto">
                {/* Back Button Overlay */}
                <div className="absolute top-0 left-0 right-0 z-50 p-4 safe-area-top">
                    <button onClick={() => navigate(-1)} className="p-3 bg-black/20 backdrop-blur-md rounded-full shadow-sm hover:bg-black/30 active:scale-95 transition-all outline-none border border-white/5">
                        <ArrowLeft className="w-5 h-5 text-white/90" />
                    </button>
                </div>

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
                </div>

                {/* Avatar */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 z-20">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                        className="relative"
                    >
                        <Avatar src={profile.avatar} size="4xl" className="border-[6px] border-claude-bg shadow-2xl relative z-10 bg-claude-surface" />
                        {(profile.isAdmin || profile.isOwner) && (
                            <motion.div
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.3 }}
                                className={`absolute bottom-1 right-1 w-8 h-8 ${profile.isOwner ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-red-500 to-orange-500'} rounded-full flex items-center justify-center border-2 border-claude-bg shadow-md z-20`}
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
                {/* Profile Info */}
                <motion.div variants={itemVariants} className="flex flex-col items-center mb-8 text-center mt-4">
                    <div className="flex items-center gap-2 mb-1 justify-center">
                        <h2 className="text-3xl font-display font-bold tracking-tight text-claude-text">
                            {profile.display_name || profile.username}
                        </h2>
                        {profile.isOwner && (
                            <span className="px-2 py-0.5 rounded-full bg-botanical-sepia/20 text-botanical-sepia font-mono text-[10px] uppercase font-bold tracking-widest border border-botanical-sepia/30 shadow-sm ml-2">
                                Owner
                            </span>
                        )}
                        {!profile.isOwner && profile.isAdmin && (
                            <span className="px-2 py-0.5 rounded-full bg-botanical-forest/10 text-botanical-forest font-mono text-[10px] uppercase font-bold tracking-widest border border-botanical-forest/20 shadow-sm ml-2">
                                Admin
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1 mb-4">
                        <p className="text-botanical-forest/80 text-[13px] font-mono tracking-widest font-semibold flex items-center gap-1">
                            <User className="w-3 h-3" />
                            @{profile.username}
                        </p>
                    </div>

                    {profile.bio && (
                        <p className="text-botanical-sepia text-sm italic font-serif leading-relaxed px-4">"{profile.bio}"</p>
                    )}
                </motion.div>

                {/* Stats Bento */}
                <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-claude-surface/40 backdrop-blur-md border border-botanical-sepia/10 rounded-[2rem] p-5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-2 text-2xl font-display font-bold text-claude-text mb-1">
                            <Layers className="w-5 h-5 text-botanical-forest" />
                            {profile.deckCount}
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia">Decks</p>
                    </div>
                    <div className="bg-claude-surface/40 backdrop-blur-md border border-botanical-sepia/10 rounded-[2rem] p-5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-2 text-[16px] font-display font-bold text-claude-text mb-1 h-[32px]">
                            <Calendar className="w-4 h-4 text-botanical-sepia/80" />
                            {formatDate(profile.createdAt)}
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia">Joined</p>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div variants={itemVariants} className="flex gap-4 mb-10">
                    <AnimatePresence mode="popLayout">
                        {isFriend ? (
                            <motion.div key="friend" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-3 w-full">
                                <Link
                                    to={`/messages/${profile.id}`}
                                    onClick={() => haptics.light()}
                                    className="flex-1 py-4 bg-[#0ea5e9] hover:bg-[#0284c7] text-white rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-[#0ea5e9]/20"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    Message
                                </Link>
                                <button
                                    onClick={handleRemoveFriend}
                                    disabled={actionLoading}
                                    className="px-5 py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 border border-red-500/20"
                                >
                                    {actionLoading ? <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <UserMinus className="w-5 h-5" />}
                                </button>
                            </motion.div>
                        ) : isPendingIncoming ? (
                            <motion.div key="incoming" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-3 w-full">
                                <button
                                    onClick={handleAcceptRequest}
                                    disabled={actionLoading}
                                    className="flex-1 py-4 bg-botanical-forest hover:bg-[#2b4c3e] text-white rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-botanical-forest/20"
                                >
                                    <Check className="w-5 h-5" />
                                    Accept Request
                                </button>
                                <button
                                    onClick={handleRemoveFriend}
                                    disabled={actionLoading}
                                    className="px-5 py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 border border-red-500/20"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </motion.div>
                        ) : isPendingOutgoing ? (
                            <motion.button
                                key="outgoing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                onClick={handleRemoveFriend}
                                disabled={actionLoading}
                                className="w-full py-4 bg-claude-surface border border-botanical-sepia/20 rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 text-claude-secondary active:scale-95 transition-all hover:border-red-500/30 hover:text-red-500"
                            >
                                <Clock className="w-5 h-5" />
                                Request Pending
                            </motion.button>
                        ) : (
                            <motion.button
                                key="add" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                onClick={handleSendRequest}
                                disabled={actionLoading}
                                className="w-full py-4 bg-botanical-forest hover:bg-[#2b4c3e] text-white rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-botanical-forest/20"
                            >
                                {actionLoading ? <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                Add Friend
                            </motion.button>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Share Code Ticket */}
                <motion.div variants={itemVariants} className="bg-gradient-to-br from-claude-surface to-claude-bg border border-botanical-sepia/10 rounded-[2rem] p-6 shadow-sm relative overflow-hidden group">
                    {/* Ticket notch cutouts via pseudo-elements would require complex CSS, using simple overlay instead */}
                    <div className="absolute top-1/2 -left-4 w-8 h-8 rounded-full bg-claude-bg border-r border-botanical-sepia/10 transform -translate-y-1/2 hidden sm:block"></div>
                    <div className="absolute top-1/2 -right-4 w-8 h-8 rounded-full bg-claude-bg border-l border-botanical-sepia/10 transform -translate-y-1/2 hidden sm:block"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia/80 mb-1.5 flex items-center gap-1.5">
                                <Share2 className="w-3 h-3" /> Connect Ticket
                            </p>
                            <p className="text-2xl font-mono font-bold tracking-[0.2em] text-claude-text selection:bg-botanical-forest/20">{profile.shareCode}</p>
                        </div>
                        <button
                            onClick={copyShareCode}
                            className={`p-3.5 rounded-2xl active:scale-90 transition-all shadow-inner border border-botanical-sepia/10 ${copied ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-claude-bg hover:bg-botanical-forest/5 text-botanical-forest'}`}
                        >
                            <AnimatePresence mode="wait">
                                {copied ? (
                                    <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                        <Check className="w-6 h-6" />
                                    </motion.div>
                                ) : (
                                    <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                        <Copy className="w-6 h-6" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="mt-8 text-center text-[10px] text-botanical-sepia/40 font-mono tracking-widest uppercase flex flex-col items-center gap-2">
                    <Leaf className="w-4 h-4 opacity-50" />
                </motion.div>
            </motion.div>
        </div>
    );
}
