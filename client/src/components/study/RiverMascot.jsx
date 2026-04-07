import React, { useId } from 'react';
import { motion } from 'motion/react';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget';

const ENTER_EASE = [0.22, 1, 0.36, 1];

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
        accent: '#8fb27c',
        bodyY: 0,
        bodyScale: 1,
        headY: 0,
        headRotate: -1,
        eyeScaleX: 0.95,
        eyeScaleY: 0.95,
        pupilX: 0,
        pupilY: 0,
        mouth: 'M144 177 Q160 183 176 177',
        forelimbLeftX: 0,
        forelimbLeftY: 0,
        forelimbLeftRotate: -4,
        forelimbRightX: 0,
        forelimbRightY: 0,
        forelimbRightRotate: 4,
        hindlegLeftRotate: -7,
        hindlegRightRotate: 7,
        hindlegDrift: 2,
        hatRotate: -2,
        hatY: 0,
    },
    teach: {
        label: 'Teaching',
        accent: '#79ad75',
        bodyY: -2,
        bodyScale: 1.01,
        headY: -5,
        headRotate: -5,
        eyeScaleX: 0.95,
        eyeScaleY: 0.93,
        pupilX: 0,
        pupilY: -1,
        mouth: 'M145 176 Q160 182 175 176',
        forelimbLeftX: -3,
        forelimbLeftY: 2,
        forelimbLeftRotate: -8,
        forelimbRightX: 18,
        forelimbRightY: -10,
        forelimbRightRotate: -20,
        hindlegLeftRotate: -8,
        hindlegRightRotate: 6,
        hindlegDrift: 1.5,
        hatRotate: -4,
        hatY: -1,
    },
    point: {
        label: 'Pointing something out',
        accent: '#c5b56d',
        bodyY: -1,
        bodyScale: 1,
        headY: -3,
        headRotate: 4,
        eyeScaleX: 0.96,
        eyeScaleY: 0.91,
        pupilX: 1,
        pupilY: 0,
        mouth: 'M145 176 Q160 180 175 174',
        forelimbLeftX: 0,
        forelimbLeftY: 3,
        forelimbLeftRotate: -1,
        forelimbRightX: 28,
        forelimbRightY: -20,
        forelimbRightRotate: -34,
        hindlegLeftRotate: -6,
        hindlegRightRotate: 9,
        hindlegDrift: 2,
        hatRotate: 0,
        hatY: 0,
    },
    encourage: {
        label: 'Encouraging',
        accent: '#dcb679',
        bodyY: -2,
        bodyScale: 1.01,
        headY: -2,
        headRotate: -3,
        eyeScaleX: 0.98,
        eyeScaleY: 0.98,
        pupilX: 0,
        pupilY: -1,
        mouth: 'M143 176 Q160 186 177 176',
        forelimbLeftX: -8,
        forelimbLeftY: -3,
        forelimbLeftRotate: -13,
        forelimbRightX: 8,
        forelimbRightY: -3,
        forelimbRightRotate: 13,
        hindlegLeftRotate: -5,
        hindlegRightRotate: 5,
        hindlegDrift: 2,
        hatRotate: -2,
        hatY: -1,
    },
    thinking: {
        label: 'Thinking it through',
        accent: '#8ea9a0',
        bodyY: 0,
        bodyScale: 1,
        headY: -4,
        headRotate: 6,
        eyeScaleX: 0.94,
        eyeScaleY: 0.86,
        pupilX: -1,
        pupilY: -1,
        mouth: 'M146 177 Q160 173 174 177',
        forelimbLeftX: -2,
        forelimbLeftY: 6,
        forelimbLeftRotate: 10,
        forelimbRightX: 6,
        forelimbRightY: 2,
        forelimbRightRotate: -4,
        hindlegLeftRotate: -10,
        hindlegRightRotate: 4,
        hindlegDrift: 1.2,
        hatRotate: 3,
        hatY: 0,
    },
    'gentle-correct': {
        label: 'Gently correcting',
        accent: '#d59678',
        bodyY: 0,
        bodyScale: 1,
        headY: -1,
        headRotate: 4,
        eyeScaleX: 0.95,
        eyeScaleY: 0.9,
        pupilX: 0,
        pupilY: 1,
        mouth: 'M145 178 Q160 171 175 178',
        forelimbLeftX: -1,
        forelimbLeftY: 2,
        forelimbLeftRotate: 0,
        forelimbRightX: 10,
        forelimbRightY: -7,
        forelimbRightRotate: -12,
        hindlegLeftRotate: -8,
        hindlegRightRotate: 7,
        hindlegDrift: 1.5,
        hatRotate: 2,
        hatY: 0,
    },
    celebrate: {
        label: 'Celebrating',
        accent: '#e7c86f',
        bodyY: -5,
        bodyScale: 1.02,
        headY: -10,
        headRotate: -1,
        eyeScaleX: 1.01,
        eyeScaleY: 1.02,
        pupilX: 0,
        pupilY: -2,
        mouth: 'M142 176 Q160 189 178 176',
        forelimbLeftX: -18,
        forelimbLeftY: -18,
        forelimbLeftRotate: -22,
        forelimbRightX: 18,
        forelimbRightY: -18,
        forelimbRightRotate: 22,
        hindlegLeftRotate: -5,
        hindlegRightRotate: 5,
        hindlegDrift: 3,
        hatRotate: -6,
        hatY: -2,
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

function FrogEye({
    cx,
    cy,
    pose,
    reduceMotion,
    delay = 0,
    featureName,
    pupilFeature,
}) {
    const blinkAnimation = reduceMotion
        ? { scaleX: pose.eyeScaleX, scaleY: pose.eyeScaleY }
        : {
            scaleX: [pose.eyeScaleX, pose.eyeScaleX, pose.eyeScaleX * 0.98, pose.eyeScaleX],
            scaleY: [pose.eyeScaleY, pose.eyeScaleY, 0.22, pose.eyeScaleY],
        };
    const pupilCx = cx + pose.pupilX;
    const pupilCy = cy + pose.pupilY + 1;

    return (
        <motion.g
            animate={blinkAnimation}
            transition={{ duration: 4.1, repeat: Infinity, ease: ENTER_EASE, delay }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
            <path
                d={`M${cx - 18} ${cy - 16} Q${cx} ${cy - 25} ${cx + 18} ${cy - 16}`}
                stroke="#334235"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.34"
            />
            <ellipse
                data-river-feature={featureName}
                cx={cx}
                cy={cy}
                rx="18.5"
                ry="21"
                fill="#edf2c8"
                stroke="#334235"
                strokeWidth="3.2"
            />
            <ellipse cx={cx} cy={cy + 7} rx="13.5" ry="9.2" fill="#dbe3b0" opacity="0.62" />
            <circle data-river-feature={pupilFeature} cx={pupilCx} cy={pupilCy} r="6.4" fill="#17231a" />
            <circle cx={cx - 4.5} cy={cy - 5.8} r="3.6" fill="#fffef0" />
            <circle cx={cx + 2.4} cy={cy - 0.5} r="1.9" fill="#fffef0" opacity="0.92" />
        </motion.g>
    );
}

export default function RiverMascot({
    state = 'idle',
    caption = '',
    className = '',
}) {
    const mobileBudget = useMobileVisualBudget();
    const reduceMotion = mobileBudget || getMotionPreference();
    const { normalizedState, pose } = getPose(state);
    const assetPrefix = useId().replace(/:/g, '');
    const ids = {
        body: `${assetPrefix}-river-body`,
        belly: `${assetPrefix}-river-belly`,
        head: `${assetPrefix}-river-head`,
        limb: `${assetPrefix}-river-limb`,
        hat: `${assetPrefix}-river-hat`,
        stage: `${assetPrefix}-river-stage`,
    };

    const bodyAnimation = reduceMotion
        ? { y: pose.bodyY, scale: pose.bodyScale }
        : {
            y: [pose.bodyY, pose.bodyY - 3, pose.bodyY],
            scale: [pose.bodyScale, pose.bodyScale + 0.012, pose.bodyScale],
        };
    const floatTransition = reduceMotion
        ? { duration: 0 }
        : { duration: 4.8, repeat: Infinity, ease: ENTER_EASE };
    const hindlegLeftAnimation = reduceMotion
        ? { rotate: pose.hindlegLeftRotate }
        : { rotate: [pose.hindlegLeftRotate, pose.hindlegLeftRotate + pose.hindlegDrift, pose.hindlegLeftRotate] };
    const hindlegRightAnimation = reduceMotion
        ? { rotate: pose.hindlegRightRotate }
        : { rotate: [pose.hindlegRightRotate, pose.hindlegRightRotate - pose.hindlegDrift, pose.hindlegRightRotate] };

    return (
        <div
            className={`relative overflow-hidden rounded-[2rem] border border-claude-border/80 bg-[radial-gradient(circle_at_top,_rgba(241,223,182,0.18),_rgba(13,15,14,0.97)_68%)] p-4 pt-5 sm:p-5 sm:pt-6 ${className}`}
            data-testid="river-mascot"
            data-river-state={normalizedState}
            role="img"
            aria-label={`River is ${pose.label.toLowerCase()}`}
        >
            <div className="pointer-events-none absolute inset-0 opacity-80 [background:linear-gradient(180deg,rgba(250,232,193,0.14),transparent_18%),linear-gradient(180deg,transparent_72%,rgba(32,40,34,0.84)_100%)]" />
            <div className="pointer-events-none absolute inset-x-8 bottom-6 h-20 rounded-full bg-[radial-gradient(circle,_rgba(0,0,0,0.42),transparent_72%)] blur-2xl" />

            <div className="relative flex flex-col gap-4">
                <div className="relative mx-auto w-full max-w-[320px]">
                    <motion.div
                        className="absolute inset-x-[16%] top-[10%] h-[58%] rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${pose.accent}44 0%, rgba(255,255,255,0.07) 42%, transparent 74%)` }}
                        animate={reduceMotion ? { opacity: 0.48, scale: 1 } : { opacity: [0.34, 0.6, 0.34], scale: [0.97, 1.04, 0.97] }}
                        transition={{ duration: 3.1, repeat: Infinity, ease: ENTER_EASE }}
                    />

                    <svg viewBox="0 0 320 330" className="relative z-10 w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id={ids.body} x1="96" y1="146" x2="224" y2="278" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#9fb685" />
                                <stop offset="58%" stopColor="#6f8f58" />
                                <stop offset="100%" stopColor="#425c36" />
                            </linearGradient>
                            <linearGradient id={ids.belly} x1="129" y1="168" x2="189" y2="271" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#f2eccd" />
                                <stop offset="100%" stopColor="#d9c8a4" />
                            </linearGradient>
                            <linearGradient id={ids.head} x1="104" y1="62" x2="220" y2="214" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#a8be8d" />
                                <stop offset="60%" stopColor="#789761" />
                                <stop offset="100%" stopColor="#4b643e" />
                            </linearGradient>
                            <linearGradient id={ids.limb} x1="92" y1="176" x2="215" y2="276" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#809d66" />
                                <stop offset="100%" stopColor="#506540" />
                            </linearGradient>
                            <linearGradient id={ids.hat} x1="128" y1="70" x2="191" y2="108" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#8fba73" />
                                <stop offset="100%" stopColor="#294428" />
                            </linearGradient>
                            <radialGradient id={ids.stage} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 244) rotate(90) scale(78 118)">
                                <stop offset="0%" stopColor="rgba(201,220,150,0.2)" />
                                <stop offset="100%" stopColor="rgba(13,15,14,0)" />
                            </radialGradient>
                        </defs>

                        <ellipse cx="160" cy="244" rx="118" ry="78" fill={`url(#${ids.stage})`} />

                        <motion.g
                            animate={bodyAnimation}
                            transition={floatTransition}
                            style={{ transformOrigin: '160px 214px' }}
                        >
                            <motion.g
                                animate={hindlegLeftAnimation}
                                transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE }}
                                style={{ transformOrigin: '113px 220px' }}
                            >
                                <path
                                    data-river-feature="hindleg-left"
                                    d="M111 249 C94 243 84 228 86 210 C88 191 101 179 118 180 C128 181 136 189 138 201 C141 219 130 237 111 249 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M100 253 C110 262 127 266 142 261 C149 258 149 250 141 247 C128 242 113 244 100 249 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                            </motion.g>
                            <motion.g
                                animate={hindlegRightAnimation}
                                transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE }}
                                style={{ transformOrigin: '207px 220px' }}
                            >
                                <path
                                    data-river-feature="hindleg-right"
                                    d="M209 249 C226 243 236 228 234 210 C232 191 219 179 202 180 C192 181 184 189 182 201 C179 219 190 237 209 249 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M220 253 C210 262 193 266 178 261 C171 258 171 250 179 247 C192 242 207 244 220 249 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                            </motion.g>

                            <path
                                d="M107 255 C93 242 89 218 98 192 C108 164 129 149 160 147 C191 149 212 164 222 192 C231 218 227 242 213 255 C201 266 183 273 160 275 C137 273 119 266 107 255 Z"
                                fill={`url(#${ids.body})`}
                                stroke="#334235"
                                strokeWidth="4"
                            />
                            <ellipse cx="124" cy="208" rx="22" ry="28" fill="#5c7449" opacity="0.24" />
                            <ellipse cx="196" cy="208" rx="22" ry="28" fill="#5c7449" opacity="0.24" />
                            <path
                                data-river-feature="belly"
                                d="M128 179 C125 194 127 234 133 259 C141 265 150 268 160 269 C170 268 179 265 187 259 C193 234 195 194 192 179 C189 167 131 167 128 179 Z"
                                fill={`url(#${ids.belly})`}
                                opacity="0.98"
                            />
                            <ellipse cx="160" cy="194" rx="27" ry="18" fill="#fbf5da" opacity="0.22" />

                            <motion.g
                                animate={{ x: pose.forelimbLeftX, y: pose.forelimbLeftY, rotate: pose.forelimbLeftRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '145px 226px' }}
                            >
                                <path
                                    data-river-feature="forelimb-left"
                                    d="M132 195 C125 208 124 230 128 253 C130 264 140 269 149 267 C155 265 158 258 158 248 L158 205 C158 195 138 188 132 195 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                                <path d="M131 252 C137 257 144 259 151 258" stroke="#698453" strokeWidth="3" strokeLinecap="round" />
                            </motion.g>
                            <motion.g
                                animate={{ x: pose.forelimbRightX, y: pose.forelimbRightY, rotate: pose.forelimbRightRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '175px 226px' }}
                            >
                                <path
                                    data-river-feature="forelimb-right"
                                    d="M188 195 C195 208 196 230 192 253 C190 264 180 269 171 267 C165 265 162 258 162 248 L162 205 C162 195 182 188 188 195 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                                <path d="M189 252 C183 257 176 259 169 258" stroke="#698453" strokeWidth="3" strokeLinecap="round" />
                            </motion.g>

                            <motion.g
                                animate={{ y: pose.headY, rotate: pose.headRotate }}
                                transition={{ duration: 0.4, ease: ENTER_EASE }}
                                style={{ transformOrigin: '160px 148px' }}
                            >
                                <path
                                    data-river-feature="head"
                                    d="M111 166 C102 155 98 139 100 122 C103 98 116 80 136 72 C143 64 151 60 160 60 C169 60 177 64 184 72 C204 80 217 98 220 122 C222 139 218 155 209 166 C211 182 204 196 191 205 C182 212 171 216 160 217 C149 216 138 212 129 205 C116 196 109 182 111 166 Z"
                                    fill={`url(#${ids.head})`}
                                    stroke="#334235"
                                    strokeWidth="4"
                                />
                                <ellipse cx="135" cy="139" rx="12" ry="10" fill="#60794b" opacity="0.28" />
                                <ellipse cx="185" cy="139" rx="12" ry="10" fill="#60794b" opacity="0.28" />

                                <motion.g
                                    animate={{ y: pose.hatY, rotate: pose.hatRotate }}
                                    transition={{ duration: 0.4, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '160px 88px' }}
                                >
                                    <path
                                        data-river-feature="hat"
                                        d="M132 91 C139 80 149 72 160 72 C171 72 181 80 188 91 C179 87 170 85 160 85 C150 85 141 87 132 91 Z"
                                        fill={`url(#${ids.hat})`}
                                        stroke="#223a22"
                                        strokeWidth="4"
                                    />
                                    <path
                                        data-river-feature="hat-band"
                                        d="M130 95 C139 90 149 88 160 88 C171 88 181 90 190 95 L188 106 C180 103 170 101 160 101 C150 101 140 103 132 106 Z"
                                        fill="#a5cb89"
                                        stroke="#223a22"
                                        strokeWidth="2.6"
                                        strokeLinejoin="round"
                                    />
                                    <path d="M143 92 L144 104" stroke="#729b63" strokeWidth="2.1" strokeLinecap="round" opacity="0.78" />
                                    <path d="M152 90 L152 103" stroke="#729b63" strokeWidth="2.1" strokeLinecap="round" opacity="0.78" />
                                    <path d="M160 89 L160 103" stroke="#729b63" strokeWidth="2.1" strokeLinecap="round" opacity="0.78" />
                                    <path d="M168 90 L168 103" stroke="#729b63" strokeWidth="2.1" strokeLinecap="round" opacity="0.78" />
                                    <path d="M177 92 L176 104" stroke="#729b63" strokeWidth="2.1" strokeLinecap="round" opacity="0.78" />
                                    <circle cx="160" cy="68" r="5.8" fill="#9ac07e" stroke="#223a22" strokeWidth="3.5" />
                                </motion.g>

                                <FrogEye
                                    cx={127}
                                    cy={107}
                                    pose={pose}
                                    reduceMotion={reduceMotion}
                                    delay={0}
                                    featureName="eye-left"
                                    pupilFeature="pupil-left"
                                />
                                <FrogEye
                                    cx={193}
                                    cy={107}
                                    pose={pose}
                                    reduceMotion={reduceMotion}
                                    delay={0.18}
                                    featureName="eye-right"
                                    pupilFeature="pupil-right"
                                />

                                <ellipse cx="152" cy="166" rx="2.2" ry="1.6" fill="#50623e" opacity="0.68" />
                                <ellipse cx="168" cy="166" rx="2.2" ry="1.6" fill="#50623e" opacity="0.68" />
                                <path
                                    data-river-feature="mouth"
                                    d={pose.mouth}
                                    stroke="#2f3e31"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    fill="none"
                                />
                            </motion.g>
                        </motion.g>
                    </svg>
                </div>

                {caption ? (
                    <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.32, ease: ENTER_EASE }}
                        className="glass-panel-subtle relative rounded-[1.8rem] border border-claude-border/60 bg-[radial-gradient(circle_at_50%_10%,_rgba(161,190,118,0.1),_rgba(12,14,13,0.9)_68%)] p-5 sm:p-6"
                    >
                        <div
                            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-70"
                            style={{ boxShadow: `inset 0 0 0 1px ${pose.accent}18, 0 20px 40px rgba(0,0,0,0.16)` }}
                        />
                        <div className="relative">
                            <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.34em] text-claude-accent">
                                River
                            </p>
                            <p className="mt-3 text-balance font-serif text-[1.05rem] leading-relaxed text-claude-text sm:text-[1.12rem]">
                                {caption}
                            </p>
                        </div>
                    </motion.div>
                ) : null}
            </div>
        </div>
    );
}
