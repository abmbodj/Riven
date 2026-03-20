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
import OnboardingArt from '../components/OnboardingArt';

const ONBOARDING_STEPS = [
    {
        id: 'focus',
        eyebrow: 'Choose a lane',
        title: {
            lead: 'What feels most',
            highlight: 'important',
            tail: 'right now?',
        },
        description: 'We kept this first setup short. Pick the kind of win you want Riven to help create first.',
        primary: 'Continue',
        options: [
            {
                id: 'cards',
                eyebrow: 'Outcome',
                label: 'Turn class material into flashcards',
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
        description: 'The app feels best when it meets your real study inputs instead of asking you to start from scratch.',
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
        description: 'Today is where Riven starts paying off. Tell us what tends to make your studying feel noisy.',
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

    const motionProps = reducedMotion
        ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
        : {
              initial: { opacity: 0, y: 14 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -10 },
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
          };

    return (
        <div className="relative min-h-dvh w-full max-w-lg mx-auto overflow-hidden bg-claude-bg text-claude-text">
            <div className="pointer-events-none absolute inset-0">
                <div
                    className="absolute left-1/2 top-[-8rem] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full blur-3xl opacity-80"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--accent-color) 18%, transparent) 0%, transparent 62%)',
                    }}
                />
                <div
                    className="absolute right-[-5rem] top-[20%] h-[18rem] w-[18rem] rounded-full blur-3xl opacity-60"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--botanical-forest) 18%, transparent) 0%, transparent 64%)',
                    }}
                />
                <div
                    className="absolute bottom-[-9rem] left-[-4rem] h-[18rem] w-[18rem] rounded-full blur-3xl opacity-50"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--secondary-text-color) 18%, transparent) 0%, transparent 64%)',
                    }}
                />
            </div>

            <div className="relative z-10 flex min-h-dvh flex-col">
                <header className="shrink-0 px-5 safe-area-top pt-3 pb-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => !busy && goBack()}
                            disabled={busy || step === 0}
                            aria-label="Go back"
                            className="touch-target h-11 w-11 rounded-full border border-white/10 bg-white/[0.05] text-botanical-parchment transition-all duration-200 hover:border-white/15 hover:bg-white/[0.08] disabled:opacity-30"
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

                <div className="flex min-h-0 flex-1 flex-col px-5">
                    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                        <AnimatePresence mode="wait">
                            <motion.section key={screen.id} className="flex min-h-full flex-col pb-2" {...motionProps}>
                                <div className="pt-2">
                                    <div className="mx-auto mb-8 inline-flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 shadow-[0_12px_32px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)]">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                                            <OnboardingArt className="w-7 h-7 scale-[1.15]" />
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-claude-accent">
                                                {screen.eyebrow}
                                            </p>
                                            <p className="truncate text-xs text-claude-secondary">Riven mobile setup</p>
                                        </div>
                                    </div>

                                    <div className="mx-auto max-w-[22rem] text-center">
                                        <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-claude-secondary">
                                            Step {step + 1} of {STEP_COUNT}
                                        </p>
                                        <h1 className="text-[clamp(2.75rem,11vw,4.35rem)] font-display font-semibold leading-[0.9] tracking-[-0.055em] text-botanical-parchment">
                                            <span className="block">{screen.title.lead}</span>
                                            <span className="block">
                                                <span className="text-claude-accent">{screen.title.highlight}</span>
                                                {screen.title.tail ? ` ${screen.title.tail}` : ''}
                                            </span>
                                        </h1>
                                        <p className="mt-5 text-[15px] leading-6 text-claude-secondary">
                                            {screen.description}
                                        </p>
                                    </div>

                                    {step === STEP_COUNT - 1 && focusChoice && materialChoice ? (
                                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-botanical-parchment">
                                                Focus: {focusChoice.shortLabel}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-botanical-parchment">
                                                Material: {materialChoice.shortLabel}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="mt-9 space-y-3.5">
                                    {screen.options.map((option) => {
                                        const isSelected = selectedAnswerId === option.id;

                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setAnswer(screen.id, option.id)}
                                                disabled={busy}
                                                aria-pressed={isSelected}
                                                className="group relative w-full overflow-hidden rounded-[1.75rem] border p-4 text-left transition-all duration-200 active:scale-[0.99] disabled:opacity-70"
                                                style={{
                                                    borderColor: isSelected
                                                        ? 'color-mix(in srgb, var(--accent-color) 52%, rgba(255,255,255,0.18))'
                                                        : 'rgba(255,255,255,0.08)',
                                                    background: isSelected
                                                        ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%), linear-gradient(155deg, color-mix(in srgb, var(--surface-color) 88%, transparent) 0%, color-mix(in srgb, var(--bg-color) 72%, transparent) 100%)'
                                                        : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%), linear-gradient(155deg, color-mix(in srgb, var(--surface-color) 82%, transparent) 0%, color-mix(in srgb, var(--bg-color) 74%, transparent) 100%)',
                                                    boxShadow: isSelected
                                                        ? '0 26px 44px -36px color-mix(in srgb, var(--accent-color) 65%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)'
                                                        : '0 18px 38px -34px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
                                                }}
                                            >
                                                <div
                                                    className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-full transition-opacity duration-200"
                                                    style={{
                                                        background: 'linear-gradient(180deg, var(--accent-color) 0%, var(--botanical-forest) 100%)',
                                                        opacity: isSelected ? 1 : 0,
                                                    }}
                                                />

                                                <div className="flex items-start gap-3.5">
                                                    <div
                                                        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200"
                                                        style={{
                                                            borderColor: isSelected
                                                                ? 'color-mix(in srgb, var(--accent-color) 70%, transparent)'
                                                                : 'rgba(255,255,255,0.18)',
                                                            backgroundColor: isSelected
                                                                ? 'color-mix(in srgb, var(--accent-color) 82%, transparent)'
                                                                : 'transparent',
                                                        }}
                                                    >
                                                        <div
                                                            className="h-2 w-2 rounded-full transition-transform duration-200"
                                                            style={{
                                                                backgroundColor: isSelected ? 'var(--botanical-ink)' : 'rgba(255,255,255,0.18)',
                                                                transform: isSelected ? 'scale(1)' : 'scale(0.8)',
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-claude-secondary">
                                                            {option.eyebrow}
                                                        </p>
                                                        <p className="mt-1 font-display text-[1.42rem] leading-[1.02] tracking-[-0.03em] text-botanical-parchment">
                                                            {option.label}
                                                        </p>
                                                        <p className="mt-2 text-[13px] leading-5 text-claude-secondary">
                                                            {option.detail}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.section>
                        </AnimatePresence>
                    </div>

                    <div className="relative shrink-0 pt-3 pb-3 safe-area-bottom">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-transparent to-claude-bg" />
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => !busy && onPrimary()}
                            className="relative w-full overflow-hidden rounded-[1.9rem] px-6 py-5 transition-all duration-200 active:scale-[0.99] disabled:opacity-60"
                            style={{
                                background:
                                    'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 88%, white 8%) 0%, color-mix(in srgb, var(--botanical-forest) 58%, var(--accent-color)) 100%)',
                                boxShadow:
                                    '0 26px 46px -28px color-mix(in srgb, var(--accent-color) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)',
                            }}
                        >
                            <span className="font-mono text-[13px] font-bold uppercase tracking-[0.26em] text-botanical-ink">
                                {busy ? 'Saving' : screen.primary}
                            </span>
                            <span className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                                {busy ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-botanical-ink" />
                                ) : (
                                    <ArrowRight className="h-5 w-5 text-botanical-ink" strokeWidth={2.6} />
                                )}
                            </span>
                        </button>

                        <p className="mt-3 text-center text-[11px] leading-5 text-claude-secondary">
                            You can revisit your study flow later. Skip will drop you straight into Today.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
