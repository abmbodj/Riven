import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import gsap from 'gsap';
import { useMobileVisualBudget } from '../hooks/useMobileVisualBudget';

const FLOATING_MOTES = Array.from({ length: 7 }, (_, index) => {
    const step = index + 1;

    return {
        id: `mote-${index}`,
        radius: 1 + (step % 3) * 0.45,
        y: -80 - step * 7,
        xStart: (step - 4) * 4,
        xEnd: (step - 4) * 10,
        duration: 5 + step * 0.35,
        delay: 2 + step * 0.55,
    };
});

export default function OnboardingArt({ className = "w-full max-w-[280px]" }) {
    const leafColor = 'var(--botanical-forest)'; // #7a9e72
    const accentColor = 'var(--accent-color)';    // #deb96a
    const glowRef = useRef(null);
    const bloomRef = useRef(null);
    const lightBudget = useMobileVisualBudget();

    const activeMotes = lightBudget ? FLOATING_MOTES.slice(0, 3) : FLOATING_MOTES;

    // GSAP breathing animations
    useEffect(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches || lightBudget) return;

        const ctx = gsap.context(() => {
            // Inner glow breathing
            if (glowRef.current) {
                gsap.to(glowRef.current, {
                    scale: 1.15,
                    opacity: 0.4,
                    duration: 4,
                    ease: 'power1.inOut',
                    yoyo: true,
                    repeat: -1,
                });
            }

            // Central bloom breathing
            if (bloomRef.current) {
                gsap.to(bloomRef.current, {
                    scale: 1.02,
                    duration: 4,
                    ease: 'power1.inOut',
                    yoyo: true,
                    repeat: -1,
                });
            }
        });

        return () => ctx.revert();
    }, []);

    return (
        <div className={`relative aspect-square mx-auto flex items-center justify-center ${className}`}>
            {/* Deep inner glow — GSAP breathing */}
            <div
                ref={glowRef}
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle at center, ${leafColor} 0%, transparent 60%)`,
                    filter: 'blur(24px)',
                    opacity: 0.15,
                }}
            />

            <svg
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full relative z-10"
                style={{ overflow: 'visible' }}
            >
                <defs>
                    <filter id="bloom-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    <linearGradient id="leafGradLeft" x1="100" y1="130" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={leafColor} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={leafColor} stopOpacity="0.2" />
                    </linearGradient>

                    <linearGradient id="leafGradRight" x1="100" y1="130" x2="160" y2="40" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={leafColor} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={leafColor} stopOpacity="0.2" />
                    </linearGradient>
                </defs>

                {/* Central Bloom Group - breathing */}
                <motion.g
                    originX="0.5"
                    originY="0.75"
                    animate={{ scale: [0.98, 1.02, 0.98] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Base stem / anchor point */}
                    <motion.path
                        d="M 100 150 C 100 135 100 120 100 100"
                        stroke={leafColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                    />

                    {/* Inner Glowing Core / Seed */}
                    <motion.circle
                        cx="100"
                        cy="105"
                        r="4.5"
                        fill={accentColor}
                        filter={lightBudget ? undefined : "url(#bloom-glow)"}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    />

                    {/* Left Blooming Leaf - Sweeping Upward */}
                    <motion.g
                        originX="0.5"
                        originY="0.65"
                        initial={{ scale: 0.2, rotate: -60, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ delay: 0.6, duration: 4, type: "spring", stiffness: 15, damping: 10 }}
                    >
                        <motion.path
                            d="M 98 105 C 50 110 25 70 45 35 C 70 30 85 70 98 105"
                            fill="url(#leafGradLeft)"
                            stroke={leafColor}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            animate={{ rotate: [-2, 1, -2] }}
                            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                        />
                        {/* Delicate inner vein */}
                        <motion.path
                            d="M 98 105 C 70 85 55 55 47 40"
                            stroke={leafColor}
                            strokeWidth="1"
                            strokeOpacity="0.5"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 2.2, duration: 2.5, ease: "easeOut" }}
                        />
                    </motion.g>

                    {/* Right Blooming Leaf - Sweeping Upward */}
                    <motion.g
                        originX="0.5"
                        originY="0.65"
                        initial={{ scale: 0.2, rotate: 60, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ delay: 0.9, duration: 4, type: "spring", stiffness: 15, damping: 10 }}
                    >
                        <motion.path
                            d="M 102 105 C 150 110 175 70 155 35 C 130 30 115 70 102 105"
                            fill="url(#leafGradRight)"
                            stroke={leafColor}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            animate={{ rotate: [2, -1, 2] }}
                            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        />
                        {/* Delicate inner vein */}
                        <motion.path
                            d="M 102 105 C 130 85 145 55 153 40"
                            stroke={leafColor}
                            strokeWidth="1"
                            strokeOpacity="0.5"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 2.5, duration: 2.5, ease: "easeOut" }}
                        />
                    </motion.g>

                    {/* Outer Left Leaf (lower) */}
                    <motion.g
                        originX="0.5"
                        originY="0.65"
                        initial={{ scale: 0, rotate: -40, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ delay: 1.4, duration: 3.5, type: "spring", stiffness: 12, damping: 8 }}
                    >
                        <motion.path
                            d="M 96 115 C 60 140 20 120 15 90 C 20 70 50 85 96 115"
                            fill={`${leafColor}40`}
                            stroke={leafColor}
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                            animate={{ rotate: [-1, 2, -1] }}
                            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </motion.g>

                    {/* Outer Right Leaf (lower) */}
                    <motion.g
                        originX="0.5"
                        originY="0.65"
                        initial={{ scale: 0, rotate: 40, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ delay: 1.7, duration: 3.5, type: "spring", stiffness: 12, damping: 8 }}
                    >
                        <motion.path
                            d="M 104 115 C 140 140 180 120 185 90 C 180 70 150 85 104 115"
                            fill={`${leafColor}50`}
                            stroke={leafColor}
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                            animate={{ rotate: [1, -2, 1] }}
                            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        />
                    </motion.g>

                    {/* Central Sprout / Pistil */}
                    <motion.g
                        originX="0.5"
                        originY="0.8"
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        transition={{ delay: 2.8, duration: 3, type: "spring", stiffness: 25 }}
                    >
                        <motion.path
                            d="M 100 100 C 95 70 98 40 100 15 C 102 40 105 70 100 100"
                            fill={accentColor}
                            fillOpacity="0.7"
                            filter={lightBudget ? undefined : "url(#bloom-glow)"}
                        />
                    </motion.g>
                </motion.g>

                {/* Orbiting energy motes floating upwards */}
                {activeMotes.map((mote) => (
                    <motion.circle
                        key={mote.id}
                        cx="100"
                        cy="120"
                        r={mote.radius}
                        fill={accentColor}
                        filter={lightBudget ? undefined : "url(#bloom-glow)"}
                        initial={{ opacity: 0, y: 0, x: 0 }}
                        animate={{
                            opacity: [0, 0.9, 0],
                            y: [-10, mote.y],
                            x: [mote.xStart, mote.xEnd],
                            scale: [0.5, 1.5, 0.5]
                        }}
                        transition={{
                            duration: mote.duration,
                            repeat: Infinity,
                            delay: mote.delay,
                            ease: "easeInOut"
                        }}
                    />
                ))}

                {/* Ethereal Sacred Geometry Rings — skip on mobile */}
                {!lightBudget && (
                    <>
                        <motion.circle
                            cx="100"
                            cy="95"
                            r="70"
                            fill="none"
                            stroke={accentColor}
                            strokeWidth="0.5"
                            strokeOpacity="0.4"
                            strokeDasharray="1 12"
                            initial={{ rotateZ: -30, opacity: 0, scale: 0.9 }}
                            animate={{ rotateZ: 330, opacity: [0, 0.6, 0.2, 0.6, 0], scale: 1 }}
                            transition={{
                                rotateZ: { duration: 90, repeat: Infinity, ease: "linear" },
                                opacity: { duration: 18, repeat: Infinity, ease: "easeInOut", times: [0, 0.3, 0.5, 0.8, 1], delay: 1.5 },
                                scale: { duration: 4, ease: "easeOut" }
                            }}
                            style={{ transformOrigin: '100px 95px' }}
                        />
                        <motion.circle
                            cx="100"
                            cy="95"
                            r="55"
                            fill="none"
                            stroke={leafColor}
                            strokeWidth="0.5"
                            strokeOpacity="0.5"
                            strokeDasharray="2 18"
                            initial={{ rotateZ: 40, opacity: 0, scale: 0.8 }}
                            animate={{ rotateZ: -320, opacity: [0, 0.5, 0.8, 0.5, 0], scale: 1 }}
                            transition={{
                                rotateZ: { duration: 60, repeat: Infinity, ease: "linear" },
                                opacity: { duration: 12, repeat: Infinity, ease: "easeInOut", times: [0, 0.2, 0.5, 0.8, 1], delay: 2 },
                                scale: { duration: 4, ease: "easeOut" }
                            }}
                            style={{ transformOrigin: '100px 95px' }}
                        />
                    </>
                )}
            </svg>
        </div>
    );
}
