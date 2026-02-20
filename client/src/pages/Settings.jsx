import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, Leaf, Flower } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { ThemeContext } from '../ThemeContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TwoFactorAuthModal from '../components/TwoFactorAuthModal';
import DeleteAccountModal from '../components/DeleteAccountModal';

const SettingItem = ({ icon: IconComponent, title, description, onClick, destructive = false, toggle = null, toggleValue = false }) => (
    <button
        onClick={onClick}
        className={`w-full py-4 flex items-center gap-4 border-b border-botanical-sepia/10 active:bg-botanical-forest/5 transition-colors group relative overflow-hidden`}
    >
        <div className={`p-2 rounded-full ${destructive ? 'bg-red-500/10 text-red-500' : 'bg-botanical-forest/10 text-botanical-forest'} group-hover:scale-110 transition-transform duration-300`}>
            {IconComponent && <IconComponent className="w-5 h-5" />}
        </div>
        <div className="flex-1 text-left z-10">
            <p className={`font-display text-lg tracking-wide ${destructive ? 'text-red-400' : 'text-claude-text group-hover:text-botanical-parchment transition-colors'}`}>{title}</p>
            {description && <p className="text-xs font-mono text-botanical-sepia mt-0.5">{description}</p>}
        </div>

        {toggle !== null ? (
            <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggleValue ? 'bg-botanical-forest' : 'bg-claude-surface border border-botanical-sepia/30'}`}>
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${toggleValue ? 'left-6' : 'left-1'}`} />
            </div>
        ) : (
            <ChevronRight className={`w-5 h-5 ${destructive ? 'text-red-500/50' : 'text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-all'}`} />
        )}
    </button>
);

export default function Settings() {
    const { signOut, user } = useAuth();
    const { activeTheme, switchTheme, themes } = useContext(ThemeContext) || {};
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [modals, setModals] = useState({
        password: false,
        twoFactor: false,
        delete: false
    });

    const isLightMode = activeTheme?.name === 'Riven Light';

    const handleSignOut = () => {
        haptics.medium();
        signOut();
        toast.success('Signed out');
        navigate('/');
    };

    const toggleTheme = () => {
        haptics.light();
        if (themes && themes.length > 0) {
            const targetThemeName = isLightMode ? 'Riven' : 'Riven Light';
            const targetTheme = themes.find(t => t.name === targetThemeName);
            if (targetTheme) {
                switchTheme(targetTheme.id);
                toast.success(`Switched to ${targetThemeName}`);
            } else {
                toast.error('Theme not found');
            }
        }
    };

    const openModal = (name) => {
        haptics.light();
        setModals(prev => ({ ...prev, [name]: true }));
    };

    const closeModal = (name) => {
        setModals(prev => ({ ...prev, [name]: false }));
    };

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
                            onClick={() => openModal('password')}
                        />
                        <SettingItem
                            icon={Shield}
                            title="Two-Factor Auth"
                            description={user?.twoFAEnabled ? "Enabled" : "Add extra protection"}
                            onClick={() => openModal('twoFactor')}
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
                            toggleValue={false} // Placeholder
                            onClick={() => toast('Notification settings saved')}
                        />
                        <SettingItem
                            icon={isLightMode ? Sun : Moon}
                            title="Light Mode"
                            description={isLightMode ? "Daylight Theme" : "Midnight Theme"}
                            toggle={true}
                            toggleValue={isLightMode}
                            onClick={toggleTheme}
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
                            onClick={() => openModal('delete')}
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

            {/* Modals */}
            <ChangePasswordModal
                isOpen={modals.password}
                onClose={() => closeModal('password')}
            />
            <TwoFactorAuthModal
                isOpen={modals.twoFactor}
                onClose={() => closeModal('twoFactor')}
            />
            <DeleteAccountModal
                isOpen={modals.delete}
                onClose={() => closeModal('delete')}
            />
        </div>
    );
}
