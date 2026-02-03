import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
    Users, Layers, CreditCard, Share2, MessageSquare,
    Plus, Trash2, Power, AlertCircle, Info, CheckCircle, 
    AlertTriangle, X, Send, BarChart3, TrendingUp, 
    Megaphone, UserCircle, Calendar, Zap, Database
} from 'lucide-react';

// Supabase brand green
const SUPA_GREEN = '#3ECF8E';

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
    
    const [activeTab, setActiveTab] = useState('overview');
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
            setUsers(usersData || []);
            setMessages(messagesData || []);
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
        if (!confirm(`Delete user "${username}"? This action cannot be undone.`)) return;
        try {
            await adminDeleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
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
            setMessages(messages.map(m => m.id === id ? { ...m, isActive: !currentActive } : m));
        } catch {
            setError('Failed to update message');
        }
    };

    const handleDeleteMessage = async (id) => {
        if (!confirm('Delete this broadcast?')) return;
        try {
            await adminDeleteMessage(id);
            setMessages(messages.filter(m => m.id !== id));
            const newStats = await adminGetStats();
            setStats(newStats);
        } catch {
            setError('Failed to delete message');
        }
    };

    if (!isAdmin) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone }
    ];

    return (
        <div className="min-h-screen -mx-4 -my-4 bg-[#1C1C1C]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#1C1C1C]/95 backdrop-blur-sm border-b border-[#2E2E2E]">
                <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#3ECF8E]/10 flex items-center justify-center">
                            <Database className="w-5 h-5" style={{ color: SUPA_GREEN }} />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-white">Admin Dashboard</h1>
                            <p className="text-xs text-[#8F8F8F]">Manage your application</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation - Supabase style */}
                <div className="px-4 flex gap-1 overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-[1px] ${
                                activeTab === tab.id 
                                    ? 'text-white border-[#3ECF8E]' 
                                    : 'text-[#8F8F8F] border-transparent hover:text-white'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error Toast */}
            {error && (
                <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">{error}</span>
                    </div>
                    <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded">
                        <X className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="p-4 pb-24">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#3ECF8E] border-t-transparent rounded-full animate-spin" />
                        <p className="mt-3 text-sm text-[#8F8F8F]">Loading dashboard...</p>
                    </div>
                ) : (
                    <>
                        {/* Overview Tab */}
                        {activeTab === 'overview' && stats && (
                            <div className="space-y-4">
                                {/* Hero Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard 
                                        icon={Users} 
                                        label="Total Users" 
                                        value={stats.users}
                                        trend={stats.recentSignups > 0 ? `+${stats.recentSignups} this week` : null}
                                    />
                                    <StatCard 
                                        icon={CreditCard} 
                                        label="Total Cards" 
                                        value={stats.cards}
                                    />
                                    <StatCard 
                                        icon={Layers} 
                                        label="Total Decks" 
                                        value={stats.decks}
                                    />
                                    <StatCard 
                                        icon={Share2} 
                                        label="Shared" 
                                        value={stats.sharedDecks}
                                    />
                                </div>

                                {/* Activity Section */}
                                <div className="bg-[#232323] rounded-lg border border-[#2E2E2E] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-[#2E2E2E] flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-[#8F8F8F]" />
                                        <span className="text-sm font-medium text-white">Activity (7 days)</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-3">
                                        <div className="bg-[#1C1C1C] rounded-lg p-3 border border-[#2E2E2E]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <UserCircle className="w-4 h-4 text-[#3ECF8E]" />
                                                <span className="text-xs text-[#8F8F8F]">New Signups</span>
                                            </div>
                                            <p className="text-2xl font-bold text-white">{stats.recentSignups || 0}</p>
                                        </div>
                                        <div className="bg-[#1C1C1C] rounded-lg p-3 border border-[#2E2E2E]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Zap className="w-4 h-4 text-amber-400" />
                                                <span className="text-xs text-[#8F8F8F]">Sessions</span>
                                            </div>
                                            <p className="text-2xl font-bold text-white">{stats.recentSessions || 0}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Broadcasts Summary */}
                                <div className="bg-[#232323] rounded-lg border border-[#2E2E2E] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-[#2E2E2E] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Megaphone className="w-4 h-4 text-[#8F8F8F]" />
                                            <span className="text-sm font-medium text-white">Active Broadcasts</span>
                                        </div>
                                        <span className="text-lg font-bold" style={{ color: SUPA_GREEN }}>
                                            {stats.activeMessages || 0}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => setActiveTab('broadcasts')}
                                        className="w-full px-4 py-3 text-left text-sm text-[#8F8F8F] hover:bg-[#2E2E2E] transition-colors flex items-center justify-between"
                                    >
                                        <span>Manage broadcasts</span>
                                        <span className="text-xs">→</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Users Tab */}
                        {activeTab === 'users' && (
                            <div className="space-y-3">
                                {/* Users Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-[#8F8F8F]" />
                                        <span className="text-sm font-medium text-white">{users.length} Users</span>
                                    </div>
                                </div>

                                {/* Users Table */}
                                <div className="bg-[#232323] rounded-lg border border-[#2E2E2E] overflow-hidden">
                                    {/* Table Header - hidden on mobile */}
                                    <div className="hidden sm:grid sm:grid-cols-[1fr,1fr,auto] px-4 py-2 bg-[#1C1C1C] border-b border-[#2E2E2E] text-xs text-[#8F8F8F] font-medium">
                                        <span>User</span>
                                        <span>Joined</span>
                                        <span>Actions</span>
                                    </div>
                                    
                                    {/* User Rows */}
                                    <div className="divide-y divide-[#2E2E2E]">
                                        {users.map(user => (
                                            <div 
                                                key={user.id}
                                                className="p-3 sm:p-4 hover:bg-[#2E2E2E]/50 transition-colors"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div 
                                                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                                                            style={{ 
                                                                backgroundColor: user.isAdmin ? 'rgba(62, 207, 142, 0.15)' : '#2E2E2E',
                                                                color: user.isAdmin ? SUPA_GREEN : '#8F8F8F'
                                                            }}
                                                        >
                                                            {user.avatar || user.username[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-medium text-white text-sm truncate">
                                                                    {user.username}
                                                                </span>
                                                                {user.isAdmin && (
                                                                    <span 
                                                                        className="px-1.5 py-0.5 text-[10px] font-bold rounded"
                                                                        style={{ backgroundColor: 'rgba(62, 207, 142, 0.15)', color: SUPA_GREEN }}
                                                                    >
                                                                        ADMIN
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-[#8F8F8F] truncate">{user.email}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="hidden sm:flex items-center gap-1 text-xs text-[#8F8F8F]">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(user.createdAt).toLocaleDateString()}
                                                        </div>
                                                        {!user.isAdmin && (
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                                className="p-2 rounded-md hover:bg-red-500/10 text-[#8F8F8F] hover:text-red-400 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Mobile: Show date and streak */}
                                                <div className="sm:hidden mt-2 flex items-center gap-3 text-xs text-[#8F8F8F]">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(user.createdAt).toLocaleDateString()}
                                                    </span>
                                                    {user.streakData?.currentStreak > 0 && (
                                                        <span className="text-amber-400">
                                                            🔥 {user.streakData.currentStreak}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Broadcasts Tab */}
                        {activeTab === 'broadcasts' && (
                            <div className="space-y-4">
                                {/* Create Button / Form */}
                                {!showMessageForm ? (
                                    <button
                                        onClick={() => setShowMessageForm(true)}
                                        className="w-full p-4 rounded-lg border border-dashed border-[#3E3E3E] hover:border-[#3ECF8E]/50 transition-all flex items-center justify-center gap-2 text-[#8F8F8F] hover:text-[#3ECF8E] bg-[#232323]"
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span className="font-medium">New Broadcast</span>
                                    </button>
                                ) : (
                                    <form onSubmit={handleCreateMessage} className="bg-[#232323] rounded-lg border border-[#2E2E2E] overflow-hidden">
                                        <div className="px-4 py-3 border-b border-[#2E2E2E] flex items-center justify-between">
                                            <span className="text-sm font-medium text-white">Create Broadcast</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowMessageForm(false);
                                                    setMessageForm({ title: '', content: '', type: 'info' });
                                                }}
                                                className="p-1 rounded hover:bg-[#2E2E2E]"
                                            >
                                                <X className="w-4 h-4 text-[#8F8F8F]" />
                                            </button>
                                        </div>
                                        
                                        <div className="p-4 space-y-4">
                                            {/* Type Selector */}
                                            <div>
                                                <label className="text-xs font-medium text-[#8F8F8F] mb-2 block">Type</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[
                                                        { type: 'info', icon: Info, color: '#3B82F6' },
                                                        { type: 'success', icon: CheckCircle, color: '#3ECF8E' },
                                                        { type: 'warning', icon: AlertTriangle, color: '#F59E0B' },
                                                        { type: 'error', icon: AlertCircle, color: '#EF4444' }
                                                    // eslint-disable-next-line no-unused-vars
                                                    ].map(({ type, icon: TypeIcon, color }) => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => setMessageForm({ ...messageForm, type })}
                                                            className={`p-2.5 rounded-lg text-xs font-medium capitalize transition-all flex flex-col items-center gap-1.5 ${
                                                                messageForm.type === type
                                                                    ? 'bg-[#2E2E2E] ring-1'
                                                                    : 'bg-[#1C1C1C] hover:bg-[#2E2E2E]'
                                                            }`}
                                                            style={{ 
                                                                borderColor: messageForm.type === type ? color : 'transparent',
                                                                ringColor: messageForm.type === type ? color : 'transparent'
                                                            }}
                                                        >
                                                            <TypeIcon className="w-4 h-4" style={{ color }} />
                                                            <span className="text-[#8F8F8F]">{type}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            {/* Title */}
                                            <div>
                                                <label className="text-xs font-medium text-[#8F8F8F] mb-2 block">Title</label>
                                                <input
                                                    type="text"
                                                    value={messageForm.title}
                                                    onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                                                    placeholder="Broadcast title..."
                                                    maxLength={100}
                                                    className="w-full px-3 py-2.5 rounded-lg bg-[#1C1C1C] border border-[#2E2E2E] text-sm text-white placeholder-[#5F5F5F] focus:border-[#3ECF8E] focus:outline-none transition-colors"
                                                />
                                            </div>
                                            
                                            {/* Content */}
                                            <div>
                                                <label className="text-xs font-medium text-[#8F8F8F] mb-2 block">Message</label>
                                                <textarea
                                                    value={messageForm.content}
                                                    onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                                                    placeholder="Write your broadcast message..."
                                                    maxLength={1000}
                                                    rows={4}
                                                    className="w-full px-3 py-2.5 rounded-lg bg-[#1C1C1C] border border-[#2E2E2E] text-sm text-white placeholder-[#5F5F5F] focus:border-[#3ECF8E] focus:outline-none transition-colors resize-none"
                                                />
                                                <div className="text-xs text-[#5F5F5F] text-right mt-1">
                                                    {messageForm.content.length}/1000
                                                </div>
                                            </div>
                                            
                                            {/* Submit */}
                                            <button
                                                type="submit"
                                                disabled={formLoading || !messageForm.title.trim() || !messageForm.content.trim()}
                                                className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                style={{ backgroundColor: SUPA_GREEN, color: '#1C1C1C' }}
                                            >
                                                {formLoading ? (
                                                    <div className="w-4 h-4 border-2 border-[#1C1C1C]/30 border-t-[#1C1C1C] rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send className="w-4 h-4" />
                                                        Send Broadcast
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Messages List */}
                                <div className="space-y-2">
                                    {messages.length === 0 ? (
                                        <div className="text-center py-12 bg-[#232323] rounded-lg border border-[#2E2E2E]">
                                            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[#3E3E3E]" />
                                            <p className="text-sm text-[#8F8F8F]">No broadcasts yet</p>
                                            <p className="text-xs text-[#5F5F5F] mt-1">Create one to notify all users</p>
                                        </div>
                                    ) : (
                                        messages.map(message => (
                                            <MessageCard 
                                                key={message.id}
                                                message={message}
                                                onToggle={handleToggleMessage}
                                                onDelete={handleDeleteMessage}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Stat Card Component - Supabase style
// eslint-disable-next-line no-unused-vars
function StatCard({ icon: Icon, label, value, trend }) {
    return (
        <div className="bg-[#232323] rounded-lg border border-[#2E2E2E] p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-md bg-[#2E2E2E] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#8F8F8F]" />
                </div>
                {trend && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(62, 207, 142, 0.15)', color: SUPA_GREEN }}>
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-white">{value?.toLocaleString() || 0}</p>
            <p className="text-xs text-[#8F8F8F] mt-0.5">{label}</p>
        </div>
    );
}

// Message Card Component
function MessageCard({ message, onToggle, onDelete }) {
    const typeConfig = {
        info: { icon: Info, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
        success: { icon: CheckCircle, color: '#3ECF8E', bg: 'rgba(62, 207, 142, 0.1)' },
        warning: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
        error: { icon: AlertCircle, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' }
    };
    
    const config = typeConfig[message.type] || typeConfig.info;
    const TypeIcon = config.icon;

    return (
        <div 
            className={`bg-[#232323] rounded-lg border border-[#2E2E2E] overflow-hidden transition-opacity ${
                !message.isActive ? 'opacity-50' : ''
            }`}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div 
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: config.bg }}
                    >
                        <TypeIcon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-white text-sm">{message.title}</h4>
                            {!message.isActive && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#2E2E2E] text-[#8F8F8F] rounded">
                                    INACTIVE
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-[#8F8F8F] mt-1 line-clamp-2">{message.content}</p>
                        <p className="text-xs text-[#5F5F5F] mt-2">
                            {message.createdBy} • {new Date(message.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Actions Footer */}
            <div className="px-4 py-2 bg-[#1C1C1C] border-t border-[#2E2E2E] flex items-center justify-end gap-2">
                <button
                    onClick={() => onToggle(message.id, message.isActive)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        message.isActive 
                            ? 'bg-[#2E2E2E] text-[#8F8F8F] hover:text-white' 
                            : 'text-[#8F8F8F] hover:bg-[#2E2E2E]'
                    }`}
                    style={message.isActive ? {} : { backgroundColor: 'rgba(62, 207, 142, 0.1)', color: SUPA_GREEN }}
                >
                    <Power className="w-3.5 h-3.5" />
                    {message.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                    onClick={() => onDelete(message.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                </button>
            </div>
        </div>
    );
}
