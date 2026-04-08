import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { api } from '../api';
import ChangePasswordModal from '../components/ChangePasswordModal';
import TwoFactorAuthModal from '../components/TwoFactorAuthModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import FeedbackModal from '../components/FeedbackModal';
import PricingModal from '../components/ui/PricingModal';
import { useRevenueCat } from '../hooks/useRevenueCat';
import { canvasIcalUrlSchema } from '../schemas/forms';
import { checkNotificationPermissions, requestNotificationPermissions, scheduleAssignmentNotifications } from '../utils/notifications';
import { checkPushPermissions, isNativeIos, registerPushNotifications, requestPushPermissions } from '../utils/pushNotifications.js';

import { SETTINGS_SECTIONS, DEFAULT_REMOTE_PUSH_PREFERENCES, SIDEBAR_STORAGE_KEY, sectionTransition } from '../components/settings/settingsConstants';
import SettingsNav from '../components/settings/SettingsNav';
import SecuritySection from '../components/settings/sections/SecuritySection';
import PlanAccessSection from '../components/settings/sections/PlanAccessSection';
import IntegrationsSection from '../components/settings/sections/IntegrationsSection';
import RivenAISection from '../components/settings/sections/RivenAISection';
import NotificationsSection from '../components/settings/sections/NotificationsSection';
import SafetySection from '../components/settings/sections/SafetySection';
import HelpPoliciesSection from '../components/settings/sections/HelpPoliciesSection';
import DangerZoneSection from '../components/settings/sections/DangerZoneSection';
import { formatAiHistoryItem, shouldShowAiHistoryJob } from '../components/settings/sections/rivenAiHistory';

const mapAiHistoryItems = (jobs = []) => jobs
    .filter(shouldShowAiHistoryJob)
    .map(formatAiHistoryItem)
    .filter(Boolean);

export default function Settings() {
    const {
        user,
        signOut,
        refreshUser,
        getPushPreferences,
        updatePushPreferences,
    } = useAuth();
    const rc = useRevenueCat();
    const isPremium = user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime';
    const remotePushAvailable = isNativeIos();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const headerRef = useRef(null);

    // --- Navigation state ---
    const [activeSection, setActiveSection] = useState(() => {
        const hash = window.location.hash.slice(1);
        return SETTINGS_SECTIONS.find(s => s.id === hash)?.id || 'security';
    });
    const [sidebarExpanded, setSidebarExpanded] = useState(
        () => localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false'
    );

    // URL hash sync
    useEffect(() => {
        window.history.replaceState(null, '', `#${activeSection}`);
    }, [activeSection]);

    // Sidebar persistence
    useEffect(() => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarExpanded);
    }, [sidebarExpanded]);

    // Measure header height for sticky pill tabs offset
    useEffect(() => {
        if (headerRef.current) {
            const h = headerRef.current.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--settings-header-h', `${h}px`);
        }
    }, []);

    // --- Modal state ---
    const [modals, setModals] = useState({
        password: false,
        twoFactor: false,
        delete: false,
        feedback: false,
        pricing: false
    });

    const openModal = (name) => {
        haptics.light();
        setModals(prev => ({ ...prev, [name]: true }));
    };

    const closeModal = (name) => {
        setModals(prev => ({ ...prev, [name]: false }));
    };

    // --- LMS / Canvas state ---
    const [lmsStatus, setLmsStatus] = useState({
        loading: true,
        syncing: false,
        savingAutoSync: false,
        isConnected: false,
        canvasUrl: '',
        autoSyncEnabled: false,
        lastSyncAt: null,
        lastAutoSyncError: '',
    });
    const [canvasForm, setCanvasForm] = useState({ url: '', token: '' });
    const [connectingCanvas, setConnectingCanvas] = useState(false);
    const [formErrors, setFormErrors] = useState({ url: false, token: false });
    const [canvasNotice, setCanvasNotice] = useState(null);

    // --- AI limits ---
    const [aiLimits, setAiLimits] = useState({
        remaining: 10,
        max: 10,
        characterLimit: 15000,
        flashcardRange: [5, 15],
        isPremium: false,
        loading: true,
    });
    const [aiHistory, setAiHistory] = useState({
        items: [],
        loading: true,
        error: false,
    });

    // --- Notification state ---
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const saved = localStorage.getItem('notifications_enabled');
        return saved === null ? true : saved === 'true';
    });
    const [remotePushPreferences, setRemotePushPreferences] = useState(DEFAULT_REMOTE_PUSH_PREFERENCES);
    const [pushPermissionGranted, setPushPermissionGranted] = useState(false);
    const [pushPreferencesLoading, setPushPreferencesLoading] = useState(remotePushAvailable);
    const [savingPushPreference, setSavingPushPreference] = useState(null);

    // --- Derived values ---
    const membershipSummary = user?.subscription_tier === 'lifetime'
        ? 'Lifetime'
        : isPremium
            ? 'Pro'
            : 'Free';
    const securitySummary = user?.twoFAEnabled ? '2FA enabled' : 'Password only';

    // --- Data loading ---
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await api.getCanvasSettings();
                setLmsStatus(prev => ({
                    ...prev,
                    isConnected: res.isConnected,
                    canvasUrl: res.canvasUrl || '',
                    autoSyncEnabled: Boolean(res.autoSyncEnabled),
                    lastSyncAt: res.lastSyncAt || null,
                    lastAutoSyncError: res.lastAutoSyncError || '',
                    loading: false
                }));
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

            try {
                const historyRows = await api.listAiJobs({ limit: 20 });
                setAiHistory({
                    items: mapAiHistoryItems(historyRows),
                    loading: false,
                    error: false,
                });
            } catch {
                setAiHistory({
                    items: [],
                    loading: false,
                    error: true,
                });
            }

            if (notificationsEnabled) {
                const hasPermission = await checkNotificationPermissions();
                if (!hasPermission) {
                    setNotificationsEnabled(false);
                    localStorage.setItem('notifications_enabled', 'false');
                }
            }

            if (remotePushAvailable) {
                try {
                    const [preferences, hasPushPermission] = await Promise.all([
                        getPushPreferences(),
                        checkPushPermissions(),
                    ]);
                    setRemotePushPreferences({
                        ...DEFAULT_REMOTE_PUSH_PREFERENCES,
                        ...preferences,
                    });
                    setPushPermissionGranted(hasPushPermission);
                } catch (error) {
                    console.warn('[Settings] Failed to load push preferences:', error);
                } finally {
                    setPushPreferencesLoading(false);
                }
            } else {
                setPushPreferencesLoading(false);
            }
        };

        loadSettings();
    }, [getPushPreferences, notificationsEnabled, remotePushAvailable]);

    useEffect(() => {
        const unsubscribe = api.subscribeToAiJobsForUser({
            onUpdate: () => {
                api.listAiJobs({ limit: 20 })
                    .then((rows) => {
                        setAiHistory({
                            items: mapAiHistoryItems(rows),
                            loading: false,
                            error: false,
                        });
                    })
                    .catch(() => {
                        setAiHistory((prev) => ({
                            ...prev,
                            loading: false,
                            error: true,
                        }));
                    });
            },
        });

        return unsubscribe;
    }, []);

    // --- Canvas handlers ---
    const handleConnectCanvas = async () => {
        const result = canvasIcalUrlSchema.safeParse(canvasForm.url.trim());
        if (!result.success) {
            const msg = result.error.errors[0]?.message || 'Invalid Canvas link';
            setFormErrors({ url: true });
            haptics.error();
            toast.error(msg);
            setCanvasNotice({ tone: 'error', title: 'Canvas feed required', detail: msg });
            setTimeout(() => setFormErrors({ url: false }), 2000);
            return;
        }

        setConnectingCanvas(true);
        try {
            const submittedUrl = result.data;
            await api.connectCanvas(submittedUrl);
            toast.success('Canvas connected successfully!');
            haptics.success();
            setLmsStatus(prev => ({
                ...prev,
                isConnected: true,
                canvasUrl: submittedUrl,
                autoSyncEnabled: true,
                lastAutoSyncError: '',
            }));
            setCanvasForm({ url: '' });
            setCanvasNotice({
                tone: 'success',
                title: 'Feed saved',
                detail: 'Auto-sync is now on every 12 hours. Run a sync now if you want your first import immediately.'
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
            setLmsStatus(prev => ({
                ...prev,
                isConnected: false,
                canvasUrl: '',
                autoSyncEnabled: false,
                lastSyncAt: null,
                lastAutoSyncError: '',
            }));
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
            setLmsStatus(prev => ({
                ...prev,
                lastSyncAt: new Date().toISOString(),
                lastAutoSyncError: '',
            }));
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

    const handleToggleCanvasAutoSync = async () => {
        if (lmsStatus.savingAutoSync || !lmsStatus.isConnected) return;

        const nextValue = !lmsStatus.autoSyncEnabled;
        setLmsStatus(prev => ({ ...prev, savingAutoSync: true }));
        haptics.light();

        try {
            await api.setCanvasAutoSync(nextValue);
            setLmsStatus(prev => ({
                ...prev,
                autoSyncEnabled: nextValue,
                savingAutoSync: false,
            }));
            setCanvasNotice({
                tone: 'success',
                title: nextValue ? 'Auto-sync enabled' : 'Auto-sync paused',
                detail: nextValue
                    ? 'Riven will check your Canvas feed about every 12 hours while it stays connected.'
                    : 'Canvas will stay connected, but new imports will wait for a manual sync.'
            });
        } catch (err) {
            setLmsStatus(prev => ({ ...prev, savingAutoSync: false }));
            haptics.error();
            toast.error(err.message || 'Failed to update Canvas auto-sync');
            setCanvasNotice({
                tone: 'error',
                title: 'Auto-sync update failed',
                detail: err.message || 'Riven could not update your Canvas auto-sync preference.'
            });
        }
    };

    // --- Auth handlers ---
    const handleSignOut = async () => {
        haptics.medium();
        await signOut();
        toast.success('Signed out');
        navigate('/');
    };

    const handleRestorePurchases = async () => {
        haptics.light();
        toast.show('Restoring purchases...');

        try {
            if (rc?.isNative) {
                const result = await rc.restorePurchases();
                const hasActiveEntitlement = result?.customerInfo?.entitlements?.active &&
                    Object.keys(result.customerInfo.entitlements.active).length > 0;

                if (hasActiveEntitlement) {
                    try {
                        const syncResult = await api.syncRevenueCat({
                            rcAppUserIdOverride: result?.customerInfo?.originalAppUserId
                        });
                        if (syncResult && syncResult.subscription_tier !== 'free') {
                            toast.success(`Welcome back, ${syncResult.subscription_tier}. Your access has been restored.`);
                            setTimeout(() => { refreshUser(); }, 1800);
                            return;
                        } else {
                            const localId = result?.customerInfo?.appUserId;
                            const origId = result?.customerInfo?.originalAppUserId;
                            console.error(`DEBUG - Sync Failed!\nLocal IDs: [current: ${localId}, orig: ${origId}]\nEdge Payload: ${JSON.stringify(syncResult, null, 2)}`);
                        }
                    } catch (syncErr) {
                        console.error('DEBUG (Settings) Edge function failed! ' + syncErr.message + '\nFull: ' + JSON.stringify(syncErr, null, 2));
                        console.warn('[Settings] Manual sync failed, falling back to polling webhook', syncErr);
                    }

                    let attempts = 0;
                    let finalUser = null;
                    while (attempts < 6) {
                        try {
                            const updatedUser = await refreshUser();
                            if (updatedUser?.subscription_tier && updatedUser.subscription_tier !== 'free') {
                                finalUser = updatedUser;
                                break;
                            }
                        } catch (e) { }
                        await new Promise(r => setTimeout(r, 2000));
                        attempts++;
                    }

                    if (finalUser && finalUser.subscription_tier !== 'free') {
                        toast.success(`Welcome back, ${finalUser.subscription_tier}!`);
                    } else {
                        toast.error('Found subscription, but servers are taking too long to sync. Please restart the app.');
                    }
                } else {
                    toast.error(rc.error || 'No active purchases found for this Apple ID.');
                }
            } else {
                const u = await refreshUser();
                if (u?.subscription_tier !== 'free') {
                    toast.success('Subscription restored!');
                } else {
                    toast.error('No active subscription found');
                }
            }
        } catch (err) {
            toast.error(err.message || 'Restore failed, try again');
        }
    };

    // --- Notification handlers ---
    const handleToggleNotifications = async () => {
        haptics.light();
        const nextValue = !notificationsEnabled;

        if (nextValue) {
            const granted = await requestNotificationPermissions();
            if (granted) {
                setNotificationsEnabled(true);
                localStorage.setItem('notifications_enabled', 'true');
                toast.show('Notifications enabled');
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
            await scheduleAssignmentNotifications([], false);
            toast.show('Notifications disabled');
        }
    };

    const handleToggleRemotePushPreference = useCallback(async (preferenceKey, labels) => {
        if (!remotePushAvailable || pushPreferencesLoading || savingPushPreference) return;

        haptics.light();
        const currentValue = Boolean(remotePushPreferences[preferenceKey]);
        const nextPreferences = {
            ...remotePushPreferences,
            [preferenceKey]: !currentValue,
        };

        if (!currentValue) {
            const granted = await requestPushPermissions();
            setPushPermissionGranted(granted);
            if (!granted) {
                toast.error('Allow iPhone notifications in Settings to enable remote alerts.');
                return;
            }
            await registerPushNotifications().catch(() => false);
        }

        setSavingPushPreference(preferenceKey);
        try {
            const savedPreferences = await updatePushPreferences(nextPreferences);
            setRemotePushPreferences({
                ...DEFAULT_REMOTE_PUSH_PREFERENCES,
                ...savedPreferences,
            });
            toast.show(!currentValue ? labels.enabledToast : labels.disabledToast);
        } catch (error) {
            toast.error(error.message || 'Failed to update remote push settings.');
        } finally {
            setSavingPushPreference(null);
        }
    }, [
        haptics,
        pushPreferencesLoading,
        remotePushAvailable,
        remotePushPreferences,
        savingPushPreference,
        toast,
        updatePushPreferences,
    ]);

    // --- Remote push status ---
    const remotePushStatus = !remotePushAvailable
        ? { tone: 'info', title: 'iPhone app only', detail: 'Remote pushes for messages, streak rescue, and comeback nudges are available in the native iOS app.' }
        : pushPreferencesLoading
            ? { tone: 'info', title: 'Checking push status', detail: 'Riven is loading your iPhone push preferences.' }
            : pushPermissionGranted
                ? { tone: 'success', title: 'Remote push ready', detail: 'Message alerts, streak rescue, and comeback nudges can reach this iPhone when their toggles are on.' }
                : { tone: 'info', title: 'Permission needed', detail: 'Allow iPhone notifications to receive direct messages, garden streak rescue, and comeback nudges.' };

    // --- Section rendering ---
    const renderActiveSection = () => {
        switch (activeSection) {
            case 'security':
                return <SecuritySection user={user} openModal={openModal} />;
            case 'plan':
                return <PlanAccessSection user={user} openModal={openModal} haptics={haptics} onRestorePurchases={handleRestorePurchases} />;
            case 'integrations':
                return (
                    <IntegrationsSection
                        isPremium={isPremium}
                        lmsStatus={lmsStatus}
                        canvasForm={canvasForm}
                        setCanvasForm={setCanvasForm}
                        formErrors={formErrors}
                        setFormErrors={setFormErrors}
                        canvasNotice={canvasNotice}
                        connectingCanvas={connectingCanvas}
                        onConnectCanvas={handleConnectCanvas}
                        onDisconnectCanvas={handleDisconnectCanvas}
                        onSyncCanvas={handleSyncLms}
                        onToggleAutoSync={handleToggleCanvasAutoSync}
                        openModal={openModal}
                        haptics={haptics}
                    />
                );
            case 'ai':
                return <RivenAISection aiLimits={aiLimits} history={aiHistory} />;
            case 'notifications':
                return (
                    <NotificationsSection
                        notificationsEnabled={notificationsEnabled}
                        onToggleNotifications={handleToggleNotifications}
                        remotePushStatus={remotePushStatus}
                        remotePushAvailable={remotePushAvailable}
                        pushPermissionGranted={pushPermissionGranted}
                        remotePushPreferences={remotePushPreferences}
                        pushPreferencesLoading={pushPreferencesLoading}
                        savingPushPreference={savingPushPreference}
                        onToggleRemotePushPreference={handleToggleRemotePushPreference}
                    />
                );
            case 'safety':
                return <SafetySection />;
            case 'help':
                return <HelpPoliciesSection openModal={openModal} />;
            case 'danger':
                return <DangerZoneSection onSignOut={handleSignOut} openModal={openModal} />;
            default:
                return <SecuritySection user={user} openModal={openModal} />;
        }
    };

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text pb-24 font-sans">
            {/* Sticky header */}
            <div ref={headerRef} className="sticky top-0 z-50 border-b border-claude-border/60 bg-claude-bg/88 safe-area-top md:backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3.5 sm:items-center sm:gap-4 sm:py-4 lg:px-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="tap-action touch-target rounded-full border border-claude-border/70 bg-claude-surface/80 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-accent active:scale-95"
                    >
                        <ArrowLeft className="w-5 h-5 text-claude-text" />
                    </button>

                    <div className="min-w-0 flex-1">
                        <h1 className="font-serif text-[2rem] font-semibold italic leading-none tracking-[-0.04em] text-claude-text sm:text-[2.8rem]">
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

            {/* Main layout */}
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Navigation */}
                    <SettingsNav
                        sections={SETTINGS_SECTIONS}
                        activeSection={activeSection}
                        onSectionChange={setActiveSection}
                        sidebarExpanded={sidebarExpanded}
                        onToggleSidebar={() => setSidebarExpanded(prev => !prev)}
                    />

                    {/* Content panel */}
                    <div className="min-w-0 flex-1">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeSection}
                                role="tabpanel"
                                id={`${activeSection}-panel`}
                                aria-labelledby={`${activeSection}-tab`}
                                {...sectionTransition}
                            >
                                {renderActiveSection()}
                            </motion.div>
                        </AnimatePresence>

                        {/* Footer */}
                        <div className="pb-4 pt-8 text-center opacity-40">
                            <Leaf className="w-6 h-6 text-claude-accent mx-auto mb-3" />
                            <p className="text-[10px] text-claude-secondary font-mono tracking-widest uppercase">
                                Riven OS v1.0.0
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ChangePasswordModal isOpen={modals.password} onClose={() => closeModal('password')} />
            <TwoFactorAuthModal isOpen={modals.twoFactor} onClose={() => closeModal('twoFactor')} />
            <DeleteAccountModal isOpen={modals.delete} onClose={() => closeModal('delete')} />
            <FeedbackModal isOpen={modals.feedback} onClose={() => closeModal('feedback')} />
            <PricingModal isOpen={modals.pricing} onClose={() => closeModal('pricing')} currentTier={user?.subscription_tier || 'free'} />
        </div>
    );
}
