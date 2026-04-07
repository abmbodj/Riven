import React from 'react';
import { motion } from 'motion/react';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget';

const ENTER_EASE = [0.22, 1, 0.36, 1];
const EXIT_EASE = [0.7, 0, 0.84, 0];
const STATE_ALIASES = {
    focus: 'thinking',
    recover: 'encourage',
    misconception: 'gentle-correct',
    hint: 'point',
    mastery: 'encourage',
};

const POSES = {
    idle: {
        label: 'Settled and ready',
        accent: '#98c487',
        headY: 0,
        headRotate: -2,
        earLeft: -6,
        earRight: 8,
        eyeScaleY: 1,
        browY: 0,
        mouth: 'M113 170 Q140 183 166 170',
        pawLeftX: 0,
        pawLeftY: 0,
        pawLeftRotate: 4,
        pawRightX: 0,
        pawRightY: 0,
        pawRightRotate: -6,
        tailRotate: -10,
        beanieRotate: -3,
        bubbleTone: 'rgba(152,196,135,0.16)',
    },
    teach: {
        label: 'Teaching',
        accent: '#7fbf8d',
        headY: -2,
        headRotate: -5,
        earLeft: -10,
        earRight: 10,
        eyeScaleY: 0.94,
        browY: -3,
        mouth: 'M112 170 Q140 186 168 170',
        pawLeftX: -4,
        pawLeftY: 4,
        pawLeftRotate: 8,
        pawRightX: 8,
        pawRightY: -12,
        pawRightRotate: -24,
        tailRotate: -2,
        beanieRotate: -6,
        bubbleTone: 'rgba(127,191,141,0.18)',
    },
    point: {
        label: 'Pointing something out',
        accent: '#d2c06f',
        headY: -1,
        headRotate: 3,
        earLeft: -4,
        earRight: 14,
        eyeScaleY: 0.9,
        browY: -4,
        mouth: 'M112 170 Q139 181 166 168',
        pawLeftX: -2,
        pawLeftY: 6,
        pawLeftRotate: 10,
        pawRightX: 20,
        pawRightY: -18,
        pawRightRotate: -42,
        tailRotate: 10,
        beanieRotate: 0,
        bubbleTone: 'rgba(210,192,111,0.18)',
    },
    encourage: {
        label: 'Encouraging',
        accent: '#e4be80',
        headY: -1,
        headRotate: -3,
        earLeft: -3,
        earRight: 4,
        eyeScaleY: 0.86,
        browY: -2,
        mouth: 'M109 168 Q140 190 171 168',
        pawLeftX: -8,
        pawLeftY: 2,
        pawLeftRotate: 2,
        pawRightX: 8,
        pawRightY: -4,
        pawRightRotate: -8,
        tailRotate: 14,
        beanieRotate: -4,
        bubbleTone: 'rgba(228,190,128,0.18)',
    },
    thinking: {
        label: 'Thinking it through',
        accent: '#97b7d8',
        headY: -4,
        headRotate: 6,
        earLeft: -12,
        earRight: 2,
        eyeScaleY: 0.76,
        browY: -6,
        mouth: 'M118 173 Q140 163 162 173',
        pawLeftX: -2,
        pawLeftY: 8,
        pawLeftRotate: 12,
        pawRightX: 10,
        pawRightY: -6,
        pawRightRotate: -12,
        tailRotate: -8,
        beanieRotate: 5,
        bubbleTone: 'rgba(151,183,216,0.18)',
    },
    'gentle-correct': {
        label: 'Gently correcting',
        accent: '#e79a7c',
        headY: 0,
        headRotate: 4,
        earLeft: -16,
        earRight: 10,
        eyeScaleY: 0.72,
        browY: 4,
        mouth: 'M115 176 Q140 162 165 176',
        pawLeftX: 0,
        pawLeftY: 2,
        pawLeftRotate: 10,
        pawRightX: 14,
        pawRightY: -16,
        pawRightRotate: -34,
        tailRotate: -16,
        beanieRotate: 2,
        bubbleTone: 'rgba(231,154,124,0.18)',
    },
    celebrate: {
        label: 'Celebrating',
        accent: '#f0d37e',
        headY: -8,
        headRotate: -1,
        earLeft: 2,
        earRight: -1,
        eyeScaleY: 0.3,
        browY: -9,
        mouth: 'M106 166 Q140 198 174 166',
        pawLeftX: -14,
        pawLeftY: -20,
        pawLeftRotate: -36,
        pawRightX: 18,
        pawRightY: -24,
        pawRightRotate: -58,
        tailRotate: 20,
        beanieRotate: -8,
        bubbleTone: 'rgba(240,211,126,0.2)',
    },
};

const getMotionPreference = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const getPose = (state) => {
    const normalizedState = STATE_ALIASES[state] || state;
    return {
        normalizedState,
        pose: POSES[normalizedState] || POSES.idle,
    };
};

export default function RiverMascot({
    state = 'idle',
    caption = '',
    className = '',
}) {
    const mobileBudget = useMobileVisualBudget();
    const reduceMotion = mobileBudget || getMotionPreference();
    const { normalizedState, pose } = getPose(state);
    const breathing = reduceMotion
        ? { y: 0, scale: 1 }
        : { y: [0, -4, 0], scale: [1, 1.01, 1] };
    const blinking = reduceMotion
        ? { scaleY: pose.eyeScaleY }
        : { scaleY: [pose.eyeScaleY, pose.eyeScaleY, 0.18, pose.eyeScaleY] };
    const floatTransition = reduceMotion
        ? { duration: 0 }
        : { duration: 4.8, repeat: Infinity, ease: ENTER_EASE };

    return (
        <div
            className={`relative overflow-hidden rounded-[2rem] border border-claude-border/80 bg-[radial-gradient(circle_at_top,_rgba(241,223,182,0.18),_rgba(13,15,14,0.97)_66%)] p-4 sm:p-5 ${className}`}
            data-testid="river-mascot"
            data-river-state={normalizedState}
            aria-label={`River is ${pose.label.toLowerCase()}`}
        >
            <div className="pointer-events-none absolute inset-0 opacity-80 [background:linear-gradient(180deg,rgba(250,232,193,0.14),transparent_18%),linear-gradient(180deg,transparent_72%,rgba(32,40,34,0.84)_100%)]" />
            <div className="pointer-events-none absolute inset-x-8 bottom-6 h-20 rounded-full bg-[radial-gradient(circle,_rgba(0,0,0,0.42),transparent_72%)] blur-2xl" />

            <div className="relative flex flex-col gap-4">
                <div className="relative mx-auto w-full max-w-[290px]">
                    <motion.div
                        className="absolute inset-x-[16%] top-[8%] h-[58%] rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${pose.accent}44 0%, rgba(255,255,255,0.06) 42%, transparent 74%)` }}
                        animate={reduceMotion ? { opacity: 0.5, scale: 1 } : { opacity: [0.36, 0.62, 0.36], scale: [0.96, 1.04, 0.96] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: ENTER_EASE }}
                    />

                    <svg viewBox="0 0 280 300" className="relative z-10 w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="river-body-fur" x1="88" y1="90" x2="194" y2="250" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#d7dadd" />
                                <stop offset="56%" stopColor="#8b9499" />
                                <stop offset="100%" stopColor="#525b60" />
                            </linearGradient>
                            <linearGradient id="river-head-fur" x1="90" y1="66" x2="190" y2="170" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#eef1f3" />
                                <stop offset="52%" stopColor="#a0a7ac" />
                                <stop offset="100%" stopColor="#626a6f" />
                            </linearGradient>
                            <linearGradient id="river-chest" x1="122" y1="160" x2="164" y2="242" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#f3ede6" />
                                <stop offset="100%" stopColor="#c7beb6" />
                            </linearGradient>
                            <linearGradient id="river-beanie" x1="94" y1="54" x2="186" y2="92" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#6aa06a" />
                                <stop offset="100%" stopColor="#315237" />
                            </linearGradient>
                            <radialGradient id="river-stage" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(138 194) rotate(90) scale(72 90)">
                                <stop offset="0%" stopColor="rgba(241,223,182,0.2)" />
                                <stop offset="100%" stopColor="rgba(13,15,14,0)" />
                            </radialGradient>
                        </defs>

                        <ellipse cx="140" cy="206" rx="96" ry="76" fill="url(#river-stage)" />

                        <motion.g
                            animate={breathing}
                            transition={floatTransition}
                            style={{ transformOrigin: '140px 196px' }}
                        >
                            <motion.path
                                d="M206 224 C236 198 244 147 220 114 C211 101 193 104 187 120 C179 143 188 176 196 195 C185 191 170 190 158 198"
                                fill="none"
                                stroke="#4a5357"
                                strokeWidth="16"
                                strokeLinecap="round"
                                animate={{ rotate: pose.tailRotate }}
                                transition={{ duration: 0.4, ease: ENTER_EASE }}
                                style={{ transformOrigin: '198px 208px' }}
                            />

                            <path
                                d="M84 224 C72 198 74 160 88 134 C102 108 119 96 140 96 C161 96 178 108 192 134 C206 161 208 198 196 224 C184 250 164 264 140 264 C116 264 96 250 84 224 Z"
                                fill="url(#river-body-fur)"
                                stroke="#303739"
                                strokeWidth="4"
                            />
                            <ellipse cx="140" cy="203" rx="41" ry="56" fill="url(#river-chest)" opacity="0.96" />

                            <motion.g
                                animate={{ x: pose.pawLeftX, y: pose.pawLeftY, rotate: pose.pawLeftRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '104px 232px' }}
                            >
                                <ellipse cx="104" cy="232" rx="22" ry="14" fill="#545c60" />
                            </motion.g>
                            <motion.g
                                animate={{ x: pose.pawRightX, y: pose.pawRightY, rotate: pose.pawRightRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '178px 228px' }}
                            >
                                <ellipse cx="178" cy="228" rx="22" ry="14" fill="#545c60" />
                            </motion.g>

                            <motion.g
                                animate={{ y: pose.headY, rotate: pose.headRotate }}
                                transition={{ duration: 0.4, ease: ENTER_EASE }}
                                style={{ transformOrigin: '140px 126px' }}
                            >
                                <motion.g
                                    animate={{ rotate: pose.earLeft }}
                                    transition={{ duration: 0.32, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '100px 94px' }}
                                >
                                    <path d="M96 114 L82 64 L122 90 Z" fill="#7d868a" stroke="#303739" strokeWidth="4" />
                                    <path d="M96 103 L90 76 L112 92 Z" fill="#dcb8b3" opacity="0.9" />
                                </motion.g>
                                <motion.g
                                    animate={{ rotate: pose.earRight }}
                                    transition={{ duration: 0.32, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '180px 94px' }}
                                >
                                    <path d="M184 114 L158 90 L198 64 Z" fill="#7d868a" stroke="#303739" strokeWidth="4" />
                                    <path d="M182 102 L168 91 L190 76 Z" fill="#dcb8b3" opacity="0.9" />
                                </motion.g>

                                <motion.g
                                    animate={{ rotate: pose.beanieRotate }}
                                    transition={{ duration: 0.4, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '140px 80px' }}
                                >
                                    <path
                                        d="M98 96 C102 64 124 46 144 46 C167 46 188 63 190 95 C172 84 153 80 140 80 C126 80 113 84 98 96 Z"
                                        fill="url(#river-beanie)"
                                        stroke="#1d3020"
                                        strokeWidth="4"
                                    />
                                    <path d="M92 96 C112 84 129 80 140 80 C152 80 171 84 192 96 L186 108 C170 98 154 95 140 95 C126 95 111 98 98 108 Z" fill="#84b57e" />
                                    <circle cx="140" cy="44" r="14" fill="#7aae73" stroke="#1d3020" strokeWidth="4" />
                                </motion.g>

                                <path
                                    d="M88 148 C88 116 110 90 140 90 C170 90 192 116 192 148 C192 180 169 202 140 202 C111 202 88 180 88 148 Z"
                                    fill="url(#river-head-fur)"
                                    stroke="#303739"
                                    strokeWidth="4"
                                />

                                <motion.path
                                    d="M107 128 Q120 121 131 126"
                                    stroke="#2a3133"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    animate={{ y: pose.browY }}
                                    transition={{ duration: 0.3, ease: ENTER_EASE }}
                                />
                                <motion.path
                                    d="M149 126 Q160 121 173 128"
                                    stroke="#2a3133"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    animate={{ y: pose.browY }}
                                    transition={{ duration: 0.3, ease: ENTER_EASE }}
                                />

                                <motion.g
                                    animate={blinking}
                                    transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '117px 145px' }}
                                >
                                    <ellipse cx="117" cy="145" rx="11" ry="13" fill="#fbf6e9" />
                                    <ellipse cx="117" cy="146" rx="5" ry="7" fill="#2c3a2d" />
                                    <circle cx="119" cy="143" r="1.8" fill="#fffef9" />
                                </motion.g>
                                <motion.g
                                    animate={blinking}
                                    transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE, delay: reduceMotion ? 0 : 0.12 }}
                                    style={{ transformOrigin: '163px 145px' }}
                                >
                                    <ellipse cx="163" cy="145" rx="11" ry="13" fill="#fbf6e9" />
                                    <ellipse cx="163" cy="146" rx="5" ry="7" fill="#2c3a2d" />
                                    <circle cx="165" cy="143" r="1.8" fill="#fffef9" />
                                </motion.g>

                                <path d="M132 157 Q140 164 148 157" fill="#efcdc3" stroke="#303739" strokeWidth="3" strokeLinejoin="round" />
                                <path d="M140 160 L140 170" stroke="#303739" strokeWidth="3" strokeLinecap="round" />
                                <motion.path
                                    d={pose.mouth}
                                    stroke="#303739"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    fill="none"
                                    transition={{ duration: 0.3, ease: ENTER_EASE }}
                                />

                                <g opacity="0.88">
                                    <path d="M72 154 C90 149 102 149 122 154" stroke="#ddd8cf" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M74 166 C91 166 102 167 122 170" stroke="#ddd8cf" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M208 154 C190 149 178 149 158 154" stroke="#ddd8cf" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M206 166 C189 166 178 167 158 170" stroke="#ddd8cf" strokeWidth="3" strokeLinecap="round" />
                                </g>
                            </motion.g>

                            {normalizedState === 'celebrate' ? (
                                <motion.g
                                    animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0.36, 0.9, 0.36], scale: [0.96, 1.04, 0.96] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: ENTER_EASE }}
                                >
                                    <circle cx="66" cy="74" r="5" fill="#f0d37e" />
                                    <circle cx="214" cy="86" r="4" fill="#9fd8a6" />
                                    <circle cx="226" cy="142" r="3.5" fill="#f6e8b2" />
                                </motion.g>
                            ) : null}
                        </motion.g>
                    </svg>
                </div>

                <motion.div
                    className="relative rounded-[1.6rem] border border-white/10 bg-[rgba(12,14,13,0.76)] px-4 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: ENTER_EASE }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.18, ease: EXIT_EASE } }}
                >
                    <div
                        className="absolute inset-x-3 inset-y-3 rounded-[1.2rem] blur-2xl"
                        style={{ background: pose.bubbleTone, opacity: reduceMotion ? 0.7 : 1 }}
                    />
                    <div className="relative">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                            River
                        </p>
                        <p className="mt-2 text-sm leading-6 text-claude-text">
                            {caption || 'We can take this one step at a time.'}
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
