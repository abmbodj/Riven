import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Leaf } from 'lucide-react';

export default function GardenLanding() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0d141e] text-[#fcfaf2] flex flex-col items-center justify-center font-serif">
            {/* Procedural Garden Background */}
            <div className="absolute inset-0 w-full h-full overflow-hidden bg-black pointer-events-none">
                <svg
                    className="absolute min-w-full min-h-full w-auto h-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-cover opacity-80"
                    viewBox="0 0 1440 800"
                    preserveAspectRatio="xMidYMid slice"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <radialGradient id="skyGlow" cx="50%" cy="40%" r="60%">
                            <stop offset="0%" stopColor="#1e3840" />
                            <stop offset="100%" stopColor="#0d141e" />
                        </radialGradient>
                        <linearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#1a353c" />
                            <stop offset="100%" stopColor="#10252b" />
                        </linearGradient>
                        <linearGradient id="hillMid" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#23464b" />
                            <stop offset="100%" stopColor="#153036" />
                        </linearGradient>
                        <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#2e5859" />
                            <stop offset="100%" stopColor="#1a3a3e" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Sky */}
                    <rect width="100%" height="100%" fill="url(#skyGlow)" />

                    {/* Stars / Fireflies */}
                    {[...Array(40)].map((_, i) => (
                        <circle
                            key={`star-${i}`}
                            cx={Math.random() * 1440}
                            cy={Math.random() * 600}
                            r={Math.random() * 1.5 + 0.5}
                            fill="#deb96a"
                            opacity={Math.random() * 0.6 + 0.2}
                            filter="url(#glow)"
                        >
                            <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${Math.random() * 3 + 2}s`} repeatCount="indefinite" />
                        </circle>
                    ))}

                    {/* Background Hills */}
                    <path d="M0,500 Q360,400 720,520 T1440,480 L1440,800 L0,800 Z" fill="url(#hillBack)" opacity="0.8" />

                    {/* Midground Hills */}
                    <path d="M-100,580 Q260,480 620,600 T1540,550 L1540,800 L-100,800 Z" fill="url(#hillMid)" />

                    {/* Foreground Hills */}
                    <path d="M-200,680 Q160,580 520,700 T1640,650 L1640,800 L-200,800 Z" fill="url(#hillFront)" />

                    {/* Trees / Plants (Procedural Abstract) */}
                    {[...Array(12)].map((_, i) => {
                        const x = 100 + i * 110 + (Math.random() * 60 - 30);
                        const y = 600 + (Math.random() * 100 - 30);
                        const scale = Math.random() * 0.5 + 0.6;
                        return (
                            <g key={`tree-${i}`} transform={`translate(${x}, ${y}) scale(${scale})`}>
                                <path d="M0,0 Q-10,-40 -5,-80 Q0,-120 10,-150 Q15,-100 0,0" fill="#142c30" />
                                <circle cx="10" cy="-150" r="35" fill="#1e484a" opacity="0.9" />
                                <circle cx="-15" cy="-120" r="45" fill="#1b4044" opacity="0.9" />
                                <circle cx="25" cy="-110" r="40" fill="#225052" opacity="0.9" />
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Glowing Accent Overlay */}
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#deb96a]/10 to-transparent pointer-events-none" />

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                >
                    <div className="mb-6 inline-flex items-center justify-center p-3 sm:p-4 rounded-full bg-[#1e484a]/40 border border-[#deb96a]/30 backdrop-blur-md shadow-[0_0_30px_rgba(222,185,106,0.15)]">
                        <Leaf className="w-8 h-8 sm:w-10 sm:h-10 text-[#deb96a]" />
                    </div>
                    <h1 className="text-6xl sm:text-8xl font-bold tracking-tight text-white drop-shadow-xl" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                        Riven
                    </h1>
                    <p className="mt-6 text-lg sm:text-xl text-[#b8d0d2] max-w-md mx-auto tracking-wide italic">
                        Grow your knowledge.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                    className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-sm"
                >
                    <Link
                        to="/account?mode=signup"
                        className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[#deb96a] px-6 py-4 text-sm font-sans font-bold uppercase tracking-widest text-[#162a31] transition-all hover:bg-[#ebc97e] hover:shadow-[0_0_20px_rgba(222,185,106,0.4)] hover:-translate-y-0.5"
                    >
                        Sign Up
                    </Link>
                    <Link
                        to="/account?mode=login"
                        className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[#1e3840]/60 border border-[#8fa6a8]/30 px-6 py-4 text-sm font-sans font-bold uppercase tracking-widest text-[#fcfaf2] backdrop-blur-md transition-all hover:bg-[#1e3840]/90 hover:border-[#8fa6a8]/60 hover:-translate-y-0.5"
                    >
                        Log In
                    </Link>
                </motion.div>
            </div>

            <div className="absolute bottom-6 left-0 right-0 flex justify-center text-[10px] uppercase font-sans tracking-widest text-[#8fa6a8]/60 z-10">
                A serene space for study
            </div>
        </div>
    );
}
