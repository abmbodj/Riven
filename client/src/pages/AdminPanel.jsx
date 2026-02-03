import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
    Shield, Users, Layers, CreditCard, Share2, MessageSquare,
    ChevronRight, Plus, Trash2, ToggleLeft, ToggleRight,
    AlertCircle, Info, CheckCircle, AlertTriangle, X, Send,
    ArrowLeft, Activity, Clock
} from 'lucide-react';

export default function AdminPanel() {
    const navigate = useNavigate();
    const { 
        isAdmin, 
        adminGetStats, 
        getAllUsers,
        adminDeleteUser,
        adminGetMessages,
        adminCreateMessage,
        adminUpdateMessage,
        adminDeleteMessage
    } = useContext(AuthContext);
    
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Message form state
    const [showMessageForm, setShowMessageForm] = useState(false);
    const [messageForm, setMessageForm] = useState({
        title: '',
        content: '',
        type: 'info'
    });
    const [formLoading, setFormLoading] = useState(false);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, usersData, messagesData] = await Promise.all([
                adminGetStats(),
                getAllUsers(),
                adminGetMessages()
            ]);
            setStats(statsData);
            setUsers(usersData);
            setMessages(messagesData);
        } catch {
            setError('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    }, [adminGetStats, getAllUsers, adminGetMessages]);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }
        loadData();
    }, [isAdmin, navigate, loadData]);

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
        
        try {
            await adminDeleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
            // Refresh stats after deletion
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to delete user');
        }
    };

    const handleCreateMessage = async (e) => {
        e.preventDefault();
        if (!messageForm.title.trim() || !messageForm.content.trim()) {
            setError('Title and content are required');
            return;
        }
        
        setFormLoading(true);
        try {
            const newMessage = await adminCreateMessage(
                messageForm.title.trim(),
                messageForm.content.trim(),
                messageForm.type
            );
            setMessages([newMessage, ...messages]);
            setMessageForm({ title: '', content: '', type: 'info' });
            setShowMessageForm(false);
            // Refresh stats
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to create message');
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleMessage = async (id, currentActive) => {
        try {
            await adminUpdateMessage(id, { isActive: !currentActive });
            setMessages(messages.map(m => 
                m.id === id ? { ...m, isActive: !currentActive } : m
            ));
        } catch {
            setError('Failed to update message');
        }
    };

    const handleDeleteMessage = async (id) => {
        if (!confirm('Delete this message?')) return;
        
        try {
            await adminDeleteMessage(id);
            setMessages(messages.filter(m => m.id !== id));
            // Refresh stats
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to delete message');
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'success': return 'bg-green-500/10 border-green-500/30';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'error': return 'bg-red-500/10 border-red-500/30';
            default: return 'bg-blue-500/10 border-blue-500/30';
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl bg-claude-surface border border-claude-border hover:bg-claude-border/50 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-claude-text">Admin Panel</h1>
                        <p className="text-xs text-claude-secondary">Manage your app</p>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                    <span className="text-sm text-red-400">{error}</span>
                    <button onClick={() => setError('')}>
                        <X className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2 p-1 rounded-xl bg-claude-surface border border-claude-border">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: Activity },
                    { id: 'users', label: 'Users', icon: Users },
                    { id: 'messages', label: 'Messages', icon: MessageSquare }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id 
                                ? 'bg-claude-accent text-white' 
                                : 'text-claude-secondary hover:text-claude-text'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Dashboard Tab */}
                    {activeTab === 'dashboard' && stats && (
                        <div className="space-y-4">
                            {/* Main Stats Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard 
                                    icon={Users} 
                                    label="Total Users" 
                                    value={stats.users} 
                                    color="blue"
                                />
                                <StatCard 
                                    icon={CreditCard} 
                                    label="Total Cards" 
                                    value={stats.cards} 
                                    color="purple"
                                />
                                <StatCard 
                                    icon={Layers} 
                                    label="Total Decks" 
                                    value={stats.decks} 
                                    color="green"
                                />
                                <StatCard 
                                    icon={Share2} 
                                    label="Shared Decks" 
                                    value={stats.sharedDecks} 
                                    color="orange"
                                />
                            </div>

                            {/* Recent Activity */}
                            <div className="p-4 rounded-xl bg-claude-surface border border-claude-border">
                                <h3 className="text-sm font-semibold text-claude-text mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-claude-secondary" />
                                    Last 7 Days
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-claude-bg border border-claude-border/50">
                                        <div className="text-2xl font-bold text-claude-accent">
                                            {stats.recentSignups || 0}
                                        </div>
                                        <div className="text-xs text-claude-secondary">New Signups</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-claude-bg border border-claude-border/50">
                                        <div className="text-2xl font-bold text-green-500">
                                            {stats.recentSessions || 0}
                                        </div>
                                        <div className="text-xs text-claude-secondary">Study Sessions</div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Messages Count */}
                            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-claude-text">Active Broadcasts</div>
                                            <div className="text-xs text-claude-secondary">Messages shown to users</div>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-purple-400">
                                        {stats.activeMessages || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-claude-secondary">Quick Actions</h3>
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className="w-full p-3 rounded-xl bg-claude-surface border border-claude-border hover:border-claude-accent/50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-claude-accent/10 flex items-center justify-center">
                                            <Send className="w-4 h-4 text-claude-accent" />
                                        </div>
                                        <span className="text-sm font-medium">Broadcast a Message</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-claude-secondary group-hover:text-claude-accent transition-colors" />
                                </button>
                                <button
                                    onClick={() => setActiveTab('users')}
                                    className="w-full p-3 rounded-xl bg-claude-surface border border-claude-border hover:border-claude-accent/50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <span className="text-sm font-medium">Manage Users</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-claude-secondary group-hover:text-claude-accent transition-colors" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Users Tab */}
                    {activeTab === 'users' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-claude-secondary">
                                    {users.length} Users
                                </h2>
                            </div>
                            
                            <div className="space-y-2">
                                {users.map(user => (
                                    <div 
                                        key={user.id}
                                        className="p-3 rounded-xl bg-claude-surface border border-claude-border"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-10 h-10 rounded-full bg-claude-accent/10 border border-claude-accent/30 flex items-center justify-center shrink-0">
                                                    {user.avatar ? (
                                                        <span className="text-lg">{user.avatar}</span>
                                                    ) : (
                                                        <span className="text-sm font-bold text-claude-accent">
                                                            {user.username[0].toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-claude-text truncate">
                                                            {user.username}
                                                        </span>
                                                        {user.isAdmin && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/10 text-red-400 rounded">
                                                                ADMIN
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-claude-secondary truncate">
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                            {!user.isAdmin && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                                    className="p-2 rounded-lg hover:bg-red-500/10 text-claude-secondary hover:text-red-400 transition-colors shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2 flex items-center gap-3 text-xs text-claude-secondary">
                                            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                                            {user.streakData?.currentStreak > 0 && (
                                                <span className="text-orange-400">
                                                    🔥 {user.streakData.currentStreak} streak
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages Tab */}
                    {activeTab === 'messages' && (
                        <div className="space-y-4">
                            {/* Create Message Button / Form */}
                            {!showMessageForm ? (
                                <button
                                    onClick={() => setShowMessageForm(true)}
                                    className="w-full p-4 rounded-xl border-2 border-dashed border-claude-border hover:border-claude-accent/50 transition-colors flex items-center justify-center gap-2 text-claude-secondary hover:text-claude-accent"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span className="font-medium">Create Broadcast</span>
                                </button>
                            ) : (
                                <form onSubmit={handleCreateMessage} className="p-4 rounded-xl bg-claude-surface border border-claude-border space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-claude-text">New Broadcast</h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowMessageForm(false);
                                                setMessageForm({ title: '', content: '', type: 'info' });
                                            }}
                                            className="p-1 rounded hover:bg-claude-border/50"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-medium text-claude-secondary mb-1 block">Type</label>
                                        <div className="flex gap-2">
                                            {['info', 'success', 'warning', 'error'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setMessageForm({ ...messageForm, type })}
                                                    className={`flex-1 p-2 rounded-lg text-xs font-medium capitalize transition-all ${
                                                        messageForm.type === type
                                                            ? getTypeColor(type) + ' border'
                                                            : 'bg-claude-bg border border-claude-border hover:border-claude-accent/30'
                                                    }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-medium text-claude-secondary mb-1 block">Title</label>
                                        <input
                                            type="text"
                                            value={messageForm.title}
                                            onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                                            placeholder="Message title..."
                                            maxLength={100}
                                            className="w-full px-3 py-2 rounded-lg bg-claude-bg border border-claude-border text-sm focus:border-claude-accent focus:outline-none"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-medium text-claude-secondary mb-1 block">Content</label>
                                        <textarea
                                            value={messageForm.content}
                                            onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                                            placeholder="Write your message..."
                                            maxLength={1000}
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-lg bg-claude-bg border border-claude-border text-sm focus:border-claude-accent focus:outline-none resize-none"
                                        />
                                        <div className="text-xs text-claude-secondary text-right mt-1">
                                            {messageForm.content.length}/1000
                                        </div>
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        disabled={formLoading || !messageForm.title.trim() || !messageForm.content.trim()}
                                        className="w-full py-2.5 rounded-lg bg-claude-accent text-white font-medium text-sm hover:bg-claude-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {formLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Broadcast Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* Messages List */}
                            <div className="space-y-2">
                                {messages.length === 0 ? (
                                    <div className="text-center py-8 text-claude-secondary">
                                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No broadcasts yet</p>
                                    </div>
                                ) : (
                                    messages.map(message => (
                                        <div 
                                            key={message.id}
                                            className={`p-4 rounded-xl border ${getTypeColor(message.type)} ${
                                                !message.isActive ? 'opacity-50' : ''
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    {getTypeIcon(message.type)}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-medium text-claude-text">
                                                                {message.title}
                                                            </h4>
                                                            {!message.isActive && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-claude-border text-claude-secondary rounded">
                                                                    INACTIVE
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-claude-secondary mt-1">
                                                            {message.content}
                                                        </p>
                                                        <div className="text-xs text-claude-secondary mt-2">
                                                            By {message.createdBy} • {new Date(message.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => handleToggleMessage(message.id, message.isActive)}
                                                        className="p-2 rounded-lg hover:bg-claude-bg/50 text-claude-secondary hover:text-claude-text transition-colors"
                                                        title={message.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {message.isActive ? (
                                                            <ToggleRight className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <ToggleLeft className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMessage(message.id)}
                                                        className="p-2 rounded-lg hover:bg-red-500/10 text-claude-secondary hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// Stat Card Component
// eslint-disable-next-line no-unused-vars
function StatCard({ icon: Icon, label, value, color }) {
    const colorClasses = {
        blue: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
        purple: 'bg-purple-500/10 border-purple-500/30 text-purple-500',
        green: 'bg-green-500/10 border-green-500/30 text-green-500',
        orange: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
    };

    return (
        <div className="p-4 rounded-xl bg-claude-surface border border-claude-border">
            <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} border flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-claude-text">{value?.toLocaleString() || 0}</div>
            <div className="text-xs text-claude-secondary">{label}</div>
        </div>
    );
}
