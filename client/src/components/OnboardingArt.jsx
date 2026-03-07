```javascript
import React from 'react';
import { motion } from 'motion/react';

export default function OnboardingArt() {
  // A calming botanical theme
  const leafColor = 'var(--botanical-forest)'; // #7a9e72 
const stemColor = 'var(--botanical-sepia)';   // #8fa6a8
const accentColor = 'var(--accent-color)';    // #deb96a

return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center">
        {/* Soft background glow */}
        <motion.div
            animate={{
                scale: [1, 1.15, 1],
                opacity: [0.15, 0.35, 0.15],
            }}
            transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut"
            }}
            className="absolute inset-0 rounded-full"
            style={{
                background: `radial - gradient(circle at center, ${ leafColor } 0 %, transparent 60 %)`,
                filter: 'blur(20px)'
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
                <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Central Stem group, swaying gently */}
            <motion.g
                animate={{ rotate: [-1.5, 1.5, -1.5] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                originX="0.5"
                originY="1"
            >
                {/* Main curved stem */}
                <motion.path
                    d="M 100 170 C 100 120 90 70 110 20"
                    stroke={stemColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3, ease: "easeOut" }}
                />

                {/* Left Leaf 1 (bottom) */}
                <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.0, duration: 2, type: "spring", stiffness: 40 }}
                    originX="1"
                    originY="0.5"
                >
                    <motion.path
                        d="M 97 130 C 50 140 30 110 35 85 C 65 65 90 95 97 130"
                        fill={`${ leafColor } 60`}
                        stroke={leafColor}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        animate={{
                            rotate: [-2, 2, -2],
                        }}
                        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                    />
                </motion.g>

                {/* Right Leaf 1 (middle) */}
                <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.5, duration: 2, type: "spring", stiffness: 40 }}
                    originX="0"
                    originY="0.5"
                >
                    <motion.path
                        d="M 94 85 C 145 75 165 45 150 20 C 115 15 95 55 94 85"
                        fill={`${ leafColor } 80`}
                        stroke={leafColor}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        animate={{
                            rotate: [2, -2, 2],
                        }}
                        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    />
                </motion.g>

                {/* Top terminal leaf */}
                <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 2.2, duration: 2, type: "spring", stiffness: 35 }}
                    originX="0.5"
                    originY="1"
                >
                    <motion.path
                        d="M 110 20 C 90 0 100 -25 120 -30 C 140 -25 130 0 110 20"
                        fill={leafColor}
                        stroke={leafColor}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        animate={{
                            rotate: [-3, 3, -3],
                        }}
                        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                </motion.g>
            </motion.g>

            {/* Ambient floating spores/light particles */}
            {[...Array(8)].map((_, i) => (
                <motion.circle
                    key={`spore - ${ i } `}
                    cx={40 + Math.random() * 120}
                    cy={20 + Math.random() * 140}
                    r={1.5 + Math.random() * 2}
                    fill={accentColor}
                    filter="url(#soft-glow)"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{
                        opacity: [0, 0.7, 0],
                        y: [-15, -40],
                        x: Math.random() * 25 - 12.5,
                        scale: [1, 1.2, 0.8]
                    }}
                    transition={{
                        duration: 5 + Math.random() * 4,
                        repeat: Infinity,
                        delay: Math.random() * 5,
                        ease: "easeInOut"
                    }}
                />
            ))}

            {/* Delicate orbit ring to tie it to the arcane/botanical theme */}
            <motion.ellipse
                cx="100"
                cy="100"
                rx="75"
                ry="30"
                fill="none"
                stroke={`${ accentColor } 60`}
                strokeWidth="1.5"
                strokeDasharray="2 8"
                strokeLinecap="round"
                initial={{ rotateX: 65, rotateZ: -20, opacity: 0 }}
                animate={{ rotateZ: 340, opacity: [0, 0.8, 0.4, 0.8, 0] }}
                transition={{
                    rotateZ: { duration: 45, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 15, repeat: Infinity, ease: "easeInOut", times: [0, 0.2, 0.5, 0.8, 1] }
                }}
            />
            <motion.ellipse
                cx="100"
                cy="100"
                rx="90"
                ry="35"
                fill="none"
                stroke={`${ stemColor } 40`}
                strokeWidth="1"
                strokeDasharray="4 6"
                strokeLinecap="round"
                initial={{ rotateX: 65, rotateZ: 40, opacity: 0 }}
                animate={{ rotateZ: -320, opacity: [0, 0.4, 0.8, 0.4, 0] }}
                transition={{
                    rotateZ: { duration: 55, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2, times: [0, 0.3, 0.5, 0.7, 1] }
                }}
            />
        </svg>
    </div>
);
}
```
