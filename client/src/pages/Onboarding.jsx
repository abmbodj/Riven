import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { UIContext } from '../context/UIContext';
import {
    userNeedsOnboarding,
    canUseOnboardingFunnel,
} from '../utils/onboardingGate';
import { trackOnboarding } from '../utils/onboardingAnalytics';
import { subscribeMediaQueryList } from '../utils/matchMediaSubscribe';
import { registerSchema } from '../schemas/auth';
import ProfilePictureStep from '../components/onboarding/ProfilePictureStep';
import AccountStep from '../components/onboarding/AccountStep';

const CHOICE_STEPS = [
    {
        id: 'focus',
        type: 'choice',
        eyebrow: 'Your goal',
        title: { lead: 'What brings you', highlight: 'to Riven', tail: '?' },
        description: 'Pick the one that matches where you are right now.',
        options: [
            { id: 'cards', eyebrow: 'Flashcards', label: 'I want to turn my notes into flashcard decks', shortLabel: 'Flashcards' },
            { id: 'habit', eyebrow: 'Habit', label: 'I need to build a consistent study routine', shortLabel: 'Routine' },
            { id: 'exams', eyebrow: 'Exams', label: 'I have an upcoming exam I need to ace', shortLabel: 'Exam prep' },
            { id: 'organize', eyebrow: 'Organization', label: 'My study material is all over the place', shortLabel: 'Organization' },
        ],
    },
    {
        id: 'material',
        type: 'choice',
        eyebrow: 'Your toolkit',
        title: { lead: 'What do you', highlight: 'usually study', tail: 'from?' },
        description: 'Choose whatever you reach for most.',
        options: [
            { id: 'audio', eyebrow: 'Audio', label: 'Lecture recordings or podcasts', shortLabel: 'Audio' },
            { id: 'slides', eyebrow: 'Files', label: 'Slides, PDFs, or syllabi', shortLabel: 'Slides' },
            { id: 'notes', eyebrow: 'Notes', label: 'My handwritten or typed notes', shortLabel: 'Notes' },
            { id: 'existing', eyebrow: 'Sets', label: 'Decks and practice sets I already made', shortLabel: 'Existing sets' },
        ],
    },
    {
        id: 'friction',
        type: 'choice',
        eyebrow: 'Your roadblock',
        title: { lead: 'What gets in the way of', highlight: 'actually studying', tail: '?' },
        description: 'Be honest — we built features for exactly this.',
        finalPrimary: 'Take me to Riven',
        options: [
            { id: 'starting', eyebrow: 'Starting', label: 'Finding the motivation to begin', shortLabel: 'Getting started' },
            { id: 'scatter', eyebrow: 'Organization', label: 'Keeping all my material in one place', shortLabel: 'Scattered material' },
            { id: 'review', eyebrow: 'Recall', label: 'Knowing what to review and when', shortLabel: 'Review order' },
            { id: 'switching', eyebrow: 'Focus', label: 'Juggling too many classes at once', shortLabel: 'Context switching' },
        ],
    },
];

const AVATAR_STEP = {
    id: 'avatar',
    type: 'avatar',
    eyebrow: 'Make it yours',
    title: { lead: 'Pick a', highlight: 'profile picture', tail: '' },
    description: 'Choose a look or upload your own. You can change it anytime.',
};

const ACCOUNT_STEP = {
    id: 'account',
    type: 'account',
    eyebrow: 'Last step',
    title: { lead: 'Create your', highlight: 'account', tail: '' },
    description: 'Save your setup and pick up on any device.',
};

const FUNNEL_STEPS = [...CHOICE_STEPS, AVATAR_STEP, ACCOUNT_STEP];

const STASH_KEY = 'riven_onboarding_funnel_stash';

const writeStash = (data) => {
    try { localStorage.setItem(STASH_KEY, JSON.stringify(data)); } catch { /* quota */ }
};
const readStash = () => {
    try { const v = localStorage.getItem(STASH_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
};
const clearStash = () => {
    try { localStorage.removeItem(STASH_KEY); } catch { /* ignore */ }
};

const createDefaultAnswers = () =>
    Object.fromEntries(CHOICE_STEPS.map((screen) => [screen.id, screen.options[0]?.id ?? null]));

const deriveUsername = (displayName, email) => {
    const base = (displayName || email.split('@')[0] || 'student');
    let cleaned = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
    if (cleaned.length < 2) cleaned = 'student';
    return `${cleaned}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30);
};

export default function Onboarding() {
    const navigate = useNavigate();
    const toast = useToast();
    const { user, loading, signUp, updateProfile, saveOnboardingProgress } = useAuth();
    const ui = useContext(UIContext);
    const hideNav = ui?.hideNav;
    const showBottomNav = ui?.showBottomNav;

    // Whether this client *entered* as the logged-out signup funnel. Decided once auth has
    // finished loading (so a logged-in refresh isn't misread as logged-out) and then frozen
    // in a ref so it doesn't flip when account creation sets `user` mid-finalize.
    const decidedRef = useRef(false);
    const enteredAsFunnelRef = useRef(false);
    if (!loading && !decidedRef.current) {
        decidedRef.current = true;
        enteredAsFunnelRef.current = !user?.id && canUseOnboardingFunnel();
    }
    const isFunnel = enteredAsFunnelRef.current;
    const steps = useMemo(() => (isFunnel ? FUNNEL_STEPS : CHOICE_STEPS), [isFunnel]);
    const stepCount = steps.length;

    const initialStep = useMemo(() => {
        if (isFunnel) return 0;
        const persistedStep = Number(user?.onboardingStep);
        if (Number.isFinite(persistedStep) && persistedStep >= 0 && persistedStep < CHOICE_STEPS.length) {
            return persistedStep;
        }
        return 0;
    }, [isFunnel, user?.onboardingStep]);

    const [step, setStep] = useState(initialStep);
    const [answers, setAnswers] = useState(() => createDefaultAnswers());
    const [avatar, setAvatar] = useState(null);
    const [account, setAccount] = useState({ displayName: '', email: '', password: '' });
    const [accountError, setAccountError] = useState('');
    const [busy, setBusy] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [compactHeight, setCompactHeight] = useState(false);

    const flushedRef = useRef(false);
    const latestRef = useRef({ avatar: null, displayName: '' });
    latestRef.current = { avatar, displayName: account.displayName };

    useEffect(() => {
        if (!isFunnel) setStep(initialStep);
    }, [isFunnel, initialStep]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        return subscribeMediaQueryList(mq, () => setReducedMotion(mq.matches));
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(max-height: 760px)');
        setCompactHeight(mq.matches);
        return subscribeMediaQueryList(mq, () => setCompactHeight(mq.matches));
    }, []);

    useEffect(() => {
        hideNav?.();
        return () => showBottomNav?.();
    }, [hideNav, showBottomNav]);

    // Desktop logged-out users keep the classic signup form.
    useEffect(() => {
        if (loading) return;
        if (!user?.id && !canUseOnboardingFunnel()) {
            navigate('/account?mode=signup', { replace: true });
        }
    }, [loading, user?.id, navigate]);

    // Already-onboarded users who land here directly go to the dashboard.
    useEffect(() => {
        if (loading) return;
        if (user?.id && !userNeedsOnboarding(user) && !enteredAsFunnelRef.current && !readStash() && !flushedRef.current) {
            navigate('/dashboard', { replace: true });
        }
    }, [loading, user, navigate]);

    // Funnel completion: once an account exists (email signup or OAuth, incl. web redirect
    // return via the stash), persist the collected profile + mark onboarding done.
    useEffect(() => {
        if (!user?.id || flushedRef.current) return;
        const stash = readStash();
        if (!enteredAsFunnelRef.current && !stash) return;

        flushedRef.current = true;
        setSubmitting(true);
        (async () => {
            try {
                const avatarVal = stash?.avatar ?? latestRef.current.avatar;
                const nameVal = stash?.displayName ?? latestRef.current.displayName;
                const updates = {};
                if (avatarVal) updates.avatar = avatarVal;
                if (nameVal && nameVal.trim()) updates.displayName = nameVal.trim();
                if (Object.keys(updates).length) {
                    await updateProfile(updates).catch((err) => console.error('[Onboarding] profile flush failed', err));
                }
                await saveOnboardingProgress({ markComplete: true }).catch((err) => console.error('[Onboarding] complete failed', err));
            } finally {
                clearStash();
                navigate('/dashboard', { replace: true });
            }
        })();
    }, [user?.id, updateProfile, saveOnboardingProgress, navigate]);

    useEffect(() => {
        trackOnboarding('onboarding_screen_view', { step });
    }, [step]);

    const persist = useCallback(
        async (payload) => {
            setBusy(true);
            try {
                await saveOnboardingProgress(payload);
            } catch (err) {
                console.error('[Onboarding] persist failed', err);
                toast.error('Couldn’t save progress. Try again.');
                throw err;
            } finally {
                setBusy(false);
            }
        },
        [saveOnboardingProgress, toast],
    );

    const finishToDashboard = useCallback(
        async (trackName) => {
            try {
                await persist({ markComplete: true });
                trackOnboarding(trackName, { path: '/dashboard' });
                navigate('/dashboard', { replace: true });
            } catch { /* toast handled in persist */ }
        },
        [navigate, persist],
    );

    const skip = useCallback(async () => {
        if (isFunnel) {
            trackOnboarding('onboarding_skip_to_account', { step });
            setStep(stepCount - 1);
            return;
        }
        trackOnboarding('onboarding_skip_all', { step });
        await finishToDashboard('onboarding_complete');
    }, [isFunnel, step, stepCount, finishToDashboard]);

    const goBack = useCallback(async () => {
        if (step === 0) {
            navigate(isFunnel ? '/' : '/dashboard', { replace: true });
            return;
        }
        const previous = step - 1;
        if (isFunnel) { setStep(previous); return; }
        try { await persist({ nextStep: previous }); setStep(previous); } catch { /* handled */ }
    }, [isFunnel, navigate, persist, step]);

    const goNext = useCallback(async () => {
        trackOnboarding('onboarding_continue', { fromStep: step });
        const next = Math.min(step + 1, stepCount - 1);
        if (isFunnel) { setStep(next); return; }
        try { await persist({ nextStep: next }); setStep(next); } catch { /* handled */ }
    }, [isFunnel, persist, step, stepCount]);

    const submitAccount = useCallback(async () => {
        setAccountError('');
        const email = account.email.trim();
        const username = deriveUsername(account.displayName.trim(), email);
        const parsed = registerSchema.safeParse({ username, email, password: account.password });
        if (!parsed.success) {
            setAccountError(parsed.error.errors[0]?.message || 'Please check your details.');
            return;
        }
        setSubmitting(true);
        trackOnboarding('onboarding_account_submit', {});
        try {
            await signUp(username, email, account.password);
            // The funnel-completion effect flushes profile + marks complete, then navigates.
        } catch (err) {
            console.error('[Onboarding] signup failed', err);
            setSubmitting(false);
            setAccountError(err?.message || err?.error || 'Could not create your account. Try again.');
        }
    }, [account, signUp]);

    const onPrimary = useCallback(async () => {
        const screen = steps[Math.min(step, stepCount - 1)];
        if (screen.type === 'account') { await submitAccount(); return; }
        if (step < stepCount - 1) { await goNext(); return; }
        await finishToDashboard('onboarding_complete');
    }, [steps, step, stepCount, submitAccount, goNext, finishToDashboard]);

    const setAnswer = useCallback((screenId, optionId) => {
        setAnswers((current) => ({ ...current, [screenId]: optionId }));
    }, []);

    const handleBeforeOAuth = useCallback(() => {
        writeStash({ avatar, displayName: account.displayName, answers });
    }, [avatar, account.displayName, answers]);

    // Guard render: desktop logged-out / already-onboarded are redirected by effects above.
    if (loading) return null;
    if (!user?.id && !canUseOnboardingFunnel()) return null;
    if (user?.id && !isFunnel && !userNeedsOnboarding(user)) return null;

    const safeStep = Math.min(step, stepCount - 1);
    const screen = steps[safeStep];
    const selectedAnswerId = answers[screen.id];
    const progress = ((safeStep + 1) / stepCount) * 100;
    const isAccountStep = screen.type === 'account';
    const primaryLabel = isAccountStep
        ? 'Create account'
        : safeStep === stepCount - 1
            ? (screen.finalPrimary || 'Finish')
            : 'Continue';
    const primaryBusy = busy || submitting;

    const containerVariants = reducedMotion
        ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
        : {
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
              exit: { opacity: 0, transition: { duration: 0.2 } },
          };

    const itemVariants = reducedMotion
        ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
        : {
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
          };

    const rootEntrance = reducedMotion
        ? {}
        : {
              initial: { opacity: 0, y: 14, scale: 0.985 },
              animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 240, damping: 28 } },
          };

    return (
        <motion.div
            {...rootEntrance}
            className="relative min-h-dvh w-full max-w-lg mx-auto overflow-hidden bg-claude-bg text-claude-text"
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    animate={reducedMotion ? {} : { y: [0, -20, 0], scale: [1, 1.05, 1], opacity: [0.8, 0.6, 0.8] }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-1/2 top-[-8rem] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full blur-3xl opacity-80"
                    style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-color) 18%, transparent) 0%, transparent 62%)' }}
                />
                <motion.div
                    animate={reducedMotion ? {} : { y: [0, 20, 0], x: [0, -15, 0], opacity: [0.6, 0.4, 0.6] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                    className="absolute right-[-5rem] top-[20%] h-[18rem] w-[18rem] rounded-full blur-3xl opacity-60"
                    style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--botanical-forest) 18%, transparent) 0%, transparent 64%)' }}
                />
                <motion.div
                    animate={reducedMotion ? {} : { y: [0, -15, 0], x: [0, 15, 0], opacity: [0.5, 0.3, 0.5] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
                    className="absolute bottom-[-9rem] left-[-4rem] h-[18rem] w-[18rem] rounded-full blur-3xl opacity-50"
                    style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--secondary-text-color) 18%, transparent) 0%, transparent 64%)' }}
                />
            </div>

            {submitting ? (
                <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
                    <Loader2 className="h-9 w-9 animate-spin text-claude-accent" />
                    <p className="font-display text-xl tracking-[-0.03em] text-botanical-parchment">Setting up your space…</p>
                    <p className="max-w-[16rem] text-[13px] text-claude-secondary">Saving your answers and getting Riven ready.</p>
                </div>
            ) : (
            <div className="relative z-10 flex min-h-dvh flex-col">
                <header className={`shrink-0 px-5 safe-area-top ${compactHeight ? 'pt-2 pb-3' : 'pt-3 pb-4'}`}>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => !primaryBusy && goBack()}
                            disabled={primaryBusy}
                            aria-label={safeStep === 0 ? 'Close onboarding' : 'Go back'}
                            className={`touch-target rounded-full border border-white/10 bg-white/[0.05] text-botanical-parchment transition-all duration-200 hover:border-white/15 hover:bg-white/[0.08] disabled:opacity-30 ${compactHeight ? 'h-10 w-10' : 'h-11 w-11'}`}
                        >
                            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
                        </button>

                        <div
                            className="relative h-3 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]"
                            role="progressbar"
                            aria-valuemin={1}
                            aria-valuemax={stepCount}
                            aria-valuenow={safeStep + 1}
                            aria-label={`Step ${safeStep + 1} of ${stepCount}`}
                        >
                            <motion.div
                                className="absolute inset-y-0 left-0 rounded-full"
                                animate={{ width: `${progress}%` }}
                                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                    background: 'linear-gradient(90deg, color-mix(in srgb, var(--botanical-forest) 55%, var(--accent-color)) 0%, var(--accent-color) 100%)',
                                    boxShadow: '0 0 22px color-mix(in srgb, var(--accent-color) 26%, transparent)',
                                }}
                            />
                        </div>

                        {isAccountStep ? (
                            <span className="min-w-[48px]" aria-hidden="true" />
                        ) : (
                            <button
                                type="button"
                                onClick={() => !primaryBusy && skip()}
                                disabled={primaryBusy}
                                className="min-w-[48px] text-right font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-white disabled:opacity-40"
                            >
                                Skip
                            </button>
                        )}
                    </div>
                </header>

                <div className={`flex min-h-0 flex-1 flex-col px-5 ${compactHeight ? 'pb-2' : 'pb-3'} ${isAccountStep ? 'overflow-y-auto' : ''}`}>
                    <AnimatePresence mode="wait">
                        <motion.section
                            key={screen.id}
                            data-testid="onboarding-main-layout"
                            className={`flex flex-1 flex-col ${compactHeight ? 'pt-1' : 'pt-2'}`}
                            variants={containerVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            <div className={`flex flex-col ${compactHeight ? 'gap-3' : 'gap-4'}`}>
                                <div className={`mx-auto text-center ${compactHeight ? 'max-w-[19rem]' : 'max-w-[20.5rem]'}`}>
                                    <motion.p variants={itemVariants} className={`font-mono font-semibold uppercase tracking-[0.22em] text-claude-secondary ${compactHeight ? 'mb-2 text-[9px]' : 'mb-3 text-[10px]'}`}>
                                        {screen.eyebrow} · Step {safeStep + 1} of {stepCount}
                                    </motion.p>
                                    <motion.h1 variants={itemVariants} className={`font-display font-semibold tracking-[-0.05em] text-botanical-parchment ${compactHeight ? 'text-[clamp(2.1rem,8.5vw,3rem)] leading-[0.93]' : 'text-[clamp(2.35rem,9.3vw,3.35rem)] leading-[0.92]'}`}>
                                        <span className="block">{screen.title.lead}</span>
                                        <span className="block">
                                            <span className="text-claude-accent">{screen.title.highlight}</span>
                                            {screen.title.tail ? ` ${screen.title.tail}` : ''}
                                        </span>
                                    </motion.h1>
                                    <motion.p variants={itemVariants} className={`mx-auto text-claude-secondary ${compactHeight ? 'mt-2 max-w-[17.5rem] text-[12px] leading-4' : 'mt-3 max-w-[19rem] text-[13px] leading-5'}`}>
                                        {screen.description}
                                    </motion.p>
                                </div>

                                {screen.type === 'choice' ? (
                                    <div className={`grid ${compactHeight ? 'gap-2.5' : 'gap-3'}`}>
                                        {screen.options.map((option) => {
                                            const isSelected = selectedAnswerId === option.id;
                                            return (
                                                <motion.button
                                                    variants={itemVariants}
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => setAnswer(screen.id, option.id)}
                                                    disabled={primaryBusy}
                                                    aria-pressed={isSelected}
                                                    className={`group relative w-full overflow-hidden border text-left transition-all duration-300 active:scale-[0.98] disabled:opacity-70 ${compactHeight ? 'rounded-[1.2rem] px-3.5 py-3' : 'rounded-[1.35rem] px-4 py-3.5'}`}
                                                    style={{
                                                        borderColor: isSelected
                                                            ? 'color-mix(in srgb, var(--accent-color) 58%, rgba(255,255,255,0.25))'
                                                            : 'rgba(255,255,255,0.06)',
                                                        background: isSelected
                                                            ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%), linear-gradient(155deg, color-mix(in srgb, var(--surface-color) 90%, transparent) 0%, color-mix(in srgb, var(--bg-color) 78%, transparent) 100%)'
                                                            : 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(155deg, color-mix(in srgb, var(--surface-color) 70%, transparent) 0%, color-mix(in srgb, var(--bg-color) 64%, transparent) 100%)',
                                                        boxShadow: isSelected
                                                            ? '0 20px 40px -24px color-mix(in srgb, var(--accent-color) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.2)'
                                                            : '0 12px 24px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300"
                                                            style={{
                                                                borderColor: isSelected ? 'color-mix(in srgb, var(--accent-color) 80%, transparent)' : 'rgba(255,255,255,0.15)',
                                                                backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent-color) 85%, transparent)' : 'rgba(0,0,0,0.2)',
                                                                boxShadow: isSelected ? '0 0 12px color-mix(in srgb, var(--accent-color) 40%, transparent)' : 'none',
                                                            }}
                                                        >
                                                            <div
                                                                className="h-2 w-2 rounded-full transition-transform duration-300 ease-out"
                                                                style={{ backgroundColor: isSelected ? 'var(--botanical-ink)' : 'transparent', transform: isSelected ? 'scale(1)' : 'scale(0)' }}
                                                            />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-claude-secondary">
                                                                {option.eyebrow}
                                                            </p>
                                                            <p className={`mt-1 font-display tracking-[-0.028em] text-botanical-parchment ${compactHeight ? 'text-[1.02rem] leading-[1.02]' : 'text-[1.12rem] leading-[1.04]'}`}>
                                                                {option.label}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                {screen.type === 'avatar' ? (
                                    <motion.div variants={itemVariants}>
                                        <ProfilePictureStep value={avatar} onChange={setAvatar} compactHeight={compactHeight} />
                                    </motion.div>
                                ) : null}

                                {screen.type === 'account' ? (
                                    <motion.div variants={itemVariants}>
                                        <AccountStep
                                            value={account}
                                            onChange={setAccount}
                                            error={accountError}
                                            onOAuthError={(err) => setAccountError(err?.message || 'Sign-in failed. Try again.')}
                                            onBeforeOAuth={handleBeforeOAuth}
                                        />
                                    </motion.div>
                                ) : null}
                            </div>
                        </motion.section>
                    </AnimatePresence>

                    <motion.div
                        variants={itemVariants}
                        className={`relative shrink-0 ${compactHeight ? 'pt-2' : 'pt-3'}`}
                        style={{ paddingBottom: compactHeight ? 'calc(env(safe-area-inset-bottom, 0px) + 0.9rem)' : 'calc(env(safe-area-inset-bottom, 0px) + 1.1rem)' }}
                    >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-claude-bg" />
                        <button
                            type="button"
                            disabled={primaryBusy}
                            onClick={() => !primaryBusy && onPrimary()}
                            className={`relative w-full overflow-hidden transition-all duration-300 active:scale-[0.97] disabled:opacity-60 ${compactHeight ? 'rounded-[1.35rem] px-5 py-3.5' : 'rounded-[1.6rem] px-5 py-4'}`}
                            style={{
                                background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 88%, white 8%) 0%, color-mix(in srgb, var(--botanical-forest) 58%, var(--accent-color)) 100%)',
                                boxShadow: '0 28px 50px -24px color-mix(in srgb, var(--accent-color) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
                            }}
                        >
                            <span className={`font-mono font-bold uppercase tracking-[0.24em] text-botanical-ink ${compactHeight ? 'text-[11px]' : 'text-[12px]'}`}>
                                {primaryBusy ? (isAccountStep ? 'Creating' : 'Saving') : primaryLabel}
                            </span>
                            <span className={`absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ${compactHeight ? 'h-9 w-9' : 'h-10 w-10'}`}>
                                {primaryBusy ? (
                                    <Loader2 className={`${compactHeight ? 'h-4 w-4' : 'h-5 w-5'} animate-spin text-botanical-ink`} />
                                ) : (
                                    <ArrowRight className={`${compactHeight ? 'h-4 w-4' : 'h-5 w-5'} text-botanical-ink`} strokeWidth={2.6} />
                                )}
                            </span>
                        </button>
                    </motion.div>
                </div>
            </div>
            )}
        </motion.div>
    );
}
