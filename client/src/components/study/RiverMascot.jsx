import React from 'react';
import { motion } from 'motion/react';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget';

const RIVER_STATES = {
    idle: {
        label: 'Settled and ready',
        earLeft: -6,
        earRight: 6,
        browLeft: 0,
        browRight: 0,
        eyeScale: 1,
        whisker: 0,
        tail: -8,
        mouth: 'M86 122 Q100 132 114 122',
        accent: '#9dc08b',
    },
    focus: {
        label: 'Focused',
        earLeft: -10,
        earRight: 10,
        browLeft: -4,
        browRight: -4,
        eyeScale: 0.72,
        whisker: -3,
        tail: -4,
        mouth: 'M88 121 Q100 126 112 121',
        accent: '#b6d8a3',
    },
    encourage: {
        label: 'Encouraging',
        earLeft: -4,
        earRight: 4,
        browLeft: -2,
        browRight: -2,
        eyeScale: 0.85,
        whisker: 2,
        tail: 6,
        mouth: 'M86 120 Q100 134 114 120',
        accent: '#d8c27a',
    },
    recover: {
        label: 'Gentle recovery',
        earLeft: -16,
        earRight: 12,
        browLeft: 6,
        browRight: 4,
        eyeScale: 0.64,
        whisker: -6,
        tail: -12,
        mouth: 'M88 126 Q100 116 112 126',
        accent: '#d9aa72',
    },
    misconception: {
        label: 'Correcting a misconception',
        earLeft: -18,
        earRight: 14,
        browLeft: 10,
        browRight: 8,
        eyeScale: 0.58,
        whisker: -8,
        tail: -16,
        mouth: 'M88 128 Q100 114 112 128',
        accent: '#e7a77d',
    },
    hint: {
        label: 'Offering a hint',
        earLeft: -12,
        earRight: 14,
        browLeft: 2,
        browRight: -4,
        eyeScale: 0.8,
        whisker: 6,
        tail: 8,
        mouth: 'M88 121 Q100 129 112 121',
        accent: '#c8b07b',
    },
    mastery: {
        label: 'Mastery',
        earLeft: -2,
        earRight: 2,
        browLeft: -8,
        browRight: -8,
        eyeScale: 0.92,
        whisker: 8,
        tail: 14,
        mouth: 'M84 118 Q100 138 116 118',
        accent: '#b8d89d',
    },
    celebrate: {
        label: 'Celebrating',
        earLeft: -1,
        earRight: 1,
        browLeft: -10,
        browRight: -10,
        eyeScale: 0.35,
        whisker: 10,
        tail: 18,
        mouth: 'M82 116 Q100 141 118 116',
        accent: '#d9c47f',
    },
};

const getMotionPreference = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export default function RiverMascot({
    state = 'idle',
    caption = '',
    className = '',
}) {
    const mobileBudget = useMobileVisualBudget();
    const reduceMotion = mobileBudget || getMotionPreference();
    const pose = RIVER_STATES[state] || RIVER_STATES.idle;
    const loopTransition = reduceMotion ? { duration: 0 } : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' };

    return (
        <div
            className={`relative overflow-hidden rounded-[2rem] border border-claude-border/80 bg-[radial-gradient(circle_at_top,_rgba(244,231,197,0.16),_rgba(16,20,18,0.94)_70%)] p-4 sm:p-5 ${className}`}
            data-testid="river-mascot"
            data-river-state={state}
            aria-label={`River is ${pose.label.toLowerCase()}`}
        >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(191,168,113,0.12),transparent_38%,rgba(122,158,114,0.16))]" />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
                <div className="relative mx-auto w-full max-w-[240px]">
                    <motion.div
                        className="absolute inset-x-[18%] top-[14%] h-[52%] rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${pose.accent}55 0%, rgba(122,158,114,0.06) 62%, transparent 100%)` }}
                        animate={reduceMotion ? { opacity: 0.45, scale: 1 } : { opacity: [0.34, 0.52, 0.34], scale: [0.96, 1.04, 0.96] }}
                        transition={loopTransition}
                    />

                    <svg
                        viewBox="0 0 220 220"
                        className="relative z-10 w-full"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id="river-fur" x1="54" y1="44" x2="176" y2="182" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#cfd2d4" />
                                <stop offset="46%" stopColor="#8e9497" />
                                <stop offset="100%" stopColor="#596062" />
                            </linearGradient>
                            <linearGradient id="river-fur-shadow" x1="86" y1="64" x2="146" y2="188" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#565d61" />
                                <stop offset="100%" stopColor="#1d2325" />
                            </linearGradient>
                            <linearGradient id="river-ear" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#e2cccb" />
                                <stop offset="100%" stopColor="#8f6f70" />
                            </linearGradient>
                            <linearGradient id="river-chest" x1="90" y1="132" x2="126" y2="188" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#eee7de" />
                                <stop offset="100%" stopColor="#b9b0a8" />
                            </linearGradient>
                            <filter id="river-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        <motion.g
                            animate={reduceMotion ? { y: 0, scaleY: 1 } : { y: [0, -2.5, 0], scaleY: [1, 1.012, 1] }}
                            transition={loopTransition}
                            style={{ transformOrigin: '110px 140px' }}
                        >
                            <motion.path
                                d="M160 166 C186 142 193 102 177 77 C166 61 150 58 144 73 C136 92 144 121 154 142 C145 138 132 136 122 143"
                                fill="none"
                                stroke="url(#river-fur-shadow)"
                                strokeWidth="14"
                                strokeLinecap="round"
                                animate={{ rotate: pose.tail }}
                                transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                                style={{ transformOrigin: '152px 152px' }}
                            />
                            <path
                                d="M66 165 C56 140 58 108 70 86 C80 67 95 56 110 56 C126 56 142 67 151 86 C163 109 164 141 154 165 C145 186 128 197 110 197 C92 197 75 186 66 165 Z"
                                fill="url(#river-fur)"
                                stroke="#31383c"
                                strokeWidth="3.5"
                            />
                            <motion.g
                                animate={{ rotate: pose.earLeft }}
                                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                                style={{ transformOrigin: '74px 66px' }}
                            >
                                <path d="M72 77 L62 40 L92 63 Z" fill="#737a7d" stroke="#31383c" strokeWidth="3.5" />
                                <path d="M72 70 L67 48 L84 63 Z" fill="url(#river-ear)" opacity="0.88" />
                            </motion.g>
                            <motion.g
                                animate={{ rotate: pose.earRight }}
                                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                                style={{ transformOrigin: '146px 66px' }}
                            >
                                <path d="M148 77 L128 63 L158 40 Z" fill="#737a7d" stroke="#31383c" strokeWidth="3.5" />
                                <path d="M148 70 L136 63 L153 48 Z" fill="url(#river-ear)" opacity="0.88" />
                            </motion.g>

                            <ellipse cx="110" cy="126" rx="35" ry="44" fill="url(#river-chest)" opacity="0.92" />
                            <ellipse cx="110" cy="97" rx="40" ry="35" fill="url(#river-fur)" stroke="#31383c" strokeWidth="3.5" />
                            <path d="M96 112 Q110 122 124 112" stroke="#31383c" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />

                            <motion.path
                                d="M78 90 Q88 84 96 88"
                                stroke="#2e3235"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                animate={{ y: pose.browLeft }}
                                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                            />
                            <motion.path
                                d="M124 88 Q132 84 142 90"
                                stroke="#2e3235"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                animate={{ y: pose.browRight }}
                                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                            />

                            <motion.g style={{ transformOrigin: '86px 98px' }} animate={{ scaleY: pose.eyeScale }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                                <ellipse cx="86" cy="98" rx="8" ry="10" fill="#f6f0df" />
                                <ellipse cx="86" cy="99" rx="4.2" ry="6.2" fill="#334032" />
                                <ellipse cx="86" cy="98" rx="1.5" ry="1.5" fill="#fffef8" />
                            </motion.g>
                            <motion.g style={{ transformOrigin: '134px 98px' }} animate={{ scaleY: pose.eyeScale }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                                <ellipse cx="134" cy="98" rx="8" ry="10" fill="#f6f0df" />
                                <ellipse cx="134" cy="99" rx="4.2" ry="6.2" fill="#334032" />
                                <ellipse cx="134" cy="98" rx="1.5" ry="1.5" fill="#fffef8" />
                            </motion.g>

                            <path d="M101 108 Q110 116 119 108" fill="#f0d9d5" stroke="#31383c" strokeWidth="2.5" strokeLinejoin="round" />
                            <path d="M110 109 L110 120" stroke="#31383c" strokeWidth="2.5" strokeLinecap="round" />
                            <motion.path
                                d={pose.mouth}
                                stroke="#31383c"
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                            />

                            <motion.g animate={{ x: pose.whisker }} transition={{ type: 'spring', stiffness: 170, damping: 18 }}>
                                <path d="M51 110 C66 106 79 106 91 110" stroke="#d7d2c9" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M54 118 C68 118 79 118 92 122" stroke="#d7d2c9" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M57 126 C71 130 80 129 91 132" stroke="#d7d2c9" strokeWidth="2.5" strokeLinecap="round" />
                            </motion.g>
                            <motion.g animate={{ x: -pose.whisker }} transition={{ type: 'spring', stiffness: 170, damping: 18 }}>
                                <path d="M169 110 C154 106 141 106 129 110" stroke="#d7d2c9" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M166 118 C152 118 141 118 128 122" stroke="#d7d2c9" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M163 126 C149 130 140 129 129 132" stroke="#d7d2c9" strokeWidth="2.5" strokeLinecap="round" />
                            </motion.g>

                            <path d="M76 174 C80 157 90 151 99 160" stroke="#43494c" strokeWidth="9" strokeLinecap="round" />
                            <path d="M144 174 C140 157 130 151 121 160" stroke="#43494c" strokeWidth="9" strokeLinecap="round" />
                        </motion.g>

                        {(state === 'mastery' || state === 'celebrate') ? (
                            <motion.g
                                filter="url(#river-soft-glow)"
                                animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0.35, 1, 0.35], scale: [0.95, 1.05, 0.95] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <circle cx="54" cy="54" r="3" fill={pose.accent} />
                                <circle cx="163" cy="46" r="4" fill="#f2e5b8" />
                                <circle cx="180" cy="82" r="2.5" fill={pose.accent} />
                            </motion.g>
                        ) : null}
                    </svg>
                </div>

                <div className="relative rounded-[1.6rem] border border-white/8 bg-[rgba(13,16,15,0.72)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                        River
                    </p>
                    <p className="mt-2 text-sm leading-6 text-claude-text">
                        {caption || 'We can take this one step at a time.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
