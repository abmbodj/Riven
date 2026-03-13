import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Compact hearts display for study modes.
 * Accepts heartsStatus externally so it stays in sync with the parent page.
 * Animates on gain/loss with color flash + number pop.
 */
export default function StudyHeartsDisplay({ heartsStatus }) {
    const [flash, setFlash] = useState(null); // 'lost' | 'gained' | null
    const prevHearts = useRef(null);

    useEffect(() => {
        if (!heartsStatus || heartsStatus.isUnlimited) return;
        const current = heartsStatus.hearts;
        const previous = prevHearts.current;
        prevHearts.current = current;

        if (previous !== null && current !== previous) {
            const nextFlash = current < previous ? 'lost' : 'gained';
            const startId = window.setTimeout(() => setFlash(nextFlash), 0);
            const clearId = window.setTimeout(() => setFlash(null), 800);

            return () => {
                window.clearTimeout(startId);
                window.clearTimeout(clearId);
            };
        }
    }, [heartsStatus]);

    if (!heartsStatus) return null;

    const isUnlimited = heartsStatus.isUnlimited;
    const hearts = heartsStatus.hearts;

    return (
        <div className="flex items-center gap-1.5 relative">
            {/* Heart icon with pulse on change */}
            <motion.div
                animate={
                    flash === 'lost'
                        ? { scale: [1, 1.4, 0.85, 1], rotate: [0, -12, 8, 0] }
                        : flash === 'gained'
                            ? { scale: [1, 1.3, 1], rotate: [0, 6, 0] }
                            : {}
                }
                transition={{ duration: 0.5 }}
            >
                <Heart
                    className={`w-4 h-4 transition-colors duration-300 ${isUnlimited
                            ? 'text-indigo-500 fill-indigo-500'
                            : flash === 'lost'
                                ? 'text-red-600 fill-red-600'
                                : flash === 'gained'
                                    ? 'text-green-500 fill-green-500'
                                    : 'text-red-500 fill-red-500'
                        }`}
                />
            </motion.div>

            {/* Count with animated number change */}
            <motion.span
                key={isUnlimited ? 'inf' : hearts}
                initial={{ y: flash === 'lost' ? -4 : flash === 'gained' ? 4 : 0, opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                className={`font-mono font-bold text-sm tabular-nums transition-colors duration-300 ${isUnlimited
                        ? 'text-indigo-500'
                        : flash === 'lost'
                            ? 'text-red-600'
                            : flash === 'gained'
                                ? 'text-green-500'
                                : 'text-red-500'
                    }`}
            >
                {isUnlimited ? '∞' : hearts}
            </motion.span>

            {/* Delta popup: "-1" or "+5" */}
            <AnimatePresence>
                {flash && !isUnlimited && (
                    <motion.span
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: flash === 'lost' ? 16 : -16 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7 }}
                        className={`absolute -right-5 top-0 text-[10px] font-mono font-bold pointer-events-none ${flash === 'lost' ? 'text-red-500' : 'text-green-500'
                            }`}
                    >
                        {flash === 'lost' ? '-1' : '+'}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );
}
