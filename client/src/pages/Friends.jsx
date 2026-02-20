import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Search, UserPlus, UserMinus, Check, X,
    MessageCircle, Users, Clock, ChevronRight, Leaf
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import * as authApi from '../api/authApi';

export default function Friends() {
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn } = useAuth();

    const [tab, setTab] = useState('friends'); // friends, requests, search
    const [friends, setFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadFriends = useCallback(async () => {
        try {
            const data = await authApi.getFriends();
            setFriends(data);
        } catch {
            // Failed to load friends silently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/account');
            return;
        }
        loadFriends();
    }, [isLoggedIn, navigate, loadFriends]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setSearching(true);
                try {
                    const results = await authApi.searchUsers(searchQuery);
                    setSearchResults(results);
                } catch {
                    // Search failed silently
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSendRequest = async (userId) => {
        haptics.light();
        try {
            const result = await authApi.sendFriendRequest(userId);
            toast.success(`Friend request sent to ${result.username}`);
            setSearchResults(prev => prev.map(u =>
                u.id === userId ? { ...u, requestSent: true } : u
            ));
            loadFriends();
        } catch (err) {
            haptics.error();
            const errorMessage = err?.message || 'Failed to send friend request';
            toast.error(errorMessage);
        }
    };

    const handleAcceptRequest = async (userId, username) => {
        haptics.success();
        try {
            await authApi.acceptFriendRequest(userId);
            toast.success(`You're now friends with ${username}`);
            loadFriends();
        } catch (err) {
            haptics.error();
            const errorMessage = err?.message || 'Failed to accept friend request';
            toast.error(errorMessage);
        }
    };

    const handleDeclineOrRemove = async (userId, isRequest = false) => {
        haptics.medium();
        try {
            await authApi.removeFriend(userId);
            toast.success(isRequest ? 'Request declined' : 'Friend removed');
            loadFriends();
        } catch (err) {
            haptics.error();
            const errorMessage = err?.message || 'Failed to remove friend';
            toast.error(errorMessage);
        }
    };

    const acceptedFriends = friends.filter(f => f.status === 'accepted');
    const incomingRequests = friends.filter(f => f.status === 'pending' && !f.isOutgoing);
    const outgoingRequests = friends.filter(f => f.status === 'pending' && f.isOutgoing);

    return (
        <div className="animate-in fade-in duration-300">
            <div className="mb-6 relative">
                <div className="absolute -top-2 left-0 w-8 h-8 opacity-10">
                    <Leaf className="w-full h-full text-botanical-forest rotate-12" />
                </div>
                <h1 className="text-2xl font-display font-bold mb-1">Friends</h1>
                <p className="text-botanical-sepia font-mono text-sm">Connect with other learners</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 scroll-container relative z-10">
                <button
                    onClick={() => setTab('friends')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${tab === 'friends'
                        ? 'bg-botanical-forest text-white shadow-md shadow-botanical-forest/20'
                        : 'botanical-card text-botanical-sepia hover:bg-white/50 border border-transparent'
                        }`}
                >
                    <Users className="w-4 h-4 inline mr-1.5" />
                    Friends ({acceptedFriends.length})
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors relative ${tab === 'requests'
                        ? 'bg-botanical-forest text-white shadow-md shadow-botanical-forest/20'
                        : 'botanical-card text-botanical-sepia hover:bg-white/50 border border-transparent'
                        }`}
                >
                    <Clock className="w-4 h-4 inline mr-1.5" />
                    Requests
                    {incomingRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-400 rounded-full text-xs text-white flex items-center justify-center font-bold font-mono border-2 border-claude-bg">
                            {incomingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('search')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${tab === 'search'
                        ? 'bg-botanical-forest text-white shadow-md shadow-botanical-forest/20'
                        : 'botanical-card text-botanical-sepia hover:bg-white/50 border border-transparent'
                        }`}
                >
                    <Search className="w-4 h-4 inline mr-1.5" />
                    Find
                </button>
            </div>

            {/* Friends List */}
            {tab === 'friends' && (
                loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : acceptedFriends.length === 0 ? (
                    <div className="text-center py-12 relative overflow-hidden botanical-card rounded-3xl">
                        <div className="absolute -top-10 -right-10 w-40 h-40 opacity-5">
                            <Leaf className="w-full h-full text-botanical-forest -rotate-45" />
                        </div>
                        <div className="w-16 h-16 rounded-full bg-botanical-forest/10 flex items-center justify-center mx-auto mb-4 relative z-10">
                            <Users className="w-8 h-8 text-botanical-forest" />
                        </div>
                        <p className="text-botanical-parchment font-display mb-2 relative z-10">No friends yet</p>
                        <p className="text-sm text-botanical-sepia font-mono mb-4 relative z-10">
                            Search for users to add them as friends
                        </p>
                        <button
                            onClick={() => setTab('search')}
                            className="px-6 py-2 bg-botanical-forest text-white rounded-full font-medium active:scale-95 transition-transform"
                        >
                            Find Friends
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {acceptedFriends.map(friend => (
                            <div
                                key={friend.id}
                                className="flex items-center gap-3 p-4 botanical-card rounded-2xl relative overflow-hidden group"
                            >
                                {/* Decorative corner accent */}
                                <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-botanical-forest/20 rounded-tl group-hover:border-botanical-forest/40 transition-colors" />

                                <Link to={`/profile/${friend.id}`}>
                                    <Avatar src={friend.avatar} size="lg" />
                                </Link>
                                <Link to={`/profile/${friend.id}`} className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-display font-semibold truncate text-botanical-parchment">{friend.username}</p>
                                        {friend.isOwner ? (
                                            <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full">OWNER</span>
                                        ) : friend.isAdmin ? (
                                            <span className="px-1.5 py-0.5 bg-red-400 text-white text-[8px] font-bold rounded-full">ADMIN</span>
                                        ) : null}
                                    </div>
                                    {friend.bio && (
                                        <p className="text-xs text-botanical-sepia font-mono truncate mt-0.5">{friend.bio}</p>
                                    )}
                                </Link>
                                <div className="flex gap-2">
                                    <Link
                                        to={`/messages/${friend.id}`}
                                        className="p-2.5 bg-botanical-forest/10 text-botanical-forest rounded-xl active:scale-95 transition-transform hover:bg-botanical-forest/20"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </Link>
                                    <button
                                        onClick={() => handleDeclineOrRemove(friend.id)}
                                        className="p-2.5 bg-red-500/10 text-red-500 rounded-xl active:scale-95 transition-transform hover:bg-red-500/20"
                                    >
                                        <UserMinus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Requests Tab */}
            {tab === 'requests' && (
                <div className="space-y-6">
                    {/* Incoming */}
                    {incomingRequests.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-botanical-sepia mb-3 flex items-center gap-2 mt-2 ml-2">
                                <span className="w-2 h-2 rounded-full bg-red-400"></span> Incoming Requests
                            </h3>
                            <div className="space-y-3">
                                {incomingRequests.map(req => (
                                    <div
                                        key={req.id}
                                        className="flex items-center gap-3 p-4 botanical-card border-l-2 border-l-red-400 rounded-2xl"
                                    >
                                        <Link to={`/profile/${req.id}`}>
                                            <Avatar src={req.avatar} size="lg" />
                                        </Link>
                                        <Link to={`/profile/${req.id}`} className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-display font-semibold truncate text-botanical-parchment">{req.username}</p>
                                                {/* roles */}
                                                {req.isOwner ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full">OWNER</span>
                                                ) : req.isAdmin ? (
                                                    <span className="px-1.5 py-0.5 bg-red-400 text-white text-[8px] font-bold rounded-full">ADMIN</span>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-botanical-sepia font-mono mt-0.5">Wants to be friends</p>
                                        </Link>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptRequest(req.id, req.username)}
                                                className="p-2.5 bg-botanical-forest text-white rounded-xl active:scale-95 transition-transform shadow-md shadow-botanical-forest/30"
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeclineOrRemove(req.id, true)}
                                                className="p-2.5 bg-red-500/10 text-red-500 rounded-xl active:scale-95 transition-transform"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Outgoing */}
                    {outgoingRequests.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-botanical-sepia mb-3 mt-6 ml-2">
                                Pending Requests
                            </h3>
                            <div className="space-y-3">
                                {outgoingRequests.map(req => (
                                    <div
                                        key={req.id}
                                        className="flex items-center gap-3 p-4 botanical-card rounded-2xl opacity-80"
                                    >
                                        <Link to={`/profile/${req.id}`}>
                                            <Avatar src={req.avatar} size="lg" />
                                        </Link>
                                        <Link to={`/profile/${req.id}`} className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-display font-semibold truncate text-botanical-parchment">{req.username}</p>
                                                {req.isOwner ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full">OWNER</span>
                                                ) : req.isAdmin ? (
                                                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full">ADMIN</span>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-botanical-sepia font-mono mt-0.5" style={{ fontStyle: 'italic' }}>Request sent...</p>
                                        </Link>
                                        <button
                                            onClick={() => handleDeclineOrRemove(req.id, true)}
                                            className="px-4 py-2 text-xs font-mono text-botanical-sepia hover:text-red-500 transition-colors bg-white/50 rounded-lg border border-botanical-forest/10"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                        <div className="text-center py-12 botanical-card rounded-3xl relative overflow-hidden">
                            <div className="w-16 h-16 rounded-full bg-botanical-forest/10 flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-botanical-forest" />
                            </div>
                            <p className="text-botanical-sepia font-mono">No pending requests</p>
                        </div>
                    )}
                </div>
            )}

            {/* Search Tab */}
            {tab === 'search' && (
                <div>
                    {/* Search Input */}
                    <div className="relative mb-6 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-botanical-forest transition-colors group-focus-within:text-botanical-forest" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by username or share code"
                            className="w-full pl-12 pr-4 py-4 botanical-card focus:bg-white border-2 border-transparent focus:border-botanical-forest/20 rounded-2xl focus:outline-none focus:ring-4 focus:ring-botanical-forest/10 transition-all font-mono text-botanical-parchment placeholder:text-botanical-sepia/50 shadow-sm"
                            autoFocus
                        />
                    </div>

                    {/* Search Results */}
                    {searching ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-2 border-botanical-forest/20 border-t-botanical-forest rounded-full animate-spin" />
                        </div>
                    ) : searchQuery.length < 2 ? (
                        <div className="text-center py-12 botanical-card rounded-3xl">
                            <div className="w-12 h-12 bg-botanical-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-6 h-6 text-botanical-sepia" />
                            </div>
                            <p className="text-botanical-sepia font-mono text-sm">
                                Enter at least 2 characters to search
                            </p>
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className="text-center py-12 botanical-card rounded-3xl">
                            <p className="text-botanical-sepia font-mono">No users found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {searchResults.map(user => {
                                const existingFriend = friends.find(f => f.id === user.id);
                                const isFriend = existingFriend?.status === 'accepted';
                                const isPending = existingFriend?.status === 'pending';

                                return (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-3 p-4 botanical-card rounded-2xl"
                                    >
                                        <Link to={`/profile/${user.id}`}>
                                            <Avatar src={user.avatar} size="lg" />
                                        </Link>
                                        <Link to={`/profile/${user.id}`} className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-display font-semibold truncate text-botanical-parchment">{user.username}</p>
                                                {user.isOwner ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full">OWNER</span>
                                                ) : user.isAdmin ? (
                                                    <span className="px-1.5 py-0.5 bg-red-400 text-white text-[8px] font-bold rounded-full">ADMIN</span>
                                                ) : null}
                                            </div>
                                            {user.bio && (
                                                <p className="text-xs text-botanical-sepia font-mono truncate mt-0.5">{user.bio}</p>
                                            )}
                                        </Link>
                                        {isFriend ? (
                                            <span className="text-xs text-botanical-forest font-bold px-3 py-1 bg-botanical-forest/10 rounded-lg uppercase tracking-wider">Friends</span>
                                        ) : isPending || user.requestSent ? (
                                            <span className="text-xs text-botanical-sepia px-3 py-1 font-mono italic">Pending</span>
                                        ) : (
                                            <button
                                                onClick={() => handleSendRequest(user.id)}
                                                className="p-2.5 bg-botanical-forest text-white rounded-xl active:scale-95 transition-transform hover:shadow-lg hover:shadow-botanical-forest/20"
                                            >
                                                <UserPlus className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
