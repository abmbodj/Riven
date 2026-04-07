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
        mouth: 'M118 163 Q160 176 202 163',
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
        mouth: 'M119 162 Q160 174 201 161',
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
        mouth: 'M119 161 Q160 171 201 159',
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
        mouth: 'M117 162 Q160 180 203 162',
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
        mouth: 'M120 164 Q160 158 200 164',
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
        mouth: 'M119 165 Q160 158 201 165',
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
        mouth: 'M116 162 Q160 183 204 162',
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
                d={`M${cx - 17} ${cy - 9} Q${cx} ${cy - 23} ${cx + 17} ${cy - 9}`}
                stroke="#273629"
                strokeWidth="3.6"
                strokeLinecap="round"
                opacity="0.72"
            />
            <ellipse
                data-river-feature={featureName}
                cx={cx}
                cy={cy}
                rx="16.5"
                ry="18.5"
                fill="#f8f6ea"
                stroke="#273629"
                strokeWidth="3.8"
            />
            <path
                d={`M${cx - 14} ${cy - 4} Q${cx} ${cy - 10} ${cx + 14} ${cy - 4}`}
                stroke="#d9d7c2"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.82"
            />
            <ellipse cx={cx} cy={cy + 1} rx="8.8" ry="10.4" fill="#4e653b" />
            <circle data-river-feature={pupilFeature} cx={pupilCx} cy={pupilCy} r="5.8" fill="#101611" />
            <circle cx={cx - 4.2} cy={cy - 4.8} r="2.8" fill="#ffffff" opacity="0.96" />
            <circle cx={cx + 2.2} cy={cy - 0.2} r="1.5" fill="#ffffff" opacity="0.88" />
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

            <div className="relative flex flex-col">
                <div className="relative mx-auto flex w-full max-w-[320px] flex-col items-center">
                    {caption ? (
                        <motion.div
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: ENTER_EASE }}
                            className="relative z-20 mb-[-10px] w-full max-w-[296px] px-2"
                        >
                            <div
                                data-river-feature="speech-bubble"
                                className="relative rounded-[1.85rem] border border-[#d7cfba]/45 bg-[radial-gradient(circle_at_16%_16%,rgba(248,245,230,0.98),rgba(233,223,197,0.94)_58%,rgba(198,185,157,0.9)_100%)] px-5 py-4 text-left shadow-[0_20px_42px_rgba(0,0,0,0.24)]"
                                style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.48), 0 20px 42px rgba(0,0,0,0.24), 0 0 0 1px ${pose.accent}22` }}
                            >
                                <div
                                    data-river-feature="speech-tail"
                                    className="absolute -bottom-3 left-[46%] h-6 w-6 -translate-x-1/2 rotate-45 rounded-[0.45rem] border-b border-r border-[#d7cfba]/45 bg-[#e4d8bc]"
                                />
                                <div className="relative">
                                    <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.32em] text-[#4d683d]">
                                        River
                                    </p>
                                    <p className="mt-2.5 text-balance font-serif text-[1rem] leading-relaxed text-[#243026] sm:text-[1.08rem]">
                                        {caption}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}

                    <div className="relative w-full">
                    <motion.div
                        className="absolute inset-x-[14%] top-[11%] h-[56%] rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${pose.accent}3e 0%, rgba(255,255,255,0.06) 44%, transparent 76%)` }}
                        animate={reduceMotion ? { opacity: 0.42, scale: 1 } : { opacity: [0.28, 0.5, 0.28], scale: [0.98, 1.03, 0.98] }}
                        transition={{ duration: 3.1, repeat: Infinity, ease: ENTER_EASE }}
                    />

                    <svg viewBox="0 0 320 332" className="relative z-10 w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id={ids.body} x1="108" y1="154" x2="208" y2="278" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#8daa72" />
                                <stop offset="54%" stopColor="#6c8a54" />
                                <stop offset="100%" stopColor="#4d663e" />
                            </linearGradient>
                            <linearGradient id={ids.belly} x1="140" y1="182" x2="180" y2="264" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#efe6c8" />
                                <stop offset="100%" stopColor="#dcc8a2" />
                            </linearGradient>
                            <linearGradient id={ids.head} x1="92" y1="66" x2="228" y2="206" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#98b77a" />
                                <stop offset="62%" stopColor="#6e8f53" />
                                <stop offset="100%" stopColor="#4a623b" />
                            </linearGradient>
                            <linearGradient id={ids.limb} x1="78" y1="160" x2="232" y2="274" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#78975d" />
                                <stop offset="100%" stopColor="#4f6540" />
                            </linearGradient>
                            <linearGradient id={ids.hat} x1="123" y1="78" x2="198" y2="107" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#7ca766" />
                                <stop offset="100%" stopColor="#2d452b" />
                            </linearGradient>
                            <radialGradient id={ids.stage} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 262) rotate(90) scale(54 116)">
                                <stop offset="0%" stopColor="rgba(178,202,127,0.18)" />
                                <stop offset="100%" stopColor="rgba(13,15,14,0)" />
                            </radialGradient>
                        </defs>

                        <ellipse cx="160" cy="262" rx="116" ry="54" fill={`url(#${ids.stage})`} />

                        <motion.g
                            animate={bodyAnimation}
                            transition={floatTransition}
                            style={{ transformOrigin: '160px 216px' }}
                        >
                            <motion.g
                                animate={hindlegLeftAnimation}
                                transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE }}
                                style={{ transformOrigin: '113px 210px' }}
                            >
                                <path
                                    data-river-feature="hindleg-left"
                                    d="M120 247 C98 235 82 216 79 194 C76 173 85 154 102 146 C118 139 131 149 135 168 C139 186 133 210 120 247 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M75 264 C88 258 103 252 118 247 C118 255 121 262 127 268 C113 274 98 277 84 276 C77 273 74 269 75 264 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path d="M86 262 L75 270" stroke="#273629" strokeWidth="3.4" strokeLinecap="round" />
                                <path d="M98 257 L92 275" stroke="#273629" strokeWidth="3.4" strokeLinecap="round" />
                                <path d="M111 252 L110 274" stroke="#273629" strokeWidth="3.4" strokeLinecap="round" />
                            </motion.g>
                            <motion.g
                                animate={hindlegRightAnimation}
                                transition={{ duration: 3.6, repeat: Infinity, ease: ENTER_EASE }}
                                style={{ transformOrigin: '207px 210px' }}
                            >
                                <path
                                    data-river-feature="hindleg-right"
                                    d="M200 247 C222 235 238 216 241 194 C244 173 235 154 218 146 C202 139 189 149 185 168 C181 186 187 210 200 247 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M245 264 C232 258 217 252 202 247 C202 255 199 262 193 268 C207 274 222 277 236 276 C243 273 246 269 245 264 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path d="M234 262 L245 270" stroke="#273629" strokeWidth="3.4" strokeLinecap="round" />
                                <path d="M222 257 L228 275" stroke="#273629" strokeWidth="3.4" strokeLinecap="round" />
                                <path d="M209 252 L210 274" stroke="#273629" strokeWidth="3.4" strokeLinecap="round" />
                            </motion.g>

                            <path
                                d="M118 258 C104 245 101 228 105 205 C110 178 127 158 160 153 C193 158 210 178 215 205 C219 228 216 245 202 258 C191 269 177 276 160 279 C143 276 129 269 118 258 Z"
                                fill={`url(#${ids.body})`}
                                stroke="#273629"
                                strokeWidth="4"
                            />
                            <path d="M130 196 C136 184 146 178 160 178 C174 178 184 184 190 196" stroke="#587147" strokeWidth="3" strokeLinecap="round" opacity="0.36" />
                            <path
                                data-river-feature="belly"
                                d="M140 186 C137 197 138 228 144 250 C150 258 155 262 160 263 C165 262 170 258 176 250 C182 228 183 197 180 186 C176 177 144 177 140 186 Z"
                                fill={`url(#${ids.belly})`}
                                opacity="0.98"
                            />
                            <path d="M147 188 C152 184 156 182 160 182 C164 182 168 184 173 188" stroke="#f6ecd0" strokeWidth="3" strokeLinecap="round" opacity="0.54" />

                            <motion.g
                                animate={{ x: pose.forelimbLeftX, y: pose.forelimbLeftY, rotate: pose.forelimbLeftRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '146px 220px' }}
                            >
                                <path
                                    data-river-feature="forelimb-left"
                                    d="M141 182 C133 196 131 214 132 237 C133 250 141 259 149 259 C154 259 157 255 157 247 C157 226 157 206 155 190 C153 183 145 177 141 182 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M131 248 C137 244 142 244 146 249 C149 244 154 244 157 249 C160 245 165 247 168 252 C160 260 151 262 141 261 C136 258 133 254 131 248 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                            </motion.g>
                            <motion.g
                                animate={{ x: pose.forelimbRightX, y: pose.forelimbRightY, rotate: pose.forelimbRightRotate }}
                                transition={{ duration: 0.35, ease: ENTER_EASE }}
                                style={{ transformOrigin: '174px 220px' }}
                            >
                                <path
                                    data-river-feature="forelimb-right"
                                    d="M179 182 C187 196 189 214 188 237 C187 250 179 259 171 259 C166 259 163 255 163 247 C163 226 163 206 165 190 C167 183 175 177 179 182 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path
                                    d="M189 248 C183 244 178 244 174 249 C171 244 166 244 163 249 C160 245 155 247 152 252 C160 260 169 262 179 261 C184 258 187 254 189 248 Z"
                                    fill={`url(#${ids.limb})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                            </motion.g>

                            <motion.g
                                animate={{ y: pose.headY, rotate: pose.headRotate }}
                                transition={{ duration: 0.4, ease: ENTER_EASE }}
                                style={{ transformOrigin: '160px 142px' }}
                            >
                                <path
                                    data-river-feature="head"
                                    d="M82 168 C73 155 73 136 83 120 C90 109 100 101 112 96 C114 77 128 61 145 61 C152 61 157 64 160 68 C163 64 168 61 175 61 C192 61 206 77 208 96 C220 101 230 109 237 120 C247 136 247 155 238 168 C229 181 216 191 201 199 C188 205 174 209 160 210 C146 209 132 205 119 199 C104 191 91 181 82 168 Z"
                                    fill={`url(#${ids.head})`}
                                    stroke="#273629"
                                    strokeWidth="4"
                                />
                                <path d="M103 143 C122 151 141 155 160 155 C179 155 198 151 217 143" stroke="#5c7648" strokeWidth="3" strokeLinecap="round" opacity="0.3" />

                                <motion.g
                                    animate={{ y: pose.hatY, rotate: pose.hatRotate }}
                                    transition={{ duration: 0.4, ease: ENTER_EASE }}
                                    style={{ transformOrigin: '160px 88px' }}
                                >
                                    <path
                                        data-river-feature="hat"
                                        d="M121 94 C129 83 144 77 160 77 C176 77 191 83 199 94 C188 91 174 89 160 89 C146 89 132 91 121 94 Z"
                                        fill={`url(#${ids.hat})`}
                                        stroke="#223a22"
                                        strokeWidth="4"
                                    />
                                    <path
                                        data-river-feature="hat-band"
                                        d="M121 98 C132 93 146 91 160 91 C174 91 188 93 199 98 L197 107 C186 104 173 102 160 102 C147 102 134 104 123 107 Z"
                                        fill="#99c27a"
                                        stroke="#223a22"
                                        strokeWidth="2.6"
                                        strokeLinejoin="round"
                                    />
                                    <path d="M136 95 L137 106" stroke="#678c57" strokeWidth="2" strokeLinecap="round" opacity="0.76" />
                                    <path d="M148 93 L148 105" stroke="#678c57" strokeWidth="2" strokeLinecap="round" opacity="0.76" />
                                    <path d="M160 92 L160 105" stroke="#678c57" strokeWidth="2" strokeLinecap="round" opacity="0.76" />
                                    <path d="M172 93 L172 105" stroke="#678c57" strokeWidth="2" strokeLinecap="round" opacity="0.76" />
                                    <path d="M184 95 L183 106" stroke="#678c57" strokeWidth="2" strokeLinecap="round" opacity="0.76" />
                                    <circle cx="160" cy="75" r="4.8" fill="#95bc74" stroke="#223a22" strokeWidth="3" />
                                </motion.g>

                                <FrogEye
                                    cx={124}
                                    cy={94}
                                    pose={pose}
                                    reduceMotion={reduceMotion}
                                    delay={0}
                                    featureName="eye-left"
                                    pupilFeature="pupil-left"
                                />
                                <FrogEye
                                    cx={196}
                                    cy={94}
                                    pose={pose}
                                    reduceMotion={reduceMotion}
                                    delay={0.18}
                                    featureName="eye-right"
                                    pupilFeature="pupil-right"
                                />

                                <ellipse cx="150" cy="151" rx="2.4" ry="1.8" fill="#3d4e33" opacity="0.84" transform="rotate(-24 150 151)" />
                                <ellipse cx="170" cy="151" rx="2.4" ry="1.8" fill="#3d4e33" opacity="0.84" transform="rotate(24 170 151)" />
                                <path
                                    data-river-feature="mouth"
                                    d={pose.mouth}
                                    stroke="#202b22"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    fill="none"
                                />
                                <path d="M136 170 C145 174 153 176 160 176 C167 176 175 174 184 170" stroke="#566d44" strokeWidth="2.5" strokeLinecap="round" opacity="0.34" />
                            </motion.g>
                        </motion.g>
                    </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
