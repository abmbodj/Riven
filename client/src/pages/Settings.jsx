import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, Leaf, Flower, Network, RefreshCw, Sparkles, CreditCard, Gift, Copy, Check, Crown, Award, UserMinus, Mail, BookOpen } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
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
                <div className={`absolute top-[3px] w-[20px] h-[20px] bg-white rounded-full transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 shadow-sm ${toggleValue ? 'left-[24px]' : 'left-[3px]'}`} />
            </div>
        ) : (
            <ChevronRight className={`w-5 h-5 ${destructive ? 'text-red-500/50' : 'text-botanical-sepia/30 group-hover:text-botanical-forest group-hover:translate-x-1 transition-[transform,opacity,color,background-color,border-color,box-shadow]'}`} />
        )}
    </button>
);

const getCanvasFeedLabel = (canvasUrl) => {
    if (!canvasUrl || canvasUrl === 'Canvas Feed Active') {
        return 'Calendar Feed Connected';
    }

    try {
        const parsed = new URL(canvasUrl);
        return `${parsed.hostname}${parsed.pathname.endsWith('.ics') ? ' (.ics)' : parsed.pathname}`;
    } catch {
        return canvasUrl;
    }
};

const StatusNotice = ({ tone = 'info', title, detail }) => {
    const toneClasses = tone === 'success'
        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
        : tone === 'error'
            ? 'border-red-500/20 bg-red-500/5 text-red-400'
            : 'border-[#0ea5e9]/15 bg-[#0ea5e9]/5 text-[#38bdf8]';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${toneClasses}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold">{title}</p>
            {detail && (
                <p className="mt-1 text-[11px] font-mono text-botanical-sepia/80">
                    {detail}
                </p>
            )}
        </div>
    );
};

const SectionHeader = ({ eyebrow, title, description, tone = 'default' }) => {
    const eyebrowTone = tone === 'accent'
        ? 'text-claude-accent'
        : tone === 'info'
            ? 'text-[#38bdf8]'
            : tone === 'success'
                ? 'text-emerald-400'
                : tone === 'warning'
                    ? 'text-amber-500'
                    : tone === 'danger'
                        ? 'text-red-400'
                        : tone === 'pink'
                            ? 'text-pink-400'
                            : 'text-botanical-sepia';

    return (
        <div className="mb-3 px-1">
            <p className={`text-[10px] font-mono uppercase tracking-[0.22em] ${eyebrowTone}`}>
                {eyebrow}
            </p>
            <div className="mt-1">
                <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-claude-text">
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 text-[11px] font-mono text-botanical-sepia/75">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
};

const SectionCard = ({ children, tone = 'default', className = '' }) => {
    const toneClasses = tone === 'accent'
        ? 'border-claude-accent/20 bg-claude-surface/95'
        : tone === 'info'
            ? 'border-[#0ea5e9]/20 bg-claude-surface/95'
            : tone === 'warning'
                ? 'border-amber-500/20 bg-claude-surface/95'
                : tone === 'danger'
                    ? 'border-red-500/15 bg-red-500/[0.03]'
                    : tone === 'pink'
                        ? 'border-pink-500/20 bg-claude-surface/95'
                        : 'border-claude-border/70 bg-claude-surface/95';

    return (
        <div className={`rounded-[1.75rem] border shadow-sm backdrop-blur ${toneClasses} ${className}`}>
            {children}
        </div>
    );
};

export default function Settings() {
    const { signOut, user, refreshUser } = useAuth();
    const isPremium = user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime';
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
    const [canvasNotice, setCanvasNotice] = useState(null);

    const [aiLimits, setAiLimits] = useState({ remaining: 10, max: 10, loading: true });

    const hasCanvasUrl = canvasForm.url.trim().length > 0;
    const canvasCardState = !isPremium
        ? 'locked'
        : lmsStatus.loading
            ? 'loading'
            : lmsStatus.isConnected
                ? 'connected'
                : 'ready';

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await api.getCanvasSettings();
                setLmsStatus(prev => ({ ...prev, isConnected: res.isConnected, canvasUrl: res.canvasUrl || '', loading: false }));
                if (res.canvasUrl) setCanvasForm(prev => ({ ...prev, url: res.canvasUrl }));
            } catch {
                setLmsStatus(prev => ({ ...prev, loading: false }));
            }

            try {
                const aiData = await api.getAILimits();
                setAiLimits({ ...aiData, loading: false });
            } catch {
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
            setCanvasNotice({
                tone: 'error',
                title: 'Canvas feed required',
                detail: 'Paste the read-only .ics Calendar Feed link before connecting.'
            });

            // Clear errors after animation
            setTimeout(() => setFormErrors({ url: false }), 2000);
            return;
        }

        setConnectingCanvas(true);
        try {
            const submittedUrl = canvasForm.url.trim();
            await api.connectCanvas(submittedUrl);
            toast.success('Canvas connected successfully!');
            haptics.success();
            setLmsStatus(prev => ({ ...prev, isConnected: true, canvasUrl: submittedUrl }));
            setCanvasForm({ url: '' }); // Clear input on success
            setCanvasNotice({
                tone: 'success',
                title: 'Feed saved',
                detail: 'Run a sync now to import your current courses and assignments.'
            });
        } catch (err) {
            haptics.error();
            toast.error(err.message || 'Failed to connect Canvas');
            setCanvasNotice({
                tone: 'error',
                title: 'Connection failed',
                detail: err.message || 'Check that your Canvas calendar feed is a valid .ics link.'
            });
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
            setCanvasNotice({
                tone: 'info',
                title: 'Integration removed',
                detail: 'You can reconnect any time with a new read-only Canvas feed.'
            });
        } catch {
            toast.error('Failed to disconnect');
            setCanvasNotice({
                tone: 'error',
                title: 'Disconnect failed',
                detail: 'Riven could not remove your Canvas feed. Try again in a moment.'
            });
        }
    };

    const handleSyncLms = async () => {
        setLmsStatus(prev => ({ ...prev, syncing: true }));
        haptics.light();
        try {
            const res = await api.syncCanvas(false);
            toast.success(`Synced ${res.classesAdded} classes & ${res.assignmentsAdded} assignments!`);
            haptics.success();
            setCanvasNotice({
                tone: 'success',
                title: 'Last sync completed',
                detail: `Imported ${res.classesAdded} classes and ${res.assignmentsAdded} assignments just now.`
            });
        } catch (err) {
            haptics.error();
            if (err.status === 429) {
                setCanvasNotice({
                    tone: 'error',
                    title: 'Sync limit reached',
                    detail: 'Upgrade your plan to keep importing Canvas updates.'
                });
                openModal('pricing');
            } else {
                toast.error(err.message || 'Canvas Sync Failed');
                setCanvasNotice({
                    tone: 'error',
                    title: 'Sync failed',
                    detail: err.message || 'Riven could not import updates from Canvas.'
                });
            }
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
            <div className="sticky top-0 z-50 bg-claude-bg/80 md:backdrop-blur-xl border-b border-botanical-sepia/5 pb-2 pt-12">
                <div className="flex items-center justify-between px-4 py-2 border-b border-botanical-sepia/5 pb-4">
                    <button onClick={() => navigate(-1)} className="p-3 bg-claude-surface rounded-full shadow-sm border border-botanical-sepia/5 hover:bg-botanical-sepia/10 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow]">
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
                className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-6"
            >
                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Account"
                        title="Security"
                        description="Protect your login and recovery options."
                    />
                    <SectionCard className="overflow-hidden">
                        <SettingItem icon={Lock} title="Change Password" description="Update your credentials" onClick={() => openModal('password')} />
                        <SettingItem icon={Shield} title="Two-Factor Auth" description={user?.twoFAEnabled ? 'Enabled — Manage 2FA' : 'Add extra security'} onClick={() => openModal('twoFactor')} noBorder />
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Membership"
                        title="Plan & access"
                        description="Manage your subscription, restore purchases, and check premium status."
                        tone="accent"
                    />
                    <SectionCard tone="accent" className="space-y-4 p-6">
                        <div className="flex items-center gap-4">
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
                                    {user?.subscription_tier === 'free' || !user?.subscription_tier ? 'Free plan currently active' : 'Premium access active'}
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button
                                onClick={() => openModal('pricing')}
                                className="flex-1 bg-gradient-to-r from-claude-accent to-indigo-500 hover:from-indigo-500 hover:to-claude-accent text-white font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 rounded-xl transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-claude-accent/20"
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
                        {(user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime') && (
                            <div className={`rounded-[1.25rem] border px-4 py-4 flex items-center gap-4 ${user?.subscription_tier === 'lifetime' ? 'border-amber-500/20 bg-amber-500/5' : 'border-indigo-500/20 bg-indigo-500/5'}`}>
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
                                        {user?.subscription_tier === 'lifetime' ? 'All features unlocked forever' : 'Thank you for supporting Riven.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </SectionCard>
                </motion.div>

                <ReferralCard />

                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Workspace"
                        title="Integrations"
                        description="Connect external systems that keep your classes and assignments in sync."
                        tone="info"
                    />
                    <SectionCard tone="info" className="flex flex-col p-6 space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 shadow-inner">
                                <Network className="w-6 h-6 text-[#0ea5e9]" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold">Canvas Sync</h3>
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest font-bold border ${
                                        canvasCardState === 'locked'
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            : canvasCardState === 'connected'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : canvasCardState === 'loading'
                                                    ? 'bg-white/5 text-claude-secondary border-white/10'
                                                    : 'bg-[#0ea5e9]/10 text-[#38bdf8] border-[#0ea5e9]/20'
                                    }`}>
                                        {canvasCardState === 'locked'
                                            ? 'PRO'
                                            : canvasCardState === 'connected'
                                                ? 'CONNECTED'
                                                : canvasCardState === 'loading'
                                                    ? 'LOADING'
                                                    : 'READY'}
                                    </span>
                                </div>
                                <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">
                                    {canvasCardState === 'locked'
                                        ? 'Premium automation for courses and assignments'
                                        : canvasCardState === 'loading'
                                            ? 'Checking your Canvas connection'
                                            : canvasCardState === 'connected'
                                                ? 'Connected via Calendar Feed'
                                                : 'Paste your Canvas feed to import courses and assignments'}
                                </p>
                            </div>
                        </div>

                        {canvasCardState === 'locked' ? (
                            <div className="pt-2">
                                <p className="text-[11px] font-mono text-botanical-sepia/70 leading-relaxed mb-4">
                                    Automatically import your courses and assignments from Canvas. Upgrade to unlock this integration.
                                </p>
                                <button
                                    onClick={() => { haptics.medium(); openModal('pricing'); }}
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-white font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 rounded-xl transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-amber-500/20"
                                >
                                    <Crown className="w-4 h-4" />
                                    Upgrade to Connect Canvas
                                </button>
                            </div>
                        ) : canvasCardState === 'loading' ? (
                            <div className="pt-2 space-y-3" aria-label="Canvas status loading">
                                <div className="h-12 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
                                <div className="h-24 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
                            </div>
                        ) : (
                            <div>
                                <AnimatePresence mode="wait">
                                    {canvasCardState === 'ready' ? (
                                        <motion.div
                                            key="connect"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 pt-2"
                                        >
                                            <StatusNotice
                                                title="How this works"
                                                detail="Copy your Canvas Calendar Feed, paste the .ics link here, then connect once to unlock one-tap syncing."
                                            />

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

                                            <div className="rounded-2xl border border-[#0ea5e9]/15 bg-[#0ea5e9]/5 px-4 py-3">
                                                <p className="text-[10px] font-mono text-botanical-sepia/80 leading-relaxed text-center">
                                                    Go to Canvas Calendar, open `Calendar Feed`, then paste the `.ics` link here.
                                                </p>
                                            </div>

                                            <p className="text-[10px] font-mono text-botanical-sepia/60 leading-relaxed text-center px-2">
                                                Riven only needs the read-only calendar feed.
                                            </p>

                                            {canvasNotice && (
                                                <StatusNotice
                                                    tone={canvasNotice.tone}
                                                    title={canvasNotice.title}
                                                    detail={canvasNotice.detail}
                                                />
                                            )}

                                            <button
                                                onClick={handleConnectCanvas}
                                                disabled={connectingCanvas || !hasCanvasUrl}
                                                className="w-full bg-claude-text hover:bg-botanical-forest text-claude-bg font-mono text-[11px] uppercase tracking-[0.2em] py-3.5 rounded-xl transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] shadow-md"
                                            >
                                                <Lock className="w-4 h-4" />
                                                {connectingCanvas ? 'Connecting...' : 'Connect Calendar Feed'}
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
                                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-400">Canvas feed active</p>
                                                <p className="mt-1 text-[11px] font-mono text-botanical-sepia/80">
                                                    {getCanvasFeedLabel(lmsStatus.canvasUrl)}
                                                </p>
                                            </div>
                                            <StatusNotice
                                                title="Next step"
                                                detail="Run a sync to pull in any new classes or assignments from your connected Canvas feed."
                                            />
                                            {canvasNotice && (
                                                <StatusNotice
                                                    tone={canvasNotice.tone}
                                                    title={canvasNotice.title}
                                                    detail={canvasNotice.detail}
                                                />
                                            )}
                                            <button
                                                onClick={handleSyncLms}
                                                disabled={lmsStatus.syncing}
                                                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white disabled:opacity-70 font-mono text-[11px] uppercase tracking-[0.15em] py-3.5 rounded-xl transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-[#0ea5e9]/20"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${lmsStatus.syncing ? 'animate-spin' : ''}`} />
                                                {lmsStatus.syncing ? 'Syncing Courses...' : 'Sync Canvas Now'}
                                            </button>

                                            <button
                                                onClick={handleDisconnectCanvas}
                                                className="w-full bg-claude-bg border border-botanical-sepia/10 text-botanical-sepia/80 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 font-mono text-[10px] uppercase tracking-[0.2em] py-3 rounded-xl transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98]"
                                            >
                                                Disconnect Integration
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Workspace"
                        title="AI limits"
                        description="See your current generation allowance and request boundaries."
                        tone="warning"
                    />
                    <SectionCard tone="warning" className="flex flex-col p-6 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
                                <Sun className="w-6 h-6 text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold flex items-center justify-between">
                                    AI Generations
                                    {!aiLimits.loading && (
                                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${aiLimits.remaining > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                            {`${aiLimits.remaining} / ${aiLimits.max} Left`}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[11px] font-mono text-botanical-sepia mt-0.5">
                                    Resets every 2 hours
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
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

                        {!aiLimits.loading && (
                            <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden mt-2 border border-botanical-sepia/5 shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(aiLimits.remaining / aiLimits.max) * 100}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full ${aiLimits.remaining > 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-red-500'} rounded-full`}
                                />
                            </div>
                        )}
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Preferences"
                        title="Notifications"
                        description="Control reminders and system alerts."
                    />
                    <SectionCard className="overflow-hidden">
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
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <BlockedUsersCard />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Appearance"
                        title="Theme & atmosphere"
                        description="Adjust the visual mood of the workspace."
                    />
                    <SectionCard className="overflow-hidden">
                        <button
                            onClick={() => { haptics.light(); navigate('/themes'); }}
                            className="w-full relative overflow-hidden p-6 text-left group transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 active:scale-[0.98]"
                            style={{
                                backgroundColor: isLightMode ? '#fdfbf7' : '#141716',
                            }}
                        >
                            <div className="absolute inset-0 pointer-events-none opacity-[0.18] md:mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                            <motion.div
                                animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.08, 1] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none ${isLightMode ? 'bg-amber-100/40' : 'bg-indigo-500/10'}`}
                            />

                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className={`p-4 rounded-2xl transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 shadow-inner group-hover:scale-110 ${isLightMode ? 'bg-[#f4f1eb] text-amber-500 border border-amber-900/5' : 'bg-[#1c211f] text-indigo-400 border border-indigo-100/5'}`}>
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

                                <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 group-hover:scale-110 ${isLightMode ? 'border-[#2c2825]/10 text-[#2c2825]/40 bg-white/50' : 'border-[#e8e4dc]/10 text-[#e8e4dc]/40 bg-black/20'} shadow-sm`}>
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </div>
                        </button>
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <SectionHeader
                        eyebrow="Support"
                        title="Help & policies"
                        description="Reach support and review the documents that govern your account."
                    />
                    <SectionCard className="overflow-hidden">
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
                            onClick={() => navigate('/privacy')}
                        />
                        <SettingItem
                            icon={BookOpen}
                            title="Terms of Service"
                            description="EULA and usage rules"
                            onClick={() => navigate('/terms')}
                            noBorder
                        />
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-1">
                    <SectionHeader
                        eyebrow="Danger"
                        title="Danger zone"
                        description="Actions here affect access to the account itself."
                        tone="danger"
                    />
                    <SectionCard tone="danger" className="overflow-hidden">
                        <SettingItem icon={LogOut} title="Sign Out" onClick={handleSignOut} destructive />
                        <SettingItem icon={Trash2} title="Delete Account" description="Permanently erase all data" onClick={() => openModal('delete')} destructive noBorder />
                    </SectionCard>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center pt-4 pb-4 opacity-40">
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
    const { user } = useAuth();
    const [referralInfo, setReferralInfo] = React.useState(null);
    const [applyCode, setApplyCode] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [applying, setApplying] = React.useState(false);
    const [referralNotice, setReferralNotice] = React.useState(null);
    const toast = useToast();
    const progressPercent = referralInfo ? Math.min(100, (referralInfo.qualifiedCount / referralInfo.targetCount) * 100) : 0;
    const remainingReferrals = referralInfo ? Math.max(0, referralInfo.targetCount - referralInfo.qualifiedCount) : 0;

    React.useEffect(() => {
        if (user?.subscription_tier && user.subscription_tier !== 'free') {
            return;
        }

        api.getReferralInfo().then(data => {
            if (data) setReferralInfo(data);
        }).catch(() => { });
    }, [user?.subscription_tier]);

    // Hide referral program for users who already have a membership
    if (user?.subscription_tier && user.subscription_tier !== 'free') return null;

    const handleCopy = () => {
        if (referralInfo?.referralCode) {
            navigator.clipboard.writeText(referralInfo.referralCode);
            setCopied(true);
            setReferralNotice({
                tone: 'success',
                title: 'Code copied',
                detail: 'Share it with a friend so they can join with your referral code.'
            });
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
            setReferralNotice({
                tone: 'success',
                title: 'Referral code applied',
                detail: 'Your account will credit the referral after the eligibility requirements are met.'
            });
        } catch (err) {
            toast(err.message || 'Failed to apply code');
            setReferralNotice({
                tone: 'error',
                title: 'Code could not be applied',
                detail: err.message || 'Check the referral code and try again.'
            });
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
            <SectionHeader
                eyebrow="Membership"
                title="Invite friends"
                description="Track referral progress and share or apply referral codes."
                tone="pink"
            />
            <SectionCard tone="pink" className="p-6 space-y-5">
                <div className="flex items-center gap-4">
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

                <StatusNotice
                    title={referralInfo.rewardEarned ? 'Reward unlocked' : `${remainingReferrals} invites to go`}
                    detail={referralInfo.rewardEarned
                        ? 'Your referrals already earned Lifetime access.'
                        : 'Share your code, track qualified signups, or apply a friend’s code below.'}
                />

                {/* Your Code */}
                <div className="rounded-[1.5rem] border border-claude-border bg-claude-bg/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Your Referral Code</p>
                            <p className="mt-1 text-[11px] font-mono text-botanical-sepia/70">Share this with friends who are joining Riven.</p>
                        </div>
                        <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-pink-400">
                            Share
                        </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 bg-claude-bg border border-claude-border rounded-xl px-4 py-3 text-lg font-mono font-bold text-claude-text tracking-[0.3em] text-center">
                            {referralInfo.referralCode}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="min-h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 px-4 py-3 text-pink-400 hover:border-pink-400/30 hover:bg-pink-400/5 transition-[transform,opacity,color,background-color,border-color,box-shadow] font-mono text-[11px] uppercase tracking-[0.16em] font-bold flex items-center justify-center gap-2"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-pink-400" />}
                            {copied ? 'Copied' : 'Copy code'}
                        </button>
                    </div>
                </div>

                {/* Progress */}
                <div className="rounded-[1.5rem] border border-claude-border bg-claude-bg/70 p-4">
                    <div className="flex items-center justify-between mb-2 gap-3">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Progress</p>
                            <p className="mt-1 text-[11px] font-mono text-botanical-sepia/70">
                                {referralInfo.rewardEarned ? 'All referral milestones completed.' : `${remainingReferrals} more qualified referral${remainingReferrals === 1 ? '' : 's'} until Lifetime.`}
                            </p>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-claude-text whitespace-nowrap">{referralInfo.qualifiedCount} / {referralInfo.targetCount}</span>
                    </div>
                    <div className="w-full h-2 bg-claude-bg rounded-full overflow-hidden border border-claude-border">
                        <div
                            className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-700"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    {referralInfo.rewardEarned && (
                        <p className="text-[11px] font-mono text-green-400 mt-2 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Lifetime earned! 🎉
                        </p>
                    )}
                </div>

                {/* Apply someone else's code */}
                <div className="pt-2 border-t border-claude-border">
                    <div className="mb-3">
                        <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Have a referral code?</p>
                        <p className="mt-1 text-[11px] font-mono text-botanical-sepia/70">
                            Apply a friend&apos;s code before you qualify on your own invite path.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="text"
                            value={applyCode}
                            onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                            placeholder="ENTER CODE"
                            maxLength={8}
                            className="flex-1 min-h-12 bg-claude-bg border border-claude-border rounded-xl px-3 py-2.5 text-sm font-mono text-claude-text placeholder-claude-secondary/50 focus:outline-none focus:border-pink-400/50"
                        />
                        <button
                            onClick={handleApply}
                            disabled={applying || !applyCode.trim()}
                            className="min-h-12 px-4 py-2.5 rounded-xl bg-pink-500/10 text-pink-400 font-mono text-[11px] uppercase tracking-wider font-bold hover:bg-pink-500/20 disabled:opacity-30 transition-[transform,opacity,color,background-color,border-color,box-shadow]"
                        >
                            {applying ? 'Applying...' : 'Apply Code'}
                        </button>
                    </div>
                    {referralNotice && (
                        <div className="mt-3">
                            <StatusNotice
                                tone={referralNotice.tone}
                                title={referralNotice.title}
                                detail={referralNotice.detail}
                            />
                        </div>
                    )}
                </div>
            </SectionCard>
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
            setBlockedUsers(prev => prev.filter(u => u.id !== userId));
            toast.success('User unblocked successfully.');
        } catch (err) {
            toast.error(err.message || 'Failed to unblock user.');
        } finally {
            setUnblockingId(null);
        }
    };

    return (
        <div>
            <SectionHeader
                eyebrow="Privacy"
                title="Safety controls"
                description="Review blocked accounts and manage who can reach you."
            />
            <SectionCard className="overflow-hidden transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300">
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
                                        <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-claude-bg border border-claude-border/50">
                                            <div>
                                                <p className="text-sm font-semibold text-claude-text">{u.username}</p>
                                                <p className="text-[10px] text-claude-secondary font-mono tracking-wider mt-0.5">
                                                    Blocked {new Date(u.blocked_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUnblock(u.id)}
                                                disabled={unblockingId === u.id}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-claude-text bg-claude-surface hover:bg-claude-surface/80 border border-claude-border transition-colors disabled:opacity-50 touch-target tap-action native-press"
                                            >
                                                {unblockingId === u.id ? 'Unblocking...' : 'Unblock'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SectionCard>
        </div>
    );
}
