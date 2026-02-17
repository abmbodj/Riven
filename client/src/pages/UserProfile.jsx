import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, MessageCircle, UserPlus, UserMinus, Check, X,
    Clock, Layers, Calendar, Copy, Share2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import * as authApi from '../api/authApi';

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
            haptics.selection();
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="w-8 h-8 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-12">
                <p className="text-claude-secondary">User not found</p>
            </div>
        );
    }

    const isFriend = profile.friendshipStatus === 'accepted';
    const isPendingOutgoing = profile.friendshipStatus === 'pending' && profile.friendshipDirection === 'outgoing';
    const isPendingIncoming = profile.friendshipStatus === 'pending' && profile.friendshipDirection === 'incoming';

    return (
        <div className="animate-in fade-in duration-300 pb-24">
            {/* Header with Back Button */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-display font-bold">Profile</h1>
            </div>

            <div className="flex flex-col items-center mb-6">
                <Avatar src={profile.avatar} size="3xl" className="mb-4" />
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold">{profile.username}</h2>
                    {profile.isOwner ? (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">OWNER</span>
                    ) : profile.isAdmin ? (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">ADMIN</span>
                    ) : null}
                </div>
                {profile.bio && (
                    <p className="text-claude-secondary text-center max-w-xs">{profile.bio}</p>
                )}
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-8 mb-6">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                        <Layers className="w-5 h-5 text-claude-accent" />
                        {profile.deckCount}
                    </div>
                    <p className="text-xs text-claude-secondary uppercase tracking-wider">Decks</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-claude-secondary">
                        <Calendar className="w-4 h-4" />
                        {formatDate(profile.createdAt)}
                    </div>
                    <p className="text-xs text-claude-secondary uppercase tracking-wider">Joined</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                {isFriend ? (
                    <>
                        <Link
                            to={`/messages/${profile.id}`}
                            className="flex-1 py-3 bg-claude-accent text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Message
                        </Link>
                        <button
                            onClick={handleRemoveFriend}
                            disabled={actionLoading}
                            className="px-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                        >
                            <UserMinus className="w-5 h-5" />
                        </button>
                    </>
                ) : isPendingIncoming ? (
                    <>
                        <button
                            onClick={handleAcceptRequest}
                            disabled={actionLoading}
                            className="flex-1 py-3 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                        >
                            <Check className="w-5 h-5" />
                            Accept Request
                        </button>
                        <button
                            onClick={handleRemoveFriend}
                            disabled={actionLoading}
                            className="px-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </>
                ) : isPendingOutgoing ? (
                    <button
                        onClick={handleRemoveFriend}
                        disabled={actionLoading}
                        className="flex-1 py-3 bg-claude-surface border border-claude-border rounded-xl font-semibold flex items-center justify-center gap-2 text-claude-secondary"
                    >
                        <Clock className="w-5 h-5" />
                        Request Pending
                    </button>
                ) : (
                    <button
                        onClick={handleSendRequest}
                        disabled={actionLoading}
                        className="flex-1 py-3 bg-claude-accent text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                    >
                        <UserPlus className="w-5 h-5" />
                        Add Friend
                    </button>
                )}
            </div>

            {/* Share Code */}
            <div className="bg-claude-surface border border-claude-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-claude-secondary uppercase tracking-wider mb-1">Share Code</p>
                        <p className="text-xl font-mono font-bold tracking-widest">{profile.shareCode}</p>
                    </div>
                    <button
                        onClick={copyShareCode}
                        className="p-3 bg-claude-bg rounded-xl active:scale-95 transition-transform"
                    >
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                </div>
                <p className="text-xs text-claude-secondary mt-2">
                    Use this code to find and share decks with {profile.username}
                </p>
            </div>
        </div>
    );
}
