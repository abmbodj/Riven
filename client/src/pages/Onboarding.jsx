import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { UIContext } from '../context/UIContext';
import {
    userNeedsOnboarding,
    isMobileOnboardingEligible,
} from '../utils/onboardingGate';
import { trackOnboarding } from '../utils/onboardingAnalytics';
import { subscribeMediaQueryList } from '../utils/matchMediaSubscribe';

const ONBOARDING_STEPS = [
    {
        id: 'focus',
        eyebrow: 'Choose a lane',
        title: {
            lead: 'What feels most',
            highlight: 'important',
            tail: 'right now?',
        },
        description: 'Pick the outcome you want Riven to help with first.',
        primary: 'Continue',
        options: [
            {
                id: 'cards',
                eyebrow: 'Outcome',
                label: 'Make flashcards from class material',
                detail: 'Move from lecture, reading, or notes into something reviewable fast.',
                shortLabel: 'Flashcards',
            },
            {
                id: 'habit',
                eyebrow: 'Rhythm',
                label: 'Build a steadier study habit',
                detail: 'Stay close to small daily wins instead of waiting for crunch time.',
                shortLabel: 'Consistency',
            },
            {
                id: 'exams',
                eyebrow: 'Practice',
                label: 'Practice for exams faster',
                detail: 'Keep your review loop tight when quizzes and tests start stacking up.',
                shortLabel: 'Exam prep',
            },
            {
                id: 'organize',
                eyebrow: 'Clarity',
                label: 'Keep each class organized',
                detail: 'Hold notes, decks, and materials in one place that feels calm to use.',
                shortLabel: 'Organization',
            },
        ],
    },
    {
        id: 'material',
        eyebrow: 'Bring your material in',
        title: {
            lead: 'What do you usually',
            highlight: 'bring into',
            tail: 'Riven?',
        },
        description: 'Choose the study material you reach for most often.',
        primary: 'Continue',
        options: [
            {
                id: 'audio',
                eyebrow: 'Capture',
                label: 'Lecture audio',
                detail: 'Record in class and turn spoken material into cleaner notes and cards.',
                shortLabel: 'Audio',
            },
            {
                id: 'slides',
                eyebrow: 'Upload',
                label: 'Slides and syllabi',
                detail: 'Drop in PDFs or class docs so Riven can build from the source material.',
                shortLabel: 'Slides',
            },
            {
                id: 'notes',
                eyebrow: 'Write',
                label: 'Reading notes',
                detail: 'Keep what you already highlighted or summarized in one active study flow.',
                shortLabel: 'Notes',
            },
            {
                id: 'existing',
                eyebrow: 'Reuse',
                label: 'Existing decks and questions',
                detail: 'Start from material you already have and sharpen it instead of rebuilding.',
                shortLabel: 'Existing sets',
            },
        ],
    },
    {
        id: 'friction',
        eyebrow: 'Tune the first screen',
        title: {
            lead: 'What usually',
            highlight: 'throws off',
            tail: 'your study rhythm?',
        },
        description: 'Choose the friction you want Riven to help clear first.',
        primary: 'Go to Today',
        options: [
            {
                id: 'starting',
                eyebrow: 'Momentum',
                label: 'I miss the moment to start',
                detail: 'A quick first action matters more than another long plan.',
                shortLabel: 'Starting',
            },
            {
                id: 'scatter',
                eyebrow: 'Signal',
                label: 'My material gets scattered',
                detail: 'I need one clear place to reopen what matters and keep moving.',
                shortLabel: 'Scattered material',
            },
            {
                id: 'review',
                eyebrow: 'Recall',
                label: 'I forget what to review next',
                detail: 'I want the app to surface the right thing without a lot of digging.',
                shortLabel: 'Review order',
            },
            {
                id: 'switching',
                eyebrow: 'Context',
                label: 'I bounce between too many classes',
                detail: 'I need a calmer way to switch without losing the thread.',
                shortLabel: 'Context switching',
            },
        ],
    },
];

const STEP_COUNT = ONBOARDING_STEPS.length;

const createDefaultAnswers = () =>
    Object.fromEntries(ONBOARDING_STEPS.map((screen) => [screen.id, screen.options[0]?.id ?? null]));

const getStepOption = (stepId, optionId) => {
    const screen = ONBOARDING_STEPS.find((candidate) => candidate.id === stepId);
    return screen?.options.find((option) => option.id === optionId) ?? screen?.options[0] ?? null;
};

export default function Onboarding() {
    const navigate = useNavigate();
    const toast = useToast();
    const { user, saveOnboardingProgress } = useAuth();
    const ui = useContext(UIContext);
    const hideNav = ui?.hideNav;
    const showBottomNav = ui?.showBottomNav;

    const initialStep = useMemo(() => {
        const persistedStep = Number(user?.onboardingStep);
        if (Number.isFinite(persistedStep) && persistedStep >= 0 && persistedStep < STEP_COUNT) {
            return persistedStep;
        }
        return 0;
    }, [user?.onboardingStep]);

    const [step, setStep] = useState(initialStep);
    const [answers, setAnswers] = useState(() => createDefaultAnswers());
    const [busy, setBusy] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [compactHeight, setCompactHeight] = useState(false);

    useEffect(() => {
        setStep(initialStep);
    }, [initialStep]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const updateMotionPreference = () => setReducedMotion(mq.matches);
        return subscribeMediaQueryList(mq, updateMotionPreference);
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(max-height: 760px)');
        setCompactHeight(mq.matches);
        const updateCompactHeight = () => setCompactHeight(mq.matches);
        return subscribeMediaQueryList(mq, updateCompactHeight);
    }, []);

    useEffect(() => {
        hideNav?.();
        return () => showBottomNav?.();
    }, [hideNav, showBottomNav]);

    useEffect(() => {
        if (!isMobileOnboardingEligible()) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        if (!userNeedsOnboarding(user)) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

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
            } catch {
                /* toast handled in persist */
            }
        },
        [navigate, persist],
    );

    const skipAll = useCallback(async () => {
        trackOnboarding('onboarding_skip_all', { step });
        await finishToDashboard('onboarding_complete');
    }, [finishToDashboard, step]);

    const goBack = useCallback(async () => {
        if (step <= 0) return;

        const previous = Math.max(step - 1, 0);
        try {
            await persist({ nextStep: previous });
            setStep(previous);
        } catch {
            /* toast handled in persist */
        }
    }, [persist, step]);

    const goNext = useCallback(async () => {
        trackOnboarding('onboarding_continue', { fromStep: step });
        const next = Math.min(step + 1, STEP_COUNT - 1);

        try {
            await persist({ nextStep: next });
            setStep(next);
        } catch {
            /* toast handled in persist */
        }
    }, [persist, step]);

    const onPrimary = useCallback(async () => {
        const screen = ONBOARDING_STEPS[step];
        trackOnboarding('onboarding_cta', { step, cta: screen.primary });

        if (step < STEP_COUNT - 1) {
            await goNext();
            return;
        }

        await finishToDashboard('onboarding_complete');
    }, [finishToDashboard, goNext, step]);

    const setAnswer = useCallback((screenId, optionId) => {
        setAnswers((current) => ({ ...current, [screenId]: optionId }));
    }, []);

    if (!isMobileOnboardingEligible() || !userNeedsOnboarding(user)) {
        return null;
    }

    const screen = ONBOARDING_STEPS[step];
    const selectedAnswerId = answers[screen.id];
    const focusChoice = getStepOption('focus', answers.focus);
    const materialChoice = getStepOption('material', answers.material);
    const progress = ((step + 1) / STEP_COUNT) * 100;
    const summaryLine = step === STEP_COUNT - 1 && focusChoice && materialChoice
        ? `Focus: ${focusChoice.shortLabel} • Material: ${materialChoice.shortLabel}`
        : null;

    const containerVariants = reducedMotion
        ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
        : {
              initial: { opacity: 0 },
              animate: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08, delayChildren: 0.05 },
              },
              exit: { opacity: 0, transition: { duration: 0.2 } },
          };

    const itemVariants = reducedMotion
        ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
        : {
              initial: { opacity: 0, y: 12 },
              animate: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              },
          };

    return (
        <div className="relative min-h-dvh w-full max-w-lg mx-auto overflow-hidden bg-claude-bg text-claude-text">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    animate={reducedMotion ? {} : {
                        y: [0, -20, 0],
                        scale: [1, 1.05, 1],
                        opacity: [0.8, 0.6, 0.8],
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-1/2 top-[-8rem] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full blur-3xl opacity-80"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--accent-color) 18%, transparent) 0%, transparent 62%)',
                    }}
                />
                <motion.div
                    animate={reducedMotion ? {} : {
                        y: [0, 20, 0],
                        x: [0, -15, 0],
                        opacity: [0.6, 0.4, 0.6],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute right-[-5rem] top-[20%] h-[18rem] w-[18rem] rounded-full blur-3xl opacity-60"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--botanical-forest) 18%, transparent) 0%, transparent 64%)',
                    }}
                />
                <motion.div
                    animate={reducedMotion ? {} : {
                        y: [0, -15, 0],
                        x: [0, 15, 0],
                        opacity: [0.5, 0.3, 0.5],
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }}
                    className="absolute bottom-[-9rem] left-[-4rem] h-[18rem] w-[18rem] rounded-full blur-3xl opacity-50"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--secondary-text-color) 18%, transparent) 0%, transparent 64%)',
                    }}
                />
            </div>

            <div className="relative z-10 flex min-h-dvh flex-col">
                <header className={`shrink-0 px-5 safe-area-top ${compactHeight ? 'pt-2 pb-3' : 'pt-3 pb-4'}`}>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => !busy && goBack()}
                            disabled={busy || step === 0}
                            aria-label="Go back"
                            className={`touch-target rounded-full border border-white/10 bg-white/[0.05] text-botanical-parchment transition-all duration-200 hover:border-white/15 hover:bg-white/[0.08] disabled:opacity-30 ${compactHeight ? 'h-10 w-10' : 'h-11 w-11'}`}
                        >
                            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
                        </button>

                        <div
                            className="relative h-3 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]"
                            role="progressbar"
                            aria-valuemin={1}
                            aria-valuemax={STEP_COUNT}
                            aria-valuenow={step + 1}
                            aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
                        >
                            <motion.div
                                className="absolute inset-y-0 left-0 rounded-full"
                                animate={{ width: `${progress}%` }}
                                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                    background:
                                        'linear-gradient(90deg, color-mix(in srgb, var(--botanical-forest) 55%, var(--accent-color)) 0%, var(--accent-color) 100%)',
                                    boxShadow:
                                        '0 0 22px color-mix(in srgb, var(--accent-color) 26%, transparent)',
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => !busy && skipAll()}
                            disabled={busy}
                            className="min-w-[48px] text-right font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-white disabled:opacity-40"
                        >
                            Skip
                        </button>
                    </div>
                </header>

                <div className={`flex min-h-0 flex-1 flex-col px-5 ${compactHeight ? 'pb-2' : 'pb-3'}`}>
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
                                        {screen.eyebrow} · Step {step + 1} of {STEP_COUNT}
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
                                    {summaryLine ? (
                                        <motion.p variants={itemVariants} className={`mx-auto font-mono uppercase tracking-[0.16em] text-botanical-parchment/80 ${compactHeight ? 'mt-2 text-[9px]' : 'mt-3 text-[10px]'}`}>
                                            {summaryLine}
                                        </motion.p>
                                    ) : null}
                                </div>

                                <div className={`grid ${compactHeight ? 'gap-2.5' : 'gap-3'}`}>
                                    {screen.options.map((option) => {
                                        const isSelected = selectedAnswerId === option.id;

                                        return (
                                            <motion.button
                                                variants={itemVariants}
                                                key={option.id}
                                                type="button"
                                                onClick={() => setAnswer(screen.id, option.id)}
                                                disabled={busy}
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
                                                            borderColor: isSelected
                                                                ? 'color-mix(in srgb, var(--accent-color) 80%, transparent)'
                                                                : 'rgba(255,255,255,0.15)',
                                                            backgroundColor: isSelected
                                                                ? 'color-mix(in srgb, var(--accent-color) 85%, transparent)'
                                                                : 'rgba(0,0,0,0.2)',
                                                            boxShadow: isSelected
                                                                ? '0 0 12px color-mix(in srgb, var(--accent-color) 40%, transparent)'
                                                                : 'none',
                                                        }}
                                                    >
                                                        <div
                                                            className="h-2 w-2 rounded-full transition-transform duration-300 ease-out"
                                                            style={{
                                                                backgroundColor: isSelected ? 'var(--botanical-ink)' : 'transparent',
                                                                transform: isSelected ? 'scale(1)' : 'scale(0)',
                                                            }}
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
                            </div>
                        </motion.section>
                    </AnimatePresence>

                    <motion.div
                        variants={itemVariants}
                        className={`relative shrink-0 ${compactHeight ? 'pt-2' : 'pt-3'}`}
                        style={{
                            paddingBottom: compactHeight
                                ? 'calc(env(safe-area-inset-bottom, 0px) + 0.9rem)'
                                : 'calc(env(safe-area-inset-bottom, 0px) + 1.1rem)',
                        }}
                    >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-claude-bg" />
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => !busy && onPrimary()}
                            className={`relative w-full overflow-hidden transition-all duration-300 active:scale-[0.97] disabled:opacity-60 ${compactHeight ? 'rounded-[1.35rem] px-5 py-3.5' : 'rounded-[1.6rem] px-5 py-4'}`}
                            style={{
                                background:
                                    'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 88%, white 8%) 0%, color-mix(in srgb, var(--botanical-forest) 58%, var(--accent-color)) 100%)',
                                boxShadow:
                                    '0 28px 50px -24px color-mix(in srgb, var(--accent-color) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
                            }}
                        >
                            <span className={`font-mono font-bold uppercase tracking-[0.24em] text-botanical-ink ${compactHeight ? 'text-[11px]' : 'text-[12px]'}`}>
                                {busy ? 'Saving' : screen.primary}
                            </span>
                            <span className={`absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ${compactHeight ? 'h-9 w-9' : 'h-10 w-10'}`}>
                                {busy ? (
                                    <Loader2 className={`${compactHeight ? 'h-4 w-4' : 'h-5 w-5'} animate-spin text-botanical-ink`} />
                                ) : (
                                    <ArrowRight className={`${compactHeight ? 'h-4 w-4' : 'h-5 w-5'} text-botanical-ink`} strokeWidth={2.6} />
                                )}
                            </span>
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
