import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Search, Image, Layers,
    Check, CheckCheck, MoreVertical, Trash2, Leaf, Edit2, X, ShieldAlert, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import ReportModal from '../components/ui/ReportModal';
import * as authApi from '../api/authApi';
import gsap from 'gsap';
import { EASE, DURATION, STAGGER } from '../utils/animations';
import FileViewer from '../components/FileViewer';
import { useVirtualizer } from '@tanstack/react-virtual';

// Persistent session-aware message cache — survives page reloads via sessionStorage
const CACHE_KEY = 'riven_msg_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (realtime subscriptions keep state live)
const MAX_CACHED_CONVERSATIONS = 50;
const messageCache = {
    _userId: null,
    _loaded: false,
    messages: {},
    users: {},
    conversations: null,
    times: {},
    /** Hydrate from sessionStorage on first access */
    _hydrate(userId) {
        if (this._loaded) return;
        this._loaded = true;
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed._userId === userId) {
                    this.messages = parsed.messages || {};
                    this.users = parsed.users || {};
                    this.conversations = parsed.conversations || null;
                    this.times = parsed.times || {};
                }
            }
        } catch { /* corrupt cache, ignore */ }
    },
    _persist() {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                _userId: this._userId,
                messages: this.messages,
                users: this.users,
                conversations: this.conversations,
                times: this.times,
            }));
        } catch { /* storage full, ignore */ }
    },
    /** Reset cache if user changed, or clear entirely */
    ensure(userId) {
        this._hydrate(userId);
        if (this._userId !== userId) {
            this.messages = {};
            this.users = {};
            this.conversations = null;
            this.times = {};
            this._userId = userId;
            this._persist();
        }
    },
    /** Evict oldest entries if cache is too large */
    _trim() {
        const keys = Object.keys(this.messages);
        if (keys.length > MAX_CACHED_CONVERSATIONS) {
            const sorted = keys.sort((a, b) => (this.times[a] || 0) - (this.times[b] || 0));
            for (const key of sorted.slice(0, keys.length - MAX_CACHED_CONVERSATIONS)) {
                delete this.messages[key];
                delete this.users[key];
                delete this.times[key];
            }
        }
    },
    setMessages(targetId, data) {
        this.messages[targetId] = data;
        this.times[targetId] = Date.now();
        this._trim();
        this._persist();
    },
    setConversations(data) {
        this.conversations = data;
        this._persist();
    },
    setUser(targetId, data) {
        this.users[targetId] = data;
        this._persist();
    },
};

export default function Messages() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn, user } = useAuth();

    // Ensure cache is valid for current user
    messageCache.ensure(user?.id);

    const [conversations, setConversations] = useState(messageCache.conversations || []);
    const [messages, setMessages] = useState(userId && messageCache.messages[userId] ? messageCache.messages[userId] : []);
    const [chatUser, setChatUser] = useState(userId && messageCache.users[userId] ? messageCache.users[userId] : null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(!userId || !messageCache.messages[userId]);
    const [sending, setSending] = useState(false);
    const [acceptingDeck, setAcceptingDeck] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [conversationQuery, setConversationQuery] = useState('');
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    // Reporting state
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [reportingMessageId, setReportingMessageId] = useState(null);

    // File Viewer State
    const [selectedFile, setSelectedFile] = useState(null);
    const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);

    const scrollParentRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const loadedMsgIdsRef = useRef(new Set());
    const convListRef = useRef(null);
    const chatViewRef = useRef(null);

    // Infinite scroll state
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    // "New messages" pill — shown when user is scrolled up and new messages arrive
    const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
    const isNearBottomRef = useRef(true);
    const typingPresenceRef = useRef(null);

    // GSAP reveal for conversations list
    useEffect(() => {
        if (userId || !convListRef.current) return;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        gsap.fromTo(convListRef.current,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.organic, clearProps: 'all' }
        );
    }, [userId, conversations.length]);

    // GSAP reveal for chat view
    useEffect(() => {
        if (!userId || !chatViewRef.current) return;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        gsap.fromTo(chatViewRef.current,
            { opacity: 0 },
            { opacity: 1, duration: DURATION.normal, ease: EASE.organic, clearProps: 'all' }
        );
    }, [userId]);

    // Load conversations list
    const loadConversations = useCallback(async () => {
        try {
            if (messageCache.conversations) {
                setConversations(messageCache.conversations);
            }
            const data = await authApi.getConversations(user);
            messageCache.setConversations(data);
            setConversations(data);
        } catch {
            // Failed to load conversations silently
        }
    }, [user]);

    // Invalidate conversations cache so the list refreshes on next visit
    const invalidateConversations = useCallback(() => {
        messageCache.setConversations(null);
    }, []);

    const hydrateConversationMessages = useCallback((threadMessages, profile) => {
        return (threadMessages || []).map((message) => {
            if (message.isMine) return message;

            return {
                ...message,
                senderAvatar: message.senderAvatar ?? profile?.avatar ?? null,
                senderUsername: message.senderUsername ?? profile?.username ?? null,
            };
        });
    }, []);

    // Load messages for specific user
    const loadMessages = useCallback(async (targetUserId) => {
        const cached = messageCache.messages[targetUserId];
        const cachedUser = messageCache.users[targetUserId];
        const cacheTime = messageCache.times[targetUserId] || 0;
        const hasFreshCache = cached && cachedUser && (Date.now() - cacheTime < CACHE_TTL);

        if (cached && cachedUser) {
            setMessages(cached);
            setChatUser(cachedUser);
            // Seed the loaded IDs set so cached messages don't animate
            loadedMsgIdsRef.current = new Set(cached.map(m => m.id));
            setLoading(false);

            // Skip network call if cache is fresh — realtime subscriptions keep it live
            if (hasFreshCache) return;
        } else {
            setLoading(true);
        }

        try {
            const conversationFallback = conversations.find((conversation) => String(conversation.userId) === String(targetUserId));
            const [messagesResult, userResult] = await Promise.allSettled([
                authApi.getMessages(targetUserId, 50, undefined, user),
                authApi.getUserProfile(targetUserId)
            ]);

            if (messagesResult.status !== 'fulfilled') {
                throw messagesResult.reason;
            }

            const fallbackUser = cachedUser
                || (conversationFallback ? {
                    id: conversationFallback.userId,
                    username: conversationFallback.username,
                    avatar: conversationFallback.avatar ?? null,
                } : null)
                || chatUser
                || { id: Number(targetUserId), username: 'Unknown', avatar: null };

            const resolvedUser = userResult.status === 'fulfilled'
                ? userResult.value
                : fallbackUser;

            if (userResult.status !== 'fulfilled') {
                console.warn('[Messages] Failed to load chat profile:', userResult.reason?.message || userResult.reason);
            }

            const hydratedMessages = hydrateConversationMessages(messagesResult.value, resolvedUser);

            messageCache.setMessages(targetUserId, hydratedMessages);
            messageCache.setUser(targetUserId, resolvedUser);

            // Seed loaded IDs so fetched messages don't animate
            loadedMsgIdsRef.current = new Set(hydratedMessages.map(m => m.id));

            setMessages(hydratedMessages);
            setChatUser(resolvedUser);
        } catch {
            toast.error('Failed to load messages');
            navigate('/messages');
        } finally {
            setLoading(false);
        }
    }, [chatUser, conversations, hydrateConversationMessages, navigate, toast, user]);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/account');
            return;
        }

        loadConversations();

        if (userId) {
            loadMessages(userId);
        } else {
            setLoading(false);
        }
    }, [isLoggedIn, userId, loadConversations, loadMessages, navigate]);

    // Virtualizer for message list
    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollParentRef.current,
        estimateSize: () => 72,
        overscan: 15,
    });

    // Track whether user is near the bottom of the scroll
    const checkNearBottom = useCallback(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        const threshold = 150;
        isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        if (isNearBottomRef.current) setShowNewMessagesPill(false);
    }, []);

    // Scroll to bottom (used for new messages, initial load)
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        if (messages.length > 0) {
            virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior });
        }
        setShowNewMessagesPill(false);
    }, [messages.length, virtualizer]);

    // Auto-scroll to bottom on new messages (only if user is near bottom)
    const prevMsgCountRef = useRef(messages.length);
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            if (isNearBottomRef.current) {
                // Small delay so virtualizer measures the new item first
                requestAnimationFrame(() => scrollToBottom('smooth'));
            } else {
                setShowNewMessagesPill(true);
            }
        }
        prevMsgCountRef.current = messages.length;
    }, [messages.length, scrollToBottom]);

    // Scroll to bottom on initial load / conversation switch
    const prevUserIdRef = useRef(userId);
    useEffect(() => {
        if (userId !== prevUserIdRef.current) {
            prevUserIdRef.current = userId;
            setHasMore(true);
            setShowNewMessagesPill(false);
        }
    }, [userId]);
    useEffect(() => {
        if (!loading && messages.length > 0) {
            // Instant scroll on initial load
            requestAnimationFrame(() => scrollToBottom('auto'));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, userId]);

    // Scroll to bottom when typing indicator appears (if near bottom)
    useEffect(() => {
        if (isTyping && isNearBottomRef.current) {
            requestAnimationFrame(() => scrollToBottom('smooth'));
        }
    }, [isTyping, scrollToBottom]);

    // Infinite scroll — load older messages when scrolled near top
    const loadOlderMessages = useCallback(async () => {
        if (!hasMore || loadingMore || messages.length === 0 || !userId) return;
        setLoadingMore(true);
        const oldestMessage = messages[0];
        const prevHeight = scrollParentRef.current?.scrollHeight || 0;
        try {
            const olderMessages = await authApi.getMessages(userId, 50, oldestMessage.createdAt, user);
            if (olderMessages.length < 50) setHasMore(false);
            if (olderMessages.length > 0) {
                // Mark old messages as loaded so they don't animate
                olderMessages.forEach(m => loadedMsgIdsRef.current.add(m.id));
                setMessages(prev => {
                    const combined = [...olderMessages, ...prev];
                    messageCache.setMessages(userId, combined);
                    return combined;
                });
                // Preserve scroll position after prepend
                requestAnimationFrame(() => {
                    const el = scrollParentRef.current;
                    if (el) {
                        const newHeight = el.scrollHeight;
                        el.scrollTop += newHeight - prevHeight;
                    }
                });
            }
        } catch {
            toast.error('Failed to load older messages');
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, messages, toast, user, userId]);

    // Detect scroll near top to trigger loading older messages
    useEffect(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        const handleScroll = () => {
            checkNearBottom();
            if (el.scrollTop < 100 && !loadingMore && hasMore && messages.length > 0) {
                loadOlderMessages();
            }
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [checkNearBottom, loadOlderMessages, loadingMore, hasMore, messages.length]);

    // Background prefetching of top conversations
    useEffect(() => {
        if (!conversations.length || userId) return;
        const toPrefetch = conversations
            .slice(0, 5)
            .filter(c => !messageCache.messages[c.userId] ||
                Date.now() - (messageCache.times[c.userId] || 0) > CACHE_TTL);
        const timers = toPrefetch.map(conv =>
            setTimeout(async () => {
                try {
                    const [msgs, profile] = await Promise.all([
                        authApi.getMessages(conv.userId, 50, undefined, user),
                        authApi.getUserProfile(conv.userId)
                    ]);
                    messageCache.setMessages(conv.userId, msgs);
                    messageCache.setUser(conv.userId, profile);
                } catch { /* prefetch failure is non-critical */ }
            }, 0)
        );
        return () => timers.forEach(id => clearTimeout(id));
    }, [conversations, user, userId]);

    // Supabase Realtime listeners for DM rows
    useEffect(() => {
        if (!user?.id) return;

        const activeThreadUserId = userId ? parseInt(userId) : null;

        const hydrateThreadMessage = (message) => {
            if (!message || !activeThreadUserId) return message;
            if (message.senderId !== activeThreadUserId && message.receiverId !== activeThreadUserId) {
                return message;
            }
            return hydrateConversationMessages([message], chatUser)[0];
        };

        const handleNewMessage = (msg) => {
            const hydrated = hydrateThreadMessage(msg);

            if (activeThreadUserId && (hydrated.senderId === activeThreadUserId || hydrated.receiverId === activeThreadUserId)) {
                setMessages(prev => {
                    if (prev.find(m => m.id === hydrated.id)) return prev;
                    const updated = [...prev, hydrated];
                    messageCache.setMessages(userId, updated);
                    return updated;
                });

                if (hydrated.senderId === activeThreadUserId) {
                    setIsTyping(false);
                }
            } else if (!userId) {
                loadConversations();
            }
            invalidateConversations();
        };

        const handleMessageUpdated = (msg) => {
            const hydrated = hydrateThreadMessage(msg);

            if (userId) {
                setMessages(prev => {
                    const updated = prev.map(m => m.id === hydrated.id ? { ...m, ...hydrated } : m);
                    messageCache.setMessages(userId, updated);
                    return updated;
                });
            } else {
                loadConversations();
            }
            invalidateConversations();
        };

        const handleMessageDeleted = ({ id }) => {
            if (userId) {
                setMessages(prev => {
                    const updated = prev.filter(m => m.id !== id);
                    messageCache.setMessages(userId, updated);
                    return updated;
                });
            } else {
                loadConversations();
            }
            invalidateConversations();
        };

        const unsubscribe = authApi.subscribeToMessages(user.id, {
            onInsert: handleNewMessage,
            onUpdate: handleMessageUpdated,
            onDelete: handleMessageDeleted,
        });

        return () => {
            unsubscribe();
        };
    }, [chatUser, hydrateConversationMessages, invalidateConversations, loadConversations, user?.id, userId]);

    useEffect(() => {
        if (!userId) {
            setIsTyping(false);
            return;
        }

        const presence = authApi.subscribeToTypingPresence(user?.id, userId, {
            onTypingChange: setIsTyping,
        });

        typingPresenceRef.current = presence;

        return () => {
            presence.stopTyping?.();
            presence.unsubscribe?.();
            if (typingPresenceRef.current === presence) {
                typingPresenceRef.current = null;
            }
        };
    }, [user?.id, userId]);

    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, []);

    const handleTypingStart = () => {
        if (!userId) return;

        typingPresenceRef.current?.startTyping?.();

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set a timeout to stop typing after 2.5s of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            typingPresenceRef.current?.stopTyping?.();
        }, 2500);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
                inputRef.current?.focus();
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (editingMessageId) {
            if (!newMessage.trim() || sending) return;
            setSending(true);
            try {
                const updatedMsg = await authApi.editMessage(editingMessageId, newMessage.trim(), user);
                setMessages(prev => {
                    const updated = prev.map(m => m.id === editingMessageId ? updatedMsg : m);
                    if (userId) messageCache.setMessages(userId, updated);
                    return updated;
                });
                invalidateConversations();
                setNewMessage('');
                setEditingMessageId(null);
            } catch {
                toast.error('Failed to edit message');
            } finally {
                setSending(false);
            }
            return;
        }

        if ((!newMessage.trim() && !imagePreview) || sending) return;

        setSending(true);
        haptics.light();

        // Stop typing indicator immediately
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingPresenceRef.current?.stopTyping?.();

        try {
            const message = await authApi.sendMessage(userId, newMessage.trim() || '', 'text', null, imagePreview, user);
            setMessages(prev => {
                const updated = [...prev, message];
                messageCache.setMessages(userId, updated);
                return updated;
            });
            invalidateConversations();
            setNewMessage('');
            setImagePreview(null);
            inputRef.current?.focus();
        } catch {
            haptics.error();
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleDeleteMessage = async (msgId) => {
        if (!window.confirm('Are you sure you want to delete this message?')) return;
        try {
            await authApi.deleteMessage(msgId);
            setMessages(prev => {
                const updated = prev.filter(m => m.id !== msgId);
                if (userId) messageCache.setMessages(userId, updated);
                return updated;
            });
            invalidateConversations();
            setActiveMenuId(null);
            toast.success('Message deleted');
            haptics.medium();
        } catch {
            toast.error('Failed to delete message');
            haptics.error();
        }
    };

    const startEditing = (msg) => {
        setEditingMessageId(msg.id);
        setNewMessage(msg.content);
        setImagePreview(null);
        setActiveMenuId(null);
        inputRef.current?.focus();
    };

    const handleReportMessageSubmit = async (reason, details) => {
        setIsReporting(true);
        try {
            await authApi.reportContent({
                reportedUserId: chatUser.id,
                contentType: 'message',
                contentId: reportingMessageId,
                reason,
                details
            });
            toast.success('Message reported successfully. Thank you.');
            setIsReportModalOpen(false);
            setReportingMessageId(null);
        } catch (err) {
            toast.error(err.message || 'Failed to submit report');
        } finally {
            setIsReporting(false);
        }
    };

    const handleAcceptDeck = async (messageId) => {
        setAcceptingDeck(messageId);
        try {
            const { newDeck } = await authApi.acceptSharedDeck(messageId);
            toast.success(`Deck "${newDeck.title}" added to your collection!`);
            // Update local messages to show accepted
            setMessages(prev => prev.map(m => {
                if (m.id === messageId) {
                    return {
                        ...m,
                        deckData: {
                            ...m.deckData,
                            acceptedDeckId: newDeck.id
                        }
                    };
                }
                return m;
            }));
            haptics.light();
        } catch (error) {
            toast.error(error.message || 'Failed to accept deck');
            haptics.error();
        } finally {
            setAcceptingDeck(null);
        }
    };

    const formatTime = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return 'now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const filteredConversations = useMemo(() => {
        const normalizedQuery = conversationQuery.trim().toLowerCase();

        return conversations.filter((conv) => {
            if (showUnreadOnly && conv.unreadCount <= 0 && String(conv.userId) !== String(userId)) {
                return false;
            }

            if (!normalizedQuery) return true;

            const haystack = [
                conv.username,
                conv.lastMessage,
                conv.lastMessageType === 'deck' ? 'shared deck' : '',
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [conversationQuery, conversations, showUnreadOnly, userId]);

    const unreadConversationCount = useMemo(
        () => conversations.filter((conv) => conv.unreadCount > 0).length,
        [conversations]
    );
    const sharedDeckCount = useMemo(
        () => messages.filter((msg) => msg.messageType === 'deck' && msg.deckData).length,
        [messages]
    );
    const threadMessageCount = messages.length;

    const renderConversationsList = ({ embedded = false } = {}) => {
        if (user?.is_banned) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center sm:max-w-md sm:mx-auto">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-claude-text mb-3">Messaging Disabled</h2>
                    <p className="text-sm text-claude-secondary leading-relaxed max-w-xs">
                        Your account has been restricted from using social features due to a violation of our community guidelines.
                    </p>
                </div>
            );
        }

        return (
                <div
                    ref={convListRef}
                    className={`${embedded ? 'h-full' : 'pb-24 sm:max-w-md sm:mx-auto'} w-full gsap-conv-list`}
                >
                <div className={`relative ${embedded ? 'mb-4 px-1' : 'mb-6'}`}>
                    {embedded ? (
                        <>
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-claude-secondary">Social</p>
                            <h2 className="mt-2 text-2xl font-display font-bold text-claude-text">Conversations</h2>
                            <p className="text-claude-secondary text-sm font-mono">Keep your study circle in view</p>
                        </>
                        ) : (
                            <>
                                <div className="absolute top-2 left-0 w-8 h-8 opacity-10">
                                    <Leaf className="w-full h-full text-claude-accent rotate-12" />
                                </div>
                            <h1 className="text-2xl font-display font-bold mb-1">Messages</h1>
                            <p className="text-claude-secondary text-sm font-mono">Chat with your friends</p>
                            </>
                        )}
                    </div>

                    {conversations.length > 0 ? (
                        <div className={`mb-4 space-y-3 ${embedded ? 'px-1' : ''}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary">
                                    {filteredConversations.length} shown • {unreadConversationCount} unread
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowUnreadOnly((current) => !current)}
                                    className={`rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] transition-colors ${showUnreadOnly
                                        ? 'border-claude-accent/30 bg-claude-accent/10 text-claude-accent'
                                        : 'border-claude-border bg-claude-bg/15 text-claude-secondary hover:text-claude-text'
                                        }`}
                                >
                                    {showUnreadOnly ? 'Unread only' : 'Show unread'}
                                </button>
                            </div>

                            <label className="glass-panel flex items-center gap-2 rounded-2xl border border-claude-border px-3 py-3">
                                <Search className="h-4 w-4 text-claude-secondary" />
                                <input
                                    type="search"
                                    value={conversationQuery}
                                    onChange={(event) => setConversationQuery(event.target.value)}
                                    placeholder="Search people or messages"
                                    className="w-full bg-transparent text-sm text-claude-text placeholder:text-claude-secondary/70 focus:outline-none"
                                    aria-label="Search conversations"
                                />
                            </label>
                        </div>
                    ) : null}

                {conversations.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="relative mx-auto mb-6 w-20 h-20">
                            <div className="glass-panel absolute inset-0 rounded-full flex items-center justify-center">
                                <Send className="w-8 h-8 text-claude-accent" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-claude-accent/20 flex items-center justify-center">
                                <Leaf className="w-3 h-3 text-claude-accent" />
                            </div>
                        </div>
                        <p className="text-claude-text font-display mb-2">No conversations yet</p>
                        <p className="text-sm text-claude-secondary font-mono mb-6">
                            Start connecting with friends
                        </p>
                        <Link
                            to="/friends"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-claude-accent text-white rounded-full font-medium active:scale-95 transition-transform"
                        >
                            <Leaf className="w-4 h-4" />
                            Find Friends
                        </Link>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="glass-panel rounded-3xl border border-claude-border px-5 py-10 text-center">
                        <Search className="mx-auto mb-3 h-6 w-6 text-claude-secondary/70" />
                        <p className="font-display text-claude-text">No conversations match</p>
                        <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            Clear the search or widen the filter.
                        </p>
                    </div>
                ) : (
                    <div className={`space-y-3 ${embedded ? 'max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1' : ''}`}>
                        <AnimatePresence mode="popLayout">
                            {filteredConversations.map((conv, index) => (
                                <motion.div
                                    key={conv.userId}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 12 }}
                                    transition={{
                                        delay: index * 0.05,
                                        duration: 0.3,
                                        ease: [0.25, 0.1, 0.25, 1]
                                    }}
                                >
                                    <Link
                                        to={`/messages/${conv.userId}`}
                                        className={`glass-panel flex items-center gap-4 p-4 active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] block group relative overflow-hidden ${String(conv.userId) === String(userId) ? 'border border-claude-accent/30 bg-claude-accent/10' : ''}`}
                                    >
                                        <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-claude-accent/20 rounded-tr group-hover:border-claude-accent/40 transition-colors" />

                                        <div className="relative shrink-0">
                                            <Avatar src={conv.avatar} size="lg" />
                                            {conv.unreadCount > 0 && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -top-1 -right-1 w-6 h-6 bg-claude-accent rounded-full flex items-center justify-center shadow-sm md:shadow-lg"
                                                >
                                                    <span className="text-xs text-white font-bold">
                                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                    </span>
                                                </motion.div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-display truncate ${conv.unreadCount > 0 || String(conv.userId) === String(userId) ? 'text-claude-text' : 'text-claude-text'}`}>
                                                    {conv.username}
                                                </span>
                                                <span className="text-xs text-claude-secondary shrink-0 ml-2 font-mono">
                                                    {formatTime(conv.lastMessageAt)}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate font-mono ${conv.unreadCount > 0 ? 'text-claude-text font-medium' : 'text-claude-secondary'}`}>
                                                {conv.isOwnMessage && <span className="text-claude-secondary/70">You: </span>}
                                                {conv.lastMessageType === 'deck' ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Layers className="w-3 h-3 inline" /> Shared a deck
                                                    </span>
                                                ) : conv.lastMessage}
                                            </p>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        );
    };

    const handleViewFile = (url, name) => {
        const fileExtension = url.split('?')[0].split('.').pop().toLowerCase();
        setSelectedFile({
            name: name || 'Attached Image',
            url: url,
            extension: fileExtension
        });
        setIsFileViewerOpen(true);
    };

    // Conversations List View
    if (!userId) {
        return renderConversationsList();
    }

    // Chat View
    return (
        <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6 lg:items-start lg:min-h-[calc(100dvh-6rem)]">
            <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start lg:h-[calc(100dvh-8rem)] lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-claude-border lg:bg-claude-bg/70 lg:p-5 lg:backdrop-blur-xl">
                {renderConversationsList({ embedded: true })}
            </aside>
	            <div
	                ref={chatViewRef}
	                className="fixed inset-0 bg-claude-bg z-50 flex flex-col safe-area-top sm:max-w-md sm:mx-auto sm:border-x sm:border-claude-border sm:shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:h-[calc(100dvh-8rem)] lg:max-w-none lg:mx-0 lg:rounded-[32px] lg:border lg:border-claude-border lg:shadow-2xl lg:overflow-hidden"
	            >
            {/* Botanical Chat Header with decorative elements */}
            <div className="header-blur flex items-center gap-3 p-4 border-b border-claude-border shrink-0 relative z-20 bg-claude-bg/90 md:backdrop-blur-xl">
                {/* Decorative corner marks */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-claude-accent/20 rounded-tl" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-claude-accent/20 rounded-br" />

                <button
                    onClick={() => navigate('/messages')}
                    className="touch-target -ml-2 rounded-lg hover:bg-claude-border/20 transition-colors focus-ring lg:hidden"
                    aria-label="Back to conversations"
                >
                    <ArrowLeft className="w-6 h-6" aria-hidden="true" />
                </button>

	                {chatUser && (
	                    <Link
	                        to={`/profile/${chatUser.id}`}
	                        className="flex items-center gap-3 flex-1 min-w-0 p-2 -my-2 rounded-xl hover:bg-claude-border/10 active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow]"
                    >
                        <div className="relative">
                            <Avatar src={chatUser.avatar} size="md" />
                            {/* Online indicator - could be added based on user status */}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-claude-accent rounded-full border-2 border-claude-bg" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-display font-semibold truncate">{chatUser.username}</p>
                            <p className="text-xs text-claude-secondary font-mono">Tap to view profile</p>
	                        </div>
	                    </Link>
	                )}
                    <div className="hidden lg:flex items-center gap-2 shrink-0">
                        <div className="rounded-full border border-claude-border bg-claude-bg/15 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            {threadMessageCount} message{threadMessageCount === 1 ? '' : 's'}
                        </div>
                        <div className="rounded-full border border-claude-border bg-claude-bg/15 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            {sharedDeckCount} shared deck{sharedDeckCount === 1 ? '' : 's'}
                        </div>
                    </div>
	            </div>

            {/* Messages Container — virtualized for performance */}
            <div
                ref={scrollParentRef}
                className="flex-1 overflow-y-auto scroll-container relative"
                style={{
                    paddingBottom: '96px',
                    backgroundImage: `radial-gradient(circle at 20% 80%, rgba(122, 158, 114, 0.03) 0%, transparent 50%)`
                }}
            >
                {loading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-center py-12"
                    >
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 border-2 border-claude-accent/20 border-t-claude-accent rounded-full animate-spin" />
                            <Leaf className="absolute inset-0 m-auto w-5 h-5 text-claude-accent/60" />
                        </div>
                    </motion.div>
                ) : messages.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-12 px-4"
                    >
                        <div className="relative mx-auto mb-4 w-16 h-16">
                            <div className="glass-panel absolute inset-0 rounded-full flex items-center justify-center">
                                <Send className="w-7 h-7 text-claude-secondary" />
                            </div>
                        </div>
                        <p className="text-claude-secondary font-mono">No messages yet</p>
                        <p className="text-sm text-claude-secondary/70 mt-1 font-mono">
                            Say hi to {chatUser?.username}!
                        </p>
                    </motion.div>
                ) : (
                    <div className="p-4" style={{ height: virtualizer.getTotalSize() + (isTyping ? 54 : 0), position: 'relative' }}>
                        {/* Loading older messages indicator */}
                        {loadingMore && (
                            <div className="flex justify-center py-3 absolute top-0 left-0 right-0 z-10">
                                <div className="relative w-8 h-8">
                                    <div className="absolute inset-0 border-2 border-claude-accent/20 border-t-claude-accent rounded-full animate-spin" />
                                </div>
                            </div>
                        )}

                        {virtualizer.getVirtualItems().map(virtualRow => {
                            const i = virtualRow.index;
                            const msg = messages[i];
                            const showAvatar = !msg.isMine && (i === 0 || messages[i - 1].isMine);
                            const isNew = !loadedMsgIdsRef.current.has(msg.id);

                            return (
                                <div
                                    key={msg.id}
                                    ref={virtualizer.measureElement}
                                    data-index={i}
                                    className={`pb-4 ${isNew ? 'animate-msg-in' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex items-end gap-2 max-w-[85%] ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                                            {!msg.isMine && (
                                                <div className="w-8 shrink-0 mb-1">
                                                    {showAvatar && (
                                                        <Avatar src={msg.senderAvatar} size="xs" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Deck Message */}
                                            {msg.messageType === 'deck' && msg.deckData ? (
                                                <div className={`glass-panel relative overflow-hidden ${msg.isMine ? 'rounded-br-sm' : 'rounded-bl-sm'} min-w-[240px]`}>
                                                    <div className={`absolute top-0 ${msg.isMine ? 'right-0' : 'left-0'} w-full h-1 bg-gradient-to-r ${msg.isMine ? 'from-transparent to-claude-accent/30' : 'from-claude-accent/30 to-transparent'}`} />
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="w-8 h-8 rounded-lg bg-claude-accent/10 flex items-center justify-center shrink-0 mr-3">
                                                                <Layers className="w-4 h-4 text-claude-accent" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs text-claude-secondary font-mono mb-0.5" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                                    {msg.isMine ? 'You shared a deck' : `${chatUser?.username || 'Friend'} shared a deck`}
                                                                </p>
                                                                <span className="font-display font-medium text-claude-text block truncate">
                                                                    {msg.deckData.title}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-claude-secondary font-mono mb-4 text-center">
                                                            {msg.deckData.cardCount} cards
                                                        </p>

                                                        {msg.isMine ? (
                                                            <Link to={`/deck/${msg.deckData.id}`} className="block w-full py-2 text-center text-xs font-mono font-medium rounded-lg bg-claude-accent/10 text-claude-accent hover:bg-claude-accent/20 transition-colors">
                                                                View Deck
                                                            </Link>
                                                        ) : msg.deckData.acceptedDeckId ? (
                                                            <Link to={`/deck/${msg.deckData.acceptedDeckId}`} className="block w-full py-2 text-center text-xs font-mono font-medium rounded-lg bg-claude-accent/10 text-claude-accent hover:bg-claude-accent/20 transition-colors">
                                                                View in Collection
                                                            </Link>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAcceptDeck(msg.id)}
                                                                disabled={acceptingDeck === msg.id}
                                                                className="w-full py-2 text-center text-xs font-mono font-medium rounded-lg bg-claude-accent text-white hover:brightness-110 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50"
                                                            >
                                                                {acceptingDeck === msg.id ? 'Adding...' : 'Add to Collection'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Text/Image Message Bubble */
                                                <div
                                                    className={`relative group px-4 py-3 rounded-2xl ${msg.isMine
                                                        ? 'bg-claude-accent text-white rounded-br-sm shadow-sm md:shadow-lg shadow-claude-accent/20'
                                                        : 'glass-panel rounded-bl-sm text-claude-text'
                                                        }`}
                                                    style={msg.isMine ? {
                                                        background: 'linear-gradient(135deg, rgba(122, 158, 114, 0.95) 0%, rgba(122, 158, 114, 1) 100%)'
                                                    } : {}}
                                                >
                                                    {/* Subtle corner accent for received messages */}
                                                    {!msg.isMine && (
                                                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-claude-accent/10" />
                                                    )}

                                                    {/* Message Options (Edit/Delete/Report) */}
                                                    <div className={`absolute ${msg.isMine ? '-left-10' : '-right-10'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex`}>
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                                                                className="p-1.5 text-claude-secondary hover:text-claude-text hover:bg-claude-border/20 rounded-lg transition-colors"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                            {activeMenuId === msg.id && (
                                                                <div className={`absolute ${msg.isMine ? 'right-full mr-2' : 'left-full ml-2'} top-0 lg:bg-claude-bg/10 lg:backdrop-blur-2xl border-claude-border/40 glass-panel rounded-xl shadow-sm md:shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden min-w-[120px] z-50 py-1`}>
                                                                    {msg.isMine ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => startEditing(msg)}
                                                                                className="w-full px-4 py-3 sm:py-2 lg:py-3 text-[11px] font-mono uppercase tracking-widest font-bold text-left flex items-center gap-2 hover:bg-claude-bg/20 text-claude-secondary hover:text-claude-text transition-colors group"
                                                                            >
                                                                                <Edit2 className="w-4 h-4 opacity-70 group-hover:opacity-100" /> Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                                className="w-full px-4 py-3 sm:py-2 lg:py-3 text-[11px] font-mono uppercase tracking-widest font-bold text-left flex items-center gap-2 hover:bg-claude-bg/20 text-red-500/80 hover:text-red-500 transition-colors group"
                                                                            >
                                                                                <Trash2 className="w-4 h-4 opacity-70 group-hover:opacity-100" /> Delete
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                setReportingMessageId(msg.id);
                                                                                setIsReportModalOpen(true);
                                                                                setActiveMenuId(null);
                                                                            }}
                                                                            className="w-full px-4 py-3 sm:py-2 lg:py-3 text-[11px] font-mono uppercase tracking-widest font-bold text-left flex items-center gap-2 hover:bg-claude-bg/20 text-red-400/80 hover:text-red-400 transition-colors group"
                                                                        >
                                                                            <ShieldAlert className="w-4 h-4 opacity-70 group-hover:opacity-100" /> Report
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {msg.imageUrl && (
                                                        <div className="block mb-2 cursor-pointer" onClick={() => handleViewFile(msg.imageUrl, 'Attached Image')}>
                                                            <img
                                                                src={msg.imageUrl}
                                                                alt="Attached"
                                                                className="rounded-lg max-h-[250px] object-cover hover:opacity-90 transition-opacity"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    )}

                                                    {msg.content && (
                                                        <p className={`break-words ${msg.isMine ? 'font-medium' : 'font-mono'}`}>
                                                            {msg.content}
                                                        </p>
                                                    )}

                                                    {msg.isEdited && (
                                                        <span className="text-[10px] opacity-70 ml-2 italic">(edited)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Typing indicator — positioned after last virtual item */}
                        {isTyping && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualizer.getTotalSize()}px)`,
                                }}
                                className="pb-4"
                            >
                                <div className="flex justify-start">
                                    <div className="flex items-end gap-2 max-w-[85%]">
                                        <div className="w-8 shrink-0 mb-1">
                                            <Avatar src={chatUser?.avatar} size="xs" />
                                        </div>
                                        <div className="glass-panel rounded-[20px] rounded-bl-sm px-4 py-3 flex gap-1.5 items-center h-[38px] shadow-sm">
                                            <motion.div
                                                className="w-1.5 h-1.5 bg-claude-secondary/60 rounded-full"
                                                animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: 0, ease: "easeInOut" }}
                                            />
                                            <motion.div
                                                className="w-1.5 h-1.5 bg-claude-secondary/70 rounded-full"
                                                animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: 0.2, ease: "easeInOut" }}
                                            />
                                            <motion.div
                                                className="w-1.5 h-1.5 bg-claude-secondary/80 rounded-full"
                                                animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: 0.4, ease: "easeInOut" }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* "New messages" pill — shown when scrolled up and new messages arrive */}
                {showNewMessagesPill && (
                    <button
                        onClick={() => scrollToBottom('smooth')}
                        className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-4 py-2 rounded-full bg-claude-accent text-white text-xs font-mono shadow-lg shadow-claude-accent/30 hover:brightness-110 active:scale-95 transition-all animate-msg-in"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                        New messages
                    </button>
                )}
            </div>

            {/* Native PWA Docked Message Input */}
	            <motion.form
	                initial={{ y: 20, opacity: 0 }}
	                animate={{ y: 0, opacity: 1 }}
	                transition={{ delay: 0.2 }}
	                onSubmit={handleSendMessage}
	                className="fixed bottom-0 left-0 right-0 z-[60] sm:max-w-md sm:mx-auto bg-claude-bg/90 md:backdrop-blur-xl border-t border-claude-border/50 lg:absolute lg:left-0 lg:right-0 lg:bottom-0 lg:max-w-none"
                style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)',
                    paddingTop: '8px'
                }}
            >
	                <div className="px-3 flex flex-col gap-2">
                        <div className="hidden lg:flex items-center justify-between rounded-[18px] border border-claude-border/40 bg-claude-bg/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            <span>{editingMessageId ? 'Editing reply' : `Replying to ${chatUser?.username || 'thread'}`}</span>
                            <span>{imagePreview && !editingMessageId ? 'Image attached' : 'Enter to send'}</span>
                        </div>
	                    {imagePreview && !editingMessageId && (
	                        <div className="relative self-start mb-1 mt-1 rounded-2xl border border-claude-border bg-claude-bg/15 p-2">
                                <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">Attachment preview</div>
	                            <img src={imagePreview} alt="Preview" className="h-20 rounded-xl object-cover border border-claude-border shadow-sm" />
	                            <button
	                                type="button"
	                                onClick={() => setImagePreview(null)}
                                className="absolute -top-2 -right-2 bg-red-500/90 md:backdrop-blur-md text-white rounded-full p-1 hover:scale-110 active:scale-95 transition-transform"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

	                    {editingMessageId && (
	                        <div className="flex items-center justify-between rounded-2xl border border-claude-accent/15 bg-claude-accent/8 px-3 py-2 text-xs font-mono text-claude-accent">
	                            <span className="flex items-center gap-1.5"><Edit2 className="w-3 h-3" /> Editing message</span>
	                            <button
	                                type="button"
	                                onClick={() => {
                                    setEditingMessageId(null);
                                    setNewMessage('');
                                }}
                                className="hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                                <X className="w-3 h-3" /> Cancel
                            </button>
                        </div>
                    )}

	                    <div className="flex items-end gap-2">
	                        {!editingMessageId && (
	                            <>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
	                                <button
	                                    type="button"
	                                    onClick={() => fileInputRef.current?.click()}
	                                    className="mb-[2px] inline-flex items-center gap-2 rounded-full border border-claude-border px-3 py-2 text-claude-secondary hover:text-claude-accent hover:bg-claude-accent/10 transition-colors shrink-0 active:scale-95"
	                                    disabled={sending}
                                        aria-label="Attach image"
	                                >
	                                    <Image className="w-6 h-6" />
                                        <span className="hidden lg:inline text-[11px] font-mono uppercase tracking-[0.18em]">Attach</span>
	                                </button>
	                            </>
	                        )}

	                        <div className="flex-1 glass-panel rounded-[22px] flex items-center pl-4 pr-1.5 py-1 min-h-[52px] mb-1 border border-claude-border">
	                            <input
	                                ref={inputRef}
	                                type="text"
                                value={newMessage}
                                onChange={e => {
                                    setNewMessage(e.target.value);
                                    handleTypingStart();
                                }}
	                                placeholder={editingMessageId ? "Refine your message..." : "Write a message..."}
	                                disabled={sending}
	                                className="flex-1 w-full bg-transparent border-none outline-none text-claude-text placeholder:text-claude-secondary/50 font-sans text-[15px]"
	                            />

                            <motion.button
                                type="submit"
                                disabled={(!newMessage.trim() && !imagePreview) || sending}
                                whileTap={{ scale: 0.9 }}
                                className="w-8 h-8 ml-2 rounded-full flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,opacity,color,background-color,border-color,box-shadow] relative overflow-hidden group focus-ring shrink-0"
                                aria-label={sending ? 'Sending message' : 'Send message'}
                                style={{
                                    background: 'linear-gradient(135deg, #7a9e72 0%, #6b8e63 100%)',
                                    boxShadow: '0 2px 8px rgba(122, 158, 114, 0.3)'
                                }}
                            >
                                <AnimatePresence mode="wait">
                                    {sending ? (
                                        <motion.div
                                            key="sending"
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            exit={{ scale: 0, rotate: 180 }}
                                        >
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key={editingMessageId ? "edit" : "send"}
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            exit={{ scale: 0, rotate: 180 }}
                                            className="ml-[1px]"
                                        >
                                            {editingMessageId ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </motion.form>
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => {
                    setIsReportModalOpen(false);
                    setReportingMessageId(null);
                }}
                onSubmit={handleReportMessageSubmit}
                isSubmitting={isReporting}
            />
            <FileViewer file={selectedFile} isOpen={isFileViewerOpen} onClose={() => setIsFileViewerOpen(false)} />
            </div>
        </div>
    );
}
