import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Search, Image, Layers,
    Check, CheckCheck, MoreVertical, Trash2, Leaf
} from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import Avatar from '../components/Avatar';
import * as authApi from '../api/authApi';

export default function Messages() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn } = useAuth();

    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatUser, setChatUser] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Load conversations list
    const loadConversations = useCallback(async () => {
        try {
            const data = await authApi.getConversations();
            setConversations(data);
        } catch {
            // Failed to load conversations silently
        }
    }, []);

    // Load messages for specific user
    const loadMessages = useCallback(async (targetUserId) => {
        try {
            setLoading(true);
            const [messagesData, userData] = await Promise.all([
                authApi.getMessages(targetUserId),
                authApi.getUserProfile(targetUserId)
            ]);
            setMessages(messagesData);
            setChatUser(userData);
        } catch {
            toast.error('Failed to load messages');
            navigate('/messages');
        } finally {
            setLoading(false);
        }
    }, [navigate, toast]);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/account');
            return;
        }

        if (userId) {
            loadMessages(userId);
        } else {
            loadConversations();
            setLoading(false);
        }
    }, [isLoggedIn, userId, loadConversations, loadMessages, navigate]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        haptics.light();

        try {
            const message = await authApi.sendMessage(userId, newMessage.trim());
            setMessages(prev => [...prev, message]);
            setNewMessage('');
            inputRef.current?.focus();
        } catch {
            haptics.error();
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    // Send deck function - can be exposed via context or props later
    const _handleSendDeck = async (deck) => {
        haptics.light();
        try {
            const message = await authApi.sendMessage(
                userId,
                `Shared a deck: ${deck.title}`,
                'deck',
                { id: deck.id, title: deck.title, cardCount: deck.cards?.length || 0 }
            );
            setMessages(prev => [...prev, message]);
            toast.success('Deck shared!');
        } catch {
            haptics.error();
            toast.error('Failed to share deck');
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

    // Conversations List View
    if (!userId) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="pb-24"
            >
                {/* Decorative Header */}
                <div className="mb-6 relative">
                    <div className="absolute top-2 left-0 w-8 h-8 opacity-10">
                        <Leaf className="w-full h-full text-botanical-forest rotate-12" />
                    </div>
                    <h1 className="text-2xl font-display font-bold mb-1">Messages</h1>
                    <p className="text-botanical-sepia text-sm font-mono">Chat with your friends</p>
                </div>

                {conversations.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="text-center py-12"
                    >
                        <div className="relative mx-auto mb-6 w-20 h-20">
                            {/* Botanical empty state */}
                            <div className="botanical-card absolute inset-0 rounded-full flex items-center justify-center">
                                <Send className="w-8 h-8 text-botanical-forest" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-botanical-forest/20 flex items-center justify-center">
                                <Leaf className="w-3 h-3 text-botanical-forest" />
                            </div>
                        </div>
                        <p className="text-botanical-parchment font-display mb-2">No conversations yet</p>
                        <p className="text-sm text-botanical-sepia font-mono mb-6">
                            Start connecting with friends
                        </p>
                        <Link
                            to="/friends"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-botanical-forest text-white rounded-full font-medium active:scale-95 transition-transform"
                        >
                            <Leaf className="w-4 h-4" />
                            Find Friends
                        </Link>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {conversations.map((conv, index) => (
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
                                        className="botanical-card flex items-center gap-4 p-4 active:scale-[0.98] transition-all block group relative overflow-hidden"
                                    >
                                        {/* Decorative corner accent */}
                                        <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-botanical-forest/20 rounded-tr group-hover:border-claude-accent/40 transition-colors" />

                                        <div className="relative shrink-0">
                                            <Avatar src={conv.avatar} size="lg" />
                                            {conv.unreadCount > 0 && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -top-1 -right-1 w-6 h-6 bg-botanical-forest rounded-full flex items-center justify-center shadow-lg"
                                                >
                                                    <span className="text-xs text-white font-bold">
                                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                    </span>
                                                </motion.div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-display truncate ${conv.unreadCount > 0 ? 'text-botanical-parchment' : 'text-claude-text'}`}>
                                                    {conv.username}
                                                </span>
                                                <span className="text-xs text-botanical-sepia shrink-0 ml-2 font-mono">
                                                    {formatTime(conv.lastMessageAt)}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate font-mono ${conv.unreadCount > 0 ? 'text-claude-text font-medium' : 'text-botanical-sepia'}`}>
                                                {conv.isOwnMessage && <span className="text-botanical-sepia/70">You: </span>}
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
            </motion.div>
        );
    }

    // Chat View
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-claude-bg z-50 flex flex-col safe-area-top"
        >
            {/* Botanical Chat Header with decorative elements */}
            <div className="header-blur flex items-center gap-3 p-4 border-b border-claude-border shrink-0 relative">
                {/* Decorative corner marks */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-botanical-forest/20 rounded-tl" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-botanical-forest/20 rounded-br" />

                <button
                    onClick={() => navigate('/messages')}
                    className="touch-target -ml-2 rounded-lg hover:bg-claude-border/20 transition-colors focus-ring"
                    aria-label="Back to conversations"
                >
                    <ArrowLeft className="w-6 h-6" aria-hidden="true" />
                </button>

                {chatUser && (
                    <Link
                        to={`/profile/${chatUser.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0 p-2 -my-2 rounded-xl hover:bg-claude-border/10 active:scale-[0.98] transition-all"
                    >
                        <div className="relative">
                            <Avatar src={chatUser.avatar} size="md" />
                            {/* Online indicator - could be added based on user status */}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-botanical-forest rounded-full border-2 border-claude-bg" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-display font-semibold truncate">{chatUser.username}</p>
                            <p className="text-xs text-botanical-sepia font-mono">Tap to view profile</p>
                        </div>
                    </Link>
                )}
            </div>

            {/* Messages Container with subtle botanical background pattern */}
            <div
                className="flex-1 overflow-y-auto scroll-container"
                style={{
                    paddingBottom: '80px',
                    backgroundImage: `radial-gradient(circle at 20% 80%, rgba(122, 158, 114, 0.03) 0%, transparent 50%)`
                }}
            >
                <div className="p-4 space-y-4 max-w-2xl mx-auto">
                    {loading ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-center py-12"
                        >
                            <div className="relative w-12 h-12">
                                <div className="absolute inset-0 border-2 border-botanical-forest/20 border-t-botanical-forest rounded-full animate-spin" />
                                <Leaf className="absolute inset-0 m-auto w-5 h-5 text-botanical-forest/60" />
                            </div>
                        </motion.div>
                    ) : messages.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-12"
                        >
                            <div className="relative mx-auto mb-4 w-16 h-16">
                                <div className="botanical-card absolute inset-0 rounded-full flex items-center justify-center">
                                    <Send className="w-7 h-7 text-botanical-sepia" />
                                </div>
                            </div>
                            <p className="text-botanical-sepia font-mono">No messages yet</p>
                            <p className="text-sm text-botanical-sepia/70 mt-1 font-mono">
                                Say hi to {chatUser?.username}! 👋
                            </p>
                        </motion.div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {messages.map((msg, i) => {
                                const showAvatar = !msg.isMine && (i === 0 || messages[i - 1].isMine);

                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: Math.min(i * 0.03, 0.5),
                                            ease: [0.25, 0.1, 0.25, 1]
                                        }}
                                        className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex items-end gap-2 max-w-[85%] ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                                            {!msg.isMine && (
                                                <div className="w-8 shrink-0 mb-1">
                                                    {showAvatar && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        >
                                                            <Avatar src={msg.senderAvatar} size="xs" />
                                                        </motion.div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Deck Message */}
                                            {msg.messageType === 'deck' && msg.deckData ? (
                                                <Link
                                                    to={`/decks/${msg.deckData.id}`}
                                                    className={`botanical-card group relative overflow-hidden ${msg.isMine
                                                        ? 'rounded-br-sm'
                                                        : 'rounded-bl-sm'
                                                        }`}
                                                >
                                                    {/* Decorative botanical accent */}
                                                    <div className={`absolute top-0 ${msg.isMine ? 'right-0' : 'left-0'} w-full h-1 bg-gradient-to-r ${msg.isMine ? 'from-transparent to-botanical-forest/30' : 'from-botanical-forest/30 to-transparent'}`} />

                                                    <div className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-8 h-8 rounded-lg bg-botanical-forest/10 flex items-center justify-center">
                                                                <Layers className="w-4 h-4 text-botanical-forest" />
                                                            </div>
                                                            <span className="font-display font-medium text-botanical-parchment">
                                                                {msg.deckData.title}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-botanical-sepia font-mono flex items-center gap-2">
                                                            <span>{msg.deckData.cardCount} cards</span>
                                                            <span className="text-botanical-sepia/50">•</span>
                                                            <span className="text-botanical-forest group-hover:underline">Tap to view</span>
                                                        </p>
                                                    </div>
                                                </Link>
                                            ) : (
                                                /* Text Message Bubble */
                                                <div
                                                    className={`relative px-4 py-3 rounded-2xl ${msg.isMine
                                                        ? 'bg-botanical-forest text-white rounded-br-sm shadow-lg shadow-botanical-forest/20'
                                                        : 'botanical-card rounded-bl-sm text-botanical-parchment'
                                                        }`}
                                                    style={msg.isMine ? {
                                                        background: 'linear-gradient(135deg, rgba(122, 158, 114, 0.95) 0%, rgba(122, 158, 114, 1) 100%)'
                                                    } : {}}
                                                >
                                                    {/* Subtle corner accent for received messages */}
                                                    {!msg.isMine && (
                                                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-botanical-forest/10" />
                                                    )}
                                                    <p className={`break-words ${msg.isMine ? 'font-medium' : 'font-mono'}`}>
                                                        {msg.content}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Botanical Message Input */}
            <motion.form
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleSendMessage}
                className="fixed bottom-0 left-0 right-0 z-[60]"
                style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 16px)',
                    background: 'linear-gradient(to top, var(--bg-color) 80%, transparent 100%)'
                }}
            >
                <div className="botanical-card max-w-2xl mx-4 mb-4 p-2 flex items-center gap-2 shadow-xl">
                    {/* Decorative leaf accent */}
                    <div className="absolute -top-2 left-4 w-5 h-5 opacity-40">
                        <Leaf className="w-full h-full text-botanical-forest rotate-45" />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending}
                        className="flex-1 px-4 py-3 bg-transparent border-none outline-none text-botanical-parchment placeholder:text-botanical-sepia/50 font-mono"
                    />

                    <motion.button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        whileTap={{ scale: 0.9 }}
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all relative overflow-hidden group focus-ring"
                        aria-label={sending ? 'Sending message' : 'Send message'}
                        style={{
                            background: 'linear-gradient(135deg, #7a9e72 0%, #6b8e63 100%)',
                            boxShadow: '0 4px 12px rgba(122, 158, 114, 0.3)'
                        }}
                    >
                        {/* Shimmer effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

                        <AnimatePresence mode="wait">
                            {sending ? (
                                <motion.div
                                    key="sending"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    exit={{ scale: 0, rotate: 180 }}
                                >
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Sending" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="send"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    exit={{ scale: 0, rotate: 180 }}
                                >
                                    <Send className="w-5 h-5" aria-hidden="true" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>
            </motion.form>
        </motion.div>
    );
}
