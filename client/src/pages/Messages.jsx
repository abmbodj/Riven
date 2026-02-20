import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Send, Search, Image, Layers,
    Check, CheckCheck, MoreVertical, Trash2, Leaf, Edit2, X
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
    const [acceptingDeck, setAcceptingDeck] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

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
                const updatedMsg = await authApi.editMessage(editingMessageId, newMessage.trim());
                setMessages(prev => prev.map(m => m.id === editingMessageId ? updatedMsg : m));
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

        try {
            const message = await authApi.sendMessage(userId, newMessage.trim() || '', 'text', null, imagePreview);
            setMessages(prev => [...prev, message]);
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
            setMessages(prev => prev.filter(m => m.id !== msgId));
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

    // Conversations List View
    if (!userId) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="pb-24 sm:max-w-md sm:mx-auto w-full"
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
            className="fixed inset-0 bg-claude-bg z-50 flex flex-col safe-area-top sm:max-w-md sm:mx-auto sm:border-x sm:border-claude-border sm:shadow-2xl"
        >
            {/* Botanical Chat Header with decorative elements */}
            <div className="header-blur flex items-center gap-3 p-4 border-b border-claude-border shrink-0 relative z-20 bg-claude-bg/90 backdrop-blur-xl">
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
                <div className="p-4 space-y-4 w-full">
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
                                                <div className={`botanical-card relative overflow-hidden ${msg.isMine ? 'rounded-br-sm' : 'rounded-bl-sm'} min-w-[240px]`}>
                                                    <div className={`absolute top-0 ${msg.isMine ? 'right-0' : 'left-0'} w-full h-1 bg-gradient-to-r ${msg.isMine ? 'from-transparent to-botanical-forest/30' : 'from-botanical-forest/30 to-transparent'}`} />
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="w-8 h-8 rounded-lg bg-botanical-forest/10 flex items-center justify-center shrink-0 mr-3">
                                                                <Layers className="w-4 h-4 text-botanical-forest" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs text-botanical-sepia font-mono mb-0.5" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                                    {msg.isMine ? 'You shared a deck' : `${chatUser?.username || 'Friend'} shared a deck`}
                                                                </p>
                                                                <span className="font-display font-medium text-botanical-parchment block truncate">
                                                                    {msg.deckData.title}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-botanical-sepia font-mono mb-4 text-center">
                                                            {msg.deckData.cardCount} cards
                                                        </p>

                                                        {msg.isMine ? (
                                                            <Link to={`/deck/${msg.deckData.id}`} className="block w-full py-2 text-center text-xs font-mono font-medium rounded-lg bg-botanical-forest/10 text-botanical-forest hover:bg-botanical-forest/20 transition-colors">
                                                                View Deck
                                                            </Link>
                                                        ) : msg.deckData.acceptedDeckId ? (
                                                            <Link to={`/deck/${msg.deckData.acceptedDeckId}`} className="block w-full py-2 text-center text-xs font-mono font-medium rounded-lg bg-botanical-forest/10 text-botanical-forest hover:bg-botanical-forest/20 transition-colors">
                                                                ✓ View in Collection
                                                            </Link>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAcceptDeck(msg.id)}
                                                                disabled={acceptingDeck === msg.id}
                                                                className="w-full py-2 text-center text-xs font-mono font-medium rounded-lg bg-botanical-forest text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
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

                                                    {/* Message Options (Edit/Delete) */}
                                                    {msg.isMine && (
                                                        <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex">
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                                                                    className="p-1.5 text-claude-secondary hover:text-botanical-parchment hover:bg-claude-border/20 rounded-lg transition-colors"
                                                                >
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </button>
                                                                {activeMenuId === msg.id && (
                                                                    <div className="absolute right-full top-0 mr-2 bg-claude-surface border border-claude-border rounded-xl shadow-xl overflow-hidden min-w-[120px] z-50">
                                                                        <button
                                                                            onClick={() => startEditing(msg)}
                                                                            className="w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-claude-bg/50 text-claude-text transition-colors"
                                                                        >
                                                                            <Edit2 className="w-4 h-4" /> Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                                            className="w-full px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-red-500/10 text-red-500 transition-colors"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" /> Delete
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {msg.imageUrl && (
                                                        <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                                            <img
                                                                src={msg.imageUrl}
                                                                alt="Attached"
                                                                className="rounded-lg max-h-[250px] object-cover hover:opacity-90 transition-opacity"
                                                                loading="lazy"
                                                            />
                                                        </a>
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
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Native PWA Docked Message Input */}
            <motion.form
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleSendMessage}
                className="fixed bottom-0 left-0 right-0 z-[60] sm:max-w-md sm:mx-auto bg-claude-bg/90 backdrop-blur-xl border-t border-claude-border/50"
                style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)',
                    paddingTop: '8px'
                }}
            >
                <div className="px-3 flex flex-col gap-2">
                    {imagePreview && !editingMessageId && (
                        <div className="relative self-start mb-1 mt-1">
                            <img src={imagePreview} alt="Preview" className="h-20 rounded-xl object-cover border border-claude-border shadow-sm" />
                            <button
                                type="button"
                                onClick={() => setImagePreview(null)}
                                className="absolute -top-2 -right-2 bg-red-500/90 backdrop-blur-md text-white rounded-full p-1 hover:scale-110 active:scale-95 transition-transform"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {editingMessageId && (
                        <div className="flex items-center justify-between px-2 pt-1 pb-2 text-xs font-mono text-botanical-forest">
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
                                    className="p-2 mb-[2px] text-claude-secondary hover:text-botanical-forest hover:bg-botanical-forest/10 rounded-full transition-colors flex shrink-0 active:scale-95"
                                    disabled={sending}
                                >
                                    <Image className="w-6 h-6" />
                                </button>
                            </>
                        )}

                        <div className="flex-1 bg-claude-surface border border-claude-border rounded-[20px] flex items-center pl-4 pr-1.5 py-1 min-h-[44px] mb-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder={editingMessageId ? "Edit message..." : "Message..."}
                                disabled={sending}
                                className="flex-1 w-full bg-transparent border-none outline-none text-botanical-parchment placeholder:text-botanical-sepia/50 font-sans text-[15px]"
                            />

                            <motion.button
                                type="submit"
                                disabled={(!newMessage.trim() && !imagePreview) || sending}
                                whileTap={{ scale: 0.9 }}
                                className="w-8 h-8 ml-2 rounded-full flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all relative overflow-hidden group focus-ring shrink-0"
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
        </motion.div>
    );
}
