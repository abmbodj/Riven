import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, MessageCircle, UserPlus, UserMinus, Check, X,
    Clock, Layers, Calendar, Shield, Leaf, User, ShieldAlert, Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import ReportModal from '../components/ui/ReportModal';
import ConfirmModal from '../components/ConfirmModal';
import * as authApi from '../api/authApi';
import gsap from 'gsap';
import { useGSAP } from '../hooks/useGSAP';
import { EASE, DURATION, STAGGER } from '../utils/animations';



export default function UserProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Report & Block state
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const profileContentRef = useRef(null);

    // GSAP staggered profile sections reveal
    useGSAP(() => {
        if (loading || !profile || !profileContentRef.current) return;

        gsap.from(profileContentRef.current.querySelectorAll('.gsap-profile-item'), {
            y: 20,
            opacity: 0,
            duration: DURATION.slow,
            stagger: STAGGER.relaxed,
            ease: EASE.spring,
            delay: 0.15,
        });
    }, [loading, profile]);

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

    const handleBlockUser = async () => {
        setIsBlocking(true);
        try {
            await authApi.blockUser(profile.id);
            toast.success('User blocked successfully');
            navigate('/messages', { replace: true });
        } catch (err) {
            toast.error(err.message || 'Failed to block user');
        } finally {
            setIsBlocking(false);
            setIsBlockModalOpen(false);
        }
    };

    const handleReportSubmit = async (reason, details) => {
        setIsReporting(true);
        try {
            await authApi.reportContent({
                reportedUserId: profile.id,
                contentType: 'user',
                reason,
                details
            });
            toast.success('Report submitted successfully. Thank you.');
            setIsReportModalOpen(false);
        } catch (err) {
            toast.error(err.message || 'Failed to submit report');
        } finally {
            setIsReporting(false);
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
                <div className="w-10 h-10 border-4 border-claude-accent border-t-transparent rounded-full animate-spin shadow-sm md:shadow-lg" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-20 bg-claude-bg min-h-screen">
                <Leaf className="w-12 h-12 text-claude-secondary/20 mx-auto mb-4" />
                <p className="text-claude-secondary font-display text-xl tracking-wide">Journal not found</p>
                <button onClick={() => navigate(-1)} className="mt-6 text-sm font-mono text-claude-accent uppercase tracking-widest pl-2 border-l-2 border-claude-accent hover:text-claude-accent/80 transition-colors">Return</button>
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
                    <button onClick={() => navigate(-1)} className="p-3 bg-black/20 md:backdrop-blur-md rounded-full shadow-sm hover:bg-black/30 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] outline-none border border-white/5">
                        <ArrowLeft className="w-5 h-5 text-white/90" />
                    </button>
                </div>

                <div className="h-44 overflow-hidden relative rounded-b-[3rem] shadow-sm">
                    {profile.banner ? (
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${profile.banner})` }}>
                            <div className="absolute inset-0 bg-black/20"></div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-claude-bg rounded-b-[3rem]"></div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1.2 }}
                                transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                                className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(122,158,114,0.15),transparent_60%)] blur-3xl rounded-b-[3rem]"
                            />
                            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] md:mix-blend-overlay"></div>

                            {/* Floating Leaves */}
                            <motion.div animate={{ y: [0, -10, 0], rotate: [12, 15, 12] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
                                <Leaf className="absolute -bottom-8 -right-8 w-40 h-40 text-claude-accent/5" />
                            </motion.div>
                        </>
                    )}
                </div>

                {/* Avatar */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 z-20">
                    <div
                        className="relative gsap-profile-item"
                    >
                        <Avatar src={profile.avatar} size="4xl" className="border-[6px] border-claude-bg shadow-md md:shadow-2xl relative z-10 bg-claude-surface" />
                        {(profile.isAdmin || profile.isOwner) && (
                            <div
                                className={`absolute bottom-1 right-1 w-8 h-8 ${profile.isOwner ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-red-500 to-orange-500'} rounded-full flex items-center justify-center border-2 border-claude-bg shadow-md z-20`}
                            >
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                ref={profileContentRef}
                className="max-w-md mx-auto px-5"
            >
                {/* Profile Info */}
                <div className="gsap-profile-item flex flex-col items-center mb-8 text-center mt-4">
                    <div className="flex items-center gap-2 mb-1 justify-center">
                        <h2 className="text-3xl font-display font-bold tracking-tight text-claude-text">
                            {profile.display_name || profile.username}
                        </h2>
                        {profile.isOwner && (
                            <span className="px-2 py-0.5 rounded-full bg-claude-secondary/20 text-claude-secondary font-mono text-[10px] uppercase font-bold tracking-widest border border-claude-secondary/30 shadow-sm ml-2">
                                Owner
                            </span>
                        )}
                        {!profile.isOwner && profile.isAdmin && (
                            <span className="px-2 py-0.5 rounded-full bg-claude-accent/10 text-claude-accent font-mono text-[10px] uppercase font-bold tracking-widest border border-claude-accent/20 shadow-sm ml-2">
                                Admin
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1 mb-4">
                        <p className="text-claude-accent/80 text-[13px] font-mono tracking-widest font-semibold flex items-center gap-1">
                            <User className="w-3 h-3" />
                            @{profile.username}
                        </p>
                    </div>

                    {profile.bio && (
                        <p className="text-claude-secondary text-sm italic font-serif leading-relaxed px-4">"{profile.bio}"</p>
                    )}
                </div>

                {/* Stats Bento */}
                <div className="gsap-profile-item grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-claude-surface/40 md:backdrop-blur-md border border-claude-border/10 rounded-[2rem] p-5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-2 text-2xl font-display font-bold text-claude-text mb-1">
                            <Layers className="w-5 h-5 text-claude-accent" />
                            {profile.deckCount}
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary">Decks</p>
                    </div>
                    <div className="bg-claude-surface/40 md:backdrop-blur-md border border-claude-border/10 rounded-[2rem] p-5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-2 text-[16px] font-display font-bold text-claude-text mb-1 h-[32px]">
                            <Calendar className="w-4 h-4 text-claude-secondary/80" />
                            {formatDate(profile.createdAt)}
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary">Joined</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="gsap-profile-item flex gap-4 mb-10">
                    <AnimatePresence mode="popLayout">
                        {isFriend ? (
                            <motion.div key="friend" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-3 w-full">
                                <Link
                                    to={`/messages/${profile.id}`}
                                    onClick={() => haptics.light()}
                                    className="flex-1 py-4 bg-[#0ea5e9] hover:bg-[#0284c7] text-white rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-md shadow-[#0ea5e9]/20"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    Message
                                </Link>
                                <button
                                    onClick={handleRemoveFriend}
                                    disabled={actionLoading}
                                    className="px-5 py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 border border-red-500/20"
                                >
                                    {actionLoading ? <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <UserMinus className="w-5 h-5" />}
                                </button>
                            </motion.div>
                        ) : isPendingIncoming ? (
                            <motion.div key="incoming" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-3 w-full">
                                <button
                                    onClick={handleAcceptRequest}
                                    disabled={actionLoading}
                                    className="flex-1 py-4 bg-claude-accent hover:bg-claude-accent/80 text-white rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 shadow-md shadow-claude-accent/20"
                                >
                                    <Check className="w-5 h-5" />
                                    Accept Request
                                </button>
                                <button
                                    onClick={handleRemoveFriend}
                                    disabled={actionLoading}
                                    className="px-5 py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 border border-red-500/20"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </motion.div>
                        ) : isPendingOutgoing ? (
                            <motion.button
                                key="outgoing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                onClick={handleRemoveFriend}
                                disabled={actionLoading}
                                className="w-full py-4 glass-panel border border-claude-border/20 rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 text-claude-secondary active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:border-red-500/30 hover:text-red-500"
                            >
                                <Clock className="w-5 h-5" />
                                Request Pending
                            </motion.button>
                        ) : (
                            <motion.button
                                key="add" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                onClick={handleSendRequest}
                                disabled={actionLoading}
                                className="w-full py-4 bg-claude-accent hover:bg-claude-accent/80 text-white rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 shadow-md shadow-claude-accent/20"
                            >
                                {actionLoading ? <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                Add Friend
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                <div className="gsap-profile-item mt-8 pt-8 border-t border-claude-border/10 flex flex-col gap-2">
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-2 justify-center py-3 text-sm font-medium text-claude-secondary hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Report User
                    </button>
                    <button
                        onClick={() => setIsBlockModalOpen(true)}
                        className="flex items-center gap-2 justify-center py-3 text-sm font-medium text-claude-secondary hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                        <Ban className="w-4 h-4" />
                        Block User
                    </button>
                </div>

                <div className="gsap-profile-item mt-8 text-center text-[10px] text-claude-secondary/40 font-mono tracking-widest uppercase flex flex-col items-center gap-2">
                    <Leaf className="w-4 h-4 opacity-50" />
                </div>
            </div>

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onSubmit={handleReportSubmit}
                isSubmitting={isReporting}
            />

            <ConfirmModal
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                onConfirm={handleBlockUser}
                title="Block User"
                message={`Are you sure you want to block ${profile?.display_name || profile?.username}? They will not be able to interact with you, and their messages will be hidden.`}
                confirmText="Block"
                isDestructive={true}
                isLoading={isBlocking}
            />
        </div>
    );
}
