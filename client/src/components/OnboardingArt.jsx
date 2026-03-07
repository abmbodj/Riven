import React from 'react';
import { motion } from 'motion/react';

export default function OnboardingArt() {
    const leafColor = 'var(--botanical-forest)'; // #7a9e72 
    const accentColor = 'var(--accent-color)';    // #deb96a

    return (
        <div className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center">
            {/* Deep inner glow */}
            <motion.div
                animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.15, 0.4, 0.15],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle at center, ${leafColor} 0%, transparent 60%)`,
                    filter: 'blur(24px)'
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
                        filter="url(#bloom-glow)"
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
                            filter="url(#bloom-glow)"
                        />
                    </motion.g>
                </motion.g>

                {/* Orbiting energy motes floating upwards */}
                {[...Array(7)].map((_, i) => (
                    <motion.circle
                        key={`mote-${i}`}
                        cx="100"
                        cy="120"
                        r={1 + Math.random() * 1.5}
                        fill={accentColor}
                        filter="url(#bloom-glow)"
                        initial={{ opacity: 0, y: 0, x: 0 }}
                        animate={{
                            opacity: [0, 0.9, 0],
                            y: [-10, -80 - Math.random() * 40],
                            x: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 60],
                            scale: [0.5, 1.5, 0.5]
                        }}
                        transition={{
                            duration: 5 + Math.random() * 4,
                            repeat: Infinity,
                            delay: 2 + Math.random() * 5,
                            ease: "easeInOut"
                        }}
                    />
                ))}

                {/* Ethereal Sacred Geometry Rings */}
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
            </svg>
        </div>
    );
}
