import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import OnboardingArt from '../OnboardingArt';

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
                        <linearGradient id="mistGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#8fa6a8" stopOpacity="0" />
                            <stop offset="50%" stopColor="#8fa6a8" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#8fa6a8" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="stemGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#112426" />
                            <stop offset="100%" stopColor="#1e484a" />
                        </linearGradient>
                        <radialGradient id="leafGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#2a5a5d" stopOpacity="0.9" />
                            <stop offset="70%" stopColor="#1b4044" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#112426" stopOpacity="0.5" />
                        </radialGradient>
                        <radialGradient id="leafGlowBright" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#3d7276" stopOpacity="0.9" />
                            <stop offset="70%" stopColor="#225052" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#162e31" stopOpacity="0.5" />
                        </radialGradient>

                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        {/* Animations */}
                        <style>
                            {`
                                @keyframes sway {
                                    0%, 100% { transform: rotate(-2deg); }
                                    50% { transform: rotate(2.5deg); }
                                }
                                @keyframes swaySlow {
                                    0%, 100% { transform: rotate(-1.5deg); }
                                    50% { transform: rotate(2deg); }
                                }
                                @keyframes swayFast {
                                    0%, 100% { transform: rotate(-2.5deg); }
                                    50% { transform: rotate(3deg); }
                                }
                                
                                .sway { animation: sway 8s ease-in-out infinite; transform-origin: center bottom; }
                                .sway-slow { animation: swaySlow 12s ease-in-out infinite; transform-origin: center bottom; }
                                .sway-fast { animation: swayFast 6s ease-in-out infinite; transform-origin: center bottom; }
                            `}
                        </style>

                        {/* Tree 1: Sacred Geometry (Flower of Life logic) */}
                        <g id="tree-sacred" className="sway">
                            <g transform="translate(0, -90)">
                                {/* Golden Aura */}
                                <circle cx="0" cy="0" r="65" fill="url(#leafGlow)" opacity="0.3" filter="url(#glow)" />
                                <circle cx="0" cy="0" r="64" fill="none" stroke="#3d7276" strokeWidth="0.5" opacity="0.4" />

                                {/* Seed of Life formulation */}
                                <g stroke="#4b868a" strokeWidth="0.5" fill="none" opacity="0.6">
                                    <circle cx="0" cy="0" r="22" />
                                    <circle cx="0" cy="-22" r="22" />
                                    <circle cx="19.05" cy="-11" r="22" />
                                    <circle cx="19.05" cy="11" r="22" />
                                    <circle cx="0" cy="22" r="22" />
                                    <circle cx="-19.05" cy="11" r="22" />
                                    <circle cx="-19.05" cy="-11" r="22" />
                                </g>

                                <circle cx="0" cy="0" r="38" fill="url(#leafGlowBright)" opacity="0.4" />
                                <circle cx="0" cy="0" r="12" fill="#deb96a" opacity="0.15" filter="url(#glow)" />
                            </g>
                            <path d="M0,0 Q-2,-45 0,-90" fill="none" stroke="url(#stemGrad)" strokeWidth="1.5" strokeLinecap="round" />
                            {/* Subtle grounding roots */}
                            <path d="M0,0 Q-8,8 -12,10" fill="none" stroke="#112426" strokeWidth="1" strokeLinecap="round" />
                            <path d="M0,0 Q8,8 12,10" fill="none" stroke="#112426" strokeWidth="1" strokeLinecap="round" />
                        </g>

                        {/* Tree 2: Equilibrium (Perfectly balanced swept curves and orbital rings) */}
                        <g id="tree-equilibrium" className="sway-slow">
                            <path d="M0,0 Q4,-40 0,-80" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />

                            {/* Sweeping Symmetrical Crest */}
                            <path d="M0,-170 C-45,-120 -35,-55 0,-45 C35,-55 45,-120 0,-170 Z" fill="url(#leafGlowBright)" opacity="0.6" />
                            <path d="M0,-145 C-25,-105 -20,-65 0,-55 C20,-65 25,-105 0,-145 Z" fill="#2a5a5d" opacity="0.8" />
                            <path d="M0,-120 C-10,-95 -8,-70 0,-65 C8,-70 10,-95 0,-120 Z" fill="#deb96a" opacity="0.25" filter="url(#glow)" />

                            {/* Orbital Rings - implying motion and celestial mechanics */}
                            <g transform="translate(0, -107.5)">
                                <circle cx="0" cy="0" r="70" fill="none" stroke="#8fa6a8" strokeWidth="0.5" strokeDasharray="1 8" opacity="0.4" />
                                <circle cx="0" cy="0" r="50" fill="none" stroke="#8fa6a8" strokeWidth="0.5" strokeDasharray="4 6" opacity="0.2" />
                            </g>

                            {/* Zenith point */}
                            <circle cx="0" cy="-185" r="1.5" fill="#deb96a" opacity="0.7" filter="url(#glow)" />
                        </g>

                        {/* Tree 3: Resonance (Offset concentric ripples, mimicking a soundwave pine) */}
                        <g id="tree-resonance" className="sway-fast">
                            <line x1="0" y1="0" x2="0" y2="-100" stroke="url(#stemGrad)" strokeWidth="1.5" strokeLinecap="round" />

                            {/* Nested Ripples */}
                            <g>
                                <circle cx="0" cy="-135" r="60" fill="none" stroke="url(#leafGlow)" strokeWidth="0.5" opacity="0.6" />
                                <circle cx="0" cy="-125" r="46" fill="url(#leafGlow)" opacity="0.3" />
                                <circle cx="0" cy="-125" r="46" fill="none" stroke="url(#leafGlowBright)" strokeWidth="1" opacity="0.7" />
                                <circle cx="0" cy="-115" r="32" fill="url(#leafGlowBright)" opacity="0.4" />
                                <circle cx="0" cy="-115" r="32" fill="none" stroke="#4b868a" strokeWidth="1.5" opacity="0.8" />
                                <circle cx="0" cy="-105" r="18" fill="#579296" opacity="0.5" />
                                <circle cx="0" cy="-105" r="18" fill="none" stroke="#deb96a" strokeWidth="1" opacity="0.4" />

                                {/* Core Energy */}
                                <circle cx="0" cy="-105" r="6" fill="#deb96a" opacity="0.3" filter="url(#glow)" />
                            </g>
                        </g>

                        {/* Distant Minimalist Silhouette */}
                        <g id="bg-tree">
                            <line x1="0" y1="0" x2="0" y2="-40" stroke="#112426" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M0,-65 C-15,-50 -12,-25 0,-20 C12,-25 15,-50 0,-65 Z" fill="#142b2d" opacity="0.8" />
                            <circle cx="0" cy="-65" r="2" fill="#deb96a" opacity="0.2" />
                        </g>
                    </defs>

                    {/* Sky */}
                    <rect width="100%" height="100%" fill="url(#skyGlow)" />

                    {/* Drifting Fireflies */}
                    {[...Array(50)].map((_, i) => {
                        const startX = Math.random() * 1440;
                        const startY = Math.random() * 700;
                        const floatDur = Math.random() * 10 + 15; // 15-25s
                        const pulseDur = Math.random() * 3 + 2;   // 2-5s
                        const delay = Math.random() * -20;
                        return (
                            <g key={`firefly-${i}`}>
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={Math.random() * 1.5 + 0.5}
                                    fill="#deb96a"
                                    opacity="0"
                                    filter="url(#glow)"
                                >
                                    <animateTransform
                                        attributeName="transform"
                                        type="translate"
                                        from={`${startX} ${startY}`}
                                        to={`${startX + (Math.random() * 200 - 100)} ${startY - Math.random() * 150}`}
                                        dur={`${floatDur}s`}
                                        repeatCount="indefinite"
                                        begin={`${delay}s`}
                                    />
                                    <animate
                                        attributeName="opacity"
                                        values="0;0.7;0"
                                        dur={`${pulseDur}s`}
                                        repeatCount="indefinite"
                                        begin={`${delay}s`}
                                    />
                                </circle>
                            </g>
                        );
                    })}

                    {/* Deep Background Hills & Mist */}
                    <path d="M-100,500 C300,450 500,600 900,500 C1200,400 1500,550 1600,530 L1600,800 L-100,800 Z" fill="url(#hillBack)" />
                    {/* Layer 1 Mist */}
                    <rect y="400" width="200%" height="200" fill="url(#mistGrad)" opacity="0.3">
                        <animateTransform attributeName="transform" type="translate" from="0 0" to="-1440 0" dur="120s" repeatCount="indefinite" />
                    </rect>
                    <rect y="400" x="1440" width="200%" height="200" fill="url(#mistGrad)" opacity="0.3">
                        <animateTransform attributeName="transform" type="translate" from="0 0" to="-1440 0" dur="120s" repeatCount="indefinite" />
                    </rect>

                    {/* Back Trees */}
                    <use href="#bg-tree" x="480" y="525" transform="scale(1.2)" opacity="0.6" />
                    <use href="#bg-tree" x="550" y="540" transform="scale(1)" opacity="0.5" />
                    <use href="#bg-tree" x="650" y="600" transform="scale(1.4)" opacity="0.6" />
                    <use href="#bg-tree" x="780" y="580" transform="scale(1.1)" opacity="0.6" />
                    <use href="#bg-tree" x="850" y="520" transform="scale(1.3)" opacity="0.6" />
                    <use href="#bg-tree" x="960" y="560" transform="scale(1.5)" opacity="0.6" />

                    {/* Additional Edge Back Trees */}
                    <use href="#bg-tree" x="150" y="540" transform="scale(1.1)" opacity="0.4" />
                    <use href="#bg-tree" x="300" y="510" transform="scale(1.3)" opacity="0.5" />
                    <use href="#bg-tree" x="1150" y="540" transform="scale(1.2)" opacity="0.5" />
                    <use href="#bg-tree" x="1300" y="520" transform="scale(1.4)" opacity="0.4" />

                    {/* Midground Hills */}
                    <path d="M-200,600 C200,450 450,650 850,500 C1150,350 1450,550 1600,500 L1600,800 L-200,800 Z" fill="url(#hillMid)" />

                    {/* Layer 2 Mist */}
                    <rect y="450" width="200%" height="150" fill="url(#mistGrad)" opacity="0.4">
                        <animateTransform attributeName="transform" type="translate" from="-1440 0" to="0 0" dur="90s" repeatCount="indefinite" />
                    </rect>
                    <rect y="450" x="-1440" width="200%" height="150" fill="url(#mistGrad)" opacity="0.4">
                        <animateTransform attributeName="transform" type="translate" from="-1440 0" to="0 0" dur="90s" repeatCount="indefinite" />
                    </rect>

                    {/* Mid Trees (Masterful Sacred Geometry) - Center Group */}
                    <g transform="translate(380, 580) scale(1.2)">
                        <use href="#tree-equilibrium" style={{ animationDelay: '-2s' }} />
                    </g>
                    <g transform="translate(520, 610) scale(1)">
                        <use href="#tree-resonance" style={{ animationDelay: '-1s' }} />
                    </g>
                    <g transform="translate(720, 610) scale(0.9)">
                        <use href="#tree-sacred" style={{ animationDelay: '-4s' }} />
                    </g>
                    <g transform="translate(920, 580) scale(1.3)">
                        <use href="#tree-equilibrium" style={{ animationDelay: '-5s' }} />
                    </g>
                    <g transform="translate(1080, 620) scale(1.1)">
                        <use href="#tree-resonance" style={{ animationDelay: '-3s' }} />
                    </g>

                    {/* Mid Trees - Edge Groups */}
                    <g transform="translate(120, 560) scale(1.15)">
                        <use href="#tree-sacred" style={{ animationDelay: '-6s' }} />
                    </g>
                    <g transform="translate(250, 630) scale(0.8)">
                        <use href="#tree-resonance" style={{ animationDelay: '-7s' }} />
                    </g>
                    <g transform="translate(1250, 590) scale(1.05)">
                        <use href="#tree-sacred" style={{ animationDelay: '-1s' }} />
                    </g>
                    <g transform="translate(1380, 550) scale(1.4)">
                        <use href="#tree-equilibrium" style={{ animationDelay: '-8s' }} />
                    </g>

                    {/* Foreground Hills */}
                    {/* Steeper dramatic sweeping path to frame the content */}
                    <path d="M-200,680 C150,500 500,750 800,600 C1100,450 1400,650 1600,550 L1600,800 L-200,800 Z" fill="url(#hillFront)" />

                    {/* Hero Foreground Trees - Left Side */}
                    <g transform="translate(180, 710) scale(1.6)">
                        <use href="#tree-equilibrium" style={{ animationDelay: '-4s' }} />
                    </g>
                    <g transform="translate(320, 680) scale(2.1)">
                        <use href="#tree-sacred" style={{ animationDelay: '-2s' }} />
                    </g>
                    <g transform="translate(420, 760) scale(1.4)">
                        <use href="#tree-resonance" style={{ animationDelay: '-6s' }} />
                    </g>

                    {/* Hero Foreground Trees - Inner Left & Right frames */}
                    <g transform="translate(560, 780) scale(1.3)">
                        <use href="#tree-resonance" style={{ animationDelay: '-1s' }} />
                    </g>
                    <g transform="translate(880, 710) scale(1.8)">
                        <use href="#tree-equilibrium" style={{ animationDelay: '-3s' }} />
                    </g>

                    {/* Hero Foreground Trees - Right Side */}
                    <g transform="translate(1020, 760) scale(1.5)">
                        <use href="#tree-sacred" style={{ animationDelay: '-7s' }} />
                    </g>
                    <g transform="translate(1180, 690) scale(2.2)">
                        <use href="#tree-resonance" style={{ animationDelay: '-5s' }} />
                    </g>
                    <g transform="translate(1320, 750) scale(1.7)">
                        <use href="#tree-equilibrium" style={{ animationDelay: '-2s' }} />
                    </g>
                </svg>
            </div>

            {/* Glowing Accent Overlay */}
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#deb96a]/10 to-transparent pointer-events-none" />

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 lg:px-12">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                >
                    <div className="mb-6 lg:mb-8 inline-flex items-center justify-center p-3 sm:p-4 lg:p-5 rounded-full bg-[#1e484a]/40 border border-[#deb96a]/30 backdrop-blur-md shadow-[0_0_30px_rgba(222,185,106,0.15)]">
                        <OnboardingArt className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24" />
                    </div>
                    <h1 className="text-6xl sm:text-8xl lg:text-9xl font-bold tracking-tight text-white drop-shadow-xl" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                        Riven
                    </h1>
                    <p className="mt-6 text-lg sm:text-xl lg:text-2xl text-[#b8d0d2] max-w-md lg:max-w-xl mx-auto tracking-wide italic">
                        Grow your knowledge.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                    className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-sm lg:max-w-md"
                >
                    <Link
                        to="/account?mode=signup"
                        className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[#deb96a] px-6 py-4 lg:px-8 lg:py-5 text-sm lg:text-base font-sans font-bold uppercase tracking-widest text-[#162a31] transition-all hover:bg-[#ebc97e] hover:shadow-[0_0_20px_rgba(222,185,106,0.4)] hover:-translate-y-0.5"
                    >
                        Sign Up
                    </Link>
                    <Link
                        to="/account?mode=login"
                        className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[#1e3840]/60 border border-[#8fa6a8]/30 px-6 py-4 lg:px-8 lg:py-5 text-sm lg:text-base font-sans font-bold uppercase tracking-widest text-[#fcfaf2] backdrop-blur-md transition-all hover:bg-[#1e3840]/90 hover:border-[#8fa6a8]/60 hover:-translate-y-0.5"
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
