import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Trash2, LogOut, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import AlertModal from '../components/AlertModal';

export default function Settings() {
    const { signOut, deleteAccount } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleSignOut = () => {
        haptics.medium();
        signOut();
        toast.success('Signed out');
        navigate('/');
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await deleteAccount(); // This likely requires password confirmation in a real app
            toast.success('Account deleted');
            navigate('/');
        } catch (err) {
            toast.error('Failed to delete account');
            setDeleting(false);
        }
    };

    const SettingItem = ({ icon: Icon, title, description, onClick, destructive = false, toggle = null }) => (
        <button
            onClick={onClick}
            className={`w-full p-4 flex items-center gap-4 bg-claude-surface border border-claude-border first:rounded-t-2xl last:rounded-b-2xl active:bg-claude-border/50 transition-colors ${destructive ? 'border-red-500/20 bg-red-500/5' : ''}`}
        >
            <div className={`p-2 rounded-lg ${destructive ? 'bg-red-500/10 text-red-500' : 'bg-claude-bg text-claude-secondary'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
                <p className={`font-medium ${destructive ? 'text-red-500' : 'text-claude-text'}`}>{title}</p>
                {description && <p className="text-xs text-botanical-sepia">{description}</p>}
            </div>
            {toggle !== null ? (
                <div className={`w-10 h-6 rounded-full relative transition-colors ${toggle ? 'bg-botanical-forest' : 'bg-claude-border'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${toggle ? 'left-5' : 'left-1'}`} />
                </div>
            ) : (
                <ChevronRight className={`w-5 h-5 ${destructive ? 'text-red-500/50' : 'text-claude-border'}`} />
            )}
        </button>
    );

    return (
        <div className="min-h-screen bg-claude-bg pb-24 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-claude-border sticky top-0 bg-claude-bg/80 backdrop-blur z-10">
                <button
                    onClick={() => navigate('/account')}
                    className="p-2 hover:bg-claude-surface rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-claude-text" />
                </button>
                <h1 className="text-lg font-display font-bold text-claude-text">Settings</h1>
            </div>

            <div className="p-4 max-w-md mx-auto space-y-6">

                {/* Account Security */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-wider text-botanical-sepia mb-3 px-1">
                        Security
                    </h2>
                    <div className="flex flex-col">
                        <SettingItem
                            icon={Lock}
                            title="Change Password"
                            description="Update your password"
                            onClick={() => toast('Change password coming soon!')}
                        />
                        <SettingItem
                            icon={Shield}
                            title="Two-Factor Authentication"
                            description="Extra layer of security"
                            onClick={() => toast('2FA settings coming soon!')}
                        />
                    </div>
                </div>

                {/* Preferences */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-wider text-botanical-sepia mb-3 px-1">
                        Preferences
                    </h2>
                    <div className="flex flex-col">
                        <SettingItem
                            icon={Bell}
                            title="Notifications"
                            description="Manage push notifications"
                            toggle={true}
                            onClick={() => toast('Notification settings saved')}
                        />
                        <SettingItem
                            icon={Moon}
                            title="Dark Mode"
                            description="Adjust appearance"
                            toggle={true}
                            onClick={() => toast('Theme settings saved')}
                        />
                    </div>
                </div>

                {/* Danger Zone */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-wider text-red-400 mb-3 px-1">
                        Danger Zone
                    </h2>
                    <div className="flex flex-col">
                        <SettingItem
                            icon={LogOut}
                            title="Sign Out"
                            onClick={handleSignOut}
                            destructive
                        />
                        <SettingItem
                            icon={Trash2}
                            title="Delete Account"
                            description="Permanently delete your data"
                            onClick={() => setShowDeleteModal(true)}
                            destructive
                        />
                    </div>
                </div>

                <div className="text-center pt-8">
                    <p className="text-xs text-botanical-sepia font-mono">
                        Riven v1.0.0 (Build 2024.1)
                    </p>
                    <p className="text-[10px] text-claude-border mt-1">
                        Made with 🌿 by Antigravity
                    </p>
                </div>
            </div>

            {/* Delete Account Modal */}
            <AlertModal
                isOpen={showDeleteModal}
                title="Delete Account?"
                message="This action cannot be undone. All your decks, progress, and data will be permanently lost."
                confirmText={deleting ? "Deleting..." : "Delete Forever"}
                cancelText="Cancel"
                isDestructive
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}
