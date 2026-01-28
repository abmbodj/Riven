import { useState, useEffect } from 'react';
import { loadCustomization, colorPalettes, ghostTypes, accessories } from '../utils/ghostCustomization';

/**
 * @typedef {Object} GhostPetProps
 * @property {'wisp' | 'orb' | 'small' | 'medium' | 'full'} stage - Growth stage
 * @property {'active' | 'at-risk' | 'broken'} status - Streak status
 * @property {number} streak - Current streak count
 * @property {string} [size='md'] - Size variant: 'sm', 'md', 'lg', 'xl'
 * @property {boolean} [showInfo=true] - Show streak info below ghost
 * @property {Function} [onClick] - Click handler
 */

const sizeMap = {
    sm: { width: 60, height: 72, scale: 0.5 },
    md: { width: 120, height: 144, scale: 1 },
    lg: { width: 180, height: 216, scale: 1.5 },
    xl: { width: 240, height: 288, scale: 2 }
};

const stageConfig = {
    wisp: { opacity: 0.4, scale: 0.3, complexity: 1 },
    orb: { opacity: 0.55, scale: 0.5, complexity: 2 },
    small: { opacity: 0.7, scale: 0.7, complexity: 3 },
    medium: { opacity: 0.85, scale: 0.85, complexity: 4 },
    full: { opacity: 1, scale: 1, complexity: 5 }
};

const statusGlow = {
    active: { glow: 'drop-shadow(0 0 20px rgba(136, 136, 255, 0.8))', pulse: false },
    'at-risk': { glow: 'drop-shadow(0 0 15px rgba(255, 180, 100, 0.9))', pulse: true },
    broken: { glow: 'drop-shadow(0 0 10px rgba(150, 150, 150, 0.4))', pulse: false }
};

export default function GhostPet({ 
    stage = 'wisp', 
    status = 'active', 
    streak = 0, 
    size = 'md',
    showInfo = true,
    onClick
}) {
    const [customization, setCustomization] = useState(loadCustomization);
    const [floatOffset, setFloatOffset] = useState(0);
    
    // Load customization on mount
    useEffect(() => {
        setCustomization(loadCustomization());
    }, []);

    // Floating animation
    useEffect(() => {
        let frame;
        let start = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - start;
            const offset = Math.sin(elapsed / 1000) * 8;
            setFloatOffset(offset);
            frame = requestAnimationFrame(animate);
        };
        
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, []);

    const config = stageConfig[stage] || stageConfig.wisp;
    const { width, height, scale } = sizeMap[size] || sizeMap.md;
    const { glow, pulse } = statusGlow[status] || statusGlow.active;
    
    // Get colors from palette
    const palette = colorPalettes.find(p => p.id === customization.colorPalette) || colorPalettes[0];
    const ghostType = ghostTypes.find(t => t.id === customization.ghostType) || ghostTypes[0];
    
    // Get equipped accessories
    const equippedAccessories = customization.accessories
        .map(id => accessories.find(a => a.id === id))
        .filter(Boolean);

    const renderGhost = () => {
        const ghostScale = config.scale * scale;
        const baseOpacity = status === 'broken' ? config.opacity * 0.5 : config.opacity;
        
        // Expression based on ghost type
        const eyeStyle = {
            bookworm: { eyeY: 45, eyeHeight: 8, eyeSpacing: 20 },
            energetic: { eyeY: 42, eyeHeight: 12, eyeSpacing: 24 },
            sleepy: { eyeY: 48, eyeHeight: 4, eyeSpacing: 18 },
            curious: { eyeY: 40, eyeHeight: 14, eyeSpacing: 22 }
        }[ghostType.id] || { eyeY: 45, eyeHeight: 8, eyeSpacing: 20 };

        // Render based on complexity/stage
        if (config.complexity === 1) {
            // Wisp - simple glowing orb
            return (
                <svg viewBox="0 0 120 144" width={width} height={height}>
                    <defs>
                        <radialGradient id={`wisp-grad-${customization.colorPalette}`} cx="50%" cy="40%" r="60%">
                            <stop offset="0%" stopColor={palette.primary} stopOpacity={baseOpacity} />
                            <stop offset="100%" stopColor={palette.secondary} stopOpacity={baseOpacity * 0.3} />
                        </radialGradient>
                    </defs>
                    <g transform={`translate(60, ${72 + floatOffset})`}>
                        <ellipse 
                            cx="0" 
                            cy="0" 
                            rx={25 * ghostScale} 
                            ry={30 * ghostScale} 
                            fill={`url(#wisp-grad-${customization.colorPalette})`}
                        />
                        {/* Tiny eyes forming */}
                        <ellipse cx={-5 * ghostScale} cy={-2 * ghostScale} rx={2 * ghostScale} ry={1.5 * ghostScale} fill={palette.accent} opacity={0.6} />
                        <ellipse cx={5 * ghostScale} cy={-2 * ghostScale} rx={2 * ghostScale} ry={1.5 * ghostScale} fill={palette.accent} opacity={0.6} />
                    </g>
                </svg>
            );
        }

        if (config.complexity === 2) {
            // Orb - more defined shape
            return (
                <svg viewBox="0 0 120 144" width={width} height={height}>
                    <defs>
                        <radialGradient id={`orb-grad-${customization.colorPalette}`} cx="50%" cy="30%" r="70%">
                            <stop offset="0%" stopColor={palette.primary} stopOpacity={baseOpacity} />
                            <stop offset="70%" stopColor={palette.secondary} stopOpacity={baseOpacity * 0.6} />
                            <stop offset="100%" stopColor={palette.accent} stopOpacity={0} />
                        </radialGradient>
                    </defs>
                    <g transform={`translate(60, ${72 + floatOffset})`}>
                        <ellipse 
                            cx="0" 
                            cy="0" 
                            rx={35 * ghostScale} 
                            ry={42 * ghostScale} 
                            fill={`url(#orb-grad-${customization.colorPalette})`}
                        />
                        {/* More defined eyes */}
                        <ellipse cx={-10 * ghostScale} cy={-8 * ghostScale} rx={4 * ghostScale} ry={3 * ghostScale} fill={palette.accent} />
                        <ellipse cx={10 * ghostScale} cy={-8 * ghostScale} rx={4 * ghostScale} ry={3 * ghostScale} fill={palette.accent} />
                        {/* Small trail forming */}
                        <path 
                            d={`M ${-15 * ghostScale} ${30 * ghostScale} Q 0 ${40 * ghostScale} ${15 * ghostScale} ${30 * ghostScale}`}
                            fill="none"
                            stroke={palette.secondary}
                            strokeWidth={3 * ghostScale}
                            strokeLinecap="round"
                            opacity={baseOpacity * 0.5}
                        />
                    </g>
                </svg>
            );
        }

        // Full ghost shape for stages 3-5
        return (
            <svg viewBox="0 0 120 144" width={width} height={height}>
                <defs>
                    <radialGradient id={`ghost-grad-${customization.colorPalette}`} cx="50%" cy="25%" r="75%">
                        <stop offset="0%" stopColor={palette.primary} stopOpacity={baseOpacity} />
                        <stop offset="60%" stopColor={palette.secondary} stopOpacity={baseOpacity * 0.8} />
                        <stop offset="100%" stopColor={palette.accent} stopOpacity={baseOpacity * 0.4} />
                    </radialGradient>
                    <filter id="ghost-glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                
                <g transform={`translate(60, ${65 + floatOffset})`} filter="url(#ghost-glow)">
                    {/* Main body */}
                    <path 
                        d={`
                            M ${-40 * ghostScale} 0
                            Q ${-45 * ghostScale} ${-35 * ghostScale} ${-30 * ghostScale} ${-50 * ghostScale}
                            Q 0 ${-65 * ghostScale} ${30 * ghostScale} ${-50 * ghostScale}
                            Q ${45 * ghostScale} ${-35 * ghostScale} ${40 * ghostScale} 0
                            Q ${42 * ghostScale} ${25 * ghostScale} ${35 * ghostScale} ${40 * ghostScale}
                            Q ${28 * ghostScale} ${55 * ghostScale} ${20 * ghostScale} ${45 * ghostScale}
                            Q ${12 * ghostScale} ${55 * ghostScale} 0 ${48 * ghostScale}
                            Q ${-12 * ghostScale} ${55 * ghostScale} ${-20 * ghostScale} ${45 * ghostScale}
                            Q ${-28 * ghostScale} ${55 * ghostScale} ${-35 * ghostScale} ${40 * ghostScale}
                            Q ${-42 * ghostScale} ${25 * ghostScale} ${-40 * ghostScale} 0
                            Z
                        `}
                        fill={`url(#ghost-grad-${customization.colorPalette})`}
                    />
                    
                    {/* Eyes */}
                    <ellipse 
                        cx={-eyeStyle.eyeSpacing * ghostScale / 2} 
                        cy={(-eyeStyle.eyeY + 45) * ghostScale - 20} 
                        rx={6 * ghostScale} 
                        ry={eyeStyle.eyeHeight * ghostScale / 2} 
                        fill={palette.accent}
                    />
                    <ellipse 
                        cx={eyeStyle.eyeSpacing * ghostScale / 2} 
                        cy={(-eyeStyle.eyeY + 45) * ghostScale - 20} 
                        rx={6 * ghostScale} 
                        ry={eyeStyle.eyeHeight * ghostScale / 2} 
                        fill={palette.accent}
                    />
                    
                    {/* Blush for energetic/curious */}
                    {(ghostType.id === 'energetic' || ghostType.id === 'curious') && (
                        <>
                            <ellipse cx={-20 * ghostScale} cy={-10 * ghostScale} rx={5 * ghostScale} ry={3 * ghostScale} fill="#FFB8B8" opacity={0.5} />
                            <ellipse cx={20 * ghostScale} cy={-10 * ghostScale} rx={5 * ghostScale} ry={3 * ghostScale} fill="#FFB8B8" opacity={0.5} />
                        </>
                    )}
                    
                    {/* Mouth based on type */}
                    {ghostType.id === 'sleepy' && (
                        <path 
                            d={`M ${-8 * ghostScale} ${-5 * ghostScale} Q 0 ${-2 * ghostScale} ${8 * ghostScale} ${-5 * ghostScale}`}
                            fill="none"
                            stroke={palette.accent}
                            strokeWidth={2 * ghostScale}
                            strokeLinecap="round"
                        />
                    )}
                    {ghostType.id === 'energetic' && (
                        <ellipse cx="0" cy={-3 * ghostScale} rx={6 * ghostScale} ry={4 * ghostScale} fill={palette.accent} opacity={0.7} />
                    )}
                    {ghostType.id === 'curious' && (
                        <ellipse cx="0" cy={-2 * ghostScale} rx={4 * ghostScale} ry={5 * ghostScale} fill={palette.accent} opacity={0.6} />
                    )}
                    
                    {/* Accessories */}
                    {equippedAccessories.map(acc => {
                        if (acc.slot === 'head') {
                            if (acc.id === 'wizard-hat') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${-55 * ghostScale})`}>
                                        <path 
                                            d={`M 0 ${-25 * ghostScale} L ${-18 * ghostScale} ${5 * ghostScale} L ${18 * ghostScale} ${5 * ghostScale} Z`}
                                            fill="#4B0082"
                                        />
                                        <ellipse cx="0" cy={5 * ghostScale} rx={22 * ghostScale} ry={5 * ghostScale} fill="#4B0082" />
                                        <text x="0" y={-5 * ghostScale} textAnchor="middle" fontSize={12 * ghostScale}>⭐</text>
                                    </g>
                                );
                            }
                            if (acc.id === 'graduation-cap') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${-55 * ghostScale})`}>
                                        <rect x={-20 * ghostScale} y={-5 * ghostScale} width={40 * ghostScale} height={3 * ghostScale} fill="#1a1a1a" />
                                        <polygon points={`0,${-20 * ghostScale} ${-22 * ghostScale},${-5 * ghostScale} ${22 * ghostScale},${-5 * ghostScale}`} fill="#1a1a1a" />
                                        <line x1={15 * ghostScale} y1={-5 * ghostScale} x2={20 * ghostScale} y2={10 * ghostScale} stroke="#FFD700" strokeWidth={2} />
                                    </g>
                                );
                            }
                            if (acc.id === 'crown') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${-55 * ghostScale})`}>
                                        <path 
                                            d={`M ${-18 * ghostScale} ${5 * ghostScale} L ${-15 * ghostScale} ${-10 * ghostScale} L ${-8 * ghostScale} 0 L 0 ${-15 * ghostScale} L ${8 * ghostScale} 0 L ${15 * ghostScale} ${-10 * ghostScale} L ${18 * ghostScale} ${5 * ghostScale} Z`}
                                            fill="#FFD700"
                                            stroke="#DAA520"
                                            strokeWidth={1}
                                        />
                                    </g>
                                );
                            }
                            if (acc.id === 'halo') {
                                return (
                                    <ellipse 
                                        key={acc.id}
                                        cx="0" 
                                        cy={-60 * ghostScale} 
                                        rx={18 * ghostScale} 
                                        ry={5 * ghostScale} 
                                        fill="none"
                                        stroke="#FFD700"
                                        strokeWidth={3 * ghostScale}
                                        opacity={0.8}
                                    />
                                );
                            }
                        }
                        
                        if (acc.slot === 'face') {
                            if (acc.id === 'glasses') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${-22 * ghostScale})`}>
                                        <circle cx={-10 * ghostScale} cy="0" r={8 * ghostScale} fill="none" stroke="#333" strokeWidth={1.5 * ghostScale} />
                                        <circle cx={10 * ghostScale} cy="0" r={8 * ghostScale} fill="none" stroke="#333" strokeWidth={1.5 * ghostScale} />
                                        <line x1={-2 * ghostScale} y1="0" x2={2 * ghostScale} y2="0" stroke="#333" strokeWidth={1.5 * ghostScale} />
                                    </g>
                                );
                            }
                            if (acc.id === 'monocle') {
                                return (
                                    <g key={acc.id} transform={`translate(${12 * ghostScale}, ${-22 * ghostScale})`}>
                                        <circle cx="0" cy="0" r={8 * ghostScale} fill="none" stroke="#DAA520" strokeWidth={2 * ghostScale} />
                                        <line x1="0" y1={8 * ghostScale} x2={5 * ghostScale} y2={25 * ghostScale} stroke="#DAA520" strokeWidth={1 * ghostScale} />
                                    </g>
                                );
                            }
                            if (acc.id === 'sunglasses') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${-22 * ghostScale})`}>
                                        <rect x={-22 * ghostScale} y={-5 * ghostScale} width={18 * ghostScale} height={10 * ghostScale} rx={2 * ghostScale} fill="#1a1a1a" />
                                        <rect x={4 * ghostScale} y={-5 * ghostScale} width={18 * ghostScale} height={10 * ghostScale} rx={2 * ghostScale} fill="#1a1a1a" />
                                        <line x1={-4 * ghostScale} y1="0" x2={4 * ghostScale} y2="0" stroke="#1a1a1a" strokeWidth={2 * ghostScale} />
                                    </g>
                                );
                            }
                        }
                        
                        if (acc.slot === 'body') {
                            if (acc.id === 'scarf') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${5 * ghostScale})`}>
                                        <path 
                                            d={`M ${-30 * ghostScale} 0 Q 0 ${8 * ghostScale} ${30 * ghostScale} 0`}
                                            fill="none"
                                            stroke="#E74C3C"
                                            strokeWidth={6 * ghostScale}
                                            strokeLinecap="round"
                                        />
                                        <path 
                                            d={`M ${25 * ghostScale} ${2 * ghostScale} L ${30 * ghostScale} ${20 * ghostScale}`}
                                            fill="none"
                                            stroke="#E74C3C"
                                            strokeWidth={6 * ghostScale}
                                            strokeLinecap="round"
                                        />
                                    </g>
                                );
                            }
                            if (acc.id === 'bowtie') {
                                return (
                                    <g key={acc.id} transform={`translate(0, ${5 * ghostScale})`}>
                                        <path 
                                            d={`M ${-12 * ghostScale} 0 L ${-5 * ghostScale} ${-5 * ghostScale} L ${-5 * ghostScale} ${5 * ghostScale} Z`}
                                            fill="#E74C3C"
                                        />
                                        <path 
                                            d={`M ${12 * ghostScale} 0 L ${5 * ghostScale} ${-5 * ghostScale} L ${5 * ghostScale} ${5 * ghostScale} Z`}
                                            fill="#E74C3C"
                                        />
                                        <circle cx="0" cy="0" r={3 * ghostScale} fill="#C0392B" />
                                    </g>
                                );
                            }
                            if (acc.id === 'cape') {
                                return (
                                    <path 
                                        key={acc.id}
                                        d={`M ${-35 * ghostScale} ${-10 * ghostScale} Q ${-50 * ghostScale} ${20 * ghostScale} ${-30 * ghostScale} ${50 * ghostScale} Q 0 ${60 * ghostScale} ${30 * ghostScale} ${50 * ghostScale} Q ${50 * ghostScale} ${20 * ghostScale} ${35 * ghostScale} ${-10 * ghostScale}`}
                                        fill="#9B59B6"
                                        opacity={0.8}
                                    />
                                );
                            }
                        }
                        
                        return null;
                    })}
                    
                    {/* Trail effects */}
                    {equippedAccessories.find(a => a.slot === 'trail') && (
                        <g transform={`translate(0, ${50 * ghostScale})`} opacity={0.7}>
                            {equippedAccessories.find(a => a.id === 'sparkles') && (
                                <>
                                    <text x={-15 * ghostScale} y={10 * ghostScale} fontSize={8 * ghostScale}>✨</text>
                                    <text x={5 * ghostScale} y={18 * ghostScale} fontSize={6 * ghostScale}>✨</text>
                                    <text x={-8 * ghostScale} y={25 * ghostScale} fontSize={7 * ghostScale}>✨</text>
                                </>
                            )}
                            {equippedAccessories.find(a => a.id === 'hearts') && (
                                <>
                                    <text x={-12 * ghostScale} y={12 * ghostScale} fontSize={8 * ghostScale}>💕</text>
                                    <text x={8 * ghostScale} y={20 * ghostScale} fontSize={6 * ghostScale}>💗</text>
                                </>
                            )}
                            {equippedAccessories.find(a => a.id === 'stars') && (
                                <>
                                    <text x={-10 * ghostScale} y={10 * ghostScale} fontSize={8 * ghostScale}>⭐</text>
                                    <text x={10 * ghostScale} y={18 * ghostScale} fontSize={6 * ghostScale}>🌟</text>
                                    <text x={-5 * ghostScale} y={26 * ghostScale} fontSize={7 * ghostScale}>✨</text>
                                </>
                            )}
                            {equippedAccessories.find(a => a.id === 'rainbow') && (
                                <path 
                                    d={`M ${-20 * ghostScale} ${10 * ghostScale} Q 0 ${30 * ghostScale} ${20 * ghostScale} ${10 * ghostScale}`}
                                    fill="none"
                                    stroke="url(#rainbow-grad)"
                                    strokeWidth={4 * ghostScale}
                                    strokeLinecap="round"
                                />
                            )}
                        </g>
                    )}
                </g>
                
                <defs>
                    <linearGradient id="rainbow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FF0000" />
                        <stop offset="20%" stopColor="#FF8800" />
                        <stop offset="40%" stopColor="#FFFF00" />
                        <stop offset="60%" stopColor="#00FF00" />
                        <stop offset="80%" stopColor="#0088FF" />
                        <stop offset="100%" stopColor="#8800FF" />
                    </linearGradient>
                </defs>
            </svg>
        );
    };

    const getStatusText = () => {
        switch (status) {
            case 'active': return '🔥 On Fire!';
            case 'at-risk': return '⚠️ Study soon!';
            case 'broken': return '💤 Needs revival';
            default: return '';
        }
    };

    const getStageText = () => {
        switch (stage) {
            case 'wisp': return 'Wisp';
            case 'orb': return 'Spirit Orb';
            case 'small': return 'Baby Ghost';
            case 'medium': return 'Ghost';
            case 'full': return 'Phantom';
            default: return '';
        }
    };

    return (
        <div 
            className={`ghost-pet-container flex flex-col items-center ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            style={{
                filter: glow,
                animation: pulse ? 'pulse-warning 2s ease-in-out infinite' : undefined
            }}
        >
            <style>{`
                @keyframes pulse-warning {
                    0%, 100% { filter: ${glow}; }
                    50% { filter: drop-shadow(0 0 25px rgba(255, 150, 50, 1)); }
                }
            `}</style>
            
            {renderGhost()}
            
            {showInfo && (
                <div className="text-center mt-2">
                    <div className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>
                        {streak} day{streak !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs opacity-70" style={{ color: 'var(--muted-foreground)' }}>
                        {getStageText()}
                    </div>
                    <div className="text-sm mt-1" style={{ color: status === 'at-risk' ? '#FF8C00' : 'var(--muted-foreground)' }}>
                        {getStatusText()}
                    </div>
                </div>
            )}
        </div>
    );
}
