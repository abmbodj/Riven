import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import useHaptics from '../../hooks/useHaptics';

// The emotional core of onboarding: the visitor answers a few real cards from the deck they
// just generated, turning "I saw magic" into "I felt it". Caps the mini-loop so the wall comes
// quickly after the first win. Calls onAnswer(knew) per card; the page counts toward activation.
const TASTE_TARGET = 3;

export default function TasteStudyStep({ cards = [], onAnswer, reducedMotion = false }) {
    const haptics = useHaptics();
    const deck = useMemo(() => cards.slice(0, TASTE_TARGET), [cards]);
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);

    const card = deck[index];
    const done = index >= deck.length;

    const answer = (knew) => {
        if (knew) haptics.success();
        else haptics.light();
        onAnswer?.(knew);
        setRevealed(false);
        setIndex((i) => i + 1);
    };

    if (done || !card) {
        return (
            <motion.div
                initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="flex flex-col items-center gap-3 rounded-[1.6rem] border border-claude-accent/30 bg-claude-accent/[0.06] px-6 py-8 text-center"
            >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-claude-accent/20">
                    <Sparkles className="h-6 w-6 text-claude-accent" />
                </span>
                <p className="font-display text-[1.4rem] leading-tight tracking-[-0.03em] text-botanical-parchment">
                    That’s the feeling.
                </p>
                <p className="max-w-[17rem] text-[13px] leading-5 text-claude-secondary">
                    This is your deck — save it to keep it and start your streak.
                </p>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-1.5">
                {deck.map((_, i) => (
                    <span
                        key={i}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                            width: i === index ? 22 : 7,
                            backgroundColor: i < index
                                ? 'var(--accent-color)'
                                : i === index
                                    ? 'color-mix(in srgb, var(--accent-color) 70%, transparent)'
                                    : 'rgba(255,255,255,0.15)',
                        }}
                    />
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.button
                    key={index}
                    type="button"
                    onClick={() => !revealed && setRevealed(true)}
                    initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="relative min-h-[12rem] w-full overflow-hidden rounded-[1.6rem] border border-white/10 px-5 py-6 text-center"
                    style={{
                        background:
                            'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(155deg, color-mix(in srgb, var(--surface-color) 82%, transparent) 0%, color-mix(in srgb, var(--bg-color) 72%, transparent) 100%)',
                        boxShadow: '0 22px 44px -28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)',
                    }}
                >
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-claude-secondary">
                            {revealed ? 'Answer' : 'Question'}
                        </p>
                        <p className="font-display text-[1.3rem] leading-snug tracking-[-0.03em] text-botanical-parchment">
                            {revealed ? card.back : card.front}
                        </p>
                        {!revealed ? (
                            <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-claude-secondary">
                                <RotateCcw className="h-3.5 w-3.5" />
                                Tap to reveal
                            </span>
                        ) : null}
                    </div>
                </motion.button>
            </AnimatePresence>

            <AnimatePresence>
                {revealed ? (
                    <motion.div
                        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-2 gap-3"
                    >
                        <button
                            type="button"
                            onClick={() => answer(false)}
                            className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-claude-secondary transition-colors hover:text-botanical-parchment active:scale-[0.98]"
                        >
                            Still learning
                        </button>
                        <button
                            type="button"
                            onClick={() => answer(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-claude-accent/50 bg-claude-accent/15 px-4 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-botanical-parchment transition-transform active:scale-[0.98]"
                        >
                            <Check className="h-4 w-4 text-claude-accent" strokeWidth={3} />
                            Got it
                        </button>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

export { TASTE_TARGET };
