import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, Leaf, Flower, Network, RefreshCw, Sparkles, CreditCard, Gift, Copy, Check, Crown, Award, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { ThemeContext } from '../ThemeContext';
import { api } from '../api';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TwoFactorAuthModal from '../components/TwoFactorAuthModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import PricingModal from '../components/ui/PricingModal';

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
            <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${toggleValue ? 'bg-botanical-forest shadow-inner' : 'glass-panel border border-botanical-sepia/30'}`}>
                <div className={`absolute top-[3px] w-[20px] h-[20px] bg-white rounded-full transition-all duration-300 shadow-sm ${toggleValue ? 'left-[24px]' : 'left-[3px]'}`} />
            </div>
        ) : (
            <ChevronRight className={`w-5 h-5 ${destructive ? 'text-red-500/50' : 'text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-all'}`} />
        )}
    </button>
);

export default function Settings() {
    const { signOut, user, refreshUser } = useAuth();
    const { activeTheme } = useContext(ThemeContext) || {};
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();

    const [modals, setModals] = useState({
        password: false,
        twoFactor: false,
        delete: false,
        pricing: false
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
            url: !canvasForm.url.trim()
        };

        setFormErrors(errors);

        if (errors.url) {
            haptics.error();
            toast.error('Please fill in the Calendar Link');

            // Clear errors after animation
            setTimeout(() => setFormErrors({ url: false }), 2000);
            return;
        }

        setConnectingCanvas(true);
        try {
            await api.connectCanvas(canvasForm.url);
            toast.success('Canvas connected successfully!');
            haptics.success();
            setLmsStatus(prev => ({ ...prev, isConnected: true, canvasUrl: 'Canvas Feed Active' }));
            setCanvasForm({ url: '' }); // Clear input on success
        } catch (err) {
            haptics.error();
            toast.error(err.message || 'Failed to connect Canvas');
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
            toast.error(err.message || 'Canvas Sync Failed');
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
                    <div className="glass-panel rounded-[2rem] overflow-hidden shadow-sm">
                        <SettingItem icon={Lock} title="Change Password" description="Update your credentials" onClick={() => openModal('password')} />
                        <SettingItem icon={Shield} title="Two-Factor Auth" description={user?.twoFAEnabled ? 'Enabled — Manage 2FA' : 'Add extra security'} onClick={() => openModal('twoFactor')} noBorder />
                    </div>
                </motion.div>

                {/* Subscription Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-accent mb-3 pl-2">
                        Subscription
                    </h2>
                    <div className="flex flex-col glass-panel border-claude-accent/20 rounded-[2rem] p-6 shadow-sm space-y-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-claude-accent/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3 rounded-2xl bg-claude-accent/10 border border-claude-accent/20 shadow-inner">
                                <Sparkles className="w-6 h-6 text-claude-accent" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold flex items-center justify-between">
                                    Current Plan
                                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border uppercase ${user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-botanical-sepia/10 text-botanical-sepia/80 border-botanical-sepia/20'}`}>
                                        {user?.subscription_tier || 'Free'}
                                    </span>
                                </h3>
                                <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">
                                    {user?.subscription_tier === 'free' || !user?.subscription_tier ? 'Limited daily usage' : 'Unlimited Pro active'}
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 pt-2 flex gap-3">
                            <button
                                onClick={() => openModal('pricing')}
                                className="flex-1 bg-gradient-to-r from-claude-accent to-indigo-500 hover:from-indigo-500 hover:to-claude-accent text-white font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 rounded-xl transition-all font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-claude-accent/20"
                            >
                                <Sparkles className="w-4 h-4" />
                                Upgrade Riven
                            </button>
                            <button
                                onClick={async () => { haptics.light(); try { const u = await refreshUser(); toast(u?.subscription_tier !== 'free' ? 'Subscription restored!' : 'No active subscription found'); } catch { toast('Sync failed, try again'); } }}
                                className="p-3.5 bg-claude-bg border border-botanical-sepia/10 hover:bg-white/5 rounded-xl text-claude-secondary hover:text-claude-text transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Subscriber Badge */}
                {(user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime') && (
                    <motion.div variants={itemVariants}>
                        <div className="glass-panel rounded-[2rem] p-5 flex items-center gap-4 relative overflow-hidden">
                            <div className={`p-3 rounded-2xl ${user?.subscription_tier === 'lifetime' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'} shadow-inner`}>
                                {user?.subscription_tier === 'lifetime'
                                    ? <Crown className="w-6 h-6 text-amber-400" />
                                    : <Award className="w-6 h-6 text-indigo-400" />}
                            </div>
                            <div>
                                <h3 className="font-display text-base font-bold text-claude-text flex items-center gap-2">
                                    {user?.subscription_tier === 'lifetime' ? 'Lifetime Member' : 'Supporter'}
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${user?.subscription_tier === 'lifetime' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                        {user?.subscription_tier === 'lifetime' ? '∞ LIFETIME' : '⭐ PRO'}
                                    </span>
                                </h3>
                                <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                                    {user?.subscription_tier === 'lifetime' ? 'All features unlocked forever' : 'Thank you for supporting Riven!'}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Referral Program */}
                <ReferralCard />

                {/* Integrations Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#0ea5e9] mb-3 pl-2">
                        Integrations
                    </h2>
                    <div className="flex flex-col glass-panel border-[#0ea5e9]/20 rounded-[2rem] p-6 shadow-sm space-y-5 relative overflow-hidden group">
                        {/* Glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0ea5e9]/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3 rounded-2xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 shadow-inner">
                                <Network className="w-6 h-6 text-[#0ea5e9]" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold">Canvas Sync</h3>
                                <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">
                                    {lmsStatus.isConnected ? `Connected via Calendar Feed` : 'Import courses & assignments'}
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
                                                        placeholder="Canvas Calendar Link (Ends in .ics)"
                                                        value={canvasForm.url}
                                                        onChange={e => {
                                                            setCanvasForm(prev => ({ ...prev, url: e.target.value }));
                                                            if (formErrors.url) setFormErrors(prev => ({ ...prev, url: false }));
                                                        }}
                                                        className={`w-full bg-claude-bg border ${formErrors.url ? 'border-red-400 focus:border-red-500 bg-red-500/5' : 'border-botanical-sepia/20 focus:border-[#0ea5e9]/50'} rounded-xl px-4 py-3.5 text-sm text-claude-text placeholder-botanical-sepia/40 font-mono focus:outline-none transition-colors shadow-inner`}
                                                    />
                                                </motion.div>
                                            </div>

                                            <p className="text-[10px] font-mono text-botanical-sepia/70 leading-relaxed text-center px-2">
                                                Go to Canvas Calendar → Click 'Calendar Feed' → Copy the link
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

                {/* Support & Legal Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary mb-3 pl-2">
                        Support & Legal
                    </h2>
                    <div className="glass-panel rounded-[2rem] overflow-hidden shadow-sm">
                        <SettingItem
                            icon={Mail}
                            title="Contact Support"
                            description="Email the developer"
                            onClick={() => window.open('mailto:support@Riven.app')}
                        />
                        <SettingItem
                            icon={Shield}
                            title="Privacy Policy"
                            description="How we protect your data"
                            onClick={() => window.open('https://Riven.app/privacy', '_blank')}
                        />
                        <SettingItem
                            icon={BookOpen}
                            title="Terms of Service"
                            description="EULA and usage rules"
                            onClick={() => window.open('https://Riven.app/terms', '_blank')}
                            noBorder
                        />
                    </div>
                </motion.div>

                {/* AI Capabilities Bento */}
                <motion.div variants={itemVariants}>
                    <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500 mb-3 pl-2">
                        AI Capabilities
                    </h2>
                    <div className="flex flex-col glass-panel border-amber-500/20 rounded-[2rem] p-6 shadow-sm space-y-4 relative overflow-hidden group">
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
                                    Resets every 2 hours
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
                    <div className="glass-panel rounded-[2rem] overflow-hidden shadow-sm">
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

                {/* Privacy & Safety Bento */}
                <motion.div variants={itemVariants}>
                    <BlockedUsersCard />
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
            <PricingModal isOpen={modals.pricing} onClose={() => closeModal('pricing')} currentTier={user?.subscription_tier || 'free'} />
        </div>
    );
}

function ReferralCard() {
    const [referralInfo, setReferralInfo] = React.useState(null);
    const [applyCode, setApplyCode] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [applying, setApplying] = React.useState(false);
    const toast = useToast();

    React.useEffect(() => {
        api.getReferralInfo().then(data => {
            if (data) setReferralInfo(data);
        }).catch(() => { });
    }, []);

    const handleCopy = () => {
        if (referralInfo?.referralCode) {
            navigator.clipboard.writeText(referralInfo.referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleApply = async () => {
        if (!applyCode.trim()) return;
        setApplying(true);
        try {
            await api.applyReferralCode(applyCode.trim());
            toast('Referral code applied!');
            setApplyCode('');
        } catch (err) {
            toast(err.message || 'Failed to apply code');
        } finally {
            setApplying(false);
        }
    };

    if (!referralInfo) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-pink-400 mb-3 pl-2">
                Invite Friends
            </h2>
            <div className="glass-panel rounded-[2rem] p-6 space-y-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-400/5 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Header */}
                <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-inner">
                        <Gift className="w-6 h-6 text-pink-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display text-base font-bold text-claude-text">
                            Earn Lifetime Free
                        </h3>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            Invite 5 friends who use Riven &rarr; free Lifetime membership
                        </p>
                    </div>
                </div>

                {/* Your Code */}
                <div className="relative z-10">
                    <p className="text-[10px] font-mono uppercase text-claude-secondary mb-2 tracking-wider">Your Referral Code</p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-claude-bg border border-claude-border rounded-xl px-4 py-3 text-lg font-mono font-bold text-claude-text tracking-[0.3em] text-center">
                            {referralInfo.referralCode}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="p-3 rounded-xl bg-claude-bg border border-claude-border hover:border-pink-400/30 hover:bg-pink-400/5 transition-all"
                        >
                            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-claude-secondary" />}
                        </button>
                    </div>
                </div>

                {/* Progress */}
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Progress</p>
                        <span className="text-[11px] font-mono font-bold text-claude-text">{referralInfo.qualifiedCount} / {referralInfo.targetCount}</span>
                    </div>
                    <div className="w-full h-2 bg-claude-bg rounded-full overflow-hidden border border-claude-border">
                        <div
                            className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(100, (referralInfo.qualifiedCount / referralInfo.targetCount) * 100)}%` }}
                        />
                    </div>
                    {referralInfo.rewardEarned && (
                        <p className="text-[11px] font-mono text-green-400 mt-2 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Lifetime earned! 🎉
                        </p>
                    )}
                </div>

                {/* Apply someone else's code */}
                <div className="relative z-10 pt-2 border-t border-claude-border">
                    <p className="text-[10px] font-mono uppercase text-claude-secondary mb-2 tracking-wider">Have a referral code?</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={applyCode}
                            onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                            placeholder="ENTER CODE"
                            maxLength={8}
                            className="flex-1 bg-claude-bg border border-claude-border rounded-xl px-3 py-2.5 text-sm font-mono text-claude-text placeholder-claude-secondary/50 focus:outline-none focus:border-pink-400/50"
                        />
                        <button
                            onClick={handleApply}
                            disabled={applying || !applyCode.trim()}
                            className="px-4 py-2.5 rounded-xl bg-pink-500/10 text-pink-400 font-mono text-[11px] uppercase tracking-wider font-bold hover:bg-pink-500/20 disabled:opacity-30 transition-all"
                        >
                            {applying ? '...' : 'Apply'}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function BlockedUsersCard() {
    const [blockedUsers, setBlockedUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [unblockingId, setUnblockingId] = React.useState(null);
    const [isOpen, setIsOpen] = React.useState(false);
    const toast = useToast();

    const fetchBlockedUsers = useCallback(async () => {
        setLoading(true);
        try {
            // Need to import directly or destruct from api object if it exports it. 
            // In API file: export const getBlockedUsers = ... 
            // Assuming it is exported in `index.js` as well.
            const { getBlockedUsers } = await import('../api/authApi');
            const data = await getBlockedUsers();
            setBlockedUsers(data || []);
        } catch (err) {
            console.error('Failed to load blocked users', err);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (isOpen) {
            fetchBlockedUsers();
        }
    }, [isOpen, fetchBlockedUsers]);

    const handleUnblock = async (userId) => {
        setUnblockingId(userId);
        try {
            const { unblockUser } = await import('../api/authApi');
            await unblockUser(userId);
            setBlockedUsers(prev => prev.filter(u => u.blocked_user_id !== userId));
            toast('User unblocked successfully.');
        } catch (err) {
            toast.error(err.message || 'Failed to unblock user.');
        } finally {
            setUnblockingId(null);
        }
    };

    return (
        <div className="pt-2">
            <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary mb-3 pl-2">
                Privacy & Safety
            </h2>
            <div className="glass-panel rounded-[2rem] overflow-hidden shadow-sm transition-all duration-300">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full py-4 px-5 flex items-center gap-4 active:bg-claude-surface/40 transition-colors group"
                >
                    <div className="p-2.5 rounded-xl bg-claude-bg text-claude-text/70 shadow-sm border border-claude-border/50 group-hover:scale-110 transition-transform duration-300">
                        <UserMinus className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left z-10">
                        <p className="font-display text-[16px] tracking-wide font-medium text-claude-text group-hover:text-claude-accent transition-colors">
                            Blocked Users
                        </p>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            Manage who you've blocked
                        </p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-claude-secondary/30 transition-transform duration-300 ${isOpen ? 'rotate-90 text-claude-accent' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-claude-bg/30 border-t border-claude-border/30 overflow-hidden"
                        >
                            <div className="p-4 space-y-3">
                                {loading ? (
                                    <div className="text-center py-6 text-sm py-4 text-claude-secondary font-mono animate-pulse">
                                        Loading...
                                    </div>
                                ) : blockedUsers.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-claude-secondary italic font-body">
                                        You haven't blocked anyone.
                                    </div>
                                ) : (
                                    blockedUsers.map(u => (
                                        <div key={u.blocked_user_id} className="flex items-center justify-between p-3 rounded-xl bg-claude-bg border border-claude-border/50">
                                            <div>
                                                <p className="text-sm font-semibold text-claude-text">{u.blocked_username}</p>
                                                <p className="text-[10px] text-claude-secondary font-mono tracking-wider mt-0.5">
                                                    Blocked {new Date(u.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUnblock(u.blocked_user_id)}
                                                disabled={unblockingId === u.blocked_user_id}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-claude-text bg-claude-surface hover:bg-claude-surface/80 border border-claude-border transition-colors disabled:opacity-50 touch-target tap-action native-press"
                                            >
                                                {unblockingId === u.blocked_user_id ? 'Unblocking...' : 'Unblock'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
