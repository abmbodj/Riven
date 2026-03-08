import React from 'react';
import { ArrowLeft, Leaf, BookOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ title, subtitle, children, showBackLink = false, backLinkText = "RETURN", backLinkTo = "/" }) => {
    return (
        <div className="min-h-dvh h-dvh w-full bg-[#0d141e] flex flex-col lg:flex-row font-serif selection:bg-[#deb96a] selection:text-[#0d141e] text-[#fcfaf2] overflow-hidden relative">

            {/* ===== Left Side: Form (mobile: full screen, desktop: left half) ===== */}
            <div className="relative flex-1 flex flex-col items-center justify-center z-10">
                {/* Subtle Grain Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none md:mix-blend-overlay z-0"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
                </div>

                {/* Cinematic Lighting */}
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#223940]/30 rounded-full blur-[100px] pointer-events-none z-0" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#deb96a]/10 rounded-full blur-[100px] pointer-events-none z-0 lg:hidden" />

                {/* Form Container */}
                <div className="relative z-10 w-full max-w-md px-6 flex flex-col justify-center h-full">

                    {/* Back Link */}
                    {showBackLink && (
                        <Link to={backLinkTo} className="inline-flex items-center gap-2 text-[10px] font-mono text-[#8fa6a8] hover:text-[#deb96a] mb-6 transition-colors uppercase tracking-widest group">
                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform duration-300" />
                            {backLinkText}
                        </Link>
                    )}

                    {/* Headers */}
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 border border-[#deb96a]/30 rounded-full flex items-center justify-center bg-white/5 md:backdrop-blur-md">
                                <div className="w-1 h-1 bg-[#deb96a] rounded-full" />
                            </div>
                            <span className="text-[#e4ddd0] font-mono text-[10px] tracking-[0.2em] uppercase">Riven</span>
                        </div>
                        <h2 className="text-3xl font-serif text-[#e4ddd0] mb-1.5">{title}</h2>
                        <p className="text-[#8fa6a8] font-sans text-sm font-light">{subtitle}</p>
                    </div>

                    {/* Content / Forms */}
                    <div className="w-full">
                        {children}
                    </div>
                </div>
            </div>

            {/* ===== Right Side: Branded Panel (desktop only) ===== */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative flex-col items-center justify-center overflow-hidden bg-[#0a1015] border-l border-[#1e3840]/50">
                {/* Background Gradient Orbs */}
                <div className="absolute top-[10%] right-[10%] w-[50%] h-[50%] bg-[#7a9e72]/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[15%] left-[5%] w-[40%] h-[40%] bg-[#deb96a]/8 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-[#1e3840]/40 rounded-full blur-[80px] pointer-events-none" />

                {/* Grain Texture */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none md:mix-blend-overlay"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
                </div>

                {/* Branded Content */}
                <div className="relative z-10 max-w-sm px-12 text-center">
                    {/* Logo Mark */}
                    <div className="mb-10 flex justify-center">
                        <div className="w-20 h-20 rounded-full border border-[#deb96a]/20 flex items-center justify-center bg-[#deb96a]/5 md:backdrop-blur-sm shadow-[0_0_40px_rgba(222,185,106,0.08)]">
                            <Leaf className="w-10 h-10 text-[#deb96a]/70" />
                        </div>
                    </div>

                    {/* Tagline */}
                    <h3 className="text-4xl xl:text-5xl font-serif italic text-[#e4ddd0] leading-[1.1] tracking-tight mb-6">
                        Grow your knowledge, one card at a time.
                    </h3>
                    <p className="text-[#8fa6a8] text-base leading-relaxed mb-10 font-sans font-light">
                        A serene space for studying, retaining, and mastering your subjects with spaced repetition.
                    </p>

                    {/* Feature Highlights */}
                    <div className="space-y-5 text-left">
                        {[
                            { icon: BookOpen, label: 'Smart flashcards with spaced repetition' },
                            { icon: Sparkles, label: 'AI-powered deck generation' },
                            { icon: Leaf, label: 'Watch your knowledge garden grow' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-4 group">
                                <div className="w-9 h-9 rounded-xl bg-[#1e3840]/60 border border-[#2a4a52]/50 flex items-center justify-center shrink-0 group-hover:border-[#deb96a]/30 transition-colors duration-300">
                                    <feature.icon className="w-4 h-4 text-[#7a9e72]" />
                                </div>
                                <span className="text-[13px] text-[#b8d0d2] font-sans">{feature.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Attribution */}
                <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] font-mono uppercase tracking-[0.3em] text-[#8fa6a8]/30">
                    Riven — A serene space for study
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
