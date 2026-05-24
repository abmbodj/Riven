import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    ArrowRight,
    BookOpen,
    Calendar,
    CheckCircle2,
    ClipboardList,
    Crown,
    Layers,
    Mic,
    Sparkles,
    Upload,
    WandSparkles,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '../../hooks/useGSAP';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget';

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

const productScreenshotSlots = [
    {
        eyebrow: 'Class-aware notes',
        title: 'Lecture capture turns into notes that keep the class attached.',
        body: 'Bring in audio, files, or written notes and keep the result tied to the course it came from, so study tools start with the right context.',
        placeholder: 'Notes screenshot placeholder',
        assetPath: '/landing/riven-notes.png',
        accent: '#deb96a',
        Icon: Mic,
        bullets: ['Audio and imports become structured notes', 'Source material stays linked to the class', 'Definitions, examples, and recall hooks stay visible'],
    },
    {
        eyebrow: 'Review rhythm',
        title: 'Decks and weak topics feed the next focused session.',
        body: 'Riven keeps flashcards, recall, and review queues connected so the next small study pass is already shaped when you return.',
        placeholder: 'Review screenshot placeholder',
        assetPath: '/landing/riven-review.png',
        accent: '#8fc4c7',
        Icon: Layers,
        bullets: ['Spaced repetition stays central', 'Weak topics surface before they drift', 'Guides, exams, and decks share momentum'],
    },
    {
        eyebrow: 'Course command center',
        title: 'Classes, assignments, and study material live in one course view.',
        body: 'Calendar context, due dates, and linked materials sit beside the work, so Riven is organized around school as it actually happens.',
        placeholder: 'Classes screenshot placeholder',
        assetPath: '/landing/riven-classes.png',
        accent: '#b0d9b1',
        Icon: Calendar,
        bullets: ['Class pages hold the learning context', 'Assignments and materials stay close', 'Canvas import can reduce manual setup'],
    },
    {
        eyebrow: 'AI study material',
        title: 'Generate guides and practice from material that already knows the subject.',
        body: 'The AI layer is strongest when it starts from the class, note, deck, or source you selected instead of from a blank prompt.',
        placeholder: 'AI study screenshot placeholder',
        assetPath: '/landing/riven-ai.png',
        accent: '#d89a76',
        Icon: WandSparkles,
        bullets: ['Guides, exams, and decks start from your material', 'Prompts inherit class and subject context', 'Outputs point back to what you are studying'],
    },
];

const workflowSteps = [
    {
        Icon: Upload,
        title: 'Bring in material',
        body: 'Create a class, record a lecture, import notes, or connect the source material you already have.',
    },
    {
        Icon: ClipboardList,
        title: 'Riven shapes the study surface',
        body: 'Notes, decks, guides, and mock exams keep the class identity attached instead of becoming separate piles.',
    },
    {
        Icon: BookOpen,
        title: 'Return to the next right thing',
        body: 'Review queues, deadlines, and weak topics make the next session specific enough to start quickly.',
    },
];

const outcomeStats = [
    { value: '5', label: 'Study surfaces', detail: 'Notes, decks, guides, mock exams, and classes work together.' },
    { value: '1', label: 'Course context', detail: 'Class identity stays attached as material becomes practice.' },
    { value: 'Daily', label: 'Review rhythm', detail: 'Short sessions help keep progress visible without rebuilding a plan.' },
];

const pricingPlans = [
    {
        name: 'Seedling',
        eyebrow: 'Free',
        price: '$0',
        cadence: '/mo',
        body: 'Start with the calm foundation and build your study routine first.',
        features: ['Decks, cards, notes, and class tracking', 'Spaced repetition and daily study sessions', 'Enough structure to test the workflow'],
        cta: 'Begin Journey',
        accent: '#8fc4c7',
        featured: false,
    },
    {
        name: 'Supporter',
        eyebrow: 'Most Popular',
        price: '$5.99',
        cadence: '/mo',
        body: 'Open up the deeper AI and theme experience for regular weekly studying.',
        features: ['Riven AI across notes, decks, guides, exams, and YouTube tools', 'Unlimited hearts and the full theme library', 'Ad-free study flow with fewer interruptions', 'Better fit for students using Riven every week'],
        cta: 'Support Riven',
        accent: '#deb96a',
        featured: true,
    },
    {
        name: 'Annual',
        eyebrow: 'Best for semesters',
        price: '$74.99',
        cadence: '/yr',
        body: 'Everything in Supporter, billed once for long-term study seasons.',
        features: ['Everything in Supporter, billed once for the year', 'Predictable yearly billing for long semesters', 'Best fit if Riven becomes part of your weekly loop', 'Ongoing premium updates as the product grows'],
        cta: 'Go Annual',
        accent: '#d89a76',
        featured: false,
    },
];

export default function GardenLanding() {
    const lightBudget = useMobileVisualBudget();

    const { container } = useGSAP(({ container: scope }) => {
        // 1. Ambient Tree Swaying — always animate oaks, skip others on mobile
        gsap.to('.tree-oak', {
            rotation: 'random(-2, 2)',
            transformOrigin: 'bottom center',
            duration: 'random(6, 10)',
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            stagger: { amount: 4, from: 'random' }
        });

        if (!lightBudget) {
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
        }

        // 2. Mist Parallax — skip on mobile
        if (!lightBudget) {
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
        }

        // 3. Firefly Animations (Particle System)
        const fireflies = gsap.utils.toArray('.fireflyGroup');
        fireflies.forEach((group, i) => {
            const firefly = initialFireflies[i];
            if (!firefly) return;

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
        const scrollTl = gsap.timeline({
            scrollTrigger: {
                trigger: scope,
                start: 'top top',
                end: 'bottom top',
                scrub: 1,
            }
        });

        scrollTl.to('.sky-gradient', { attr: { cy: "30%" }, duration: 1 }, 0);

        scrollTl.to('.hills-back', { y: 150, duration: 1 }, 0)
            .to('.mist-group-1', { y: 100, duration: 1 }, 0);

        scrollTl.to('.hills-mid', { y: 50, duration: 1 }, 0)
            .to('.mist-group-2', { y: 30, duration: 1 }, 0);

        scrollTl.to('.hills-front', { y: -20, duration: 1 }, 0);

    }, [lightBudget]);

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
                                <feGaussianBlur stdDeviation={lightBudget ? '0' : '3'} result="coloredBlur" />
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

                        {/* Drifting Fireflies — reduced on mobile */}
                        {(lightBudget ? initialFireflies.slice(0, 12) : initialFireflies).map((firefly) => (
                            <g key={`firefly-${firefly.id}`} className="fireflyGroup" transform={`translate(${firefly.startX}, ${firefly.startY})`}>
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={firefly.r}
                                    fill="#deb96a"
                                    opacity="0"
                                    filter={lightBudget ? undefined : "url(#glow)"}
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

            <section className="relative z-20 w-full overflow-hidden border-y border-white/[0.05] bg-[linear-gradient(180deg,rgba(13,20,30,0.96)_0%,rgba(16,28,38,1)_48%,rgba(18,31,40,1)_100%)]">
                <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28 lg:px-12 lg:py-32">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-end"
                    >
                        <div className="max-w-3xl">
                            <p className="mb-5 font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fc4c7]">
                                After the garden opens
                            </p>
                            <h2 className="text-4xl leading-tight text-[#fcfaf2] sm:text-5xl lg:text-6xl">
                                Turn scattered class material into one study rhythm.
                            </h2>
                        </div>
                        <div className="grid gap-6 font-sans text-sm leading-7 text-[#c7dcdd] sm:text-[15px]">
                            <p>
                                Riven keeps the calm atmosphere, then makes the work concrete: notes, decks, guides,
                                exams, assignments, and class context stay connected instead of becoming another tab maze.
                            </p>
                            <Link
                                to="/account?mode=signup"
                                className="inline-flex w-fit items-center gap-3 rounded-lg border border-[#deb96a]/35 bg-[#deb96a]/10 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#deb96a] transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-[#deb96a]/60 hover:bg-[#deb96a]/16"
                            >
                                Start with Riven
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8, delay: 0.08, ease: "easeOut" }}
                        className="mt-16 grid gap-3 sm:grid-cols-3"
                    >
                        {outcomeStats.map((stat) => (
                            <div key={stat.label} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5">
                                <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#8fa6a8]">{stat.label}</p>
                                <p className="mt-3 text-4xl leading-none text-[#fcfaf2]">{stat.value}</p>
                                <p className="mt-4 font-sans text-sm leading-6 text-[#a6bec0]">{stat.detail}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            <section className="relative z-20 w-full bg-[linear-gradient(180deg,rgba(18,31,40,1)_0%,rgba(11,23,32,1)_100%)] py-24 sm:py-28 lg:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-12">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="mx-auto max-w-3xl text-center"
                    >
                        <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fc4c7]">
                            Product proof
                        </p>
                        <h2 className="mt-5 text-3xl leading-tight text-[#fcfaf2] sm:text-4xl lg:text-5xl">
                            Screenshot slots for the real study flow.
                        </h2>
                        <p className="mx-auto mt-6 max-w-2xl font-sans text-sm leading-7 text-[#b7ccce] sm:text-[15px]">
                            These placeholders mark where real Riven screenshots can drop in once the final product captures are ready.
                        </p>
                    </motion.div>

                    <div className="mt-14 grid gap-8 lg:gap-10">
                        {productScreenshotSlots.map((item, idx) => {
                            const Icon = item.Icon;

                            return (
                                <motion.article
                                    key={item.title}
                                    initial={{ opacity: 0, y: 34 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.85, delay: idx * 0.06, ease: "easeOut" }}
                                    className="grid gap-8 rounded-lg border border-white/[0.08] bg-[#10202a]/76 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)] sm:p-5 lg:grid-cols-2 lg:items-center lg:p-6"
                                >
                                    <figure
                                        className={`grid aspect-[1120/760] place-items-center overflow-hidden rounded-lg border border-dashed border-[#8fa6a8]/24 bg-[linear-gradient(135deg,rgba(7,16,25,0.94),rgba(16,32,42,0.9))] p-6 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}
                                        role="img"
                                        aria-label={`${item.placeholder} for ${item.assetPath}`}
                                    >
                                        <div className="grid max-w-sm justify-items-center text-center">
                                            <div
                                                className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border"
                                                style={{ borderColor: `${item.accent}55`, backgroundColor: `${item.accent}16`, color: item.accent }}
                                            >
                                                <Icon className="h-6 w-6" aria-hidden="true" />
                                            </div>
                                            <figcaption>
                                                <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-[#8fa6a8]">
                                                    {item.placeholder}
                                                </p>
                                                <p className="mt-4 font-sans text-sm leading-6 text-[#d4e2e3]">
                                                    Add the real capture at <span className="font-mono text-[#deb96a]">{item.assetPath}</span>
                                                </p>
                                            </figcaption>
                                        </div>
                                    </figure>

                                    <div className="px-1 py-2 sm:px-3 lg:px-6">
                                        <div className="mb-6 flex items-center gap-3">
                                            <div
                                                className="flex h-11 w-11 items-center justify-center rounded-lg border"
                                                style={{ borderColor: `${item.accent}55`, backgroundColor: `${item.accent}18`, color: item.accent }}
                                            >
                                                <Icon className="h-5 w-5" aria-hidden="true" />
                                            </div>
                                            <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fa6a8]">
                                                {item.eyebrow}
                                            </p>
                                        </div>
                                        <h3 className="text-3xl leading-tight text-[#fcfaf2] sm:text-4xl">
                                            {item.title}
                                        </h3>
                                        <p className="mt-5 font-sans text-sm leading-7 text-[#b7ccce] sm:text-[15px]">
                                            {item.body}
                                        </p>
                                        <ul className="mt-7 grid gap-3 font-sans text-sm leading-6 text-[#d4e2e3]">
                                            {item.bullets.map((bullet) => (
                                                <li key={bullet} className="flex gap-3">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#deb96a]" aria-hidden="true" />
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="relative z-20 w-full border-y border-white/[0.05] bg-[#0a1017] py-24 sm:py-28 lg:py-32">
                <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                    >
                        <p className="mb-5 font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fc4c7]">
                            How it works
                        </p>
                        <h2 className="max-w-xl text-3xl leading-tight text-[#fcfaf2] sm:text-4xl lg:text-5xl">
                            From raw material to the next session in three moves.
                        </h2>
                        <p className="mt-6 max-w-xl font-sans text-sm leading-7 text-[#b7ccce] sm:text-[15px]">
                            Riven keeps the path from material to context to review short enough to repeat, so every return starts
                            closer to the next useful action.
                        </p>
                    </motion.div>

                    <div className="grid gap-4">
                        {workflowSteps.map((step, idx) => {
                            const Icon = step.Icon;

                            return (
                                <motion.div
                                    key={step.title}
                                    initial={{ opacity: 0, y: 22 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.75, delay: idx * 0.08, ease: "easeOut" }}
                                    className="grid gap-5 rounded-lg border border-white/[0.08] bg-white/[0.035] p-5 sm:grid-cols-[auto_1fr] sm:p-6"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#deb96a]/30 bg-[#deb96a]/10 text-[#deb96a]">
                                        <Icon className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#8fa6a8]">
                                                Step {idx + 1}
                                            </p>
                                            {idx < workflowSteps.length - 1 ? <ArrowRight className="h-4 w-4 text-[#8fa6a8]/60" aria-hidden="true" /> : null}
                                        </div>
                                        <h3 className="mt-2 text-2xl leading-tight text-[#fcfaf2]">{step.title}</h3>
                                        <p className="mt-3 font-sans text-sm leading-7 text-[#a6bec0] sm:text-[15px]">{step.body}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="relative z-20 w-full bg-[radial-gradient(circle_at_top,rgba(222,185,106,0.11),transparent_34%),linear-gradient(180deg,rgba(10,16,23,1)_0%,rgba(13,20,30,1)_100%)] py-24 sm:py-28 lg:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-12">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="mx-auto max-w-3xl text-center"
                    >
                        <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fc4c7]">
                            Choose the pace that fits
                        </p>
                        <h2 className="mt-5 text-3xl leading-tight text-[#fcfaf2] sm:text-4xl lg:text-5xl">
                            Start free, then stay when the rhythm clicks.
                        </h2>
                        <p className="mx-auto mt-6 max-w-2xl font-sans text-sm leading-7 text-[#b7ccce] sm:text-[15px]">
                            Every plan keeps the same foundation. Paid tiers remove friction, open up the deeper AI and theme experience,
                            and make Riven easier to live in every day.
                        </p>
                    </motion.div>

                    <div className="mt-14 grid gap-5 lg:grid-cols-3">
                        {pricingPlans.map((plan, idx) => (
                            <motion.article
                                key={plan.name}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.8, delay: idx * 0.08, ease: "easeOut" }}
                                className={`relative flex h-full flex-col rounded-lg border bg-[#0d141e]/88 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-7 ${plan.featured ? 'lg:-mt-5 lg:mb-5' : ''}`}
                                style={{ borderColor: plan.featured ? `${plan.accent}70` : 'rgba(255,255,255,0.09)' }}
                            >
                                {plan.featured ? (
                                    <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#deb96a] px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-[#0d141e]">
                                        <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                                        {plan.eyebrow}
                                    </div>
                                ) : (
                                    <p className="mb-5 font-sans text-[10px] uppercase tracking-[0.2em] text-[#8fa6a8]">
                                        {plan.eyebrow}
                                    </p>
                                )}

                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-3xl leading-tight text-[#fcfaf2]">{plan.name}</h3>
                                        <p className="mt-4 font-sans text-sm leading-7 text-[#a6bec0]">{plan.body}</p>
                                    </div>
                                    <Sparkles className="h-5 w-5 shrink-0" style={{ color: plan.accent }} aria-hidden="true" />
                                </div>

                                <div className="mt-8 flex items-end gap-1">
                                    <span className="text-5xl leading-none" style={{ color: plan.featured ? plan.accent : '#fcfaf2' }}>{plan.price}</span>
                                    <span className="pb-1 font-sans text-base text-[#8fa6a8]">{plan.cadence}</span>
                                </div>

                                <ul className="mt-8 grid flex-1 gap-3 font-sans text-sm leading-6 text-[#d4e2e3]">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex gap-3">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: plan.accent }} aria-hidden="true" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    to="/account?mode=signup"
                                    className={`mt-8 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-center font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 ${plan.featured ? 'bg-[#deb96a] text-[#0d141e] hover:bg-[#ebc97e]' : 'border border-white/[0.12] text-[#fcfaf2] hover:border-[#deb96a]/40 hover:bg-white/[0.04]'}`}
                                >
                                    {plan.cta}
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </motion.article>
                        ))}
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
