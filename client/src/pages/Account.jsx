import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    User, Mail, Lock, Eye, EyeOff, ArrowLeft, LogIn, UserPlus,
    Settings, Share2, Copy, Check, LogOut, Trash2, ChevronRight,
    Shield, Camera, MessageCircle, Users, Layers, Calendar,
    Palette, Edit3, Bell, X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';
import LoadingSpinner from '../components/LoadingSpinner';
import * as authApi from '../api/authApi';

export default function Account() {
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { 
        user, isLoggedIn, signUp, signIn, signOut, 
        updateProfile, changePassword, deleteAccount, getMySharedDecks 
    } = useAuth();

    // View state - initialize based on login status
    const [view, setView] = useState(() => isLoggedIn ? 'profile' : 'login');
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [signupForm, setSignupForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
    const [deletePassword, setDeletePassword] = useState('');

    // Modal state
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [editForm, setEditForm] = useState({ username: '', bio: '' });
    const [copied, setCopied] = useState(false);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Social stats
    const [friendCount, setFriendCount] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);

    useEffect(() => {
        let mounted = true;
        
        const loadStats = async () => {
            if (!isLoggedIn) {
                setLoading(false);
                return;
            }
            try {
                const [friends, unread] = await Promise.all([
                    authApi.getFriends(),
                    authApi.getUnreadCount()
                ]);
                if (mounted) {
                    setFriendCount(friends.filter(f => f.status === 'accepted').length);
                    setUnreadMessages(unread.count);
                }
            } catch {
                // Failed to load social stats silently
            } finally {
                if (mounted) setLoading(false);
            }
        };
        
        loadStats();
        
        return () => { mounted = false; };
    }, [isLoggedIn]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginForm.email || !loginForm.password) {
            setAlert({ show: true, title: 'Missing Fields', message: 'Please fill in all fields', type: 'warning' });
            return;
        }
        setSaving(true);
        try {
            await signIn(loginForm.email, loginForm.password);
            haptics.success();
            toast.success('Welcome back!');
            setView('profile');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Login Failed', message: err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (!signupForm.username || !signupForm.email || !signupForm.password) {
            setAlert({ show: true, title: 'Missing Fields', message: 'Please fill in all fields', type: 'warning' });
            return;
        }
        if (signupForm.password !== signupForm.confirmPassword) {
            setAlert({ show: true, title: 'Password Mismatch', message: 'Passwords do not match', type: 'error' });
            return;
        }
        if (signupForm.password.length < 6) {
            setAlert({ show: true, title: 'Weak Password', message: 'Password must be at least 6 characters', type: 'warning' });
            return;
        }
        setSaving(true);
        try {
            const result = await signUp(signupForm.username, signupForm.email, signupForm.password);
            haptics.success();
            
            if (result.migration?.migrated) {
                const { imported } = result.migration;
                toast.success(`Account created! Imported ${imported?.decks || 0} decks from guest mode.`);
            } else {
                toast.success('Account created!');
            }
            setView('profile');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Signup Failed', message: err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarSelect = async (avatarUrl) => {
        setSaving(true);
        try {
            await updateProfile({ avatar: avatarUrl });
            haptics.success();
            toast.success('Avatar updated');
            setShowAvatarPicker(false);
        } catch {
            haptics.error();
            toast.error('Failed to update avatar');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await updateProfile({ username: editForm.username, bio: editForm.bio });
            haptics.success();
            toast.success('Profile updated');
            setShowEditProfile(false);
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Update Failed', message: err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.new !== passwordForm.confirm) {
            setAlert({ show: true, title: 'Password Mismatch', message: 'New passwords do not match', type: 'error' });
            return;
        }
        if (passwordForm.new.length < 6) {
            setAlert({ show: true, title: 'Weak Password', message: 'Password must be at least 6 characters', type: 'warning' });
            return;
        }
        setSaving(true);
        try {
            await changePassword(passwordForm.current, passwordForm.new);
            haptics.success();
            toast.success('Password changed');
            setShowPasswordModal(false);
            setPasswordForm({ current: '', new: '', confirm: '' });
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Change Failed', message: err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        setSaving(true);
        try {
            await deleteAccount(deletePassword);
            haptics.medium();
            toast.success('Account deleted');
            navigate('/');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Delete Failed', message: err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = () => {
        signOut();
        haptics.medium();
        toast.success('Signed out');
        setView('login');
        setLoginForm({ email: '', password: '' });
    };

    const copyShareCode = () => {
        if (user?.shareCode) {
            navigator.clipboard.writeText(user.shareCode);
            setCopied(true);
            haptics.selection();
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const sharedDecks = getMySharedDecks();
    const formatDate = (date) => new Date(date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Login View
    if (view === 'login') {
        return (
            <div className="animate-in fade-in duration-300">
                <div className="mb-8">
                    <h1 className="text-2xl font-display font-bold mb-1">Welcome Back</h1>
                    <p className="text-claude-secondary">Sign in to sync your decks</p>
                </div>

                {/* Icon */}
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 rounded-3xl bg-claude-accent/20 flex items-center justify-center">
                        <LogIn className="w-10 h-10 text-claude-accent" />
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type="email"
                            placeholder="Email"
                            value={loginForm.email}
                            onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={loginForm.password}
                            onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                            className="w-full pl-12 pr-12 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-claude-secondary"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-4 bg-claude-accent text-white rounded-xl font-semibold active:scale-[0.97] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {saving ? <LoadingSpinner size="sm" /> : 'Sign In'}
                    </button>
                </form>

                <p className="text-center text-claude-secondary mt-6">
                    Don't have an account?{' '}
                    <button onClick={() => setView('signup')} className="text-claude-accent font-semibold">
                        Sign Up
                    </button>
                </p>

                <Link to="/" className="block text-center text-claude-secondary text-sm mt-4 underline">
                    Continue without account
                </Link>

                <AlertModal
                    isOpen={alert.show}
                    onClose={() => setAlert({ ...alert, show: false })}
                    title={alert.title}
                    message={alert.message}
                    type={alert.type}
                />
            </div>
        );
    }

    // Signup View
    if (view === 'signup') {
        return (
            <div className="animate-in fade-in duration-300">
                <div className="mb-8">
                    <button onClick={() => setView('login')} className="flex items-center gap-2 text-claude-secondary mb-4">
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <h1 className="text-2xl font-display font-bold mb-1">Create Account</h1>
                    <p className="text-claude-secondary">Join the learning community</p>
                </div>

                {/* Icon */}
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 rounded-3xl bg-green-500/20 flex items-center justify-center">
                        <UserPlus className="w-10 h-10 text-green-500" />
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type="text"
                            placeholder="Username"
                            value={signupForm.username}
                            onChange={e => setSignupForm({ ...signupForm, username: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type="email"
                            placeholder="Email"
                            value={signupForm.email}
                            onChange={e => setSignupForm({ ...signupForm, email: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={signupForm.password}
                            onChange={e => setSignupForm({ ...signupForm, password: e.target.value })}
                            className="w-full pl-12 pr-12 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-claude-secondary"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Confirm Password"
                            value={signupForm.confirmPassword}
                            onChange={e => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold active:scale-[0.97] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {saving ? <LoadingSpinner size="sm" /> : 'Create Account'}
                    </button>
                </form>

                <p className="text-center text-claude-secondary mt-6">
                    Already have an account?{' '}
                    <button onClick={() => setView('login')} className="text-claude-accent font-semibold">
                        Sign In
                    </button>
                </p>

                <AlertModal
                    isOpen={alert.show}
                    onClose={() => setAlert({ ...alert, show: false })}
                    title={alert.title}
                    message={alert.message}
                    type={alert.type}
                />
            </div>
        );
    }

    // Loading state for profile
    if (loading && isLoggedIn) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Profile View (logged in) - Social Media Style
    return (
        <div className="animate-in fade-in duration-300 pb-24">
            {/* Loading overlay for save operations */}
            {saving && (
                <div className="fixed inset-0 bg-claude-bg/60 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <LoadingSpinner size="lg" />
                </div>
            )}
            
            {/* Profile Header - Social Media Style */}
            <div className="relative mb-6">
                {/* Cover/Background */}
                <div className="h-24 bg-gradient-to-r from-claude-accent/30 to-purple-500/30 rounded-2xl" />
                
                {/* Avatar - overlapping cover */}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <button 
                        onClick={() => setShowAvatarPicker(true)}
                        className="relative group"
                    >
                        <Avatar src={user?.avatar} size="3xl" className="border-4 border-claude-bg" />
                        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                        {user?.isAdmin && (
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center border-2 border-claude-bg">
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </button>
                </div>

                {/* Settings Button */}
                <button
                    onClick={handleSignOut}
                    className="absolute top-3 right-3 p-2 bg-claude-bg/80 backdrop-blur rounded-full"
                >
                    <LogOut className="w-5 h-5 text-claude-secondary" />
                </button>
            </div>

            {/* User Info */}
            <div className="text-center mt-14 mb-6">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{user?.username}</h1>
                    {user?.isAdmin && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">ADMIN</span>
                    )}
                </div>
                <p className="text-claude-secondary text-sm mb-2">{user?.email}</p>
                {user?.bio && <p className="text-sm max-w-xs mx-auto">{user.bio}</p>}
                
                {/* Edit Profile Button */}
                <button
                    onClick={() => {
                        setEditForm({ username: user?.username || '', bio: user?.bio || '' });
                        setShowEditProfile(true);
                    }}
                    className="mt-3 px-4 py-1.5 bg-claude-surface border border-claude-border rounded-full text-sm font-medium inline-flex items-center gap-1"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Profile
                </button>
            </div>

            {/* Stats Row */}
            <div className="flex justify-center gap-8 mb-6">
                <Link to="/friends" className="text-center">
                    <p className="text-2xl font-bold">{friendCount}</p>
                    <p className="text-xs text-claude-secondary uppercase tracking-wider">Friends</p>
                </Link>
                <div className="text-center">
                    <p className="text-2xl font-bold">{sharedDecks.length}</p>
                    <p className="text-xs text-claude-secondary uppercase tracking-wider">Shared</p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-claude-secondary">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {user?.createdAt ? formatDate(user.createdAt) : 'N/A'}
                    </p>
                    <p className="text-xs text-claude-secondary uppercase tracking-wider">Joined</p>
                </div>
            </div>

            {/* Social Actions */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <Link
                    to="/friends"
                    className="p-4 bg-claude-surface border border-claude-border rounded-2xl flex items-center gap-3 active:scale-[0.97] transition-transform"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">Friends</p>
                        <p className="text-xs text-claude-secondary">Find & manage</p>
                    </div>
                </Link>
                <Link
                    to="/messages"
                    className="p-4 bg-claude-surface border border-claude-border rounded-2xl flex items-center gap-3 active:scale-[0.97] transition-transform relative"
                >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">Messages</p>
                        <p className="text-xs text-claude-secondary">Chat with friends</p>
                    </div>
                    {unreadMessages > 0 && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                        </div>
                    )}
                </Link>
            </div>

            {/* Share Code Card */}
            <div className="bg-claude-surface border border-claude-border rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-claude-secondary uppercase tracking-wider mb-1">Your Share Code</p>
                        <p className="text-2xl font-mono font-bold tracking-widest">{user?.shareCode}</p>
                    </div>
                    <button
                        onClick={copyShareCode}
                        className="p-3 bg-claude-bg rounded-xl active:scale-95 transition-transform"
                    >
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                </div>
                <p className="text-xs text-claude-secondary mt-2">Share this code with friends to exchange decks</p>
            </div>

            {/* Quick Links */}
            <div className="bg-claude-surface border border-claude-border rounded-2xl overflow-hidden mb-4">
                <Link
                    to="/shared"
                    className="flex items-center justify-between p-4 active:bg-claude-bg transition-colors border-b border-claude-border"
                >
                    <div className="flex items-center gap-3">
                        <Share2 className="w-5 h-5 text-claude-secondary" />
                        <span>Shared Decks</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-claude-secondary">{sharedDecks.length}</span>
                        <ChevronRight className="w-5 h-5 text-claude-secondary" />
                    </div>
                </Link>
                <Link
                    to="/themes"
                    className="flex items-center justify-between p-4 active:bg-claude-bg transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-claude-secondary" />
                        <span>Theme Settings</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-claude-secondary" />
                </Link>
            </div>

            {/* Account Settings */}
            <div className="bg-claude-surface border border-claude-border rounded-2xl overflow-hidden">
                <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex items-center justify-between p-4 w-full active:bg-claude-bg transition-colors border-b border-claude-border"
                >
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-claude-secondary" />
                        <span>Change Password</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-claude-secondary" />
                </button>
                {user?.isAdmin && (
                    <Link
                        to="/admin"
                        className="flex items-center justify-between p-4 active:bg-claude-bg transition-colors border-b border-claude-border"
                    >
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-red-500" />
                            <span className="text-red-500 font-medium">Admin Panel</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-red-500" />
                    </Link>
                )}
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-between p-4 w-full active:bg-claude-bg transition-colors text-red-500"
                >
                    <div className="flex items-center gap-3">
                        <Trash2 className="w-5 h-5" />
                        <span>Delete Account</span>
                    </div>
                </button>
            </div>

            {/* Modals */}
            <AlertModal
                isOpen={alert.show}
                onClose={() => setAlert({ ...alert, show: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />

            {/* Avatar Picker */}
            {showAvatarPicker && (
                <AvatarPicker
                    currentAvatar={user?.avatar}
                    onSelect={handleAvatarSelect}
                    onClose={() => setShowAvatarPicker(false)}
                />
            )}

            {/* Edit Profile Modal */}
            {showEditProfile && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setShowEditProfile(false)}
                >
                    <div 
                        className="w-full max-w-sm bg-claude-surface rounded-2xl p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-display font-bold">Edit Profile</h3>
                            <button onClick={() => setShowEditProfile(false)} className="p-1">
                                <X className="w-5 h-5 text-claude-secondary" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-claude-secondary uppercase tracking-wider mb-2 block">Username</label>
                                <input
                                    type="text"
                                    value={editForm.username}
                                    onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-claude-secondary uppercase tracking-wider mb-2 block">Bio</label>
                                <textarea
                                    value={editForm.bio}
                                    onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                                    placeholder="Tell others about yourself..."
                                    rows={3}
                                    maxLength={150}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none resize-none"
                                />
                                <p className="text-xs text-claude-secondary mt-1 text-right">{editForm.bio.length}/150</p>
                            </div>
                            <button
                                onClick={handleSaveProfile}
                                className="w-full py-3 bg-claude-accent text-white rounded-xl font-semibold"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setShowPasswordModal(false)}
                >
                    <div 
                        className="w-full max-w-sm bg-claude-surface rounded-2xl p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-display font-bold mb-4">Change Password</h3>
                        <div className="space-y-4">
                            <input
                                type="password"
                                placeholder="Current Password"
                                value={passwordForm.current}
                                onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                            />
                            <input
                                type="password"
                                placeholder="New Password"
                                value={passwordForm.new}
                                onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                            />
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={passwordForm.confirm}
                                onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 py-3 bg-claude-bg rounded-xl font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    className="flex-1 py-3 bg-claude-accent text-white rounded-xl font-semibold"
                                >
                                    Change
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Confirmation */}
            {showDeleteConfirm && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div 
                        className="w-full max-w-sm bg-claude-surface rounded-2xl p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-display font-bold text-center mb-2">Delete Account?</h3>
                        <p className="text-claude-secondary text-center text-sm mb-4">
                            This will permanently delete your account and all data. This cannot be undone.
                        </p>
                        <input
                            type="password"
                            placeholder="Enter password to confirm"
                            value={deletePassword}
                            onChange={e => setDeletePassword(e.target.value)}
                            className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-red-500 outline-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeletePassword('');
                                }}
                                className="flex-1 py-3 bg-claude-bg rounded-xl font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
