import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ title, subtitle, children, showBackLink = false, backLinkText = "RETURN TO ARCHIVE", backLinkTo = "/" }) => {
    return (
        <div className="min-h-screen w-full bg-[#0d141e] flex flex-col md:flex-row font-serif selection:bg-[#deb96a] selection:text-[#0d141e] text-[#fcfaf2]">
            {/* Left Side / Top Side (Mobile) - Aesthetic Botanical Anchor */}
            <div className="relative w-full md:w-5/12 lg:w-1/2 md:min-h-screen p-8 lg:p-16 flex flex-col items-start justify-between overflow-hidden bg-[#0d141e] border-b md:border-b-0 md:border-r border-[#1e3840]">
                {/* Subtle Grain Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
                </div>

                {/* Cinematic Lighting */}
                <div className="absolute -top-[15%] -left-[10%] w-[70%] h-[70%] bg-[#223940]/30 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-[20%] -right-[20%] w-[80%] h-[80%] bg-[#deb96a]/10 rounded-full blur-[120px] pointer-events-none" />

                {/* Brand Header */}
                <div className="relative z-10 w-full pt-4 md:pt-0">
                    <div className="inline-flex items-center gap-3 mb-10 md:mb-12">
                        <div className="w-10 h-10 border border-[#deb96a]/30 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-md shadow-[0_0_15px_rgba(222,185,106,0.1)]">
                            <div className="w-1.5 h-1.5 bg-[#deb96a] rounded-full" />
                        </div>
                        <span className="text-[#fcfaf2] font-mono text-sm tracking-[0.25em] uppercase">Riven</span>
                    </div>
                </div>

                {/* Desktop Typography Artwork */}
                <div className="relative z-10 hidden md:block max-w-lg mb-12">
                    <h1 className="text-5xl lg:text-7xl font-light text-[#e4ddd0] leading-[1.1] mb-6">
                        Cultivate your <br />
                        <span className="text-[#deb96a] italic font-serif">knowledge</span>
                    </h1>
                    <p className="text-[#8fa6a8] font-sans text-lg font-light leading-relaxed border-l border-[#deb96a]/30 pl-5">
                        A sanctuary for your studies. Enter the garden to continue your intellectual growth.
                    </p>
                </div>
            </div>

            {/* Right Side / Bottom Side (Mobile) - Form UI */}
            <div className="relative w-full md:w-7/12 lg:w-1/2 min-h-[70vh] md:min-h-screen bg-[#131d26] md:bg-[#0d141e] flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24 overflow-y-auto custom-scrollbar">

                {/* Decorative mobile light bleed */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#deb96a]/20 to-transparent md:hidden" />

                <div className="relative z-10 w-full max-w-[420px] mx-auto pb-10">
                    {/* Back Link */}
                    {showBackLink && (
                        <Link to={backLinkTo} className="inline-flex items-center gap-2 text-[11px] font-mono text-[#8fa6a8] hover:text-[#deb96a] mb-10 transition-colors uppercase tracking-widest group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform duration-300" />
                            {backLinkText}
                        </Link>
                    )}

                    {/* Headers */}
                    <div className="mb-10">
                        <h2 className="text-3xl md:text-4xl font-serif text-[#e4ddd0] mb-3">{title}</h2>
                        <p className="text-[#8fa6a8] font-sans text-base leading-relaxed">{subtitle}</p>
                    </div>

                    {/* Content / Forms */}
                    <div className="bg-transparent md:bg-[#1a252f]/40 md:p-8 md:rounded-2xl md:border md:border-[#2a3d46]/50 md:shadow-2xl">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
