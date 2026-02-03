import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Search, UserPlus, UserMinus, Check, X, 
    MessageCircle, Users, Clock, ChevronRight
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
            toast.error(err.message);
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
            toast.error(err.message);
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
            toast.error(err.message);
        }
    };

    const acceptedFriends = friends.filter(f => f.status === 'accepted');
    const incomingRequests = friends.filter(f => f.status === 'pending' && !f.isOutgoing);
    const outgoingRequests = friends.filter(f => f.status === 'pending' && f.isOutgoing);

    return (
        <div className="animate-in fade-in duration-300">
            <div className="mb-6">
                <h1 className="text-2xl font-display font-bold mb-1">Friends</h1>
                <p className="text-claude-secondary text-sm">Connect with other learners</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
                <button
                    onClick={() => setTab('friends')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        tab === 'friends' 
                            ? 'bg-claude-accent text-white' 
                            : 'bg-claude-surface text-claude-secondary'
                    }`}
                >
                    <Users className="w-4 h-4 inline mr-1.5" />
                    Friends ({acceptedFriends.length})
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors relative ${
                        tab === 'requests' 
                            ? 'bg-claude-accent text-white' 
                            : 'bg-claude-surface text-claude-secondary'
                    }`}
                >
                    <Clock className="w-4 h-4 inline mr-1.5" />
                    Requests
                    {incomingRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                            {incomingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('search')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        tab === 'search' 
                            ? 'bg-claude-accent text-white' 
                            : 'bg-claude-surface text-claude-secondary'
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
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-claude-surface flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-claude-secondary" />
                        </div>
                        <p className="text-claude-secondary mb-2">No friends yet</p>
                        <p className="text-sm text-claude-secondary mb-4">
                            Search for users to add them as friends
                        </p>
                        <button 
                            onClick={() => setTab('search')}
                            className="px-6 py-2 bg-claude-accent text-white rounded-full font-medium"
                        >
                            Find Friends
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {acceptedFriends.map(friend => (
                            <div
                                key={friend.id}
                                className="flex items-center gap-3 p-4 bg-claude-surface border border-claude-border rounded-2xl"
                            >
                                <Link to={`/profile/${friend.id}`}>
                                    <Avatar src={friend.avatar} size="lg" />
                                </Link>
                                <Link to={`/profile/${friend.id}`} className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{friend.username}</p>
                                    {friend.bio && (
                                        <p className="text-sm text-claude-secondary truncate">{friend.bio}</p>
                                    )}
                                </Link>
                                <div className="flex gap-2">
                                    <Link
                                        to={`/messages/${friend.id}`}
                                        className="p-2.5 bg-claude-accent/10 text-claude-accent rounded-xl active:scale-95 transition-transform"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </Link>
                                    <button
                                        onClick={() => handleDeclineOrRemove(friend.id)}
                                        className="p-2.5 bg-red-500/10 text-red-500 rounded-xl active:scale-95 transition-transform"
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
                            <h3 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                Incoming Requests
                            </h3>
                            <div className="space-y-2">
                                {incomingRequests.map(req => (
                                    <div
                                        key={req.id}
                                        className="flex items-center gap-3 p-4 bg-claude-surface border border-claude-border rounded-2xl"
                                    >
                                        <Link to={`/profile/${req.id}`}>
                                            <Avatar src={req.avatar} size="lg" />
                                        </Link>
                                        <Link to={`/profile/${req.id}`} className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{req.username}</p>
                                            <p className="text-sm text-claude-secondary">Wants to be friends</p>
                                        </Link>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptRequest(req.id, req.username)}
                                                className="p-2.5 bg-green-500 text-white rounded-xl active:scale-95 transition-transform"
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
                            <h3 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                Pending Requests
                            </h3>
                            <div className="space-y-2">
                                {outgoingRequests.map(req => (
                                    <div
                                        key={req.id}
                                        className="flex items-center gap-3 p-4 bg-claude-surface border border-claude-border rounded-2xl"
                                    >
                                        <Link to={`/profile/${req.id}`}>
                                            <Avatar src={req.avatar} size="lg" />
                                        </Link>
                                        <Link to={`/profile/${req.id}`} className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{req.username}</p>
                                            <p className="text-sm text-claude-secondary">Request pending</p>
                                        </Link>
                                        <button
                                            onClick={() => handleDeclineOrRemove(req.id, true)}
                                            className="px-4 py-2 text-sm text-red-500 font-medium"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-claude-surface flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-claude-secondary" />
                            </div>
                            <p className="text-claude-secondary">No pending requests</p>
                        </div>
                    )}
                </div>
            )}

            {/* Search Tab */}
            {tab === 'search' && (
                <div>
                    {/* Search Input */}
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by username or share code"
                            className="w-full pl-12 pr-4 py-3 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                            autoFocus
                        />
                    </div>

                    {/* Search Results */}
                    {searching ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : searchQuery.length < 2 ? (
                        <div className="text-center py-12">
                            <p className="text-claude-secondary">
                                Enter at least 2 characters to search
                            </p>
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-claude-secondary">No users found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {searchResults.map(user => {
                                const existingFriend = friends.find(f => f.id === user.id);
                                const isFriend = existingFriend?.status === 'accepted';
                                const isPending = existingFriend?.status === 'pending';
                                
                                return (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-3 p-4 bg-claude-surface border border-claude-border rounded-2xl"
                                    >
                                        <Link to={`/profile/${user.id}`}>
                                            <Avatar src={user.avatar} size="lg" />
                                        </Link>
                                        <Link to={`/profile/${user.id}`} className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{user.username}</p>
                                            {user.bio && (
                                                <p className="text-sm text-claude-secondary truncate">{user.bio}</p>
                                            )}
                                        </Link>
                                        {isFriend ? (
                                            <span className="text-sm text-green-500 font-medium px-3">Friends</span>
                                        ) : isPending || user.requestSent ? (
                                            <span className="text-sm text-claude-secondary px-3">Pending</span>
                                        ) : (
                                            <button
                                                onClick={() => handleSendRequest(user.id)}
                                                className="p-2.5 bg-claude-accent text-white rounded-xl active:scale-95 transition-transform"
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
