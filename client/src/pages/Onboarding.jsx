import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { UIContext } from '../context/UIContext';
import {
    userNeedsOnboarding,
    canUseOnboardingFunnel,
    setOnboardingMaterial,
} from '../utils/onboardingGate';
import { trackOnboarding } from '../utils/onboardingAnalytics';
import { subscribeMediaQueryList } from '../utils/matchMediaSubscribe';
import { registerSchema } from '../schemas/auth';
import { generateDeckPreview, savePreviewDeck } from '../api/onboardingApi';
import useHaptics from '../hooks/useHaptics';
import TopicStep from '../components/onboarding/TopicStep';
import TasteStudyStep, { TASTE_TARGET } from '../components/onboarding/TasteStudyStep';
import CapabilitiesRevealStep from '../components/onboarding/CapabilitiesRevealStep';
import AccountStep from '../components/onboarding/AccountStep';
import CanvasConnectFlow from '../components/canvas/CanvasConnectFlow';

// Activation-first flow (see docs / plan): deliver the magic (typed topic → real deck → a taste
// of studying) BEFORE asking for an account, then use that artifact as the reason to sign up.
// Funnel (logged-out) gets the account wall; an already-signed-in user needing onboarding skips it.
const FUNNEL_STEP_IDS = ['promise', 'topic', 'generate', 'taste', 'account', 'canvas', 'capabilities'];
const SIGNED_IN_STEP_IDS = ['promise', 'topic', 'generate', 'taste', 'canvas', 'capabilities'];

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

const deriveUsername = (displayName, email) => {
    const base = (displayName || email.split('@')[0] || 'student');
    let cleaned = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
    if (cleaned.length < 2) cleaned = 'student';
    return `${cleaned}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30);
};

// Per-screen copy. Some titles reflect the user's own input back to them (second-person framing).
const getCopy = (id, { topic, cardCount, isFunnel }) => {
    switch (id) {
        case 'promise':
            return {
                eyebrow: 'Welcome to Riven',
                title: { lead: 'Drop in any subject —', highlight: 'walk out ready', tail: '' },
                description: "Type what you're studying and Riven builds you a study set in seconds. No uploads, no setup.",
            };
        case 'topic':
            return {
                eyebrow: 'Your topic',
                title: { lead: 'What are you', highlight: 'studying', tail: 'right now?' },
                description: "A class, a chapter, a concept — anything. We'll turn it into flashcards.",
            };
        case 'generate':
            return {
                eyebrow: 'Building your set',
                title: { lead: 'Turning that into', highlight: 'your cards', tail: '' },
                description: topic ? `“${topic}”` : 'Give us a few seconds.',
            };
        case 'taste':
            return {
                eyebrow: 'Your first cards',
                title: { lead: "Here's your", highlight: cardCount ? `${cardCount}-card` : 'first', tail: 'set' },
                description: 'Tap to reveal, then rate yourself. This is real spaced repetition.',
            };
        case 'account':
            return {
                eyebrow: 'Save your work',
                title: { lead: 'Keep your', highlight: 'deck', tail: '' },
                description: 'Create a free account to save this deck and start your streak.',
            };
        case 'canvas':
            return {
                eyebrow: 'Import your schedule',
                title: { lead: 'Auto-fill from', highlight: 'Canvas', tail: '' },
                description: "Connect your school's Canvas to pull in classes and assignments automatically.",
            };
        case 'capabilities':
            return {
                eyebrow: isFunnel ? "You're in" : 'One more thing',
                title: { lead: 'Riven also', highlight: 'does this', tail: '' },
                description: "Pick what you'll reach for most — we'll set up your home around it.",
            };
        default:
            return { eyebrow: '', title: { lead: '', highlight: '', tail: '' }, description: '' };
    }
};

export default function Onboarding() {
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { user, loading, signUp, saveOnboardingProgress } = useAuth();
    const ui = useContext(UIContext);
    const hideNav = ui?.hideNav;
    const showBottomNav = ui?.showBottomNav;

    // Freeze whether this client *entered* as the logged-out signup funnel, decided once auth
    // settles so a logged-in refresh isn't misread (and doesn't flip mid-finalize).
    const decidedRef = useRef(false);
    const enteredAsFunnelRef = useRef(false);
    if (!loading && !decidedRef.current) {
        decidedRef.current = true;
        enteredAsFunnelRef.current = !user?.id && canUseOnboardingFunnel();
    }
    const isFunnel = enteredAsFunnelRef.current;
    const stepIds = useMemo(() => (isFunnel ? FUNNEL_STEP_IDS : SIGNED_IN_STEP_IDS), [isFunnel]);
    const stepCount = stepIds.length;
    const capabilitiesIndex = stepIds.indexOf('capabilities');

    const [step, setStep] = useState(0);
    const [topic, setTopic] = useState('');
    const [genStatus, setGenStatus] = useState('idle'); // idle | loading | done | error
    const [genAttempt, setGenAttempt] = useState(0); // bump to (re)trigger generation
    const [genError, setGenError] = useState('');
    const [previewCards, setPreviewCards] = useState([]);
    const [deckName, setDeckName] = useState('');
    const [answeredCount, setAnsweredCount] = useState(0);
    const [material, setMaterial] = useState(null);
    const [remindersOn, setRemindersOn] = useState(true);
    const [account, setAccount] = useState({ displayName: '', email: '', password: '' });
    const [accountError, setAccountError] = useState('');
    const [busy, setBusy] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [compactHeight, setCompactHeight] = useState(false);

    const flushedRef = useRef(false);
    const finalizeRef = useRef({ deckSaved: false, completed: false });
    // useHaptics() returns a fresh object each render; keep a stable ref so effects can fire
    // feedback without re-subscribing (and cancelling their own in-flight work).
    const hapticsRef = useRef(haptics);
    hapticsRef.current = haptics;
    // Mirror latest values so the post-signup flush effect (which only depends on user.id) reads
    // fresh data without re-subscribing.
    const latestRef = useRef({});
    latestRef.current = { topic, previewCards, deckName, material };

    const currentId = stepIds[Math.min(step, stepCount - 1)];

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

    useEffect(() => {
        trackOnboarding('onboarding_screen_view', { step, id: currentId });
    }, [step, currentId]);

    // Persist the previewed deck + material + completion once a session exists. Idempotent.
    const persistDeckAndComplete = useCallback(async () => {
        const stash = readStash();
        const cards = latestRef.current.previewCards?.length ? latestRef.current.previewCards : (stash?.previewCards || []);
        const name = latestRef.current.deckName || stash?.deckName || latestRef.current.topic || stash?.topic;
        const mat = latestRef.current.material || stash?.material;
        if (mat) setOnboardingMaterial(mat);

        if (!finalizeRef.current.deckSaved && cards.length) {
            finalizeRef.current.deckSaved = true;
            try {
                await savePreviewDeck(name, cards);
                trackOnboarding('preview_deck_saved', { cardCount: cards.length });
            } catch (err) {
                finalizeRef.current.deckSaved = false;
                console.error('[Onboarding] save preview deck failed', err);
            }
        }

        if (!finalizeRef.current.completed) {
            finalizeRef.current.completed = true;
            await saveOnboardingProgress({ markComplete: true }).catch((err) => {
                finalizeRef.current.completed = false;
                console.error('[Onboarding] mark complete failed', err);
            });
        }
        clearStash();
    }, [saveOnboardingProgress]);

    // Funnel completion: once an account exists (email signup or OAuth redirect return via the
    // stash), persist the deck + mark complete, then surface the capabilities reveal (peak-end)
    // rather than dropping straight to the dashboard.
    useEffect(() => {
        if (!user?.id || flushedRef.current) return;
        const stash = readStash();
        if (!enteredAsFunnelRef.current && !stash) return;

        flushedRef.current = true;
        setSubmitting(true);
        (async () => {
            await persistDeckAndComplete();
            setSubmitting(false);
            setStep(capabilitiesIndex >= 0 ? capabilitiesIndex : stepCount - 1);
        })();
    }, [user?.id, persistDeckAndComplete, capabilitiesIndex, stepCount]);

    // Kick off the anonymous preview generation when the user reaches the generate screen (or
    // retries). genStatus is intentionally NOT a dep — it's set inside, and including it would
    // re-run the effect and cancel its own in-flight request.
    useEffect(() => {
        if (currentId !== 'generate') return;
        const value = topic.trim();
        if (!value) { setStep((s) => Math.max(0, s - 1)); return; }
        // Already generated for this topic (e.g. returning from a later step): keep the result.
        if (latestRef.current.previewCards?.length) { setGenStatus('done'); return; }

        let cancelled = false;
        setGenStatus('loading');
        setGenError('');
        trackOnboarding('preview_generating', {});
        (async () => {
            try {
                const data = await generateDeckPreview(value);
                if (cancelled) return;
                const cards = Array.isArray(data?.cards) ? data.cards : [];
                if (!cards.length) throw new Error("We couldn't build a set for that. Try a more specific topic.");
                setPreviewCards(cards);
                setDeckName(data.deckName || value);
                setGenStatus('done');
                hapticsRef.current.success();
                trackOnboarding('preview_generated', { cardCount: cards.length });
            } catch (err) {
                if (cancelled) return;
                setGenError(err?.message || 'Something went wrong building your set.');
                setGenStatus('error');
            }
        })();
        return () => { cancelled = true; };
    }, [currentId, topic, genAttempt]);

    const persist = useCallback(
        async (payload) => {
            setBusy(true);
            try {
                await saveOnboardingProgress(payload);
            } catch (err) {
                console.error('[Onboarding] persist failed', err);
                toast.error("Couldn't save progress. Try again.");
                throw err;
            } finally {
                setBusy(false);
            }
        },
        [saveOnboardingProgress, toast],
    );

    const handleTopicChange = useCallback((value) => {
        setTopic(value);
        // Editing the topic invalidates any prior generation.
        setGenStatus('idle');
        setPreviewCards([]);
        setAnsweredCount(0);
    }, []);

    const handleSelectMaterial = useCallback((value) => {
        haptics.selection();
        setMaterial(value);
        setOnboardingMaterial(value);
        trackOnboarding('material_selected', { material: value });
    }, [haptics]);

    const goNext = useCallback(() => {
        trackOnboarding('onboarding_continue', { fromStep: step, id: currentId });
        setStep((s) => Math.min(s + 1, stepCount - 1));
    }, [step, currentId, stepCount]);

    const goBack = useCallback(() => {
        if (step === 0) {
            navigate(isFunnel ? '/' : '/dashboard', { replace: true });
            return;
        }
        setStep((s) => Math.max(0, s - 1));
    }, [isFunnel, navigate, step]);

    const skip = useCallback(async () => {
        if (isFunnel) {
            trackOnboarding('onboarding_skip_to_account', { step });
            const accountIdx = stepIds.indexOf('account');
            setStep(accountIdx >= 0 ? accountIdx : stepCount - 1);
            return;
        }
        trackOnboarding('onboarding_skip_all', { step });
        try {
            finalizeRef.current.completed = true;
            await persist({ markComplete: true });
            navigate('/dashboard', { replace: true });
        } catch { /* toast handled in persist */ }
    }, [isFunnel, step, stepIds, stepCount, persist, navigate]);

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
            // The post-signup flush effect persists the deck + advances to the capabilities reveal.
        } catch (err) {
            console.error('[Onboarding] signup failed', err);
            setSubmitting(false);
            setAccountError(err?.message || err?.error || 'Could not create your account. Try again.');
        }
    }, [account, signUp]);

    const finishToDashboard = useCallback(async () => {
        setBusy(true);
        try {
            await persistDeckAndComplete();
            trackOnboarding('onboarding_complete', { path: '/dashboard' });
            navigate('/dashboard', { replace: true });
        } finally {
            setBusy(false);
        }
    }, [persistDeckAndComplete, navigate]);

    const onPrimary = useCallback(async () => {
        switch (currentId) {
            case 'promise':
            case 'topic':
                goNext();
                return;
            case 'generate':
                if (genStatus === 'error') { setGenStatus('idle'); setGenAttempt((a) => a + 1); return; }
                if (genStatus === 'done') { goNext(); }
                return;
            case 'taste':
                if (isFunnel) { goNext(); return; }
                // Already signed in: save the deck now, then show the reveal.
                setBusy(true);
                try { await persistDeckAndComplete(); goNext(); } finally { setBusy(false); }
                return;
            case 'account':
                await submitAccount();
                return;
            case 'canvas':
                goNext();
                return;
            case 'capabilities':
                await finishToDashboard();
                return;
            default:
                return;
        }
    }, [currentId, genStatus, isFunnel, goNext, persistDeckAndComplete, submitAccount, finishToDashboard]);

    const onTasteAnswer = useCallback((knew) => {
        setAnsweredCount((c) => {
            const next = c + 1;
            trackOnboarding('card_answered', { count: next, knew });
            return next;
        });
    }, []);

    const handleBeforeOAuth = useCallback(() => {
        writeStash({
            displayName: account.displayName,
            topic: latestRef.current.topic,
            deckName: latestRef.current.deckName,
            previewCards: latestRef.current.previewCards,
            material: latestRef.current.material,
        });
    }, [account.displayName]);

    // Guard render: desktop logged-out / already-onboarded are redirected by effects above.
    if (loading) return null;
    if (!user?.id && !canUseOnboardingFunnel()) return null;
    if (user?.id && !isFunnel && !userNeedsOnboarding(user) && !flushedRef.current) return null;

    const safeStep = Math.min(step, stepCount - 1);
    const copy = getCopy(currentId, { topic: topic.trim(), cardCount: Math.min(TASTE_TARGET, previewCards.length), isFunnel });
    const progress = ((safeStep + 1) / stepCount) * 100;
    const isAccountStep = currentId === 'account';
    const scrollable = currentId === 'account' || currentId === 'taste' || currentId === 'capabilities';
    const tasteTarget = Math.min(TASTE_TARGET, previewCards.length || TASTE_TARGET);

    let primaryLabel = 'Continue';
    let primaryDisabled = false;
    if (currentId === 'promise') primaryLabel = 'Get started';
    else if (currentId === 'topic') { primaryLabel = 'Make my set'; primaryDisabled = !topic.trim(); }
    else if (currentId === 'generate') {
        if (genStatus === 'loading') { primaryLabel = 'Building your set'; primaryDisabled = true; }
        else if (genStatus === 'error') primaryLabel = 'Try again';
        else primaryLabel = 'See my cards';
    } else if (currentId === 'taste') { primaryLabel = isFunnel ? 'Save my deck' : 'Save & keep going'; primaryDisabled = answeredCount < tasteTarget; }
    else if (currentId === 'account') primaryLabel = 'Create account';
    else if (currentId === 'canvas') primaryLabel = 'Skip for now';
    else if (currentId === 'capabilities') primaryLabel = 'Start studying';

    const showSkip = currentId === 'topic' || currentId === 'canvas';
    const primaryBusy = busy || submitting || (currentId === 'generate' && genStatus === 'loading');

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
                    <p className="font-display text-xl tracking-[-0.03em] text-botanical-parchment">Saving your deck…</p>
                    <p className="max-w-[16rem] text-[13px] text-claude-secondary">Setting up your space and starting your streak.</p>
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

                        {showSkip ? (
                            <button
                                type="button"
                                onClick={() => !primaryBusy && skip()}
                                disabled={primaryBusy}
                                className="min-w-[48px] text-right font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-white disabled:opacity-40"
                            >
                                Skip
                            </button>
                        ) : (
                            <span className="min-w-[48px]" aria-hidden="true" />
                        )}
                    </div>
                </header>

                <div className={`flex min-h-0 flex-1 flex-col px-5 ${compactHeight ? 'pb-2' : 'pb-3'} ${scrollable ? 'overflow-y-auto' : ''}`}>
                    <AnimatePresence mode="wait">
                        <motion.section
                            key={currentId}
                            data-testid="onboarding-main-layout"
                            className={`flex flex-1 flex-col ${compactHeight ? 'pt-1' : 'pt-2'}`}
                            variants={containerVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            <div className={`flex flex-col ${compactHeight ? 'gap-3' : 'gap-4'} ${currentId === 'promise' ? 'flex-1 justify-center' : ''}`}>
                                <div className={`mx-auto text-center ${compactHeight ? 'max-w-[19rem]' : 'max-w-[20.5rem]'}`}>
                                    <motion.p variants={itemVariants} className={`font-mono font-semibold uppercase tracking-[0.22em] text-claude-secondary ${compactHeight ? 'mb-2 text-[9px]' : 'mb-3 text-[10px]'}`}>
                                        {copy.eyebrow} · Step {safeStep + 1} of {stepCount}
                                    </motion.p>
                                    <motion.h1 variants={itemVariants} className={`font-display font-semibold tracking-[-0.05em] text-botanical-parchment ${compactHeight ? 'text-[clamp(2.1rem,8.5vw,3rem)] leading-[0.93]' : 'text-[clamp(2.35rem,9.3vw,3.35rem)] leading-[0.92]'}`}>
                                        <span className="block">{copy.title.lead}</span>
                                        <span className="block">
                                            <span className="text-claude-accent">{copy.title.highlight}</span>
                                            {copy.title.tail ? ` ${copy.title.tail}` : ''}
                                        </span>
                                    </motion.h1>
                                    <motion.p variants={itemVariants} className={`mx-auto text-claude-secondary ${compactHeight ? 'mt-2 max-w-[17.5rem] text-[12px] leading-4' : 'mt-3 max-w-[19rem] text-[13px] leading-5'}`}>
                                        {copy.description}
                                    </motion.p>
                                </div>

                                {currentId === 'topic' ? (
                                    <motion.div variants={itemVariants}>
                                        <TopicStep
                                            value={topic}
                                            onChange={handleTopicChange}
                                            onSubmit={() => !primaryDisabled && goNext()}
                                            disabled={primaryBusy}
                                            compactHeight={compactHeight}
                                        />
                                    </motion.div>
                                ) : null}

                                {currentId === 'generate' ? (
                                    <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 py-4">
                                        {genStatus === 'error' ? (
                                            <p className="max-w-[18rem] text-center text-[13px] text-red-400">{genError}</p>
                                        ) : genStatus === 'done' ? (
                                            <motion.div
                                                initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                                                className="flex flex-col items-center gap-3 rounded-[1.6rem] border border-claude-accent/30 bg-claude-accent/[0.06] px-7 py-7 text-center"
                                            >
                                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent/20">
                                                    <Sparkles className="h-7 w-7 text-claude-accent" />
                                                </span>
                                                <p className="font-display text-[1.5rem] leading-tight tracking-[-0.03em] text-botanical-parchment">
                                                    {previewCards.length} cards, ready
                                                </p>
                                                <p className="max-w-[16rem] text-[13px] leading-5 text-claude-secondary">
                                                    Built just for “{topic.trim()}”. Let's try a few.
                                                </p>
                                            </motion.div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-4 py-6">
                                                <div className="relative h-16 w-16">
                                                    <Loader2 className="h-16 w-16 animate-spin text-claude-accent/80" />
                                                    <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-claude-accent" />
                                                </div>
                                                <p className="text-[13px] text-claude-secondary">Writing your flashcards…</p>
                                            </div>
                                        )}
                                    </motion.div>
                                ) : null}

                                {currentId === 'taste' ? (
                                    <motion.div variants={itemVariants}>
                                        <TasteStudyStep
                                            cards={previewCards}
                                            onAnswer={onTasteAnswer}
                                            reducedMotion={reducedMotion}
                                        />
                                    </motion.div>
                                ) : null}

                                {currentId === 'account' ? (
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

                                {currentId === 'canvas' ? (
                                    <motion.div variants={itemVariants}>
                                        {(user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime') ? (
                                            <CanvasConnectFlow
                                                userEmail={user?.email}
                                                onConnected={() => goNext()}
                                            />
                                        ) : (
                                            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-center space-y-3">
                                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-blue-400/80">Premium feature</p>
                                                <p className="font-mono text-[12px] text-claude-secondary/80 leading-relaxed">
                                                    Upgrade to automatically import your classes and assignments from Canvas every 12 hours — no copy-paste needed.
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>
                                ) : null}

                                {currentId === 'capabilities' ? (
                                    <motion.div variants={itemVariants}>
                                        <CapabilitiesRevealStep
                                            material={material}
                                            onSelectMaterial={handleSelectMaterial}
                                            remindersOn={remindersOn}
                                            onToggleReminders={setRemindersOn}
                                        />
                                    </motion.div>
                                ) : null}
                            </div>
                        </motion.section>
                    </AnimatePresence>

                    {currentId === 'generate' && genStatus === 'loading' ? null : (
                        <motion.div
                            variants={itemVariants}
                            className={`relative shrink-0 ${compactHeight ? 'pt-2' : 'pt-3'}`}
                            style={{ paddingBottom: compactHeight ? 'calc(env(safe-area-inset-bottom, 0px) + 0.9rem)' : 'calc(env(safe-area-inset-bottom, 0px) + 1.1rem)' }}
                        >
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-claude-bg" />
                            <button
                                type="button"
                                disabled={primaryBusy || primaryDisabled}
                                onClick={() => !primaryBusy && !primaryDisabled && onPrimary()}
                                className={`relative w-full overflow-hidden transition-all duration-300 active:scale-[0.97] disabled:opacity-50 ${compactHeight ? 'rounded-[1.35rem] px-5 py-3.5' : 'rounded-[1.6rem] px-5 py-4'}`}
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
                    )}
                </div>
            </div>
            )}
        </motion.div>
    );
}
