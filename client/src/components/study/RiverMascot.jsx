import React, { useId } from 'react';
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
        headRotate: -1,
        earLeft: -4,
        earRight: 3,
        earDrift: 2.5,
        eyeScaleX: 1,
        eyeScaleY: 1,
        pupilX: 0,
        pupilY: 0,
        browY: 0,
        browLeftRotate: -4,
        browRightRotate: 4,
        mouth: 'M145 188 Q160 196 175 188',
        pawLeftX: 0,
        pawLeftY: 0,
        pawLeftRotate: -2,
        pawRightX: 0,
        pawRightY: 0,
        pawRightRotate: 2,
        tailRotate: -10,
        tailSwing: 7,
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
        eyeScaleX: 1,
        eyeScaleY: 0.96,
        pupilX: 0,
        pupilY: -1,
        browY: -3,
        browLeftRotate: -7,
        browRightRotate: 6,
        mouth: 'M144 188 Q160 198 176 188',
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
        earRight: 12,
        earDrift: 1.5,
        eyeScaleX: 1.02,
        eyeScaleY: 0.92,
        pupilX: 2,
        pupilY: 0,
        browY: -4,
        browLeftRotate: -9,
        browRightRotate: 8,
        mouth: 'M146 188 Q160 194 174 186',
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
        eyeScaleX: 1.02,
        eyeScaleY: 1.04,
        pupilX: 0,
        pupilY: -1,
        browY: -1,
        browLeftRotate: -5,
        browRightRotate: 5,
        mouth: 'M143 186 Q160 201 177 186',
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
        eyeScaleX: 1,
        eyeScaleY: 0.82,
        pupilX: -3,
        pupilY: -1,
        browY: -5,
        browLeftRotate: -12,
        browRightRotate: 0,
        mouth: 'M148 190 Q160 184 172 190',
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
        eyeScaleX: 1,
        eyeScaleY: 0.8,
        pupilX: 1,
        pupilY: 1,
        browY: 2,
        browLeftRotate: 8,
        browRightRotate: -8,
        mouth: 'M146 192 Q160 183 174 192',
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
        eyeScaleX: 1.08,
        eyeScaleY: 1.12,
        pupilX: 0,
        pupilY: -3,
        browY: -7,
        browLeftRotate: -10,
        browRightRotate: 10,
        mouth: 'M140 186 Q160 208 180 186',
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
}) {
    const blinkAnimation = reduceMotion
        ? { scaleX: pose.eyeScaleX, scaleY: pose.eyeScaleY }
        : {
            scaleX: [pose.eyeScaleX, pose.eyeScaleX, pose.eyeScaleX * 0.98, pose.eyeScaleX],
            scaleY: [pose.eyeScaleY, pose.eyeScaleY, 0.16, pose.eyeScaleY],
        };

    return (
        <motion.g
            animate={blinkAnimation}
            transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE, delay }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
            <ellipse cx={cx} cy={cy} rx="18" ry="20" fill="#31364d" />
            <ellipse cx={cx} cy={cy + 6} rx="12" ry="10" fill="#58617f" opacity="0.52" />
            <circle cx={cx + pose.pupilX} cy={cy + pose.pupilY + 1} r="8.8" fill="#23273a" />
            <circle cx={cx - 6} cy={cy - 7} r="5.5" fill="#fffdfb" />
            <circle cx={cx + 3} cy={cy - 1} r="2.7" fill="#fffdfb" opacity="0.94" />
            <ellipse cx={cx - 2} cy={cy + 10} rx="15" ry="6" fill="#7a86aa" opacity="0.12" />
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
                <div className="relative mx-auto w-full max-w-[304px]">
                    <motion.div
                        className="absolute inset-x-[14%] top-[8%] h-[60%] rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${pose.accent}44 0%, rgba(255,255,255,0.08) 42%, transparent 74%)` }}
                        animate={reduceMotion ? { opacity: 0.52, scale: 1 } : { opacity: [0.36, 0.64, 0.36], scale: [0.96, 1.05, 0.96] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: ENTER_EASE }}
                    />

                    <svg viewBox="0 0 320 330" className="relative z-10 w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id={ids.bodyFur} x1="102" y1="128" x2="225" y2="285" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#d7dae0" />
                                <stop offset="58%" stopColor="#969eb3" />
                                <stop offset="100%" stopColor="#5a6178" />
                            </linearGradient>
                            <linearGradient id={ids.bodyShade} x1="181" y1="168" x2="238" y2="281" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#a5adc2" />
                                <stop offset="100%" stopColor="#646d86" />
                            </linearGradient>
                            <linearGradient id={ids.headFur} x1="92" y1="57" x2="230" y2="215" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#eef1f6" />
                                <stop offset="54%" stopColor="#afb5c5" />
                                <stop offset="100%" stopColor="#737c93" />
                            </linearGradient>
                            <linearGradient id={ids.muzzle} x1="129" y1="168" x2="191" y2="207" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#fff7f8" />
                                <stop offset="100%" stopColor="#eadce2" />
                            </linearGradient>
                            <linearGradient id={ids.chest} x1="132" y1="175" x2="194" y2="286" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#f6f0eb" />
                                <stop offset="100%" stopColor="#d2c7c1" />
                            </linearGradient>
                            <linearGradient id={ids.beanie} x1="125" y1="46" x2="202" y2="82" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#7aae73" />
                                <stop offset="100%" stopColor="#315237" />
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
                                    d="M219 256 C253 256 278 233 280 201 C282 165 267 134 246 133 C229 132 222 149 224 168 C227 189 234 205 228 222 C223 236 213 247 198 255 C206 258 213 259 219 256 Z"
                                    fill={`url(#${ids.tail})`}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M186 262 C205 278 231 279 245 268 C257 259 255 244 242 241 C228 238 207 245 188 256 Z"
                                    fill={`url(#${ids.tail})`}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                            </motion.g>

                            <path
                                d="M104 268 C84 254 74 226 79 190 C84 151 107 128 138 123 C145 122 153 121 160 122 C168 121 176 122 183 124 C213 131 236 156 241 193 C246 229 237 255 218 268 C201 280 181 284 160 283 C139 284 121 280 104 268 Z"
                                fill={`url(#${ids.bodyFur})`}
                                stroke="#353c53"
                                strokeWidth="4"
                            />
                            <path
                                d="M181 186 C205 190 219 214 217 241 C215 265 201 281 178 287 C163 290 153 280 156 262 C160 236 162 211 181 186 Z"
                                fill={`url(#${ids.bodyShade})`}
                                opacity="0.74"
                            />
                            <path
                                d="M110 188 C95 196 88 215 92 237 C96 259 109 274 126 279 C137 282 145 273 143 259 C141 232 140 207 110 188 Z"
                                fill="#b7bdcd"
                                opacity="0.45"
                            />
                            <path
                                d="M130 172 C122 185 122 231 126 275 C136 281 148 284 160 284 C172 284 184 281 194 275 C198 231 198 185 190 172 C182 160 138 160 130 172 Z"
                                fill={`url(#${ids.chest})`}
                                opacity="0.96"
                            />

                            <motion.g
                                animate={{ x: pose.pawLeftX, y: pose.pawLeftY, rotate: pose.pawLeftRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '132px 244px' }}
                            >
                                <path
                                    d="M126 192 C118 209 117 239 120 272 C121 283 131 291 142 288 C151 285 155 279 154 270 L154 206 C154 194 131 183 126 192 Z"
                                    fill="#c9ceda"
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                                <path d="M123 274 C128 280 136 283 144 282" stroke="#6e768d" strokeWidth="3" strokeLinecap="round" />
                            </motion.g>
                            <motion.g
                                animate={{ x: pose.pawRightX, y: pose.pawRightY, rotate: pose.pawRightRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '188px 238px' }}
                            >
                                <path
                                    d="M194 196 C202 211 204 239 202 270 C201 282 191 291 180 289 C171 287 167 280 168 270 L168 208 C168 196 188 186 194 196 Z"
                                    fill="#b7becf"
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />
                                <path d="M177 274 C183 280 190 282 198 281" stroke="#6e768d" strokeWidth="3" strokeLinecap="round" />
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
                                        d="M122 74 C126 50 143 38 160 38 C177 38 194 50 199 74 C187 67 174 64 160 64 C146 64 133 67 122 74 Z"
                                        fill={`url(#${ids.beanie})`}
                                        stroke="#214126"
                                        strokeWidth="4"
                                    />
                                    <path
                                        d="M118 76 C132 69 145 66 160 66 C175 66 188 69 202 76 L198 86 C186 80 173 77 160 77 C147 77 134 80 122 86 Z"
                                        fill="#93c28a"
                                    />
                                    <circle cx="160" cy="34" r="10" fill="#8ab781" stroke="#214126" strokeWidth="4" />
                                </motion.g>

                                <motion.g
                                    animate={leftEarAnimation}
                                    transition={{ duration: 3.4, repeat: Infinity, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '104px 90px' }}
                                >
                                    <path
                                        data-river-feature="ear-left"
                                        d="M118 112 C102 113 88 104 81 89 C73 73 74 55 79 45 C98 50 112 67 122 91 Z"
                                        fill="#7e889c"
                                        stroke="#353c53"
                                        strokeWidth="4"
                                    />
                                    <path
                                        d="M111 104 C99 103 90 96 86 85 C82 74 82 62 85 55 C97 59 105 71 112 88 Z"
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
                                        d="M202 112 C218 113 232 104 239 89 C247 73 246 55 241 45 C222 50 208 67 198 91 Z"
                                        fill="#7e889c"
                                        stroke="#353c53"
                                        strokeWidth="4"
                                    />
                                    <path
                                        d="M209 104 C221 103 230 96 234 85 C238 74 238 62 235 55 C223 59 215 71 208 88 Z"
                                        fill="#f6c7d8"
                                    />
                                </motion.g>

                                <path
                                    d="M100 168 C86 155 78 134 79 109 C81 72 112 45 160 45 C208 45 239 72 241 109 C242 134 234 155 220 168 C224 184 214 201 198 210 C186 217 173 220 160 221 C147 220 134 217 122 210 C106 201 96 184 100 168 Z"
                                    fill={`url(#${ids.headFur})`}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                />

                                <path d="M147 69 C152 82 153 95 147 108" stroke="#646d86" strokeWidth="7" strokeLinecap="round" opacity="0.78" />
                                <path d="M160 62 C165 78 165 96 160 114" stroke="#616a83" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
                                <path d="M173 69 C168 82 167 95 173 108" stroke="#646d86" strokeWidth="7" strokeLinecap="round" opacity="0.78" />

                                <motion.g
                                    animate={{ y: pose.browY, rotate: pose.browLeftRotate }}
                                    transition={{ duration: 0.32, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '124px 126px' }}
                                >
                                    <path d="M107 128 Q123 119 139 124" stroke="#2f3347" strokeWidth="4" strokeLinecap="round" />
                                </motion.g>
                                <motion.g
                                    animate={{ y: pose.browY, rotate: pose.browRightRotate }}
                                    transition={{ duration: 0.32, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '196px 126px' }}
                                >
                                    <path d="M181 124 Q197 119 213 128" stroke="#2f3347" strokeWidth="4" strokeLinecap="round" />
                                </motion.g>

                                <RiverEye cx={124} cy={146} pose={pose} reduceMotion={reduceMotion} />
                                <RiverEye cx={196} cy={146} pose={pose} reduceMotion={reduceMotion} delay={reduceMotion ? 0 : 0.12} />

                                <ellipse cx="112" cy="170" rx="14" ry="12" fill="#f29fbb" opacity="0.72" />
                                <ellipse cx="208" cy="170" rx="14" ry="12" fill="#f29fbb" opacity="0.72" />

                                <path
                                    data-river-feature="muzzle"
                                    d="M130 174 C138 168 149 166 160 166 C171 166 182 168 190 174 C190 191 178 203 160 204 C142 203 130 191 130 174 Z"
                                    fill={`url(#${ids.muzzle})`}
                                />
                                <path d="M154 180 Q160 175 166 180 L160 187 Z" fill="#ef8ba7" />
                                <path d="M160 186 L160 194" stroke="#353c53" strokeWidth="3" strokeLinecap="round" />
                                <motion.path
                                    d={pose.mouth}
                                    stroke="#353c53"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    fill="none"
                                    transition={{ duration: 0.3, ease: ENTER_EASE }}
                                />

                                <g opacity="0.9">
                                    <path d="M86 172 C102 168 117 168 134 173" stroke="#e8e1dc" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M88 184 C104 184 118 186 134 190" stroke="#e8e1dc" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M234 172 C218 168 203 168 186 173" stroke="#e8e1dc" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M232 184 C216 184 202 186 186 190" stroke="#e8e1dc" strokeWidth="3" strokeLinecap="round" />
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
