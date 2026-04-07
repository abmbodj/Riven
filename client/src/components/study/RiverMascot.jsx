import React, { useCallback, useEffect, useId, useState } from 'react';
import { motion } from 'motion/react';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget';

const ENTER_EASE = [0.22, 1, 0.36, 1];
const EXIT_EASE = [0.7, 0, 0.84, 0];
const HOVER_POINTER_MQ = '(hover: hover) and (pointer: fine)';
const DEFAULT_POINTER_OFFSET = Object.freeze({ x: 0, y: 0 });

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
        headRotate: -1,
        earLeft: -5,
        earRight: 3,
        earDrift: 2,
        eyeScaleX: 0.94,
        eyeScaleY: 0.94,
        pupilX: 0,
        pupilY: 0,
        browY: -1,
        browLeftRotate: -7,
        browRightRotate: 7,
        mouth: 'M149 190 Q160 194 171 190',
        pawLeftX: 0,
        pawLeftY: 0,
        pawLeftRotate: -2,
        pawRightX: 0,
        pawRightY: 0,
        pawRightRotate: 2,
        tailRotate: -9,
        tailSwing: 6,
        beanieRotate: -2,
        beanieY: 0,
        bubbleTone: 'rgba(152,196,135,0.16)',
    },
    teach: {
        label: 'Teaching',
        accent: '#7fbf8d',
        headY: -4,
        headRotate: -6,
        earLeft: -10,
        earRight: 2,
        earDrift: 1.5,
        eyeScaleX: 0.95,
        eyeScaleY: 0.94,
        pupilX: 0,
        pupilY: -1,
        browY: -3,
        browLeftRotate: -8,
        browRightRotate: 6,
        mouth: 'M148 190 Q160 196 172 189',
        pawLeftX: -2,
        pawLeftY: 2,
        pawLeftRotate: -3,
        pawRightX: 24,
        pawRightY: -18,
        pawRightRotate: -28,
        tailRotate: 2,
        tailSwing: 6,
        beanieRotate: -5,
        beanieY: -1,
        bubbleTone: 'rgba(127,191,141,0.18)',
    },
    point: {
        label: 'Pointing something out',
        accent: '#d2c06f',
        headY: -2,
        headRotate: 4,
        earLeft: -4,
        earRight: 10,
        earDrift: 1.5,
        eyeScaleX: 0.96,
        eyeScaleY: 0.92,
        pupilX: 2,
        pupilY: 0,
        browY: -4,
        browLeftRotate: -9,
        browRightRotate: 8,
        mouth: 'M148 191 Q160 194 172 188',
        pawLeftX: 0,
        pawLeftY: 4,
        pawLeftRotate: 0,
        pawRightX: 34,
        pawRightY: -24,
        pawRightRotate: -42,
        tailRotate: 11,
        tailSwing: 8,
        beanieRotate: 0,
        beanieY: 0,
        bubbleTone: 'rgba(210,192,111,0.18)',
    },
    encourage: {
        label: 'Encouraging',
        accent: '#e4be80',
        headY: -2,
        headRotate: -4,
        earLeft: -2,
        earRight: 5,
        earDrift: 2,
        eyeScaleX: 0.98,
        eyeScaleY: 0.98,
        pupilX: 0,
        pupilY: -1,
        browY: -1,
        browLeftRotate: -6,
        browRightRotate: 6,
        mouth: 'M147 188 Q160 197 173 188',
        pawLeftX: -6,
        pawLeftY: 1,
        pawLeftRotate: -6,
        pawRightX: 8,
        pawRightY: -4,
        pawRightRotate: -10,
        tailRotate: 15,
        tailSwing: 9,
        beanieRotate: -3,
        beanieY: -1,
        bubbleTone: 'rgba(228,190,128,0.18)',
    },
    thinking: {
        label: 'Thinking it through',
        accent: '#97b7d8',
        headY: -5,
        headRotate: 9,
        earLeft: -15,
        earRight: -1,
        earDrift: 1.2,
        eyeScaleX: 0.95,
        eyeScaleY: 0.88,
        pupilX: -2,
        pupilY: -1,
        browY: -5,
        browLeftRotate: -12,
        browRightRotate: 0,
        mouth: 'M150 191 Q160 187 170 191',
        pawLeftX: -2,
        pawLeftY: 5,
        pawLeftRotate: 5,
        pawRightX: 10,
        pawRightY: -8,
        pawRightRotate: -10,
        tailRotate: -6,
        tailSwing: 5,
        beanieRotate: 4,
        beanieY: 0,
        bubbleTone: 'rgba(151,183,216,0.18)',
    },
    'gentle-correct': {
        label: 'Gently correcting',
        accent: '#e79a7c',
        headY: 0,
        headRotate: 5,
        earLeft: -12,
        earRight: 6,
        earDrift: 1,
        eyeScaleX: 0.95,
        eyeScaleY: 0.9,
        pupilX: 1,
        pupilY: 1,
        browY: 1,
        browLeftRotate: 5,
        browRightRotate: -5,
        mouth: 'M149 193 Q160 186 171 193',
        pawLeftX: 0,
        pawLeftY: 2,
        pawLeftRotate: 0,
        pawRightX: 20,
        pawRightY: -14,
        pawRightRotate: -20,
        tailRotate: -14,
        tailSwing: 4,
        beanieRotate: 2,
        beanieY: 0,
        bubbleTone: 'rgba(231,154,124,0.18)',
    },
    celebrate: {
        label: 'Celebrating',
        accent: '#f0d37e',
        headY: -10,
        headRotate: -2,
        earLeft: 5,
        earRight: -3,
        earDrift: 2,
        eyeScaleX: 1.02,
        eyeScaleY: 1.04,
        pupilX: 0,
        pupilY: -3,
        browY: -7,
        browLeftRotate: -9,
        browRightRotate: 9,
        mouth: 'M146 188 Q160 202 174 188',
        pawLeftX: -18,
        pawLeftY: -24,
        pawLeftRotate: -26,
        pawRightX: 18,
        pawRightY: -26,
        pawRightRotate: -54,
        tailRotate: 24,
        tailSwing: 12,
        beanieRotate: -8,
        beanieY: -2,
        bubbleTone: 'rgba(240,211,126,0.2)',
    },
};

const getMotionPreference = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const getHoverPointerPreference = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia(HOVER_POINTER_MQ).matches;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPose = (state) => {
    const normalizedState = STATE_ALIASES[state] || state;
    return {
        normalizedState,
        pose: POSES[normalizedState] || POSES.idle,
    };
};

function RiverEye({
    cx,
    cy,
    pose,
    reduceMotion,
    delay = 0,
    pupilOffset = DEFAULT_POINTER_OFFSET,
    featureName,
}) {
    const blinkAnimation = reduceMotion
        ? { scaleX: pose.eyeScaleX, scaleY: pose.eyeScaleY }
        : {
            scaleX: [pose.eyeScaleX, pose.eyeScaleX, pose.eyeScaleX * 0.98, pose.eyeScaleX],
            scaleY: [pose.eyeScaleY, pose.eyeScaleY, 0.18, pose.eyeScaleY],
        };
    const pupilCx = cx + pose.pupilX + pupilOffset.x;
    const pupilCy = cy + pose.pupilY + pupilOffset.y + 1;

    return (
        <motion.g
            animate={blinkAnimation}
            transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE, delay }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
            <path
                d={`M${cx - 17} ${cy - 10} Q${cx} ${cy - 20} ${cx + 17} ${cy - 10}`}
                stroke="#23283a"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.24"
            />
            <ellipse cx={cx} cy={cy} rx="15.5" ry="16.8" fill="#31364d" />
            <ellipse cx={cx} cy={cy + 5} rx="10.8" ry="8.2" fill="#58617f" opacity="0.44" />
            <circle data-river-feature={featureName} cx={pupilCx} cy={pupilCy} r="7.1" fill="#202433" />
            <circle cx={cx - 5.4 + pupilOffset.x * 0.14} cy={cy - 6.2 + pupilOffset.y * 0.12} r="4.1" fill="#fffdfb" />
            <circle cx={cx + 3 + pupilOffset.x * 0.12} cy={cy - 0.8 + pupilOffset.y * 0.08} r="2.1" fill="#fffdfb" opacity="0.92" />
            <ellipse cx={cx - 1} cy={cy + 9} rx="13" ry="5.2" fill="#7a86aa" opacity="0.1" />
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
    const canTrackPointer = !reduceMotion && !mobileBudget && getHoverPointerPreference();
    const { normalizedState, pose } = getPose(state);
    const [pupilOffset, setPupilOffset] = useState(DEFAULT_POINTER_OFFSET);
    const assetPrefix = useId().replace(/:/g, '');
    const ids = {
        bodyFur: `${assetPrefix}-river-body-fur`,
        bodyShade: `${assetPrefix}-river-body-shade`,
        headFur: `${assetPrefix}-river-head-fur`,
        muzzle: `${assetPrefix}-river-muzzle`,
        chest: `${assetPrefix}-river-chest`,
        beanie: `${assetPrefix}-river-beanie`,
        tail: `${assetPrefix}-river-tail`,
        stage: `${assetPrefix}-river-stage`,
    };

    const breathing = reduceMotion
        ? { y: 0, scale: 1 }
        : { y: [0, -4, 0], scale: [1, 1.014, 1] };
    const floatTransition = reduceMotion
        ? { duration: 0 }
        : { duration: 4.8, repeat: Infinity, ease: ENTER_EASE };
    const leftEarAnimation = reduceMotion
        ? { rotate: pose.earLeft }
        : { rotate: [pose.earLeft, pose.earLeft + pose.earDrift, pose.earLeft] };
    const rightEarAnimation = reduceMotion
        ? { rotate: pose.earRight }
        : { rotate: [pose.earRight, pose.earRight - pose.earDrift, pose.earRight] };
    const tailAnimation = reduceMotion
        ? { rotate: pose.tailRotate }
        : { rotate: [pose.tailRotate, pose.tailRotate + pose.tailSwing, pose.tailRotate] };
    const activePupilOffset = canTrackPointer ? pupilOffset : DEFAULT_POINTER_OFFSET;

    useEffect(() => {
        if (!canTrackPointer) {
            setPupilOffset(DEFAULT_POINTER_OFFSET);
        }
    }, [canTrackPointer]);

    const handlePointerMove = useCallback((event) => {
        if (!canTrackPointer || (event.pointerType && event.pointerType !== 'mouse')) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const normalizedY = ((event.clientY - rect.top) / rect.height - 0.4) * 2;
        setPupilOffset({
            x: clamp(normalizedX * 2.4, -2.5, 2.5),
            y: clamp(normalizedY * 1.6, -1.7, 1.7),
        });
    }, [canTrackPointer]);

    const handlePointerLeave = useCallback(() => {
        setPupilOffset(DEFAULT_POINTER_OFFSET);
    }, []);

    return (
        <div
            className={`relative overflow-hidden rounded-[2rem] border border-claude-border/80 bg-[radial-gradient(circle_at_top,_rgba(241,223,182,0.18),_rgba(13,15,14,0.97)_68%)] p-4 pt-5 sm:p-5 sm:pt-6 ${className}`}
            data-testid="river-mascot"
            data-river-state={normalizedState}
            role="img"
            aria-label={`River is ${pose.label.toLowerCase()}`}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        >
            <div className="pointer-events-none absolute inset-0 opacity-80 [background:linear-gradient(180deg,rgba(250,232,193,0.14),transparent_18%),linear-gradient(180deg,transparent_72%,rgba(32,40,34,0.84)_100%)]" />
            <div className="pointer-events-none absolute inset-x-8 bottom-6 h-20 rounded-full bg-[radial-gradient(circle,_rgba(0,0,0,0.42),transparent_72%)] blur-2xl" />

            <div className="relative flex flex-col gap-4">
                <div className="relative mx-auto w-full max-w-[320px]">
                    <motion.div
                        className="absolute inset-x-[14%] top-[8%] h-[60%] rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${pose.accent}44 0%, rgba(255,255,255,0.08) 42%, transparent 74%)` }}
                        animate={reduceMotion ? { opacity: 0.52, scale: 1 } : { opacity: [0.36, 0.64, 0.36], scale: [0.96, 1.05, 0.96] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: ENTER_EASE }}
                    />

                    <svg viewBox="0 0 320 330" className="relative z-10 w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id={ids.bodyFur} x1="102" y1="128" x2="225" y2="285" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#d4d8e1" />
                                <stop offset="58%" stopColor="#939bb0" />
                                <stop offset="100%" stopColor="#59637a" />
                            </linearGradient>
                            <linearGradient id={ids.bodyShade} x1="181" y1="168" x2="238" y2="281" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#a5adc2" />
                                <stop offset="100%" stopColor="#646d86" />
                            </linearGradient>
                            <linearGradient id={ids.headFur} x1="92" y1="57" x2="230" y2="215" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#eef1f5" />
                                <stop offset="54%" stopColor="#b2b8c7" />
                                <stop offset="100%" stopColor="#737c92" />
                            </linearGradient>
                            <linearGradient id={ids.muzzle} x1="129" y1="168" x2="191" y2="207" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#fff7f8" />
                                <stop offset="100%" stopColor="#eadce2" />
                            </linearGradient>
                            <linearGradient id={ids.chest} x1="132" y1="175" x2="194" y2="286" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#f1ece7" />
                                <stop offset="100%" stopColor="#d0c7c2" />
                            </linearGradient>
                            <linearGradient id={ids.beanie} x1="114" y1="42" x2="211" y2="103" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#88bf75" />
                                <stop offset="100%" stopColor="#274631" />
                            </linearGradient>
                            <linearGradient id={ids.tail} x1="205" y1="140" x2="271" y2="275" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#bbc1d0" />
                                <stop offset="100%" stopColor="#707a93" />
                            </linearGradient>
                            <radialGradient id={ids.stage} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(164 234) rotate(90) scale(84 124)">
                                <stop offset="0%" stopColor="rgba(241,223,182,0.22)" />
                                <stop offset="100%" stopColor="rgba(13,15,14,0)" />
                            </radialGradient>
                        </defs>

                        <ellipse cx="160" cy="236" rx="118" ry="82" fill={`url(#${ids.stage})`} />

                        <motion.g
                            animate={breathing}
                            transition={floatTransition}
                            style={{ transformOrigin: '160px 215px' }}
                        >
                            <motion.g
                                animate={tailAnimation}
                                transition={{ duration: 3.2, repeat: Infinity, ease: ENTER_EASE }}
                                style={{ transformOrigin: '226px 228px' }}
                            >
                                <path
                                    data-river-feature="tail"
                                    d="M220 257 C251 255 275 230 276 196 C278 163 264 137 244 136 C227 136 221 152 223 170 C225 190 231 206 225 221 C219 235 209 245 194 252 C205 260 214 261 220 257 Z"
                                    fill={`url(#${ids.tail})`}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M192 260 C208 278 234 281 247 270 C257 262 255 247 241 243 C227 239 208 245 192 254 Z"
                                    fill={`url(#${ids.tail})`}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                            </motion.g>

                            <path
                                d="M107 271 C89 257 80 230 83 193 C86 158 107 135 138 129 C146 127 153 126 160 127 C167 126 174 127 182 129 C214 136 234 160 237 194 C240 229 231 257 213 271 C199 282 180 287 160 287 C140 287 121 282 107 271 Z"
                                fill={`url(#${ids.bodyFur})`}
                                stroke="#353c53"
                                strokeWidth="4"
                            />
                            <path
                                d="M183 190 C207 194 220 217 218 243 C216 266 202 281 179 287 C163 291 153 279 157 260 C161 234 163 210 183 190 Z"
                                fill={`url(#${ids.bodyShade})`}
                                opacity="0.74"
                            />
                            <path
                                d="M111 193 C97 202 90 221 93 241 C96 260 108 274 124 280 C136 284 146 274 144 259 C142 233 139 210 111 193 Z"
                                fill="#b7bdcd"
                                opacity="0.42"
                            />
                            <path
                                d="M131 173 C123 187 123 231 127 277 C136 282 148 285 160 285 C172 285 184 282 193 277 C197 231 197 187 189 173 C182 161 138 161 131 173 Z"
                                fill={`url(#${ids.chest})`}
                                opacity="0.96"
                            />

                            <motion.g
                                animate={{ x: pose.pawLeftX, y: pose.pawLeftY, rotate: pose.pawLeftRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '132px 244px' }}
                            >
                                <path
                                    data-river-feature="paw-left"
                                    d="M124 194 C117 210 116 238 119 271 C120 283 131 291 142 289 C151 287 155 281 155 271 L155 209 C155 197 130 186 124 194 Z"
                                    fill="#c9ceda"
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                                <path d="M124 275 C129 281 136 283 144 282" stroke="#6e768d" strokeWidth="3" strokeLinecap="round" />
                            </motion.g>
                            <motion.g
                                animate={{ x: pose.pawRightX, y: pose.pawRightY, rotate: pose.pawRightRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '188px 238px' }}
                            >
                                <path
                                    data-river-feature="paw-right"
                                    d="M196 194 C203 210 204 238 201 270 C200 282 189 291 178 289 C170 287 165 280 166 270 L166 209 C166 197 190 186 196 194 Z"
                                    fill="#b7becf"
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                                <path d="M177 275 C183 280 190 282 198 281" stroke="#6e768d" strokeWidth="3" strokeLinecap="round" />
                            </motion.g>

                            <motion.g
                                animate={{ y: pose.headY, rotate: pose.headRotate }}
                                transition={{ duration: 0.4, ease: ENTER_EASE }}
                                style={{ transformOrigin: '160px 136px' }}
                            >
                                <motion.g
                                    animate={{ y: pose.beanieY, rotate: pose.beanieRotate }}
                                    transition={{ duration: 0.4, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '160px 68px' }}
                                >
                                    <path
                                        data-river-feature="beanie"
                                        d="M110 86 C118 55 138 38 160 38 C182 38 202 55 210 86 C194 78 178 74 160 74 C142 74 126 78 110 86 Z"
                                        fill={`url(#${ids.beanie})`}
                                        stroke="#214126"
                                        strokeWidth="4"
                                    />
                                    <path
                                        d="M106 87 C122 80 141 76 160 76 C179 76 198 80 214 87 L210 98 C195 92 178 89 160 89 C142 89 125 92 110 98 Z"
                                        fill="#9ccb8f"
                                    />
                                    <path d="M130 83 L133 96" stroke="#6f9f65" strokeWidth="2.4" strokeLinecap="round" opacity="0.78" />
                                    <path d="M147 79 L149 93" stroke="#6f9f65" strokeWidth="2.4" strokeLinecap="round" opacity="0.78" />
                                    <path d="M164 79 L164 94" stroke="#6f9f65" strokeWidth="2.4" strokeLinecap="round" opacity="0.78" />
                                    <path d="M181 80 L179 95" stroke="#6f9f65" strokeWidth="2.4" strokeLinecap="round" opacity="0.78" />
                                    <circle cx="160" cy="43" r="8" fill="#94c487" stroke="#214126" strokeWidth="4" />
                                </motion.g>

                                <motion.g
                                    animate={leftEarAnimation}
                                    transition={{ duration: 3.4, repeat: Infinity, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '104px 90px' }}
                                >
                                    <path
                                        data-river-feature="ear-left"
                                        d="M121 118 C103 120 88 112 80 94 C72 77 72 55 79 43 C99 50 114 69 124 96 Z"
                                        fill="#7e889c"
                                        stroke="#353c53"
                                        strokeWidth="4"
                                    />
                                    <path
                                        d="M112 107 C100 106 91 99 87 88 C83 77 83 63 87 56 C99 60 108 72 114 91 Z"
                                        fill="#f6c7d8"
                                    />
                                </motion.g>
                                <motion.g
                                    animate={rightEarAnimation}
                                    transition={{ duration: 3.4, repeat: Infinity, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '216px 90px' }}
                                >
                                    <path
                                        data-river-feature="ear-right"
                                        d="M199 118 C217 120 232 112 240 94 C248 77 248 55 241 43 C221 50 206 69 196 96 Z"
                                        fill="#7e889c"
                                        stroke="#353c53"
                                        strokeWidth="4"
                                    />
                                    <path
                                        d="M208 107 C220 106 229 99 233 88 C237 77 237 63 233 56 C221 60 212 72 206 91 Z"
                                        fill="#f6c7d8"
                                    />
                                </motion.g>

                                <path
                                    d="M102 171 C89 159 81 138 82 112 C84 76 115 48 160 48 C205 48 236 76 238 112 C239 137 231 158 218 171 C221 187 212 204 196 214 C186 221 173 225 160 226 C147 225 134 221 124 214 C108 204 99 187 102 171 Z"
                                    fill={`url(#${ids.headFur})`}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />

                                <path d="M145 70 C149 81 150 93 146 105" stroke="#666e85" strokeWidth="6.4" strokeLinecap="round" opacity="0.78" />
                                <path d="M160 61 C164 77 164 94 160 111" stroke="#626b82" strokeWidth="7.6" strokeLinecap="round" opacity="0.9" />
                                <path d="M175 70 C171 81 170 93 174 105" stroke="#666e85" strokeWidth="6.4" strokeLinecap="round" opacity="0.78" />

                                <motion.g
                                    animate={{ y: pose.browY, rotate: pose.browLeftRotate }}
                                    transition={{ duration: 0.32, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '124px 126px' }}
                                >
                                    <path d="M110 130 Q124 122 138 125" stroke="#2f3347" strokeWidth="4.4" strokeLinecap="round" />
                                </motion.g>
                                <motion.g
                                    animate={{ y: pose.browY, rotate: pose.browRightRotate }}
                                    transition={{ duration: 0.32, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '196px 126px' }}
                                >
                                    <path d="M182 125 Q196 122 210 130" stroke="#2f3347" strokeWidth="4.4" strokeLinecap="round" />
                                </motion.g>

                                <RiverEye
                                    cx={124}
                                    cy={147}
                                    pose={pose}
                                    reduceMotion={reduceMotion}
                                    pupilOffset={activePupilOffset}
                                    featureName="pupil-left"
                                />
                                <RiverEye
                                    cx={196}
                                    cy={147}
                                    pose={pose}
                                    reduceMotion={reduceMotion}
                                    delay={reduceMotion ? 0 : 0.12}
                                    pupilOffset={activePupilOffset}
                                    featureName="pupil-right"
                                />

                                <ellipse cx="113" cy="171" rx="10" ry="8" fill="#e9a1b5" opacity="0.42" />
                                <ellipse cx="207" cy="171" rx="10" ry="8" fill="#e9a1b5" opacity="0.42" />

                                <path
                                    data-river-feature="muzzle"
                                    d="M134 176 C141 170 150 168 160 168 C170 168 179 170 186 176 C186 192 176 203 160 205 C144 203 134 192 134 176 Z"
                                    fill={`url(#${ids.muzzle})`}
                                />
                                <path d="M155 181 Q160 176 165 181 L160 188 Z" fill="#ef8ba7" />
                                <path d="M160 186 L160 194" stroke="#353c53" strokeWidth="3" strokeLinecap="round" />
                                <motion.path
                                    d={pose.mouth}
                                    stroke="#353c53"
                                    strokeWidth="3.6"
                                    strokeLinecap="round"
                                    fill="none"
                                    transition={{ duration: 0.3, ease: ENTER_EASE }}
                                />

                                <g opacity="0.8">
                                    <path d="M89 175 C103 172 116 172 130 176" stroke="#e4ddd8" strokeWidth="2.6" strokeLinecap="round" />
                                    <path d="M90 186 C103 186 116 188 130 191" stroke="#e4ddd8" strokeWidth="2.6" strokeLinecap="round" />
                                    <path d="M231 175 C217 172 204 172 190 176" stroke="#e4ddd8" strokeWidth="2.6" strokeLinecap="round" />
                                    <path d="M230 186 C217 186 204 188 190 191" stroke="#e4ddd8" strokeWidth="2.6" strokeLinecap="round" />
                                </g>
                            </motion.g>

                            {normalizedState === 'celebrate' ? (
                                <motion.g
                                    animate={reduceMotion ? { opacity: 0.82 } : { opacity: [0.4, 0.94, 0.4], scale: [0.96, 1.06, 0.96] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: ENTER_EASE }}
                                >
                                    <circle cx="74" cy="70" r="5" fill="#f0d37e" />
                                    <circle cx="246" cy="82" r="4.5" fill="#9fd8a6" />
                                    <circle cx="254" cy="148" r="3.5" fill="#f6e8b2" />
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
