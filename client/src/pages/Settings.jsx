import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Trash2, LogOut, ChevronRight, Leaf, Flower } from 'lucide-react';
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
            await deleteAccount();
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
            className={`w-full py-4 flex items-center gap-4 border-b border-botanical-sepia/10 active:bg-botanical-forest/5 transition-colors group relative overflow-hidden`}
        >
            <div className={`p-2 rounded-full ${destructive ? 'bg-red-500/10 text-red-500' : 'bg-botanical-forest/10 text-botanical-forest'} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left z-10">
                <p className={`font-display text-lg tracking-wide ${destructive ? 'text-red-400' : 'text-claude-text group-hover:text-botanical-parchment transition-colors'}`}>{title}</p>
                {description && <p className="text-xs font-mono text-botanical-sepia mt-0.5">{description}</p>}
            </div>

            {toggle !== null ? (
                <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggle ? 'bg-botanical-forest' : 'bg-claude-surface border border-botanical-sepia/30'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${toggle ? 'left-6' : 'left-1'}`} />
                </div>
            ) : (
                <ChevronRight className={`w-5 h-5 ${destructive ? 'text-red-500/50' : 'text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-all'}`} />
            )}
        </button>
    );

    return (
        <div className="min-h-screen bg-claude-bg pb-24 animate-in fade-in duration-300">
            {/* Organic Header */}
            <div className="relative h-40 overflow-hidden mb-6">
                <div className="absolute inset-0 bg-[#0f2026]"></div>
                <div className="absolute top-[-50%] right-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(222,185,106,0.1),transparent_60%)] blur-3xl" />

                {/* Navigation */}
                <div className="absolute top-0 left-0 right-0 p-4 z-10 safe-area-top">
                    <button
                        onClick={() => navigate('/account')}
                        className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white/90 hover:bg-black/30 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                </div>

                <div className="absolute bottom-4 left-6">
                    <h1 className="text-3xl font-display text-white/90">Settings</h1>
                </div>

                <Flower className="absolute -bottom-6 -right-6 w-32 h-32 text-botanical-forest/5 rotate-[-12deg]" />
            </div>

            <div className="px-6 max-w-md mx-auto space-y-10">

                {/* Account Security */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-widest text-botanical-sepia mb-2 pl-1 border-l-2 border-botanical-forest/30">
                        &nbsp;Security
                    </h2>
                    <div className="flex flex-col">
                        <SettingItem
                            icon={Lock}
                            title="Change Password"
                            description="Secure your journal"
                            onClick={() => toast('Change password coming soon!')}
                        />
                        <SettingItem
                            icon={Shield}
                            title="Two-Factor Auth"
                            description="Add extra protection"
                            onClick={() => toast('2FA settings coming soon!')}
                        />
                    </div>
                </div>

                {/* Preferences */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-widest text-botanical-sepia mb-2 pl-1 border-l-2 border-botanical-forest/30">
                        &nbsp;Preferences
                    </h2>
                    <div className="flex flex-col">
                        <SettingItem
                            icon={Bell}
                            title="Notifications"
                            description="Reminders & Updates"
                            toggle={true}
                            onClick={() => toast('Notification settings saved')}
                        />
                        <SettingItem
                            icon={Moon}
                            title="Dark Mode"
                            description="Always on"
                            toggle={true}
                            onClick={() => toast('Theme settings saved')}
                        />
                    </div>
                </div>

                {/* Danger Zone */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-widest text-red-400 mb-2 pl-1 border-l-2 border-red-500/30">
                        &nbsp;Danger Zone
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
                            description="Permanently remove all data"
                            onClick={() => setShowDeleteModal(true)}
                            destructive
                        />
                    </div>
                </div>

                <div className="text-center pt-8 opacity-40">
                    <Leaf className="w-6 h-6 text-botanical-forest mx-auto mb-2" />
                    <p className="text-xs text-botanical-sepia font-mono">
                        Riven v1.0.0
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
