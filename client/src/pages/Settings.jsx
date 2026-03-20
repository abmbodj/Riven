import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Shield, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, Leaf, Flower, Network, RefreshCw, Sparkles, CreditCard, Gift, Copy, Check, Crown, Award, UserMinus, Mail, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { ThemeContext } from '../context/themeContext';
import { api } from '../api';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TwoFactorAuthModal from '../components/TwoFactorAuthModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import PricingModal from '../components/ui/PricingModal';
import { canvasIcalUrlSchema, referralCodeSchema } from '../schemas/forms';
import { checkNotificationPermissions, requestNotificationPermissions, scheduleAssignmentNotifications } from '../utils/notifications';


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

const SURFACE_TEXTURE = {
    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
    backgroundSize: '10px 10px'
};

const SECTION_ANCHOR_CLASS = 'scroll-mt-32 md:scroll-mt-36';

const SettingItem = ({ icon: IconComponent, title, description, onClick, destructive = false, toggle = null, toggleValue = false, noBorder = false, badge = null }) => (
    <button
        onClick={onClick}
        aria-pressed={toggle !== null ? toggleValue : undefined}
        className={`tap-action group relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 active:scale-[0.99] sm:min-h-[76px] sm:gap-4 sm:px-5 ${destructive ? 'hover:bg-red-500/[0.04] active:bg-red-500/[0.06]' : 'hover:bg-claude-bg/35 active:bg-claude-bg/45'}`}
    >
        {!noBorder && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-claude-border/60 sm:inset-x-5" />
        )}
        <div className={`relative z-10 rounded-[1.1rem] border p-2.5 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 group-hover:-translate-y-0.5 ${destructive ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-claude-border/70 bg-claude-bg/75 text-claude-text/70'}`}>
            {IconComponent && <IconComponent className="w-5 h-5" />}
        </div>
        <div className="relative z-10 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={`font-display text-[15px] font-medium tracking-[0.01em] sm:text-[16px] ${destructive ? 'text-red-400' : 'text-claude-text transition-colors group-hover:text-claude-accent'}`}>{title}</p>
                    {description && <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-claude-secondary/85 sm:text-[10px]">{description}</p>}
                </div>
                {badge && (
                    <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] ${destructive ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-claude-border/70 bg-claude-bg/70 text-claude-secondary'}`}>
                        {badge}
                    </span>
                )}
            </div>
        </div>

        {toggle !== null ? (
            <span className="switch-track shrink-0" data-checked={toggleValue ? 'true' : 'false'}>
                <span className="switch-thumb" />
            </span>
        ) : (
            <ChevronRight className={`relative z-10 w-5 h-5 shrink-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${destructive ? 'text-red-500/55 group-hover:text-red-400' : 'text-claude-secondary/40 group-hover:translate-x-1 group-hover:text-claude-accent'}`} />
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
        ? 'border-claude-accent/20 bg-claude-accent/5 text-claude-accent'
        : tone === 'error'
            ? 'border-red-500/20 bg-red-500/5 text-red-400'
            : 'border-blue-400/15 bg-blue-400/5 text-blue-400';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${toneClasses}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold">{title}</p>
            {detail && (
                <p className="mt-1 text-[11px] font-mono text-claude-secondary/80">
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
            ? 'text-blue-400'
            : tone === 'success'
                ? 'text-claude-accent'
                : tone === 'warning'
                    ? 'text-amber-500'
                    : tone === 'danger'
                        ? 'text-red-400'
                        : tone === 'pink'
                            ? 'text-pink-400'
                            : 'text-claude-secondary';

    return (
        <div className="mb-3 px-0.5 sm:mb-4 sm:px-1">
            <div className="flex items-center gap-2.5 sm:gap-3">
                <p className={`text-[9px] font-mono uppercase tracking-[0.22em] sm:text-[10px] sm:tracking-[0.24em] ${eyebrowTone}`}>
                    {eyebrow}
                </p>
                <div className="h-px flex-1 bg-claude-border/60" />
            </div>
            <div className="mt-2.5 sm:mt-3">
                <h2 className="font-serif text-[1.55rem] font-semibold italic leading-none tracking-[-0.03em] text-claude-text sm:text-[1.9rem]">
                    {title}
                </h2>
                {description && (
                    <p className="mt-2 max-w-xl text-[10px] font-mono uppercase leading-relaxed tracking-[0.11em] text-claude-secondary/78 sm:max-w-2xl sm:text-[11px] sm:tracking-[0.12em]">
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
            ? 'border-blue-400/20 bg-claude-surface/95'
            : tone === 'warning'
                ? 'border-amber-500/20 bg-claude-surface/95'
                : tone === 'danger'
                    ? 'border-red-500/15 bg-red-500/[0.03]'
                    : tone === 'pink'
                        ? 'border-pink-500/20 bg-claude-surface/95'
                        : 'border-claude-border/70 bg-claude-surface/95';

    return (
        <div className={`relative isolate overflow-hidden rounded-[1.5rem] border shadow-[0_18px_42px_rgba(0,0,0,0.16)] backdrop-blur sm:rounded-[1.9rem] ${toneClasses} ${className}`}>
            <div className="pointer-events-none absolute inset-0 opacity-[0.09]" style={SURFACE_TEXTURE} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

const QuickJumpButton = ({ icon: IconComponent, label, meta, onClick, tone = 'default' }) => {
    const toneClasses = tone === 'accent'
        ? 'border-claude-accent/20 bg-claude-accent/[0.06]'
        : tone === 'info'
            ? 'border-blue-400/20 bg-blue-400/[0.05]'
            : tone === 'warning'
                ? 'border-amber-500/20 bg-amber-500/[0.05]'
                : tone === 'danger'
                    ? 'border-red-500/20 bg-red-500/[0.05]'
                    : 'border-claude-border/70 bg-claude-bg/45';

    return (
        <button
            onClick={onClick}
            className={`tap-action group flex min-h-[104px] w-full flex-col items-start gap-4 rounded-[1.15rem] border px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-claude-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 active:scale-[0.99] sm:min-h-[72px] sm:flex-row sm:items-center sm:gap-3 sm:rounded-[1.2rem] sm:py-3 ${toneClasses}`}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-claude-border/70 bg-claude-bg/70 text-claude-text/75 transition-colors group-hover:text-claude-accent sm:h-11 sm:w-11">
                <IconComponent className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] leading-none text-claude-text transition-colors group-hover:text-claude-accent sm:text-base">
                    {label}
                </p>
                <p className="mt-2 text-[9px] font-mono uppercase tracking-[0.14em] text-claude-secondary/80 sm:truncate sm:text-[10px] sm:tracking-[0.16em]">
                    {meta}
                </p>
            </div>
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-claude-secondary/45 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 group-hover:translate-x-1 group-hover:text-claude-accent sm:block" />
        </button>
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
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const saved = localStorage.getItem('notifications_enabled');
        return saved === null ? true : saved === 'true';
    });


    const hasCanvasUrl = canvasForm.url.trim().length > 0;
    const canvasCardState = !isPremium
        ? 'locked'
        : lmsStatus.loading
            ? 'loading'
            : lmsStatus.isConnected
                ? 'connected'
                : 'ready';
    const membershipSummary = user?.subscription_tier === 'lifetime'
        ? 'Lifetime'
        : isPremium
            ? 'Pro'
            : 'Free';
    const securitySummary = user?.twoFAEnabled ? '2FA enabled' : 'Password only';
    const canvasSummary = canvasCardState === 'loading'
        ? 'Checking Canvas'
        : canvasCardState === 'connected'
            ? 'Canvas linked'
            : canvasCardState === 'locked'
                ? 'Upgrade for Canvas'
                : 'Canvas not linked';

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

            // Sync with OS permissions
            if (notificationsEnabled) {
                const hasPermission = await checkNotificationPermissions();
                if (!hasPermission) {
                    setNotificationsEnabled(false);
                    localStorage.setItem('notifications_enabled', 'false');
                }
            }
        };

        loadSettings();
    }, []);

    const handleConnectCanvas = async () => {
        const result = canvasIcalUrlSchema.safeParse(canvasForm.url.trim());
        if (!result.success) {
            const msg = result.error.errors[0]?.message || 'Invalid Canvas link';
            setFormErrors({ url: true });
            haptics.error();
            toast.error(msg);
            setCanvasNotice({
                tone: 'error',
                title: 'Canvas feed required',
                detail: msg
            });
            setTimeout(() => setFormErrors({ url: false }), 2000);
            return;
        }

        setConnectingCanvas(true);
        try {
            const submittedUrl = result.data;
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

    const aiAllowanceSummary = aiLimits.loading
        ? 'Checking allowance'
        : `${aiLimits.remaining} / ${aiLimits.max} left`;

    const quickLinks = [
        { id: 'security-panel', label: 'Security', meta: securitySummary, icon: Shield },
        { id: 'membership-panel', label: 'Plan & access', meta: membershipSummary, icon: Sparkles, tone: 'accent' },
        { id: 'theme-panel', label: 'Theme & atmosphere', meta: activeTheme?.name || 'Current theme', icon: isLightMode ? Sun : Moon },
        { id: 'integrations-panel', label: 'Integrations', meta: canvasSummary, icon: Network, tone: 'info' },
        { id: 'limits-panel', label: 'AI limits', meta: aiAllowanceSummary, icon: Sun, tone: 'warning' },
        { id: 'notifications-panel', label: 'Notifications', meta: 'Reminders & alerts', icon: Bell },
        { id: 'privacy-panel', label: 'Safety controls', meta: 'Blocked accounts', icon: UserMinus },
        { id: 'support-panel', label: 'Help & policies', meta: 'Support + docs', icon: Mail },
        { id: 'danger-panel', label: 'Danger zone', meta: 'Sign out or delete', icon: Trash2, tone: 'danger' },
    ];

    const scrollToSection = useCallback((sectionId) => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        haptics.light();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [haptics]);

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text pb-24 font-sans">
            <div className="sticky top-0 z-50 border-b border-claude-border/60 bg-claude-bg/88 safe-area-top md:backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3.5 sm:items-center sm:gap-4 sm:py-4 lg:px-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="tap-action touch-target rounded-full border border-claude-border/70 bg-claude-surface/80 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-accent active:scale-95"
                    >
                        <ArrowLeft className="w-5 h-5 text-claude-text" />
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-claude-border/70 bg-claude-surface/70 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.26em] text-claude-secondary">
                                Settings atlas
                            </span>
                            <span className="max-w-[12rem] truncate rounded-full border border-claude-border/70 bg-claude-bg/60 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-claude-secondary/85 sm:max-w-none">
                                {activeTheme?.name || 'Current theme'}
                            </span>
                        </div>
                        <h1 className="mt-3 font-serif text-[2rem] font-semibold italic leading-none tracking-[-0.04em] text-claude-text sm:text-[2.8rem]">
                            Settings
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
                            <span className="rounded-full border border-claude-border/70 bg-claude-surface/70 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                {membershipSummary}
                            </span>
                            <span className="rounded-full border border-claude-border/70 bg-claude-surface/70 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                {securitySummary}
                            </span>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-2">
                        <span className="rounded-full border border-claude-border/70 bg-claude-surface/70 px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            {membershipSummary}
                        </span>
                        <span className="rounded-full border border-claude-border/70 bg-claude-surface/70 px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            {securitySummary}
                        </span>
                    </div>
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="mx-auto max-w-7xl px-4 py-6 lg:px-8"
            >
                <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[360px,minmax(0,1fr)] xl:items-start xl:gap-8">
                    <div className="contents xl:sticky xl:top-32 xl:block xl:self-start xl:space-y-6">
                        <motion.div id="overview-panel" variants={itemVariants} className={`${SECTION_ANCHOR_CLASS} order-1`}>
                            <SectionHeader
                                eyebrow="Overview"
                                title="Workspace snapshot"
                                description="See account status, study automation, and visual setup before you change anything."
                            />
                            <SectionCard className="overflow-hidden p-5 sm:p-6">
                                <div className="pointer-events-none absolute -top-3 left-12 h-5 w-16 rotate-[-4deg] rounded-sm bg-claude-border/60 shadow-sm" />
                                <div className="pointer-events-none absolute -right-12 top-0 h-40 w-40 rounded-full bg-claude-accent/10 blur-3xl" />
                                <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-botanical-forest/10 blur-3xl" />

                                <div className="space-y-5">
                                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-claude-secondary/75">
                                                Field guide
                                            </p>
                                            <h2 className="mt-3 font-serif text-[1.7rem] font-semibold italic leading-none tracking-[-0.04em] text-claude-text sm:text-[2rem]">
                                                Control center
                                            </h2>
                                            <p className="mt-3 max-w-sm text-[11px] font-mono uppercase leading-relaxed tracking-[0.12em] text-claude-secondary/80">
                                                Account state, study automation, and atmosphere signals in one readable surface.
                                            </p>
                                        </div>
                                        <div className="rounded-full border border-claude-border/70 bg-claude-bg/70 px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-claude-secondary">
                                            Atlas
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                                        <div className="rounded-[1.25rem] border border-claude-border/70 bg-claude-bg/55 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/10 p-2.5 text-claude-accent">
                                                    <Sparkles className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-claude-secondary/75">Plan</p>
                                                    <p className="mt-1 font-display text-lg text-claude-text">{membershipSummary}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[1.25rem] border border-claude-border/70 bg-claude-bg/55 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-2xl border border-claude-secondary/20 bg-claude-secondary/10 p-2.5 text-claude-secondary">
                                                    <Shield className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-claude-secondary/75">Security</p>
                                                    <p className="mt-1 font-display text-lg text-claude-text">{securitySummary}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[1.25rem] border border-claude-border/70 bg-claude-bg/55 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-2.5 text-blue-400">
                                                    <Network className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-claude-secondary/75">Sync</p>
                                                    <p className="mt-1 font-display text-lg text-claude-text">{canvasSummary}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <button
                                            onClick={() => openModal('pricing')}
                                            className="tap-action flex min-h-[52px] items-center justify-center rounded-[1.1rem] bg-claude-text px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 active:scale-[0.98]"
                                        >
                                            Manage plan
                                        </button>
                                        <button
                                            onClick={() => { haptics.light(); navigate('/themes'); }}
                                            className="tap-action flex min-h-[52px] items-center justify-center rounded-[1.1rem] border border-claude-border/70 bg-claude-bg/55 px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 active:scale-[0.98]"
                                        >
                                            Change atmosphere
                                        </button>
                                    </div>
                                </div>
                            </SectionCard>
                        </motion.div>

                        <motion.div variants={itemVariants} className="order-2">
                            <SectionHeader
                                eyebrow="Map"
                                title="Jump to"
                                description="Scan the settings surface and jump straight to the section you need."
                            />
                            <SectionCard className="p-2.5 sm:p-2">
                                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                                    {quickLinks.map(link => (
                                        <QuickJumpButton
                                            key={link.id}
                                            icon={link.icon}
                                            label={link.label}
                                            meta={link.meta}
                                            tone={link.tone}
                                            onClick={() => scrollToSection(link.id)}
                                        />
                                    ))}
                                </div>
                            </SectionCard>
                        </motion.div>

                        <motion.div id="theme-panel" variants={itemVariants} className={`${SECTION_ANCHOR_CLASS} order-7`}>
                            <SectionHeader
                                eyebrow="Appearance"
                                title="Theme & atmosphere"
                                description="Adjust the visual mood of the workspace."
                            />
                            <SectionCard className="overflow-hidden">
                                <button
                                    onClick={() => { haptics.light(); navigate('/themes'); }}
                                    className="tap-action group relative w-full overflow-hidden p-5 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 active:scale-[0.98] sm:p-6"
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

                                    <div className="relative z-10">
                                        <div className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-mono uppercase tracking-[0.2em] ${isLightMode ? 'border-[#d6cdc0] bg-white/60 text-[#6f665e]' : 'border-white/10 bg-claude-bg/40 text-[#c2beb6]'}`}>
                                            Current atmosphere
                                        </div>

                                        <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                                            <div className="flex w-full items-start gap-4 sm:w-auto sm:items-center sm:gap-5">
                                                <div className={`rounded-2xl border p-3 shadow-inner transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 group-hover:scale-110 sm:p-4 ${isLightMode ? 'bg-claude-surface text-amber-500 border-amber-900/5' : 'bg-claude-bg text-indigo-400 border-indigo-100/5'}`}>
                                                    {isLightMode ? <Sun className="w-7 h-7" /> : <Moon className="w-7 h-7" />}
                                                </div>
                                                <div>
                                                    <p className={`font-serif text-[1.6rem] font-semibold italic leading-none tracking-[-0.04em] transition-colors duration-500 sm:text-[2rem] ${isLightMode ? 'text-[#2c2825]' : 'text-[#e8e4dc]'}`}>
                                                        {activeTheme?.name || 'Theme'}
                                                    </p>
                                                    <p className={`mt-3 text-[9px] font-mono uppercase tracking-[0.16em] opacity-65 sm:text-[10px] sm:tracking-[0.18em] ${isLightMode ? 'text-[#2c2825]' : 'text-[#e8e4dc]'}`}>
                                                        Tap to change the workspace feel
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={`flex h-11 w-11 self-end items-center justify-center rounded-full border shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 group-hover:scale-110 sm:self-auto ${isLightMode ? 'border-claude-border/40 text-[#2c2825]/40 bg-white/50' : 'border-claude-border/40 text-[#e8e4dc]/40 bg-claude-bg/60'}`}>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </SectionCard>
                        </motion.div>

                        <motion.div id="support-panel" variants={itemVariants} className={`${SECTION_ANCHOR_CLASS} order-8`}>
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
                                    badge="Direct"
                                    onClick={() => window.open('mailto:support@Riven.app')}
                                />
                                <SettingItem
                                    icon={Shield}
                                    title="Privacy Policy"
                                    description="How we protect your data"
                                    badge="Policy"
                                    onClick={() => navigate('/privacy')}
                                />
                                <SettingItem
                                    icon={BookOpen}
                                    title="Terms of Service"
                                    description="EULA and usage rules"
                                    badge="Legal"
                                    onClick={() => navigate('/terms')}
                                    noBorder
                                />
                            </SectionCard>
                        </motion.div>
                    </div>

                    <div className="contents xl:block xl:min-w-0 xl:space-y-6">
                        <div className="order-3 grid gap-6 lg:grid-cols-2">
                            <motion.div id="security-panel" variants={itemVariants} className={SECTION_ANCHOR_CLASS}>
                                <SectionHeader
                                    eyebrow="Account"
                                    title="Security"
                                    description="Protect your login and recovery options."
                                />
                                <SectionCard className="overflow-hidden">
                                    <SettingItem icon={Lock} title="Change Password" description="Update your credentials" badge="Access" onClick={() => openModal('password')} />
                                    <SettingItem icon={Shield} title="Two-Factor Auth" description={user?.twoFAEnabled ? 'Enabled — manage 2FA' : 'Add extra security'} badge={user?.twoFAEnabled ? 'Enabled' : 'Recommended'} onClick={() => openModal('twoFactor')} noBorder />
                                </SectionCard>
                            </motion.div>

                            <motion.div id="membership-panel" variants={itemVariants} className={SECTION_ANCHOR_CLASS}>
                                <SectionHeader
                                    eyebrow="Membership"
                                    title="Plan & access"
                                    description="Manage your subscription, restore purchases, and check premium status."
                                    tone="accent"
                                />
                                <SectionCard tone="accent" className="space-y-4 p-5 sm:p-6">
                                    <div className="flex items-start gap-4 sm:items-center">
                                        <div className="p-3 rounded-2xl bg-claude-accent/10 border border-claude-accent/20 shadow-inner">
                                            <Sparkles className="w-6 h-6 text-claude-accent" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="flex flex-col items-start gap-2 font-display text-lg font-semibold tracking-wide text-claude-text sm:flex-row sm:items-center sm:justify-between">
                                                Current Plan
                                                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border uppercase ${user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-claude-secondary/10 text-claude-secondary/80 border-claude-secondary/20'}`}>
                                                    {user?.subscription_tier || 'Free'}
                                                </span>
                                            </h3>
                                            <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                                                {user?.subscription_tier === 'free' || !user?.subscription_tier ? 'Free plan currently active' : 'Premium access active'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                                        <button
                                            onClick={() => openModal('pricing')}
                                            className="tap-action flex-1 rounded-[1.1rem] bg-claude-text px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 active:scale-[0.98]"
                                        >
                                            Upgrade Riven
                                        </button>
                                        <button
                                            aria-label="Restore purchases"
                                            onClick={async () => { haptics.light(); try { const u = await refreshUser(); toast(u?.subscription_tier !== 'free' ? 'Subscription restored!' : 'No active subscription found'); } catch { toast('Sync failed, try again'); } }}
                                            className="tap-action flex items-center justify-center gap-2 rounded-[1.1rem] border border-claude-border/70 bg-claude-bg/55 px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-text active:scale-[0.98] sm:flex-none"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            <span>Restore purchases</span>
                                        </button>
                                    </div>
                                    {(user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime') && (
                                        <div className={`flex flex-col items-start gap-4 rounded-[1.25rem] border px-4 py-4 sm:flex-row sm:items-center ${user?.subscription_tier === 'lifetime' ? 'border-amber-500/20 bg-amber-500/5' : 'border-indigo-500/20 bg-indigo-500/5'}`}>
                                            <div className={`p-3 rounded-2xl ${user?.subscription_tier === 'lifetime' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'} shadow-inner`}>
                                                {user?.subscription_tier === 'lifetime'
                                                    ? <Crown className="w-6 h-6 text-amber-400" />
                                                    : <Award className="w-6 h-6 text-indigo-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="flex flex-col items-start gap-2 font-display text-base font-bold text-claude-text sm:flex-row sm:items-center">
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
                        </div>
                        <div className="order-4">
                            <ReferralCard />
                        </div>

                        <div className="order-5 grid gap-6 lg:grid-cols-2">
                            <motion.div id="integrations-panel" variants={itemVariants} className={SECTION_ANCHOR_CLASS}>
                                <SectionHeader
                                    eyebrow="Workspace"
                                    title="Integrations"
                                    description="Connect external systems that keep your classes and assignments in sync."
                                    tone="info"
                                />
                                <SectionCard tone="info" className="flex flex-col space-y-5 p-5 sm:p-6">
                        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                            <div className="p-3 rounded-2xl bg-blue-400/10 border border-blue-400/20 shadow-inner">
                                <Network className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold">Canvas Sync</h3>
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest font-bold border ${
                                        canvasCardState === 'locked'
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            : canvasCardState === 'connected'
                                                ? 'bg-claude-accent/10 text-claude-accent border-claude-accent/20'
                                                : canvasCardState === 'loading'
                                                    ? 'bg-claude-bg/20 text-claude-secondary border-claude-border'
                                                    : 'bg-blue-400/10 text-blue-400 border-blue-400/20'
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
                                <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
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
                                <p className="text-[11px] font-mono text-claude-secondary/70 leading-relaxed mb-4">
                                    Automatically import your courses and assignments from Canvas. Upgrade to unlock this integration.
                                </p>
                                <button
                                    onClick={() => { haptics.medium(); openModal('pricing'); }}
                                    className="tap-action w-full rounded-[1.1rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-amber-300 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-amber-500/15 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Crown className="w-4 h-4" />
                                    Upgrade to Connect Canvas
                                </button>
                            </div>
                        ) : canvasCardState === 'loading' ? (
                            <div className="pt-2 space-y-3" aria-label="Canvas status loading">
                                <div className="h-12 rounded-xl bg-claude-bg/20 border border-claude-border animate-pulse" />
                                <div className="h-24 rounded-2xl bg-claude-bg/15 border border-claude-border animate-pulse" />
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
                                                        className={`w-full bg-claude-bg border ${formErrors.url ? 'border-red-400 focus:border-red-500 bg-red-500/5' : 'border-claude-secondary/20 focus:border-blue-400/50'} rounded-xl px-4 py-3.5 text-sm text-claude-text placeholder-claude-secondary/40 font-mono focus:outline-none transition-colors shadow-inner`}
                                                    />
                                                </motion.div>
                                            </div>

                                            <div className="rounded-2xl border border-blue-400/15 bg-blue-400/5 px-4 py-3">
                                                <p className="text-[10px] font-mono text-claude-secondary/80 leading-relaxed text-center">
                                                    Go to Canvas Calendar, open `Calendar Feed`, then paste the `.ics` link here.
                                                </p>
                                            </div>

                                            <p className="text-[10px] font-mono text-claude-secondary/60 leading-relaxed text-center px-2">
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
                                                className="tap-action w-full bg-claude-text hover:bg-claude-accent text-claude-bg font-mono text-[10px] uppercase tracking-[0.22em] py-3.5 rounded-[1.1rem] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] shadow-md"
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
                                            <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">Canvas feed active</p>
                                                <p className="mt-1 text-[11px] font-mono text-claude-secondary/80">
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
                                                className="tap-action w-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-70 font-mono text-[10px] uppercase tracking-[0.2em] py-3.5 rounded-[1.1rem] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-blue-500/20"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${lmsStatus.syncing ? 'animate-spin' : ''}`} />
                                                {lmsStatus.syncing ? 'Syncing Courses...' : 'Sync Canvas Now'}
                                            </button>

                                            <button
                                                onClick={handleDisconnectCanvas}
                                                className="tap-action w-full bg-claude-bg border border-claude-secondary/10 text-claude-secondary/80 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 font-mono text-[10px] uppercase tracking-[0.2em] py-3 rounded-[1.1rem] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98]"
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

                            <motion.div id="limits-panel" variants={itemVariants} className={SECTION_ANCHOR_CLASS}>
                                <SectionHeader
                                    eyebrow="Workspace"
                                    title="AI limits"
                                    description="See your current generation allowance and request boundaries."
                                    tone="warning"
                                />
                                <SectionCard tone="warning" className="flex flex-col space-y-4 p-5 sm:p-6">
                                    <div className="flex items-start gap-4 sm:items-center">
                                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
                                            <Sun className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="flex flex-col items-start gap-2 font-display text-lg font-semibold tracking-wide text-claude-text sm:flex-row sm:items-center sm:justify-between">
                                                AI Generations
                                                {!aiLimits.loading && (
                                                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${aiLimits.remaining > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                                        {`${aiLimits.remaining} / ${aiLimits.max} Left`}
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                                                Resets every 2 hours
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="bg-claude-bg/50 border border-claude-secondary/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-claude-secondary/70 mb-1">Max Input</p>
                                            <p className="text-sm font-medium text-claude-text">~3,000 words</p>
                                            <p className="text-[9px] text-claude-secondary mt-0.5">15,000 chars</p>
                                        </div>
                                        <div className="bg-claude-bg/50 border border-claude-secondary/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                                            <p className="text-[10px] uppercase font-mono tracking-widest text-claude-secondary/70 mb-1">Output Size</p>
                                            <p className="text-sm font-medium text-claude-text">Flashcards or Class</p>
                                            <p className="text-[9px] text-claude-secondary mt-0.5">per request limit</p>
                                        </div>
                                    </div>

                                    {!aiLimits.loading && (
                                        <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden mt-2 border border-claude-secondary/5 shadow-inner">
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
                        </div>

                        <div className="order-6 grid gap-6 lg:grid-cols-2">
                            <motion.div id="notifications-panel" variants={itemVariants} className={SECTION_ANCHOR_CLASS}>
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
                                        badge={notificationsEnabled ? "On" : "Off"}
                                        toggle={true}
                                        toggleValue={notificationsEnabled}
                                        onClick={async () => {
                                            haptics.light();
                                            const nextValue = !notificationsEnabled;
                                            
                                            if (nextValue) {
                                                const granted = await requestNotificationPermissions();
                                                if (granted) {
                                                    setNotificationsEnabled(true);
                                                    localStorage.setItem('notifications_enabled', 'true');
                                                    toast('Notifications enabled');
                                                    // Trigger initial schedule if assignments were already loaded
                                                    try {
                                                        const assignments = await api.getAssignments();
                                                        await scheduleAssignmentNotifications(assignments, true);
                                                    } catch (e) {
                                                        console.error('Failed to reschedule on toggle', e);
                                                    }
                                                } else {
                                                    toast.error('Notification permissions denied');
                                                }
                                            } else {
                                                setNotificationsEnabled(false);
                                                localStorage.setItem('notifications_enabled', 'false');
                                                await scheduleAssignmentNotifications([], false); // Cancels all
                                                toast('Notifications disabled');
                                            }
                                        }}
                                        noBorder={true}
                                    />

                                </SectionCard>
                            </motion.div>

                            <motion.div id="privacy-panel" variants={itemVariants} className={SECTION_ANCHOR_CLASS}>
                                <BlockedUsersCard />
                            </motion.div>
                        </div>

                        <motion.div id="danger-panel" variants={itemVariants} className={`${SECTION_ANCHOR_CLASS} order-9 pt-1`}>
                            <SectionHeader
                                eyebrow="Danger"
                                title="Danger zone"
                                description="Actions here affect access to the account itself."
                                tone="danger"
                            />
                            <SectionCard tone="danger" className="overflow-hidden">
                                <SettingItem icon={LogOut} title="Sign Out" description="End this session on this device" badge="Session" onClick={handleSignOut} destructive />
                                <SettingItem icon={Trash2} title="Delete Account" description="Permanently erase all data" badge="Permanent" onClick={() => openModal('delete')} destructive noBorder />
                            </SectionCard>
                        </motion.div>

                        <motion.div variants={itemVariants} className="order-10 pb-4 pt-2 text-center opacity-40">
                            <Leaf className="w-6 h-6 text-claude-accent mx-auto mb-3" />
                            <p className="text-[10px] text-claude-secondary font-mono tracking-widest uppercase">
                                Riven OS v1.0.0
                            </p>
                        </motion.div>
                    </div>
                </div>
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
        const result = referralCodeSchema.safeParse(applyCode.trim());
        if (!result.success) {
            toast(result.error.errors[0]?.message || 'Invalid referral code');
            return;
        }
        setApplying(true);
        try {
            await api.applyReferralCode(result.data);
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
            <SectionCard tone="pink" className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start gap-4 sm:items-center">
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
                        : "Share your code, track qualified signups, or apply a friend's code below."}
                />

                {/* Your Code */}
                <div className="rounded-[1.5rem] border border-claude-border bg-claude-bg/70 p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Your Referral Code</p>
                            <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">Share this with friends who are joining Riven.</p>
                        </div>
                        <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-pink-400">
                            Share
                        </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-center font-mono text-base font-bold tracking-[0.22em] text-claude-text sm:text-lg sm:tracking-[0.3em]">
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
                    <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Progress</p>
                            <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
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
                        <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
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
                                        <div key={u.id} className="flex flex-col items-start gap-3 rounded-xl border border-claude-border/50 bg-claude-bg p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-claude-text">{u.username}</p>
                                                <p className="text-[10px] text-claude-secondary font-mono tracking-wider mt-0.5">
                                                    Blocked {new Date(u.blocked_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUnblock(u.id)}
                                                disabled={unblockingId === u.id}
                                                className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-xs font-bold text-claude-text transition-colors hover:bg-claude-surface/80 disabled:opacity-50 sm:w-auto sm:px-3 sm:py-1.5 touch-target tap-action native-press"
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
