import React from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ title, subtitle, children, showBackLink = false, backLinkText = "RETURN TO ARCHIVE", backLinkTo = "/" }) => {
    return (
        <div className="fixed inset-0 bg-botanical-ink overflow-hidden flex">
            {/* Background Textures */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
            </div>

            <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-[55%_45%] z-10">
                {/* Left Side - Botanical Study */}
                <div className="relative hidden md:flex flex-col justify-between p-12 lg:p-16 overflow-hidden">
                    {/* Ambient Glows */}
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-botanical-forest/20 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] bg-claude-accent/10 rounded-full blur-[100px]" />

                    {/* Brand Mark */}
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 border border-claude-accent/30 rounded-full flex items-center justify-center backdrop-blur-md bg-white/5">
                                <div className="w-1 h-1 bg-claude-accent rounded-full" />
                            </div>
                            <span className="text-claude-parchment font-display text-xl tracking-widest uppercase">Riven</span>
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-display font-light text-claude-parchment leading-tight">
                            Cultivate your <br />
                            <span className="text-claude-accent italic">knowledge</span>
                        </h1>
                    </div>

                    {/* Botanical Cards / Specimen View */}
                    <div className="relative z-10 flex-1 flex items-center justify-center my-8">
                        <div className="relative w-full max-w-md aspect-[4/3]">
                            {/* Card 1 */}
                            <div className="absolute top-0 right-0 w-[240px] aspect-[3/4] glass-panel rounded-lg transform rotate-6 border border-white/10 shadow-2xl p-4 flex flex-col items-center">
                                <div className="w-full h-[60%] bg-botanical-forest/10 rounded border border-white/5 mb-4 relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 50%, #fff 1px, transparent 1px) 0 0/10px 10px' }}></div>
                                </div>
                                <div className="w-full space-y-2">
                                    <div className="h-1 w-12 bg-claude-accent/40 rounded-full"></div>
                                    <div className="h-1 w-full bg-white/10 rounded-full"></div>
                                    <div className="h-1 w-2/3 bg-white/10 rounded-full"></div>
                                </div>
                            </div>
                            {/* Card 2 (Center) */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] aspect-[3/4] botanical-card transform -rotate-2 border border-claude-accent/20 shadow-2xl p-6 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-xs font-mono text-claude-accent/80">FIG 1.0</span>
                                    <div className="w-2 h-2 rounded-full bg-botanical-forest/50"></div>
                                </div>
                                <div className="flex-1 border border-dashed border-claude-border/30 rounded flex items-center justify-center p-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-display text-claude-parchment mb-2">Active Recall</div>
                                        <div className="text-[10px] text-claude-secondary uppercase tracking-widest">Memory Protocol</div>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-between items-end">
                                    <div className="text-[10px] font-mono text-claude-secondary">
                                        RETENTION<br />
                                        <span className="text-claude-parchment text-lg">98%</span>
                                    </div>
                                    <div className="h-8 w-8 rounded-full border border-claude-border flex items-center justify-center">
                                        <ArrowLeft className="w-3 h-3 text-claude-accent rotate-[135deg]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Citation */}
                    <div className="relative z-10 glass-panel border-l-2 border-claude-accent/50 pl-4 py-2 max-w-xs backdrop-blur-sm">
                        <p className="font-display italic text-claude-parchment/90 text-lg">
                            "Nature builds from the root up. Knowledge grows the same way."
                        </p>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="relative w-full flex flex-col justify-center p-6 md:p-16 lg:p-24 shadow-2xl overflow-hidden min-h-screen md:min-h-0 bg-botanical-ink md:bg-surface-color/50 md:backdrop-blur-xl border-l border-white/5">
                    {/* Mobile Background Texture */}
                    <div className="absolute inset-0 md:hidden opacity-[0.03] pointer-events-none z-0"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}>
                    </div>

                    {/* Mobile Ambient Glow */}
                    <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-claude-accent/5 rounded-full blur-[80px] md:hidden" />

                    <div className="relative z-10 w-full max-w-sm mx-auto">
                        {/* Mobile Header / Back Link */}
                        {showBackLink && (
                            <Link to={backLinkTo} className="inline-flex items-center gap-2 text-xs text-claude-secondary hover:text-claude-accent mb-6 transition-colors group">
                                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                {backLinkText}
                            </Link>
                        )}

                        <div className="mb-8">
                            <h2 className="text-3xl font-display text-claude-parchment mb-2 font-light">{title}</h2>
                            <p className="text-claude-secondary font-light text-sm">{subtitle}</p>
                        </div>

                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
