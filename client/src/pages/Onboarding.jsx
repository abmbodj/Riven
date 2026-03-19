import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, BookOpen, Loader2, Sparkles } from 'lucide-react';
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

const STEP_COUNT = 3;

const stepsMeta = [
    {
        title: 'Welcome to Riven',
        subtitle:
            'Turn lectures, readings, and notes into cards and practice—built for studying on the go.',
        primary: 'Continue',
        icon: Sparkles,
    },
    {
        title: 'Study in flow',
        subtitle:
            'Capture from the mic or files, then review and test from your decks whenever you have a few minutes.',
        primary: 'Next',
        icon: BookOpen,
    },
    {
        title: 'You’re ready',
        subtitle: 'Head to Today to pick up where you left off, or open Study to dive into decks.',
        primary: 'Go to Today',
        icon: Sparkles,
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
    const [busy, setBusy] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        setStep(initialStep);
    }, [initialStep]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const fn = () => setReducedMotion(mq.matches);
        return subscribeMediaQueryList(mq, fn);
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
                /* toast handled */
            }
        },
        [navigate, persist],
    );

    const skipAll = useCallback(async () => {
        trackOnboarding('onboarding_skip_all', { step });
        await finishToDashboard('onboarding_complete');
    }, [finishToDashboard, step]);

    const goNext = useCallback(async () => {
        trackOnboarding('onboarding_continue', { fromStep: step });
        const next = Math.min(step + 1, STEP_COUNT - 1);
        try {
            await persist({ nextStep: next });
            setStep(next);
        } catch {
            /* toast */
        }
    }, [persist, step]);

    const onPrimary = useCallback(async () => {
        const meta = stepsMeta[step];
        trackOnboarding('onboarding_cta', { step, cta: meta.primary });

        if (step < STEP_COUNT - 1) {
            await goNext();
            return;
        }
        await finishToDashboard('onboarding_complete');
    }, [finishToDashboard, goNext, step]);

    if (!isMobileOnboardingEligible() || !userNeedsOnboarding(user)) {
        return null;
    }

    const meta = stepsMeta[step];
    const Icon = meta.icon;
    const motionProps = reducedMotion
        ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
        : {
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -8 },
              transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
          };

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text flex flex-col max-w-lg mx-auto w-full">
            <header className="shrink-0 px-5 safe-area-top pb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10 overflow-hidden shrink-0">
                        <OnboardingArt className="w-7 h-7 scale-[1.2] mt-0.5" />
                    </div>
                    <span className="font-display text-base tracking-tight text-white/90 truncate">
                        Riven
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => !busy && skipAll()}
                    disabled={busy}
                    className="text-[11px] font-mono uppercase tracking-[0.12em] text-claude-secondary hover:text-white transition-colors disabled:opacity-40 shrink-0"
                >
                    Skip
                </button>
            </header>

            <div className="flex-1 flex flex-col px-5 pb-8 pt-2">
                <div className="flex gap-1 mb-5">
                    {stepsMeta.map((_, i) => (
                        <div
                            key={i}
                            className={`h-0.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-claude-accent' : 'bg-white/10'}`}
                        />
                    ))}
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary mb-3">
                    {step + 1} / {STEP_COUNT}
                </p>

                <AnimatePresence mode="wait">
                    <motion.div key={step} className="flex-1 flex flex-col" {...motionProps}>
                        <div className="flex justify-center mb-8">
                            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                <OnboardingArt className="w-36 h-36 max-w-[min(40vw,9rem)]" />
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex-1 flex flex-col">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl border border-claude-border bg-claude-surface p-2.5 text-claude-accent">
                                    <Icon className="w-5 h-5" strokeWidth={2} />
                                </div>
                            </div>
                            <h1 className="font-display text-2xl font-bold text-botanical-parchment leading-tight mb-2">
                                {meta.title}
                            </h1>
                            <p className="text-claude-secondary text-sm leading-relaxed flex-1">
                                {meta.subtitle}
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => !busy && onPrimary()}
                                className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-claude-accent text-black font-mono text-[11px] uppercase tracking-[0.12em] font-bold py-3.5 px-4 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
                            >
                                {busy ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <ArrowRight className="w-4 h-4" />
                                )}
                                {busy ? 'Saving…' : meta.primary}
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
