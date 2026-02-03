import { useState, useEffect, useContext } from 'react';
import { PetContext } from '../context/PetContext';
import { colorPalettes, pugTypes, accessories } from '../utils/pugCustomization';

/**
 * @typedef {Object} PugPetProps
 * @property {'wisp' | 'orb' | 'small' | 'medium' | 'full'} stage - Growth stage
 * @property {'active' | 'at-risk' | 'broken'} status - Streak status
 * @property {number} streak - Current streak count
 * @property {string} [size='md'] - Size variant: 'sm', 'md', 'lg', 'xl'
 * @property {boolean} [showInfo=true] - Show streak info below pug
 * @property {Function} [onClick] - Click handler
 */

const sizeMap = {
    sm: { width: 60, height: 72, scale: 0.5 },
    md: { width: 120, height: 144, scale: 1 },
    lg: { width: 180, height: 216, scale: 1.5 },
    xl: { width: 240, height: 288, scale: 2 }
};

const stageConfig = {
    wisp: { opacity: 1, scale: 0.4, complexity: 1 },
    orb: { opacity: 1, scale: 0.6, complexity: 2 },
    small: { opacity: 1, scale: 0.8, complexity: 3 },
    medium: { opacity: 1, scale: 0.9, complexity: 4 },
    full: { opacity: 1, scale: 1, complexity: 5 }
};

const statusGlow = {
    active: { glow: 'drop-shadow(0 0 15px rgba(229, 194, 159, 0.4))', pulse: false },
    'at-risk': { glow: 'drop-shadow(0 0 15px rgba(255, 180, 100, 0.6))', pulse: true },
    broken: { glow: 'drop-shadow(0 0 10px rgba(150, 150, 150, 0.2))', pulse: false }
};

export default function PugPet({
    stage = 'wisp',
    status = 'active',
    streak = 0,
    size = 'md',
    showInfo = true,
    onClick
}) {
    // Use context for live updates
    const petContext = useContext(PetContext);
    const customization = petContext?.customization || { pugType: 'bookworm', colorPalette: 'fawn', accessories: [] };
    
    const [bounceOffset, setBounceOffset] = useState(0);

    // Bouncing animation (pugs don't float, they bounce!)
    useEffect(() => {
        let frame;
        let start = Date.now();

        const animate = () => {
            const elapsed = Date.now() - start;
            const offset = Math.abs(Math.sin(elapsed / 500)) * -10;
            setBounceOffset(offset);
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
    const pugType = pugTypes.find(t => t.id === customization.pugType) || pugTypes[0];

    // Get equipped accessories
    const equippedAccessories = customization.accessories
        .map(id => accessories.find(a => a.id === id))
        .filter(Boolean);

    const renderPug = () => {
        const pugScale = config.scale * scale;
        const baseOpacity = status === 'broken' ? 0.6 : 1;

        return (
            <svg 
                viewBox="0 0 120 144" 
                width={width} 
                height={height}
                style={{ overflow: 'visible', background: 'transparent' }}
            >
                <g transform={`translate(60, ${110 + bounceOffset})`} opacity={baseOpacity}>
                    {/* Shadow on ground */}
                    <ellipse cx="0" cy="15" rx={30 * pugScale} ry={8 * pugScale} fill="black" opacity={0.1} />

                    {/* Body */}
                    <ellipse
                        cx="0"
                        cy={-15 * pugScale}
                        rx={35 * pugScale}
                        ry={30 * pugScale}
                        fill={palette.primary}
                        stroke={palette.accent}
                        strokeWidth={1}
                    />

                    {/* Curly Tail */}
                    <path
                        d={`M ${30 * pugScale} ${-25 * pugScale} Q ${45 * pugScale} ${-40 * pugScale} ${35 * pugScale} ${-15 * pugScale}`}
                        fill="none"
                        stroke={palette.primary}
                        strokeWidth={6 * pugScale}
                        strokeLinecap="round"
                    />

                    {/* Head */}
                    <g transform={`translate(0, ${-45 * pugScale})`}>
                        {/* Ears */}
                        <path
                            d={`M ${-25 * pugScale} ${-15 * pugScale} L ${-35 * pugScale} ${5 * pugScale} L ${-15 * pugScale} ${0 * pugScale} Z`}
                            fill={palette.secondary}
                        />
                        <path
                            d={`M ${25 * pugScale} ${-15 * pugScale} L ${35 * pugScale} ${5 * pugScale} L ${15 * pugScale} ${0 * pugScale} Z`}
                            fill={palette.secondary}
                        />

                        {/* Main Head Shape */}
                        <ellipse
                            cx="0"
                            cy="0"
                            rx={30 * pugScale}
                            ry={28 * pugScale}
                            fill={palette.primary}
                            stroke={palette.accent}
                            strokeWidth={1}
                        />

                        {/* Wrinkles */}
                        <path d={`M ${-10 * pugScale} ${-15 * pugScale} Q 0 ${-18 * pugScale} ${10 * pugScale} ${-15 * pugScale}`} fill="none" stroke={palette.accent} strokeWidth={1} opacity={0.4} />
                        <path d={`M ${-8 * pugScale} ${-10 * pugScale} Q 0 ${-12 * pugScale} ${8 * pugScale} ${-10 * pugScale}`} fill="none" stroke={palette.accent} strokeWidth={1} opacity={0.4} />

                        {/* Muzzle (The dark part) */}
                        <ellipse cx="0" cy={8 * pugScale} rx={18 * pugScale} ry={14 * pugScale} fill={palette.secondary} />

                        {/* Nose */}
                        <ellipse cx="0" cy={4 * pugScale} rx={4 * pugScale} ry={3 * pugScale} fill="black" />

                        {/* Eyes */}
                        <g transform={`translate(${-12 * pugScale}, ${-4 * pugScale})`}>
                            <circle r={6 * pugScale} fill="black" />
                            <circle cx={-2 * pugScale} cy={-2 * pugScale} r={2 * pugScale} fill="white" />
                        </g>
                        <g transform={`translate(${12 * pugScale}, ${-4 * pugScale})`}>
                            <circle r={6 * pugScale} fill="black" />
                            <circle cx={-2 * pugScale} cy={-2 * pugScale} r={2 * pugScale} fill="white" />
                        </g>

                        {/* Tongue (for energetic) */}
                        {pugType.id === 'energetic' && (
                            <path d={`M ${-3 * pugScale} ${15 * pugScale} Q 0 ${25 * pugScale} ${3 * pugScale} ${15 * pugScale} Z`} fill="#FF6B6B" />
                        )}

                        {/* Sleepy Zzz */}
                        {pugType.id === 'sleepy' && (
                            <g transform={`translate(${25 * pugScale}, ${-30 * pugScale})`} opacity={0.6}>
                                <text fontSize={12 * pugScale} fill={palette.accent}>Z</text>
                                <text x={8 * pugScale} y={-8 * pugScale} fontSize={8 * pugScale} fill={palette.accent}>z</text>
                            </g>
                        )}
                    </g>

                    {/* Accessories */}
                    {equippedAccessories.map(acc => {
                        if (acc.slot === 'head') {
                            return (
                                <g key={acc.id} transform={`translate(0, ${-75 * pugScale})`}>
                                    <text x="0" y="0" textAnchor="middle" fontSize={24 * pugScale}>{acc.emoji}</text>
                                </g>
                            );
                        }
                        if (acc.slot === 'face') {
                            return (
                                <g key={acc.id} transform={`translate(0, ${-48 * pugScale})`}>
                                    <text x="0" y="0" textAnchor="middle" fontSize={20 * pugScale}>{acc.emoji}</text>
                                </g>
                            );
                        }
                        if (acc.slot === 'body') {
                            return (
                                <g key={acc.id} transform={`translate(0, ${-20 * pugScale})`}>
                                    <text x="0" y="0" textAnchor="middle" fontSize={24 * pugScale}>{acc.emoji}</text>
                                </g>
                            );
                        }
                        if (acc.slot === 'trail') {
                            return (
                                <g key={acc.id} transform={`translate(${20 * pugScale}, ${-10 * pugScale})`}>
                                    <text x="0" y="0" textAnchor="middle" fontSize={16 * pugScale}>{acc.emoji}</text>
                                </g>
                            );
                        }
                        return null;
                    })}
                </g>
            </svg>
        );
    };

    const getStatusText = () => {
        switch (status) {
            case 'active': return '🦴 Good Boy!';
            case 'at-risk': return '🍖 Hungry for cards!';
            case 'broken': return '😴 Napping...';
            default: return '';
        }
    };

    const getStageText = () => {
        switch (stage) {
            case 'wisp': return 'Puppy Gmail';
            case 'orb': return 'Puglet Gmail';
            case 'small': return 'Pug Gmail';
            case 'medium': return 'Gmail';
            case 'full': return 'King Gmail';
            default: return '';
        }
    };

    return (
        <div
            className={`pug-pet-container flex flex-col items-center ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            style={{
                filter: glow,
                animation: pulse ? 'pulse-warning 2s ease-in-out infinite' : undefined
            }}
        >
            <style>{`
                @keyframes pulse-warning {
                    0%, 100% { filter: ${glow}; }
                    50% { filter: drop-shadow(0 0 20px rgba(255, 150, 50, 0.8)); }
                }
            `}</style>

            {renderPug()}

            {showInfo && (
                <div className="text-center mt-2">
                    <div className="text-lg font-display font-bold text-claude-text">
                        {streak} day{streak !== 1 ? 's' : ''}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">
                        {getStageText()}
                    </div>
                    <div className="text-xs font-medium mt-1" style={{ color: status === 'at-risk' ? '#FF8C00' : 'var(--secondary-text-color)' }}>
                        {getStatusText()}
                    </div>
                </div>
            )}
        </div>
    );
}
