import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Send, Search, Image, Layers, 
    Check, CheckCheck, MoreVertical, Trash2 
} from 'lucide-react';
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
            console.error('Failed to load conversations');
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
            <div className="animate-in fade-in duration-300">
                <div className="mb-6">
                    <h1 className="text-2xl font-display font-bold mb-1">Messages</h1>
                    <p className="text-claude-secondary text-sm">Chat with your friends</p>
                </div>

                {conversations.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-claude-surface flex items-center justify-center mx-auto mb-4">
                            <Send className="w-8 h-8 text-claude-secondary" />
                        </div>
                        <p className="text-claude-secondary mb-2">No messages yet</p>
                        <p className="text-sm text-claude-secondary">
                            Find friends to start chatting!
                        </p>
                        <Link 
                            to="/friends" 
                            className="inline-block mt-4 px-6 py-2 bg-claude-accent text-white rounded-full font-medium"
                        >
                            Find Friends
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {conversations.map(conv => (
                            <Link
                                key={conv.userId}
                                to={`/messages/${conv.userId}`}
                                className="flex items-center gap-3 p-4 bg-claude-surface border border-claude-border rounded-2xl active:scale-[0.98] transition-transform"
                            >
                                <div className="relative">
                                    <Avatar src={conv.avatar} size="lg" />
                                    {conv.unreadCount > 0 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-claude-accent rounded-full flex items-center justify-center">
                                            <span className="text-xs text-white font-bold">
                                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`font-semibold truncate ${conv.unreadCount > 0 ? 'text-claude-text' : ''}`}>
                                            {conv.username}
                                        </span>
                                        <span className="text-xs text-claude-secondary shrink-0 ml-2">
                                            {formatTime(conv.lastMessageAt)}
                                        </span>
                                    </div>
                                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-claude-text font-medium' : 'text-claude-secondary'}`}>
                                        {conv.isOwnMessage && <span className="text-claude-secondary">You: </span>}
                                        {conv.lastMessageType === 'deck' ? '📚 Shared a deck' : conv.lastMessage}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Chat View
    return (
        <div className="fixed inset-0 bg-claude-bg z-50 flex flex-col safe-area-top">
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 border-b border-claude-border bg-claude-surface shrink-0">
                <button onClick={() => navigate('/messages')} className="p-2 -ml-2">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                {chatUser && (
                    <Link to={`/profile/${chatUser.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar src={chatUser.avatar} size="md" />
                        <div className="min-w-0">
                            <p className="font-semibold truncate">{chatUser.username}</p>
                            <p className="text-xs text-claude-secondary">Tap to view profile</p>
                        </div>
                    </Link>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: '80px' }}>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-claude-secondary">No messages yet</p>
                        <p className="text-sm text-claude-secondary mt-1">
                            Say hi to {chatUser?.username}! 👋
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const showAvatar = !msg.isMine && (i === 0 || messages[i - 1].isMine);
                        
                        return (
                            <div 
                                key={msg.id} 
                                className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-end gap-2 max-w-[80%] ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                                    {!msg.isMine && (
                                        <div className="w-8 shrink-0">
                                            {showAvatar && <Avatar src={msg.senderAvatar} size="xs" />}
                                        </div>
                                    )}
                                    
                                    {msg.messageType === 'deck' && msg.deckData ? (
                                        <Link 
                                            to={`/decks/${msg.deckData.id}`}
                                            className={`p-3 rounded-2xl ${
                                                msg.isMine 
                                                    ? 'bg-claude-accent text-white rounded-br-sm' 
                                                    : 'bg-claude-surface border border-claude-border rounded-bl-sm'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Layers className="w-4 h-4" />
                                                <span className="font-medium">{msg.deckData.title}</span>
                                            </div>
                                            <p className={`text-sm ${msg.isMine ? 'text-white/80' : 'text-claude-secondary'}`}>
                                                {msg.deckData.cardCount} cards • Tap to view
                                            </p>
                                        </Link>
                                    ) : (
                                        <div 
                                            className={`px-4 py-2.5 rounded-2xl ${
                                                msg.isMine 
                                                    ? 'bg-claude-accent text-white rounded-br-sm' 
                                                    : 'bg-claude-surface border border-claude-border rounded-bl-sm'
                                            }`}
                                        >
                                            <p className="break-words">{msg.content}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form 
                onSubmit={handleSendMessage}
                className="fixed bottom-0 left-0 right-0 p-4 bg-claude-surface border-t border-claude-border safe-area-bottom"
            >
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-claude-bg border border-claude-border rounded-full focus:border-claude-accent outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="w-12 h-12 bg-claude-accent rounded-full flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-transform"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
}
