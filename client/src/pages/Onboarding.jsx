import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowRight, BookOpen, Check, Layers, Loader2, Mic, Sparkles, Upload
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { UIContext } from '../context/UIContext';
import { userNeedsOnboarding } from '../utils/onboardingGate';
import { trackOnboarding } from '../utils/onboardingAnalytics';
import OnboardingArt from '../components/OnboardingArt';

const STEP_COUNT = 5;

const stepsMeta = [
    {
        title: 'You’re in',
        subtitle: 'Riven turns what you hear and read into notes, cards, and practice—so studying starts now, not after setup.',
        primary: 'Continue',
        icon: Sparkles,
    },
    {
        title: 'How do you learn?',
        subtitle: 'Pick what matches you—we’ll prioritize the fastest path.',
        primary: 'Continue',
        icon: BookOpen,
    },
    {
        title: 'Capture a lecture',
        subtitle: 'Record or upload audio and let Riven draft structured notes. This is the fastest “aha” moment.',
        primary: 'Open note + mic',
        icon: Mic,
    },
    {
        title: 'Add your syllabus',
        subtitle: 'Upload a PDF or outline to spin up decks and guides that match your course—not generic review.',
        primary: 'Bring my materials',
        icon: Upload,
    },
    {
        title: 'Study for real',
        subtitle: 'Jump into your decks—review, test, and track what sticks.',
        primary: 'Open my decks',
        icon: Layers,
    },
];

export default function Onboarding() {
    const navigate = useNavigate();
    const toast = useToast();
    const { user, saveOnboardingProgress } = useAuth();
    const ui = useContext(UIContext);
    const hideNav = ui?.hideNav;
    const showBottomNav = ui?.showBottomNav;

    const initialStep = useMemo(() => {
        const s = Number(user?.onboardingStep);
        if (Number.isFinite(s) && s >= 0 && s < STEP_COUNT) return s;
        return 0;
    }, [user?.onboardingStep]);

    const [step, setStep] = useState(initialStep);
    const [studyStyle, setStudyStyle] = useState(null);
    const [busy, setBusy] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        setStep(initialStep);
    }, [initialStep]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const fn = () => setReducedMotion(mq.matches);
        mq.addEventListener('change', fn);
        return () => mq.removeEventListener('change', fn);
    }, []);

    useEffect(() => {
        hideNav?.();
        return () => showBottomNav?.();
    }, [hideNav, showBottomNav]);

    useEffect(() => {
        if (!userNeedsOnboarding(user)) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    useEffect(() => {
        trackOnboarding('onboarding_screen_view', { step });
    }, [step]);

    const persist = useCallback(async (payload) => {
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
    }, [saveOnboardingProgress, toast]);

    const finishToDashboard = useCallback(async (path, trackName) => {
        try {
            await persist({ markComplete: true });
            trackOnboarding(trackName, { path });
            navigate(path, { replace: true });
        } catch {
            /* toast handled */
        }
    }, [navigate, persist]);

    const skipAll = useCallback(async () => {
        trackOnboarding('onboarding_skip_all', { step });
        await finishToDashboard('/dashboard', 'onboarding_complete');
    }, [finishToDashboard, step]);

    const skipStep = useCallback(async () => {
        trackOnboarding('onboarding_skip_step', { step });
        const next = Math.min(step + 1, STEP_COUNT - 1);
        try {
            await persist({ nextStep: next });
            setStep(next);
        } catch {
            /* toast */
        }
    }, [persist, step]);

    const goNext = useCallback(async () => {
        if (step === 1 && !studyStyle) {
            toast.error('Pick one option to continue.');
            return;
        }
        trackOnboarding('onboarding_continue', { fromStep: step });
        const next = Math.min(step + 1, STEP_COUNT - 1);
        try {
            await persist({ nextStep: next });
            setStep(next);
        } catch {
            /* toast */
        }
    }, [persist, step, studyStyle, toast]);

    const onPrimary = useCallback(async () => {
        const meta = stepsMeta[step];
        trackOnboarding('onboarding_cta', { step, cta: meta.primary });

        if (step === 0) {
            await goNext();
            return;
        }
        if (step === 1) {
            await goNext();
            return;
        }
        if (step === 2) {
            try {
                await persist({ nextStep: 3 });
                navigate('/note/new');
            } catch {
                /* toast */
            }
            return;
        }
        if (step === 3) {
            try {
                await persist({ nextStep: 4 });
                navigate('/create?focus=syllabus');
            } catch {
                /* toast */
            }
            return;
        }
        if (step === 4) {
            await finishToDashboard('/decks/library', 'onboarding_complete');
        }
    }, [finishToDashboard, goNext, navigate, persist, step]);

    if (!userNeedsOnboarding(user)) {
        return null;
    }

    const meta = stepsMeta[step];
    const Icon = meta.icon;
    const motionProps = reducedMotion
        ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
        : {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -16 },
            transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        };

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text flex flex-col">
            <header className="shrink-0 px-4 pt-6 pb-2 lg:px-10 lg:pt-10 flex items-center justify-between gap-4 max-w-5xl mx-auto w-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10 overflow-hidden">
                        <OnboardingArt className="w-8 h-8 scale-[1.25] mt-0.5" />
                    </div>
                    <span className="font-display text-lg tracking-tight text-white/90">Riven</span>
                </div>
                <button
                    type="button"
                    onClick={() => !busy && skipAll()}
                    disabled={busy}
                    className="text-xs font-mono uppercase tracking-[0.14em] text-claude-secondary hover:text-white transition-colors disabled:opacity-40"
                >
                    Skip for now
                </button>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full px-4 pb-8 lg:px-10 lg:pb-12 lg:gap-12 lg:items-center">
                <div className="lg:flex-1 lg:max-w-md mb-6 lg:mb-0">
                    <div className="flex gap-1.5 mb-6">
                        {stepsMeta.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-claude-accent' : 'bg-white/10'}`}
                            />
                        ))}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-claude-secondary mb-2">
                        Step {step + 1} of {STEP_COUNT}
                    </p>
                    <AnimatePresence mode="wait">
                        <motion.div key={step} {...motionProps}>
                            <div className="hidden lg:flex mb-8 justify-start">
                                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                    <OnboardingArt className="w-48 h-48 max-w-full" />
                                </div>
                            </div>
                            <h1 className="font-display text-3xl sm:text-4xl font-bold text-botanical-parchment leading-tight mb-3">
                                {meta.title}
                            </h1>
                            <p className="text-claude-secondary text-base leading-relaxed">
                                {meta.subtitle}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="lg:flex-1 lg:max-w-md flex flex-col">
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-6 sm:p-8 flex flex-col flex-1">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="rounded-2xl border border-claude-border bg-claude-surface p-3 text-claude-accent">
                                <Icon className="w-6 h-6" strokeWidth={2} />
                            </div>
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary">This step</span>
                        </div>

                        <div className="flex-1 min-h-[12rem]">
                            {step === 1 && (
                                <div className="space-y-3">
                                    {[
                                        { id: 'lectures', label: 'Mostly lectures & recordings' },
                                        { id: 'readings', label: 'Mostly readings & PDFs' },
                                        { id: 'both', label: 'A mix of both' },
                                    ].map((opt) => {
                                        const selected = studyStyle === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setStudyStyle(opt.id)}
                                                className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all tap-action ${selected
                                                    ? 'border-claude-accent/40 bg-claude-accent/10 text-botanical-parchment'
                                                    : 'border-claude-border bg-claude-surface/80 text-claude-secondary hover:border-white/15'
                                                }`}
                                            >
                                                <span className="flex-1 text-sm font-medium">{opt.label}</span>
                                                {selected && <Check className="w-5 h-5 text-claude-accent shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {step !== 1 && (
                                <p className="text-sm text-claude-secondary leading-relaxed">
                                    {step === 0 && 'No forms—just a few taps, then you’re capturing and studying.'}
                                    {step === 2 && 'You can paste text too. The mic is the fastest way to feel the magic.'}
                                    {step === 3 && 'Optional but powerful: your materials keep decks and exams aligned with the real class.'}
                                    {step === 4 && 'You can always return to notes and guides from Study in the nav.'}
                                </p>
                            )}
                        </div>

                        <div className="mt-8 space-y-3 pt-4 border-t border-white/10">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => !busy && onPrimary()}
                                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-claude-accent text-black font-mono text-[11px] uppercase tracking-[0.14em] font-bold py-4 px-4 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                {busy ? 'Saving…' : meta.primary}
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => !busy && skipStep()}
                                className="w-full text-center text-xs font-mono uppercase tracking-[0.14em] text-claude-secondary hover:text-white transition-colors disabled:opacity-40 py-2"
                            >
                                Skip this step
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
