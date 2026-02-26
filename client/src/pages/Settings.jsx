import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, Leaf, Flower, Network, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { ThemeContext } from '../ThemeContext';
import { api } from '../api';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TwoFactorAuthModal from '../components/TwoFactorAuthModal';
import DeleteAccountModal from '../components/DeleteAccountModal';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const SettingItem = ({ icon: IconComponent, title, description, onClick, destructive = false, toggle = null, toggleValue = false, noBorder = false }) => (
    <button
        onClick={onClick}
        className={`w-full py-4 px-5 flex items-center gap-4 ${!noBorder ? 'border-b border-botanical-sepia/10' : ''} active:bg-botanical-sepia/5 transition-colors group relative overflow-hidden`}
    >
        <div className={`p-2.5 rounded-xl ${destructive ? 'bg-red-500/10 text-red-500' : 'bg-claude-bg text-claude-text/70 shadow-sm border border-botanical-sepia/5'} group-hover:scale-110 transition-transform duration-300`}>
            {IconComponent && <IconComponent className="w-5 h-5" />}
        </div>
        <div className="flex-1 text-left z-10">
            <p className={`font-display text-[16px] tracking-wide font-medium ${destructive ? 'text-red-400' : 'text-claude-text group-hover:text-botanical-forest transition-colors'}`}>{title}</p>
            {description && <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">{description}</p>}
        </div>

        {toggle !== null ? (
            <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggleValue ? 'bg-botanical-forest shadow-inner' : 'bg-claude-surface border border-botanical-sepia/30'}`}>
                <div className={`absolute top-[3px] w-[20px] h-[20px] bg-white rounded-full transition-all duration-300 shadow-sm ${toggleValue ? 'left-[24px]' : 'left-[3px]'}`} />
            </div>
        ) : (
            <ChevronRight className={`w-5 h-5 ${destructive ? 'text-red-500/50' : 'text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-all'}`} />
        )}
    </button>
);

export default function Settings() {
    const { signOut, user } = useAuth();
    const { activeTheme } = useContext(ThemeContext) || {};
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
    const [formErrors, setFormErrors] = useState({ url: false, token: false });

    const [aiLimits, setAiLimits] = useState({ remaining: 15, max: 15, loading: true });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await api.getCanvasSettings();
                setLmsStatus(prev => ({ ...prev, isConnected: res.isConnected, canvasUrl: res.canvasUrl || '', loading: false }));
                if (res.canvasUrl) setCanvasForm(prev => ({ ...prev, url: res.canvasUrl }));
            } catch (err) {
                setLmsStatus(prev => ({ ...prev, loading: false }));
            }

            try {
                const aiData = await api.getAILimits();
                setAiLimits({ ...aiData, loading: false });
            } catch (err) {
                setAiLimits(prev => ({ ...prev, loading: false }));
            }
        };
        loadSettings();
    }, []);

    const handleConnectCanvas = async () => {
        // Strict empty field validation based on user rule
        const errors = {
            url: !canvasForm.url.trim(),
            token: !canvasForm.token.trim()
        };

        setFormErrors(errors);

        if (errors.url || errors.token) {
            haptics.error();
            toast.error('Please fill in all empty fields');

            // Clear errors after animation
            setTimeout(() => setFormErrors({ url: false, token: false }), 2000);
            return;
        }

        setConnectingCanvas(true);
        try {
            await api.connectCanvas(canvasForm.url, canvasForm.token);
            toast.success('Canvas connected successfully!');
            haptics.success();
            setLmsStatus(prev => ({ ...prev, isConnected: true, canvasUrl: canvasForm.url }));
            setCanvasForm(prev => ({ ...prev, token: '' })); // Clear token for security
        } catch (err) {
            haptics.error();
            toast.error(err.error || 'Failed to connect Canvas');
        } finally {
            setConnectingCanvas(false);
        }
    };

    const handleDisconnectCanvas = async () => {
        haptics.medium();
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
        haptics.light();
        try {
            const res = await api.syncCanvas();
            toast.success(`Synced ${res.classesAdded} classes & ${res.assignmentsAdded} assignments!`);
            haptics.success();
        } catch (err) {
            haptics.error();
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

    const openModal = (name) => {
        haptics.light();
        setModals(prev => ({ ...prev, [name]: true }));
    };

    const closeModal = (name) => {
        setModals(prev => ({ ...prev, [name]: false }));
    };

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text pb-24 font-sans">
            {/* Minimalist Floating Header */}
            <div className="sticky top-0 z-50 bg-claude-bg/80 backdrop-blur-xl border-b border-botanical-sepia/5 pb-2 pt-12">
                <div className="flex items-center justify-between px-4 py-2 border-b border-botanical-sepia/5 pb-4">
                    <button onClick={() => navigate(-1)} className="p-3 bg-claude-surface rounded-full shadow-sm border border-botanical-sepia/5 hover:bg-botanical-sepia/10 active:scale-95 transition-all">
                        <ArrowLeft className="w-5 h-5 text-claude-text" />
                    </button>
                    <h1 className="font-display text-xl tracking-wider text-claude-text font-bold">Settings</h1>
                    <div className="w-12" /> {/* Spacer */}
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="max-w-lg mx-auto px-5 py-6 space-y-8"
            >
                {/* Account Section Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-botanical-sepia mb-3 pl-2">
                        Account Security
                    </h2>
                    <div className="bg-claude-surface/50 backdrop-blur-md border border-botanical-sepia/10 rounded-[2rem] overflow-hidden shadow-sm">
                        <SettingItem icon={Lock} title="Change Password" description="Update your credentials" onClick={() => openModal('password')} />
                        <SettingItem icon={Shield} title="Two-Factor Auth" description={user?.twoFAEnabled ? 'Enabled — Manage 2FA' : 'Add extra security'} onClick={() => openModal('twoFactor')} noBorder />
                    </div>
                </motion.div>

                {/* Integrations Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#0ea5e9] mb-3 pl-2">
                        Integrations
                    </h2>
                    <div className="flex flex-col bg-claude-surface/50 backdrop-blur-md border border-[#0ea5e9]/10 rounded-[2rem] p-6 shadow-sm space-y-5 relative overflow-hidden group">
                        {/* Glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0ea5e9]/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3 rounded-2xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 shadow-inner">
                                <Network className="w-6 h-6 text-[#0ea5e9]" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold">Canvas Sync</h3>
                                <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">
                                    {lmsStatus.isConnected ? `Connected to ${lmsStatus.canvasUrl.replace(/https?:\/\//, '')}` : 'Import courses & assignments'}
                                </p>
                            </div>
                        </div>

                        {!lmsStatus.loading && (
                            <div className="relative z-10">
                                <AnimatePresence mode="wait">
                                    {!lmsStatus.isConnected ? (
                                        <motion.div
                                            key="connect"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 pt-2"
                                        >
                                            <div className="space-y-3">
                                                <motion.div animate={formErrors.url ? { x: [-5, 5, -5, 5, 0] } : {}} transition={{ duration: 0.4 }}>
                                                    <input
                                                        type="url"
                                                        placeholder="Canvas URL (e.g. https://school.instructure.com)"
                                                        value={canvasForm.url}
                                                        onChange={e => {
                                                            setCanvasForm(prev => ({ ...prev, url: e.target.value }));
                                                            if (formErrors.url) setFormErrors(prev => ({ ...prev, url: false }));
                                                        }}
                                                        className={`w-full bg-claude-bg border ${formErrors.url ? 'border-red-400 focus:border-red-500 bg-red-500/5' : 'border-botanical-sepia/20 focus:border-[#0ea5e9]/50'} rounded-xl px-4 py-3.5 text-sm text-claude-text placeholder-botanical-sepia/40 font-mono focus:outline-none transition-colors shadow-inner`}
                                                    />
                                                </motion.div>

                                                <motion.div animate={formErrors.token ? { x: [-5, 5, -5, 5, 0] } : {}} transition={{ duration: 0.4 }}>
                                                    <input
                                                        type="password"
                                                        placeholder="API Token"
                                                        value={canvasForm.token}
                                                        onChange={e => {
                                                            setCanvasForm(prev => ({ ...prev, token: e.target.value }));
                                                            if (formErrors.token) setFormErrors(prev => ({ ...prev, token: false }));
                                                        }}
                                                        className={`w-full bg-claude-bg border ${formErrors.token ? 'border-red-400 focus:border-red-500 bg-red-500/5' : 'border-botanical-sepia/20 focus:border-[#0ea5e9]/50'} rounded-xl px-4 py-3.5 text-sm text-claude-text placeholder-botanical-sepia/40 font-mono focus:outline-none transition-colors shadow-inner`}
                                                    />
                                                </motion.div>
                                            </div>

                                            <p className="text-[10px] font-mono text-botanical-sepia/70 leading-relaxed text-center px-2">
                                                Find your token in Canvas → Account → Settings → New Access Token
                                            </p>

                                            <button
                                                onClick={handleConnectCanvas}
                                                disabled={connectingCanvas}
                                                className="w-full bg-claude-text hover:bg-botanical-forest text-claude-bg font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 rounded-xl transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] shadow-md"
                                            >
                                                <Lock className="w-4 h-4" />
                                                {connectingCanvas ? 'Connecting...' : 'Secure Connect'}
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="connected"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="pt-4 flex flex-col gap-3"
                                        >
                                            <button
                                                onClick={handleSyncLms}
                                                disabled={lmsStatus.syncing}
                                                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white disabled:opacity-70 font-mono text-[11px] uppercase tracking-[0.15em] py-3.5 rounded-xl transition-all font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-[#0ea5e9]/20"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${lmsStatus.syncing ? 'animate-spin' : ''}`} />
                                                {lmsStatus.syncing ? 'Syncing Courses...' : 'Sync Now'}
                                            </button>
                                            <button
                                                onClick={handleDisconnectCanvas}
                                                className="w-full bg-claude-bg border border-botanical-sepia/10 text-botanical-sepia/80 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 font-mono text-[10px] uppercase tracking-[0.2em] py-3 rounded-xl transition-all active:scale-[0.98]"
                                            >
                                                Disconnect Integration
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* AI Capabilities Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500 mb-3 pl-2">
                        AI Capabilities
                    </h2>
                    <div className="flex flex-col bg-claude-surface/50 backdrop-blur-md border border-amber-500/10 rounded-[2rem] p-6 shadow-sm space-y-4 relative overflow-hidden group">
                        {/* Glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
                                <Sun className="w-6 h-6 text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold flex items-center justify-between">
                                    AI Generations
                                    {!aiLimits.loading && (
                                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${aiLimits.remaining > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                            {aiLimits.remaining} / {aiLimits.max} Left
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">
                                    Resets every 15 minutes
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 pt-2 grid grid-cols-2 gap-3">
                            <div className="bg-claude-bg/50 border border-botanical-sepia/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                                <p className="text-[10px] uppercase font-mono tracking-widest text-botanical-sepia/70 mb-1">Max Input</p>
                                <p className="text-sm font-medium text-claude-text">~3,000 words</p>
                                <p className="text-[9px] text-botanical-sepia mt-0.5">15,000 chars</p>
                            </div>
                            <div className="bg-claude-bg/50 border border-botanical-sepia/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                                <p className="text-[10px] uppercase font-mono tracking-widest text-botanical-sepia/70 mb-1">Output Size</p>
                                <p className="text-sm font-medium text-claude-text">Flashcards or Class</p>
                                <p className="text-[9px] text-botanical-sepia mt-0.5">per request limit</p>
                            </div>
                        </div>

                        {/* Progress Bar for Limits */}
                        {!aiLimits.loading && (
                            <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden mt-2 relative z-10 border border-botanical-sepia/5 shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(aiLimits.remaining / aiLimits.max) * 100}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full ${aiLimits.remaining > 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-red-500'} rounded-full`}
                                />
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Preferences Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-botanical-sepia mb-3 pl-2">
                        Preferences
                    </h2>
                    <div className="bg-claude-surface/50 backdrop-blur-md border border-botanical-sepia/10 rounded-[2rem] overflow-hidden shadow-sm">
                        <SettingItem
                            icon={Bell}
                            title="Notifications"
                            description="Reminders & system updates"
                            toggle={true}
                            toggleValue={true}
                            onClick={() => {
                                haptics.light();
                                toast('Notification settings saved');
                            }}
                            noBorder={true}
                        />
                    </div>
                </motion.div>

                {/* Atmosphere Setting - Premium Standalone Card */}
                <motion.div variants={itemVariants} className="pt-2">
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-botanical-sepia mb-3 pl-2">
                        Environment
                    </h2>
                    <button
                        onClick={() => { haptics.light(); navigate('/themes'); }}
                        className="w-full relative overflow-hidden rounded-[2rem] p-7 text-left group transition-all duration-500 active:scale-[0.98]"
                        style={{
                            backgroundColor: isLightMode ? '#fdfbf7' : '#141716',
                            border: isLightMode ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                            boxShadow: isLightMode ? '0 10px 40px -10px rgba(0,0,0,0.08)' : '0 10px 40px -10px rgba(0,0,0,0.5)'
                        }}
                    >
                        {/* Noise Texture */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.25] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

                        {/* Animated Glow */}
                        <motion.div
                            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none ${isLightMode ? 'bg-amber-100/40' : 'bg-indigo-500/10'}`}
                        />

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className={`p-4 rounded-2xl transition-all duration-500 shadow-inner group-hover:scale-110 ${isLightMode ? 'bg-[#f4f1eb] text-amber-500 border border-amber-900/5' : 'bg-[#1c211f] text-indigo-400 border border-indigo-100/5'}`}>
                                    {isLightMode ? <Sun className="w-7 h-7" /> : <Moon className="w-7 h-7" />}
                                </div>
                                <div>
                                    <p className={`font-display text-2xl font-medium tracking-tight transition-colors duration-500 ${isLightMode ? 'text-[#2c2825]' : 'text-[#e8e4dc]'}`}>
                                        {activeTheme?.name || 'Theme'}
                                    </p>
                                    <p className={`text-[11px] font-mono uppercase tracking-[0.15em] mt-1.5 opacity-60 ${isLightMode ? 'text-[#2c2825]' : 'text-[#e8e4dc]'}`}>
                                        Current Atmosphere
                                    </p>
                                </div>
                            </div>

                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${isLightMode ? 'border-[#2c2825]/10 text-[#2c2825]/40 bg-white/50' : 'border-[#e8e4dc]/10 text-[#e8e4dc]/40 bg-black/20'} shadow-sm`}>
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </button>
                </motion.div>

                {/* Danger Zone Bento */}
                <motion.div variants={itemVariants} className="pt-4">
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-red-500/70 mb-3 pl-2">
                        Danger Zone
                    </h2>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-[2rem] overflow-hidden shadow-sm">
                        <SettingItem icon={LogOut} title="Sign Out" onClick={handleSignOut} destructive />
                        <SettingItem icon={Trash2} title="Delete Account" description="Permanently erase all data" onClick={() => openModal('delete')} destructive noBorder />
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center pt-8 pb-4 opacity-40">
                    <Leaf className="w-6 h-6 text-botanical-forest mx-auto mb-3" />
                    <p className="text-[10px] text-botanical-sepia font-mono tracking-widest uppercase">
                        Riven OS v1.0.0
                    </p>
                </motion.div>
            </motion.div>

            {/* Modals */}
            <ChangePasswordModal isOpen={modals.password} onClose={() => closeModal('password')} />
            <TwoFactorAuthModal isOpen={modals.twoFactor} onClose={() => closeModal('twoFactor')} />
            <DeleteAccountModal isOpen={modals.delete} onClose={() => closeModal('delete')} />
        </div>
    );
}
