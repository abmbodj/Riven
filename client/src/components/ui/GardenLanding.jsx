import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import OnboardingArt from '../OnboardingArt';

export default function GardenLanding() {
    return (
        <div className="relative w-full min-h-screen bg-[#0d141e] text-[#fcfaf2] font-serif overflow-x-hidden selection:bg-[#deb96a]/30 selection:text-[#fcfaf2]">
            {/* Hero Section */}
            <section className="relative w-full h-[100svh] flex flex-col items-center justify-center overflow-hidden">
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
                                    0%, 100% { transform: rotate(-1.5deg); }
                                    50% { transform: rotate(1.5deg); }
                                }
                                @keyframes swaySlow {
                                    0%, 100% { transform: rotate(-1deg); }
                                    50% { transform: rotate(1deg); }
                                }
                                @keyframes swayFast {
                                    0%, 100% { transform: rotate(-2deg); }
                                    50% { transform: rotate(2deg); }
                                }
                                
                                .sway { animation: sway 8s ease-in-out infinite; transform-origin: 0px 0px; }
                                .sway-slow { animation: swaySlow 12s ease-in-out infinite; transform-origin: 0px 0px; }
                                .sway-fast { animation: swayFast 6s ease-in-out infinite; transform-origin: 0px 0px; }
                            `}
                            </style>

                            {/* Tree 1: Gentle Oak (Welcoming and grounded) */}
                            <g id="tree-oak" className="sway-slow">
                                <path d="M0,0 Q3,-30 0,-60" fill="none" stroke="url(#stemGrad)" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M0,-40 Q15,-50 20,-65" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />
                                <path d="M0,-30 Q-15,-40 -20,-55" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />

                                <path d="M-25,-45 C-40,-45 -45,-60 -35,-70 C-45,-85 -25,-100 -10,-90 C-5,-110 20,-105 25,-85 C45,-90 45,-65 35,-55 C50,-45 35,-25 20,-35 C10,-25 -10,-25 -20,-35 C-30,-25 -45,-35 -25,-45 Z" fill="#1b4044" opacity="0.9" />

                                <path d="M-15,-55 C-30,-55 -35,-65 -25,-75 C-35,-85 -20,-95 -10,-85 C-5,-105 15,-100 20,-80 C35,-85 35,-65 25,-60 C35,-55 25,-40 15,-45 C5,-35 -5,-35 -15,-45 C-25,-35 -35,-45 -15,-55 Z" fill="#2a5a5d" opacity="0.9" />

                                <ellipse cx="0" cy="-65" rx="45" ry="35" fill="url(#leafGlowBright)" opacity="0.2" filter="url(#glow)" />
                            </g>

                            {/* Tree 2: Weeping Willow (Calm and flowing) */}
                            <g id="tree-willow" className="sway">
                                <path d="M0,0 Q-4,-40 0,-80" fill="none" stroke="url(#stemGrad)" strokeWidth="3" strokeLinecap="round" />
                                <path d="M0,-50 Q-20,-70 -35,-65" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />
                                <path d="M0,-60 Q20,-80 35,-75" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />
                                <path d="M-20,-65 Q-15,-80 -5,-90" fill="none" stroke="url(#stemGrad)" strokeWidth="1.5" strokeLinecap="round" />
                                <path d="M10,-75 Q15,-85 25,-90" fill="none" stroke="url(#stemGrad)" strokeWidth="1.5" strokeLinecap="round" />

                                {/* Cascading leaves */}
                                <g stroke="#2a5a5d" strokeWidth="2" strokeLinecap="round" opacity="0.8" fill="none">
                                    <path d="M-40,-60 Q-45,-20 -35,15" />
                                    <path d="M-30,-70 Q-35,-30 -25,25" />
                                    <path d="M-20,-85 Q-25,-40 -15,10" />
                                    <path d="M-10,-95 Q-15,-40 -5,30" />
                                    <path d="M0,-95 Q-5,-40 5,20" />
                                    <path d="M10,-95 Q15,-40 15,25" />
                                    <path d="M25,-85 Q30,-40 25,15" />
                                    <path d="M35,-75 Q40,-30 35,5" />
                                    <path d="M45,-65 Q50,-20 40,10" />
                                </g>

                                <g stroke="#3d7276" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" fill="none">
                                    <path d="M-35,-65 Q-40,-30 -30,5" />
                                    <path d="M-25,-75 Q-30,-30 -20,15" />
                                    <path d="M-15,-90 Q-20,-40 -10,20" />
                                    <path d="M-5,-100 Q-10,-40 0,35" />
                                    <path d="M5,-100 Q10,-40 10,25" />
                                    <path d="M20,-90 Q25,-40 20,10" />
                                    <path d="M30,-80 Q35,-30 30,20" />
                                    <path d="M40,-70 Q45,-20 35,0" />
                                </g>

                                <ellipse cx="0" cy="-65" rx="55" ry="40" fill="url(#leafGlowBright)" opacity="0.2" filter="url(#glow)" />
                            </g>

                            {/* Tree 3: Soft Cypress / Tall Pine (Elegant and reaching) */}
                            <g id="tree-cypress" className="sway-fast">
                                <path d="M0,0 Q2,-50 0,-120" fill="none" stroke="url(#stemGrad)" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M0,-140 C-20,-80 -30,-30 0,-10 C30,-30 20,-80 0,-140 Z" fill="#1b4044" opacity="0.9" />
                                <path d="M0,-130 C-15,-80 -20,-35 0,-20 C20,-35 15,-80 0,-130 Z" fill="#2a5a5d" opacity="0.9" />
                                <path d="M0,-120 C-10,-80 -12,-40 0,-30 C12,-40 10,-80 0,-120 Z" fill="#3d7276" opacity="0.9" />
                                <ellipse cx="0" cy="-75" rx="20" ry="50" fill="url(#leafGlowBright)" opacity="0.25" filter="url(#glow)" />
                            </g>

                            {/* Distant Minimalist Silhouette */}
                            <g id="bg-tree">
                                <path d="M0,0 L0,-30" stroke="#112426" strokeWidth="2" strokeLinecap="round" />
                                <path d="M-10,-25 C-15,-40 0,-55 0,-55 C0,-55 15,-40 10,-25 C5,-20 -5,-20 -10,-25 Z" fill="#142b2d" opacity="0.8" />
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

                        {/* Background Silhouette Trees */}
                        {[
                            [80, 530, 1.4], [180, 545, 1.1], [300, 525, 1.6], [380, 550, 1.2], [500, 535, 1.5],
                            [620, 520, 1.3], [750, 540, 1.7], [880, 530, 1.1], [980, 555, 1.4], [1100, 525, 1.6],
                            [1220, 545, 1.2], [1300, 520, 1.5], [1400, 540, 1.8]
                        ].map(([x, y, s], i) => (
                            <g key={`bg-${i}`} transform={`translate(${x}, ${y}) scale(${s})`} opacity="0.5">
                                <use href="#bg-tree" />
                            </g>
                        ))}

                        {/* Midground Hills */}
                        <path d="M-200,600 C200,450 450,650 850,500 C1150,350 1450,550 1600,500 L1600,800 L-200,800 Z" fill="url(#hillMid)" />

                        {/* Layer 2 Mist */}
                        <rect y="450" width="200%" height="150" fill="url(#mistGrad)" opacity="0.4">
                            <animateTransform attributeName="transform" type="translate" from="-1440 0" to="0 0" dur="90s" repeatCount="indefinite" />
                        </rect>
                        <rect y="450" x="-1440" width="200%" height="150" fill="url(#mistGrad)" opacity="0.4">
                            <animateTransform attributeName="transform" type="translate" from="-1440 0" to="0 0" dur="90s" repeatCount="indefinite" />
                        </rect>

                        {/* Mid Trees */}
                        {[
                            ['oak', 120, 580, 1.2, -2],
                            ['cypress', 260, 610, 1.3, -5],
                            ['willow', 400, 590, 1.5, -1],
                            ['oak', 550, 615, 1.3, -4],
                            ['cypress', 700, 585, 1.6, -7],
                            ['willow', 850, 620, 1.2, -3],
                            ['oak', 1000, 605, 1.4, -6],
                            ['cypress', 1150, 580, 1.2, -2],
                            ['willow', 1300, 610, 1.5, -5],
                            ['oak', 1420, 590, 1.3, -1]
                        ].map(([type, x, y, scale, delay], i) => (
                            <g key={`mid-${i}`} transform={`translate(${x}, ${y}) scale(${scale})`}>
                                <use href={`#tree-${type}`} style={{ animationDelay: `${delay}s` }} />
                            </g>
                        ))}

                        {/* Foreground Hills */}
                        {/* Steeper dramatic sweeping path to frame the content */}
                        <path d="M-200,680 C150,500 500,750 800,600 C1100,450 1400,650 1600,550 L1600,800 L-200,800 Z" fill="url(#hillFront)" />

                        {/* Foreground Trees */}
                        {[
                            ['willow', 80, 710, 2.1, -3],
                            ['oak', 240, 750, 1.9, -1],
                            ['cypress', 400, 780, 1.7, -6],
                            ['willow', 580, 720, 1.8, -2],
                            ['oak', 760, 770, 2.0, -5],
                            ['willow', 940, 730, 1.9, -4],
                            ['cypress', 1120, 790, 1.8, -2],
                            ['oak', 1280, 720, 2.2, -7],
                            ['willow', 1420, 760, 2.0, -1]
                        ].map(([type, x, y, scale, delay], i) => (
                            <g key={`fg-${i}`} transform={`translate(${x}, ${y}) scale(${scale})`}>
                                <use href={`#tree-${type}`} style={{ animationDelay: `${delay}s` }} />
                            </g>
                        ))}
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

                {/* Seamless gradient transition */}
                <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-[#0d141e] to-transparent pointer-events-none z-10" />
            </section>

            {/* About / Philosophy Section */}
            <section className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 py-32 lg:py-48 z-20">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="max-w-3xl mx-auto text-center"
                >
                    <h2 className="text-4xl lg:text-6xl font-serif text-[#deb96a] tracking-tight mb-8">
                        Quiet your mind. <br className="hidden md:block" /> Focus your intent.
                    </h2>
                    <p className="text-lg lg:text-2xl text-[#b8d0d2] leading-relaxed font-serif font-light">
                        Riven is not just a tool; it is a sanctuary for your thoughts. In a world of infinite distraction, finding a space to cultivate knowledge is rare. Here, you plant the seeds of your understanding and return daily to see them grow.
                    </p>
                </motion.div>

                {/* Features Bento / List */}
                <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
                    {[
                        { title: "Rooted Retention", desc: "Spaced repetition algorithms that adapt to your unique memory decay rate, ensuring knowledge takes deep root." },
                        { title: "Branching Thoughts", desc: "Organize the chaotic sprawl of ideas into coherent mental maps and interconnected flashcard decks." },
                        { title: "Peaceful Progression", desc: "A minimalist interface devoid of gamified anxiety. Measure growth not in streaks, but in quiet mastery." }
                    ].map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, delay: idx * 0.2, ease: "easeOut" }}
                            className="p-8 lg:p-10 rounded-2xl bg-[#1e3840]/20 border border-[#8fa6a8]/10 hover:border-[#deb96a]/30 hover:bg-[#1e3840]/40 transition-all duration-500 flex flex-col"
                        >
                            <div className="w-12 h-12 mb-6 rounded-full bg-[#1b4044] border border-[#2a5a5d]/50 shadow-inner flex items-center justify-center text-[#deb96a]">
                                <span className="font-sans text-xs tracking-widest uppercase opacity-80">{idx + 1}</span>
                            </div>
                            <h3 className="text-2xl font-serif text-[#fcfaf2] mb-4">{feature.title}</h3>
                            <p className="text-[#8fa6a8] leading-relaxed font-sans text-sm tracking-wide">
                                {feature.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Pricing Section */}
            <section className="relative w-full bg-[#0a1017] border-y border-[#1e3840]/50 py-32 lg:py-48 shadow-[inset_0_20px_40px_rgba(0,0,0,0.5)]">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="text-center mb-20"
                    >
                        <h2 className="text-4xl lg:text-5xl font-serif text-[#fcfaf2] mb-6">Simple transparent growth</h2>
                        <p className="text-[#8fa6a8] font-sans tracking-wide uppercase text-sm">No hidden limits. Cultivate endlessly.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 w-full max-w-4xl">
                        {/* Free Tier */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="p-10 lg:p-14 rounded-3xl bg-[#0d141e] border border-[#1e3840] flex flex-col hover:border-[#3d7276]/50 transition-colors duration-500"
                        >
                            <h3 className="text-lg uppercase tracking-widest font-sans text-[#8fa6a8] mb-2">Seedling</h3>
                            <div className="text-5xl font-serif text-[#fcfaf2] mb-6">$0<span className="text-xl text-[#8fa6a8] font-sans">/mo</span></div>
                            <ul className="space-y-4 mb-10 flex-1 font-sans text-[#b8d0d2] text-sm tracking-wide">
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d7276]"></div> Essential flashcards
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d7276]"></div> Base spaced repetition
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d7276]"></div> Serene interface
                                </li>
                            </ul>
                            <Link to="/account?mode=signup" className="w-full py-4 text-center rounded-xl border border-[#3d7276]/50 text-[#b8d0d2] font-sans uppercase tracking-widest text-xs hover:bg-[#1e3840]/30 hover:text-[#deb96a] transition-all">
                                Begin Journey
                            </Link>
                        </motion.div>

                        {/* Pro Tier */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                            className="relative p-10 lg:p-14 rounded-3xl bg-gradient-to-b from-[#1b4044]/30 to-[#0d141e] border border-[#deb96a]/30 shadow-[0_0_40px_rgba(222,185,106,0.05)] flex flex-col overflow-hidden hover:border-[#deb96a]/50 hover:shadow-[0_0_50px_rgba(222,185,106,0.1)] transition-all duration-500"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-20 pointer-events-none">
                                <OnboardingArt className="w-24 h-24" />
                            </div>
                            <h3 className="text-lg uppercase tracking-widest font-sans text-[#deb96a] mb-2">Canopy</h3>
                            <div className="text-5xl font-serif text-[#deb96a] mb-6">$8<span className="text-xl text-[#8fa6a8] font-sans">/mo</span></div>
                            <ul className="space-y-4 mb-10 flex-1 font-sans text-[#b8d0d2] text-sm tracking-wide">
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Everything in Seedling
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Unlimited Decks & Sub-decks
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Advanced Analytics
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Priority Sync
                                </li>
                            </ul>
                            <Link to="/account?mode=signup" className="w-full py-4 relative z-10 text-center rounded-xl bg-[#deb96a] text-[#0d141e] font-sans font-bold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(222,185,106,0.2)] hover:bg-[#ebc97e] hover:-translate-y-0.5 transition-all">
                                Expand Root System
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="w-full bg-[#0d141e] py-16 px-6 lg:px-12 text-center border-t border-[#1e3840]/30 font-sans mt-auto">
                <div className="mb-6 opacity-40 inline-flex items-center justify-center">
                    <OnboardingArt className="w-8 h-8" />
                </div>
                <p className="text-[#8fa6a8] text-xs tracking-widest uppercase mb-4">
                    Cultivated by Riven
                </p>
                <div className="flex justify-center gap-6 text-xs text-[#8fa6a8]/60 tracking-wider">
                    <Link to="/privacy" className="hover:text-[#deb96a] transition-colors">Privacy</Link>
                    <Link to="/terms" className="hover:text-[#deb96a] transition-colors">Terms</Link>
                    <a href="mailto:contact@riven.example.com" className="hover:text-[#deb96a] transition-colors">Contact</a>
                </div>
            </footer>
        </div>
    );
}
