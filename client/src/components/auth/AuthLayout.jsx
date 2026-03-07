import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ title, subtitle, children, showBackLink = false, backLinkText = "RETURN", backLinkTo = "/" }) => {
    return (
        <div className="min-h-dvh h-dvh w-full bg-[#0d141e] flex flex-col items-center justify-center font-serif selection:bg-[#deb96a] selection:text-[#0d141e] text-[#fcfaf2] overflow-hidden relative">

            {/* Subtle Grain Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-0"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
            </div>

            {/* Cinematic Lighting */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#223940]/30 rounded-full blur-[100px] pointer-events-none z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#deb96a]/10 rounded-full blur-[100px] pointer-events-none z-0" />

            {/* Mobile Form Container */}
            <div className="relative z-10 w-full max-w-sm px-6 flex flex-col justify-center h-full">

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
                        <div className="w-6 h-6 border border-[#deb96a]/30 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-md">
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
    );
};

export default AuthLayout;
