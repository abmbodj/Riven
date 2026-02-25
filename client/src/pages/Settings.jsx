import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, Leaf, Flower } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { ThemeContext } from '../ThemeContext';
import { api } from '../api';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TwoFactorAuthModal from '../components/TwoFactorAuthModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import { Network, RefreshCw } from 'lucide-react';

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

    const [lmsStatus, setLmsStatus] = useState({ loading: true, syncing: false, isConnected: false, canvasUrl: '' });
    const [canvasForm, setCanvasForm] = useState({ url: '', token: '' });
    const [connectingCanvas, setConnectingCanvas] = useState(false);

    React.useEffect(() => {
        const loadLMS = async () => {
            try {
                const res = await api.getCanvasSettings();
                setLmsStatus(prev => ({ ...prev, isConnected: res.isConnected, canvasUrl: res.canvasUrl || '', loading: false }));
                if (res.canvasUrl) setCanvasForm(prev => ({ ...prev, url: res.canvasUrl }));
            } catch (err) {
                setLmsStatus(prev => ({ ...prev, loading: false }));
            }
        };
        loadLMS();
    }, []);

    const handleConnectCanvas = async () => {
        if (!canvasForm.url || !canvasForm.token) {
            toast.error('Enter your Canvas URL and API Token');
            return;
        }
        setConnectingCanvas(true);
        try {
            await api.connectCanvas(canvasForm.url, canvasForm.token);
            toast.success('Canvas connected successfully!');
            setLmsStatus(prev => ({ ...prev, isConnected: true, canvasUrl: canvasForm.url }));
            setCanvasForm(prev => ({ ...prev, token: '' }));
        } catch (err) {
            toast.error(err.error || 'Failed to connect Canvas');
        } finally {
            setConnectingCanvas(false);
        }
    };

    const handleDisconnectCanvas = async () => {
        try {
            await api.disconnectCanvas();
            toast.success('Canvas disconnected');
            setLmsStatus(prev => ({ ...prev, isConnected: false, canvasUrl: '' }));
            setCanvasForm({ url: '', token: '' });
        } catch (err) {
            toast.error('Failed to disconnect');
        }
    };

    const handleSyncLms = async () => {
        setLmsStatus(prev => ({ ...prev, syncing: true }));
        try {
            const res = await api.syncCanvas();
            toast.success(`Synced ${res.classesAdded} classes & ${res.assignmentsAdded} assignments!`);
        } catch (err) {
            toast.error(err.error || 'Canvas Sync Failed');
        } finally {
            setLmsStatus(prev => ({ ...prev, syncing: false }));
        }
    };

    const isLightMode = activeTheme?.name === 'Riven Light';

    const handleSignOut = () => {
        haptics.medium();
        signOut();
        toast.success('Signed out');
        navigate('/');
    };

    const toggleTheme = () => {
        haptics.light();
        if (themes && themes.length < 2) return;
        const light = themes.find(t => t.name === 'Riven Light');
        const dark = themes.find(t => t.name === 'Riven');
        if (light && dark) {
            switchTheme(isLightMode ? dark.name : light.name);
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
        <div className="min-h-screen bg-claude-bg text-claude-text pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-claude-bg/80 backdrop-blur-xl border-b border-botanical-sepia/10">
                <div className="flex items-center justify-between px-4 py-4">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-claude-surface transition-colors">
                        <ArrowLeft className="w-5 h-5 text-claude-text" />
                    </button>
                    <h1 className="font-display text-xl tracking-wider text-claude-text">Settings</h1>
                    <div className="w-9" />
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Account Section */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-widest text-botanical-sepia mb-2 pl-1 border-l-2 border-botanical-forest/30">
                        &nbsp;Account
                    </h2>
                    <div className="bg-claude-surface/30 border border-botanical-sepia/10 rounded-2xl overflow-hidden px-4 shadow-sm">
                        <SettingItem icon={Lock} title="Change Password" description="Update your password" onClick={() => setModals(m => ({ ...m, password: true }))} />
                        <SettingItem icon={Shield} title="Two-Factor Auth" description={user?.twoFAEnabled ? 'Enabled — Manage 2FA' : 'Add extra security'} onClick={() => setModals(m => ({ ...m, twoFactor: true }))} />
                    </div>
                </div>

                {/* Integrations */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-widest text-[#0ea5e9] mb-2 pl-1 border-l-2 border-[#0ea5e9]/30">
                        &nbsp;Integrations
                    </h2>
                    <div className="flex flex-col bg-claude-surface/30 border border-botanical-sepia/10 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-[#0ea5e9]/10 text-[#0ea5e9]">
                                <Network className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg tracking-wide text-claude-text">Canvas Sync</h3>
                                <p className="text-xs font-mono text-botanical-sepia mt-0.5">
                                    {lmsStatus.isConnected ? `Connected to ${lmsStatus.canvasUrl.replace(/https?:\/\//, '')}` : 'Import courses & assignments from Canvas'}
                                </p>
                            </div>
                        </div>

                        {!lmsStatus.loading && (
                            <div className="space-y-3">
                                {!lmsStatus.isConnected ? (
                                    <>
                                        <input
                                            type="url"
                                            placeholder="Canvas URL (e.g. https://school.instructure.com)"
                                            value={canvasForm.url}
                                            onChange={e => setCanvasForm(prev => ({ ...prev, url: e.target.value }))}
                                            className="w-full bg-claude-bg border border-botanical-sepia/20 rounded-xl px-4 py-3 text-sm text-claude-text placeholder-botanical-sepia/40 font-mono focus:outline-none focus:border-[#0ea5e9]/50 transition-colors"
                                        />
                                        <input
                                            type="password"
                                            placeholder="API Token"
                                            value={canvasForm.token}
                                            onChange={e => setCanvasForm(prev => ({ ...prev, token: e.target.value }))}
                                            className="w-full bg-claude-bg border border-botanical-sepia/20 rounded-xl px-4 py-3 text-sm text-claude-text placeholder-botanical-sepia/40 font-mono focus:outline-none focus:border-[#0ea5e9]/50 transition-colors"
                                        />
                                        <p className="text-[10px] font-mono text-botanical-sepia/60 leading-relaxed">
                                            Find your token in Canvas → Account → Settings → New Access Token
                                        </p>
                                        <button
                                            onClick={handleConnectCanvas}
                                            disabled={connectingCanvas}
                                            className="w-full bg-[#1e3840] hover:bg-[#233e46] text-botanical-parchment font-mono text-xs uppercase tracking-widest py-3 rounded-xl transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Lock className="w-4 h-4" />
                                            {connectingCanvas ? 'Connecting...' : 'Connect Canvas'}
                                        </button>
                                    </>
                                ) : (
                                    <div className="pt-2 flex flex-col gap-3">
                                        <button
                                            onClick={handleSyncLms}
                                            disabled={lmsStatus.syncing}
                                            className="w-full bg-[#0ea5e9]/20 hover:bg-[#0ea5e9]/30 text-[#0ea5e9] border border-[#0ea5e9]/20 disabled:opacity-50 font-mono text-xs uppercase tracking-widest py-3 rounded-xl transition-all font-bold flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${lmsStatus.syncing ? 'animate-spin' : ''}`} />
                                            {lmsStatus.syncing ? 'Syncing Courses...' : 'Sync Now'}
                                        </button>
                                        <button
                                            onClick={handleDisconnectCanvas}
                                            className="w-full text-botanical-sepia/60 hover:text-red-400 font-mono text-[10px] uppercase tracking-widest py-2 rounded-xl transition-colors"
                                        >
                                            Disconnect Canvas
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
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

                        {/* Bespoke Atmosphere Setting */}
                        <div className="py-6 mt-4 border-t border-botanical-sepia/10">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <div>
                                    <h3 className="font-display text-lg tracking-wide text-claude-text">Atmosphere</h3>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-botanical-sepia mt-1 opacity-70">Current Element</p>
                                </div>
                            </div>

                            <button
                                onClick={toggleTheme}
                                className="w-full relative overflow-hidden rounded-[2rem] p-6 text-left group transition-all duration-500 active:scale-[0.98] border border-botanical-sepia/20"
                                style={{
                                    backgroundColor: isLightMode ? '#fdfbf7' : '#141716',
                                    boxShadow: isLightMode ? '0 10px 30px -15px rgba(0,0,0,0.05)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                                }}
                            >
                                {/* Noise Texture */}
                                <div className="absolute inset-0 pointer-events-none opacity-[0.20] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className={`p-4 rounded-full transition-all duration-500 shadow-inner border border-black/5 ${isLightMode ? 'bg-[#f4f1eb] text-amber-600' : 'bg-[#1c211f] text-indigo-300'}`}>
                                            {isLightMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <p className={`font-display text-3xl font-light tracking-tight transition-colors duration-500 ${isLightMode ? 'text-[#2c2825]' : 'text-[#e8e4dc]'}`}>
                                                {isLightMode ? 'Alabaster' : 'Obsidian'}
                                            </p>
                                            <p className={`text-[10px] font-mono uppercase tracking-widest mt-1 opacity-50 ${isLightMode ? 'text-[#2c2825]' : 'text-[#e8e4dc]'}`}>
                                                Tap to inverse flux
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action indicator */}
                                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${isLightMode ? 'border-[#2c2825]/20 text-[#2c2825]/40' : 'border-[#e8e4dc]/20 text-[#e8e4dc]/40'}`}>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </button>
                        </div>
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
