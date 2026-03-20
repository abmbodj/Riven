import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '../../hooks/useGSAP';

gsap.registerPlugin(ScrollTrigger);

const generateFireflies = () => {
    return [...Array(50)].map((_, i) => {
        const startX = Math.random() * 1440;
        const startY = Math.random() * 700;
        const floatDur = Math.random() * 10 + 15;
        const pulseDur = Math.random() * 3 + 2;
        const delay = Math.random() * -20;
        const r = Math.random() * 1.5 + 0.5;
        const endX = startX + (Math.random() * 200 - 100);
        const endY = startY - Math.random() * 150;
        return { id: i, startX, startY, floatDur, pulseDur, delay, r, endX, endY };
    });
};

const initialFireflies = generateFireflies();

export default function GardenLanding() {
    const { container } = useGSAP(({ container: scope }) => {
        // 1. Ambient Tree Swaying
        // Target groups of trees and apply different, out-of-phase organic sways
        gsap.to('.tree-oak', {
            rotation: 'random(-2, 2)',
            transformOrigin: 'bottom center',
            duration: 'random(6, 10)',
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            stagger: { amount: 4, from: 'random' }
        });

        gsap.to('.tree-willow', {
            rotation: 'random(-1.5, 1.5)',
            transformOrigin: 'bottom center',
            duration: 'random(5, 8)',
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            stagger: { amount: 3, from: 'random' }
        });

        gsap.to('.tree-cypress', {
            rotation: 'random(-3, 3)',
            transformOrigin: 'bottom center',
            duration: 'random(4, 7)',
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            stagger: { amount: 2, from: 'random' }
        });

        // 2. Mist Parallax (Infinite translation)
        gsap.to('.mist-layer-1', {
            x: -1440,
            duration: 120,
            ease: 'none',
            repeat: -1
        });

        gsap.to('.mist-layer-2', {
            x: 1440,
            duration: 90,
            ease: 'none',
            repeat: -1
        });

        // 3. Firefly Animations (Particle System)
        const fireflies = gsap.utils.toArray('.fireflyGroup');
        fireflies.forEach((group, i) => {
            const firefly = initialFireflies[i];

            // Random floating motion
            gsap.to(group, {
                x: `+=${gsap.utils.random(-150, 150)}`,
                y: `+=${gsap.utils.random(-100, -200)}`,
                duration: firefly.floatDur,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: firefly.delay
            });

            // Pulsing opacity
            gsap.to(group.querySelector('circle'), {
                opacity: 0.7,
                duration: firefly.pulseDur / 2,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: firefly.delay
            });
        });

        // 4. Scroll Parallax Effect
        // Move the distinct layers at different speeds to create depth as user scrolls down
        const scrollTl = gsap.timeline({
            scrollTrigger: {
                trigger: scope,
                start: 'top top',
                end: 'bottom top',
                scrub: 1, // Smooth scrubbing
            }
        });

        // Sun/Sky glow subtly shifts
        scrollTl.to('.sky-gradient', { attr: { cy: "30%" }, duration: 1 }, 0);

        // Back mist and hills move slowest
        scrollTl.to('.hills-back', { y: 150, duration: 1 }, 0)
            .to('.mist-group-1', { y: 100, duration: 1 }, 0);

        // Mid hills move a bit faster
        scrollTl.to('.hills-mid', { y: 50, duration: 1 }, 0)
            .to('.mist-group-2', { y: 30, duration: 1 }, 0);

        // Front hills move fastest, coming "up" slightly to frame the next section
        // (No y shift so they stay anchored, or slight negative y to parallax over mid)
        scrollTl.to('.hills-front', { y: -20, duration: 1 }, 0);

    }, []);

    return (
        <div ref={container} className="relative w-full min-h-screen bg-[#0d141e] text-[#fcfaf2] font-serif overflow-x-hidden selection:bg-[#deb96a]/30 selection:text-[#fcfaf2]">
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
                            <radialGradient id="skyGlow" className="sky-gradient" cx="50%" cy="40%" r="60%">
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

                            {/* Tree 1: Gentle Oak (Welcoming and grounded) */}
                            <g id="tree-oak" className="tree-oak">
                                <path d="M0,0 Q3,-30 0,-60" fill="none" stroke="url(#stemGrad)" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M0,-40 Q15,-50 20,-65" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />
                                <path d="M0,-30 Q-15,-40 -20,-55" fill="none" stroke="url(#stemGrad)" strokeWidth="2" strokeLinecap="round" />

                                <path d="M-25,-45 C-40,-45 -45,-60 -35,-70 C-45,-85 -25,-100 -10,-90 C-5,-110 20,-105 25,-85 C45,-90 45,-65 35,-55 C50,-45 35,-25 20,-35 C10,-25 -10,-25 -20,-35 C-30,-25 -45,-35 -25,-45 Z" fill="#1b4044" opacity="0.9" />

                                <path d="M-15,-55 C-30,-55 -35,-65 -25,-75 C-35,-85 -20,-95 -10,-85 C-5,-105 15,-100 20,-80 C35,-85 35,-65 25,-60 C35,-55 25,-40 15,-45 C5,-35 -5,-35 -15,-45 C-25,-35 -35,-45 -15,-55 Z" fill="#2a5a5d" opacity="0.9" />

                                <ellipse cx="0" cy="-65" rx="45" ry="35" fill="url(#leafGlowBright)" opacity="0.2" filter="url(#glow)" />
                            </g>

                            {/* Tree 2: Weeping Willow (Calm and flowing) */}
                            <g id="tree-willow" className="tree-willow">
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
                            <g id="tree-cypress" className="tree-cypress">
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
                        {initialFireflies.map((firefly) => (
                            <g key={`firefly-${firefly.id}`} className="fireflyGroup" transform={`translate(${firefly.startX}, ${firefly.startY})`}>
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={firefly.r}
                                    fill="#deb96a"
                                    opacity="0"
                                    filter="url(#glow)"
                                />
                            </g>
                        ))}

                        {/* Deep Background Hills & Mist */}
                        <g className="hills-back">
                            <path d="M-100,500 C300,450 500,600 900,500 C1200,400 1500,550 1600,530 L1600,800 L-100,800 Z" fill="url(#hillBack)" />
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
                        </g>

                        {/* Layer 1 Mist */}
                        <g className="mist-group-1">
                            <rect y="400" width="200%" height="200" fill="url(#mistGrad)" opacity="0.3" className="mist-layer-1" />
                            <rect y="400" x="2880" width="200%" height="200" fill="url(#mistGrad)" opacity="0.3" className="mist-layer-1" />
                        </g>

                        {/* Midground Hills */}
                        <g className="hills-mid">
                            <path d="M-200,600 C200,450 450,650 850,500 C1150,350 1450,550 1600,500 L1600,800 L-200,800 Z" fill="url(#hillMid)" />
                            {/* Mid Trees */}
                            {[
                                ['oak', 120, 580, 1.2],
                                ['cypress', 260, 610, 1.3],
                                ['willow', 400, 590, 1.5],
                                ['oak', 550, 615, 1.3],
                                ['cypress', 700, 585, 1.6],
                                ['willow', 850, 620, 1.2],
                                ['oak', 1000, 605, 1.4],
                                ['cypress', 1150, 580, 1.2],
                                ['willow', 1300, 610, 1.5],
                                ['oak', 1420, 590, 1.3]
                            ].map(([type, x, y, scale], i) => (
                                <g key={`mid-${i}`} transform={`translate(${x}, ${y}) scale(${scale})`}>
                                    <use href={`#tree-${type}`} />
                                </g>
                            ))}
                        </g>

                        {/* Layer 2 Mist */}
                        <g className="mist-group-2">
                            <rect y="450" x="-1440" width="200%" height="150" fill="url(#mistGrad)" opacity="0.4" className="mist-layer-2" />
                            <rect y="450" x="-4320" width="200%" height="150" fill="url(#mistGrad)" opacity="0.4" className="mist-layer-2" />
                        </g>

                        {/* Foreground Hills */}
                        <g className="hills-front">
                            {/* Steeper dramatic sweeping path to frame the content */}
                            <path d="M-200,680 C150,500 500,750 800,600 C1100,450 1400,650 1600,550 L1600,800 L-200,800 Z" fill="url(#hillFront)" />

                            {/* Foreground Trees */}
                            {[
                                ['willow', 80, 710, 2.1],
                                ['oak', 240, 750, 1.9],
                                ['cypress', 400, 780, 1.7],
                                ['willow', 580, 720, 1.8],
                                ['oak', 760, 770, 2.0],
                                ['willow', 940, 730, 1.9],
                                ['cypress', 1120, 790, 1.8],
                                ['oak', 1280, 720, 2.2],
                                ['willow', 1420, 760, 2.0]
                            ].map(([type, x, y, scale], i) => (
                                <g key={`fg-${i}`} transform={`translate(${x}, ${y}) scale(${scale})`}>
                                    <use href={`#tree-${type}`} />
                                </g>
                            ))}
                        </g>
                    </svg>
                </div>

                {/* Glowing Accent Overlay */}
                <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#deb96a]/10 to-transparent pointer-events-none" />

                {/* Foreground Content */}
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 lg:px-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)", letterSpacing: "0.2em" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)", letterSpacing: "normal" }}
                        transition={{
                            duration: 1.5,
                            ease: [0.22, 1, 0.36, 1],
                            opacity: { duration: 1 },
                            filter: { duration: 1.2 }
                        }}
                        className="flex flex-col items-center justify-center pointer-events-none"
                    >
                        <h1 className="text-6xl sm:text-8xl lg:text-[10rem] font-bold tracking-tighter text-white drop-shadow-2xl selection:bg-white/10" style={{ textShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
                            Riven
                        </h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1, duration: 1 }}
                            className="mt-4 text-xl sm:text-2xl lg:text-3xl text-[#b8d0d2] max-w-md lg:max-w-xl mx-auto tracking-widest italic font-light opacity-80"
                        >
                            Grow your knowledge.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 1.2, ease: "easeOut" }}
                        className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-sm lg:max-w-md"
                    >
                        <Link
                            to="/account?mode=signup"
                            className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[#deb96a] px-6 py-4 lg:px-8 lg:py-5 text-sm lg:text-base font-sans font-bold uppercase tracking-widest text-[#162a31] transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-[#ebc97e] hover:shadow-[0_0_20px_rgba(222,185,106,0.4)] hover:-translate-y-0.5"
                        >
                            Sign Up
                        </Link>
                        <Link
                            to="/account?mode=login"
                            className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[#1e3840]/60 border border-[#8fa6a8]/30 px-6 py-4 lg:px-8 lg:py-5 text-sm lg:text-base font-sans font-bold uppercase tracking-widest text-[#fcfaf2] md:backdrop-blur-md transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-[#1e3840]/90 hover:border-[#8fa6a8]/60 hover:-translate-y-0.5"
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
                        { title: "Rooted Retention", desc: "Spaced repetition algorithms that adapt to your memory, helping knowledge last." },
                        { title: "Branching Thoughts", desc: "Organize the sprawl of your ideas into focused, interconnected flashcard decks." },
                        { title: "Peaceful Progression", desc: "A minimal, anxiety-free learning experience. Measure growth in quiet mastery." }
                    ].map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, delay: idx * 0.2, ease: "easeOut" }}
                            className="p-8 lg:p-10 rounded-2xl bg-[#1e3840]/20 border border-[#8fa6a8]/10 hover:border-[#deb96a]/30 hover:bg-[#1e3840]/40 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 flex flex-col"
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
            <section className="relative w-full bg-[#0a1017] border-y border-[#1e3840]/50 py-16 sm:py-24 lg:py-48 shadow-[inset_0_20px_40px_rgba(0,0,0,0.5)]">
                <div className="max-w-7xl mx-auto px-4 lg:px-12 flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="text-center mb-10 lg:mb-20"
                    >
                        <h2 className="text-4xl lg:text-5xl font-serif text-[#fcfaf2] mb-6">Simple transparent growth</h2>
                        <p className="text-[#8fa6a8] font-sans tracking-wide uppercase text-sm">No hidden limits. Cultivate endlessly.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 w-full max-w-6xl">
                        {/* Free Tier */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="p-5 sm:p-8 lg:p-10 rounded-3xl bg-[#0d141e] border border-[#1e3840] flex flex-col hover:border-[#3d7276]/50 transition-colors duration-500"
                        >
                            <h3 className="text-lg uppercase tracking-widest font-sans text-[#8fa6a8] mb-2">Seedling (Free)</h3>
                            <div className="text-4xl lg:text-5xl font-serif text-[#fcfaf2] mb-4 lg:mb-6">$0<span className="text-lg text-[#8fa6a8] font-sans">/mo</span></div>
                            <ul className="space-y-3 lg:space-y-4 mb-6 lg:mb-10 flex-1 font-sans text-[#b8d0d2] text-sm tracking-wide">
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d7276]"></div> Create flashcards & decks
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d7276]"></div> Spaced repetition learning
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3d7276]"></div> Peaceful ad-supported interface
                                </li>
                            </ul>
                            <Link to="/account?mode=signup" className="w-full py-4 text-center rounded-xl border border-[#3d7276]/50 text-[#b8d0d2] font-sans uppercase tracking-widest text-xs hover:bg-[#1e3840]/30 hover:text-[#deb96a] transition-[transform,opacity,color,background-color,border-color,box-shadow]">
                                Begin Journey
                            </Link>
                        </motion.div>

                        {/* Supporter Tier */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                            className="relative p-5 sm:p-8 lg:p-10 rounded-3xl bg-gradient-to-b from-[#1b4044]/30 to-[#0d141e] border border-[#deb96a]/30 shadow-[0_0_40px_rgba(222,185,106,0.05)] flex flex-col overflow-hidden hover:border-[#deb96a]/50 hover:shadow-[0_0_50px_rgba(222,185,106,0.1)] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-500 scale-100 lg:scale-105 z-10"
                        >
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#deb96a] text-[#0d141e] text-[9px] font-sans font-bold px-3 py-1 rounded-b-lg uppercase tracking-widest">Most Popular</span>
                            <h3 className="text-lg uppercase tracking-widest font-sans text-[#deb96a] mb-2 mt-2">Supporter</h3>
                            <div className="text-4xl lg:text-5xl font-serif text-[#deb96a] mb-4 lg:mb-6">$5.99<span className="text-lg text-[#8fa6a8] font-sans">/mo</span></div>
                            <ul className="space-y-3 lg:space-y-4 mb-6 lg:mb-10 flex-1 font-sans text-[#b8d0d2] text-sm tracking-wide">
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Unlimited Hearts & AI Gen
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> All PRO Themes
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Ad-free Experience
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#deb96a]"></div> Advanced Study Groups
                                </li>
                            </ul>
                            <Link to="/account?mode=signup" className="w-full py-4 relative z-10 text-center rounded-xl bg-[#deb96a] text-[#0d141e] font-sans font-bold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(222,185,106,0.2)] hover:bg-[#ebc97e] hover:-translate-y-0.5 transition-[transform,opacity,color,background-color,border-color,box-shadow]">
                                Support Riven
                            </Link>
                        </motion.div>

                        {/* Annual Tier */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                            className="relative p-5 sm:p-8 lg:p-10 rounded-3xl bg-[#0d141e] border border-amber-500/20 flex flex-col hover:border-amber-500/40 transition-colors duration-500"
                        >
                            <h3 className="text-lg uppercase tracking-widest font-sans text-amber-500/80 mb-2">Annual</h3>
                            <div className="text-4xl lg:text-5xl font-serif text-[#fcfaf2] mb-4 lg:mb-6">$74.99<span className="text-lg text-[#8fa6a8] font-sans">/yr</span></div>
                            <ul className="space-y-3 lg:space-y-4 mb-6 lg:mb-10 flex-1 font-sans text-[#b8d0d2] text-sm tracking-wide">
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80"></div> All Supporter Benefits
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80"></div> Predictable yearly billing
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80"></div> Renews yearly—cancel anytime
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80"></div> Future Premium Features
                                </li>
                            </ul>
                            <Link to="/account?mode=signup" className="w-full py-4 text-center rounded-xl border border-amber-500/30 text-amber-500/90 font-sans uppercase tracking-widest text-xs hover:bg-amber-500/10 hover:text-amber-400 transition-[transform,opacity,color,background-color,border-color,box-shadow]">
                                Go Annual
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="w-full bg-[#0d141e] py-16 px-6 lg:px-12 text-center border-t border-[#1e3840]/30 font-sans mt-auto">
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
