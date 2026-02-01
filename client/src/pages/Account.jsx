import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    User, Mail, Lock, Eye, EyeOff, ArrowLeft, LogIn, UserPlus,
    Settings, Share2, Copy, Check, LogOut, Trash2, ChevronRight,
    Shield, Bell, Download, Upload, Palette
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

export default function Account() {
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { 
        user, isLoggedIn, signUp, signIn, signOut, 
        updateProfile, changePassword, deleteAccount, getMySharedDecks 
    } = useAuth();

    // View state
    const [view, setView] = useState(isLoggedIn ? 'profile' : 'login');
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [signupForm, setSignupForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
    const [profileForm, setProfileForm] = useState({ username: user?.username || '', bio: user?.bio || '' });
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [deletePassword, setDeletePassword] = useState('');

    // Modal state
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginForm.email || !loginForm.password) {
            setAlert({ show: true, title: 'Missing Fields', message: 'Please fill in all fields', type: 'warning' });
            return;
        }
        try {
            await signIn(loginForm.email, loginForm.password);
            haptics.success();
            toast.success('Welcome back!');
            setView('profile');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Login Failed', message: err.message, type: 'error' });
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
        try {
            const result = await signUp(signupForm.username, signupForm.email, signupForm.password);
            haptics.success();
            
            // Check if guest data was migrated
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
        }
    };

    const handleUpdateProfile = async () => {
        try {
            await updateProfile({ username: profileForm.username, bio: profileForm.bio });
            haptics.success();
            toast.success('Profile updated');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Update Failed', message: err.message, type: 'error' });
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
        try {
            await changePassword(passwordForm.current, passwordForm.new);
            haptics.success();
            toast.success('Password changed');
            setShowPasswordModal(false);
            setPasswordForm({ current: '', new: '', confirm: '' });
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Change Failed', message: err.message, type: 'error' });
        }
    };

    const handleDeleteAccount = async () => {
        try {
            await deleteAccount(deletePassword);
            haptics.medium();
            toast.success('Account deleted');
            navigate('/');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Delete Failed', message: err.message, type: 'error' });
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

    // Login View
    if (view === 'login') {
        return (
            <div className="min-h-screen bg-claude-bg safe-area-top safe-area-bottom">
                <div className="px-4 py-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <Link to="/" className="p-2 -ml-2">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-2xl font-display font-bold">Sign In</h1>
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
                            className="w-full py-4 bg-claude-accent text-white rounded-xl font-semibold active:scale-[0.97] transition-transform"
                        >
                            Sign In
                        </button>
                    </form>

                    {/* Switch to signup */}
                    <p className="text-center text-claude-secondary mt-6">
                        Don't have an account?{' '}
                        <button onClick={() => setView('signup')} className="text-claude-accent font-semibold">
                            Sign Up
                        </button>
                    </p>

                    {/* Continue without account */}
                    <Link
                        to="/"
                        className="block text-center text-claude-secondary text-sm mt-4 underline"
                    >
                        Continue without account
                    </Link>
                </div>

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
            <div className="min-h-screen bg-claude-bg safe-area-top safe-area-bottom">
                <div className="px-4 py-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <button onClick={() => setView('login')} className="p-2 -ml-2">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-2xl font-display font-bold">Create Account</h1>
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
                            className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold active:scale-[0.97] transition-transform"
                        >
                            Create Account
                        </button>
                    </form>

                    {/* Switch to login */}
                    <p className="text-center text-claude-secondary mt-6">
                        Already have an account?{' '}
                        <button onClick={() => setView('login')} className="text-claude-accent font-semibold">
                            Sign In
                        </button>
                    </p>
                </div>

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

    // Profile View (logged in)
    return (
        <div className="min-h-screen bg-claude-bg safe-area-top safe-area-bottom pb-24">
            <div className="px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-2 -ml-2">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-2xl font-display font-bold">Account</h1>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="p-2 text-claude-secondary"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Card */}
                <div className="bg-claude-surface border border-claude-border rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${user?.isAdmin ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-claude-accent/20'}`}>
                            {user?.isAdmin ? (
                                <Shield className="w-8 h-8 text-white" />
                            ) : (
                                <User className="w-8 h-8 text-claude-accent" />
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold">{user?.username}</h2>
                                {user?.isAdmin && (
                                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">ADMIN</span>
                                )}
                            </div>
                            <p className="text-sm text-claude-secondary">{user?.email}</p>
                        </div>
                    </div>

                    {/* Admin Notice */}
                    {user?.isAdmin && (
                        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                            <p className="text-sm text-red-400 font-medium">🛡️ Admin mode active - All Gmail perks unlocked</p>
                        </div>
                    )}

                    {/* Share Code */}
                    <div className="bg-claude-bg rounded-xl p-4 mt-4">
                        <p className="text-xs text-claude-secondary uppercase tracking-wider mb-2">Your Share Code</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-mono font-bold tracking-widest">{user?.shareCode}</span>
                            <button
                                onClick={copyShareCode}
                                className="p-2 bg-claude-surface rounded-lg active:scale-95 transition-transform"
                            >
                                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-claude-secondary mt-2">Share this code with friends to exchange decks</p>
                    </div>
                </div>

                {/* Edit Profile */}
                <div className="bg-claude-surface border border-claude-border rounded-2xl p-5 mb-4">
                    <h3 className="font-semibold mb-4">Edit Profile</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-claude-secondary uppercase tracking-wider mb-2 block">Username</label>
                            <input
                                type="text"
                                value={profileForm.username}
                                onChange={e => setProfileForm({ ...profileForm, username: e.target.value })}
                                className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-claude-secondary uppercase tracking-wider mb-2 block">Bio</label>
                            <textarea
                                value={profileForm.bio}
                                onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                                placeholder="Tell others about yourself..."
                                rows={3}
                                className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none resize-none"
                            />
                        </div>
                        <button
                            onClick={handleUpdateProfile}
                            className="w-full py-3 bg-claude-accent text-white rounded-xl font-semibold active:scale-[0.97] transition-transform"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Shared Decks */}
                <div className="bg-claude-surface border border-claude-border rounded-2xl mb-4 overflow-hidden">
                    <Link
                        to="/shared"
                        className="flex items-center justify-between p-4 active:bg-claude-bg transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Share2 className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="font-medium">Shared Decks</p>
                                <p className="text-sm text-claude-secondary">{sharedDecks.length} deck{sharedDecks.length !== 1 ? 's' : ''} shared</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-claude-secondary" />
                    </Link>
                </div>

                {/* Settings */}
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
                    <Link
                        to="/themes"
                        className="flex items-center justify-between p-4 active:bg-claude-bg transition-colors border-b border-claude-border"
                    >
                        <div className="flex items-center gap-3">
                            <Palette className="w-5 h-5 text-claude-secondary" />
                            <span>Theme Settings</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-claude-secondary" />
                    </Link>
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
            </div>

            {/* Alert Modal */}
            <AlertModal
                isOpen={alert.show}
                onClose={() => setAlert({ ...alert, show: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" 
                    style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                    onClick={() => setShowPasswordModal(false)}
                >
                    <div className="w-full max-w-sm max-h-[80vh] overflow-y-auto overscroll-contain bg-claude-surface rounded-2xl p-6" onClick={e => e.stopPropagation()}>
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
                    style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div className="w-full max-w-sm max-h-[80vh] overflow-y-auto overscroll-contain bg-claude-surface rounded-2xl p-6" onClick={e => e.stopPropagation()}>
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
