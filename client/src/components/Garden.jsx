import { useState, useEffect, useContext } from 'react';
import { GardenContext } from '../context/GardenContext';
import { gardenThemes, getStageIndex, decorations, specialPlants } from '../utils/gardenCustomization';

/**
 * Garden Component - A growing garden that evolves with your streak
 * From a barren plot to the Garden of Eden
 */

const sizeMap = {
    sm: { width: 80, height: 80, scale: 0.5 },
    md: { width: 160, height: 160, scale: 1 },
    lg: { width: 240, height: 240, scale: 1.5 },
    xl: { width: 320, height: 320, scale: 2 }
};

export default function Garden({
    streak = 0,
    status = 'active',
    size = 'md',
    showInfo = true,
    onClick
}) {
    const gardenContext = useContext(GardenContext);
    const customization = gardenContext?.customization || { gardenTheme: 'cottage', decorations: [], specialPlants: [] };
    
    const [swayOffset, setSwayOffset] = useState(0);
    const { width, height } = sizeMap[size] || sizeMap.md;
    const stageIndex = getStageIndex(streak);
    
    // Get theme colors
    const theme = gardenThemes.find(t => t.id === customization.gardenTheme) || gardenThemes[1];
    
    // Get equipped decorations
    const equippedDecorations = (customization.decorations || [])
        .map(id => decorations.find(d => d.id === id))
        .filter(Boolean);
    
    // Get equipped plants
    const equippedPlants = (customization.specialPlants || [])
        .map(id => specialPlants.find(p => p.id === id))
        .filter(Boolean);

    // Gentle swaying animation for plants
    useEffect(() => {
        if (status === 'broken') return;
        
        const interval = setInterval(() => {
            setSwayOffset(Math.sin(Date.now() / 1000) * 2);
        }, 50);
        
        return () => clearInterval(interval);
    }, [status]);

    const getStageText = () => {
        const stages = [
            'Barren Plot', 'Sprouting', 'Seedlings', 'Growing',
            'Blooming', 'Flourishing', 'Thriving', 'Enchanted',
            'Paradise', 'Eternal Eden', 'Celestial Eden'
        ];
        return stages[stageIndex] || 'Garden';
    };

    const getStatusText = () => {
        switch (status) {
            case 'active': return '🌱 Growing strong!';
            case 'at-risk': return '💧 Needs water!';
            case 'broken': return '🥀 Wilting...';
            default: return '';
        }
    };

    // Render different garden stages
    const renderGarden = () => {
        const baseOpacity = status === 'broken' ? 0.5 : 1;
        const groundY = 100;
        
        return (
            <svg 
                viewBox="0 0 160 160" 
                width={width} 
                height={height}
                style={{ overflow: 'visible', background: 'transparent' }}
            >
                {/* Sky gradient based on stage */}
                <defs>
                    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={stageIndex >= 7 ? '#FFE4B5' : stageIndex >= 5 ? '#87CEEB' : '#B0C4DE'} />
                        <stop offset="100%" stopColor={stageIndex >= 7 ? '#FFDAB9' : '#E0F0FF'} />
                    </linearGradient>
                    <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={theme.groundColor} />
                        <stop offset="100%" stopColor={theme.accentColor} />
                    </linearGradient>
                </defs>
                
                {/* Background sky */}
                <rect x="0" y="0" width="160" height={groundY} fill="url(#skyGradient)" opacity={baseOpacity} />
                
                {/* Sun/Moon based on theme */}
                {stageIndex >= 3 && (
                    <circle 
                        cx="130" 
                        cy="30" 
                        r={8 + stageIndex} 
                        fill={customization.gardenTheme === 'moonlight' ? '#F5F5F5' : '#FFD700'}
                        opacity={0.8}
                    />
                )}
                
                {/* Clouds for higher stages */}
                {stageIndex >= 5 && (
                    <>
                        <ellipse cx="30" cy="25" rx="15" ry="8" fill="white" opacity={0.6} />
                        <ellipse cx="45" cy="22" rx="12" ry="7" fill="white" opacity={0.6} />
                    </>
                )}
                
                {/* Sky decorations (rainbow, aurora) */}
                {equippedDecorations.filter(d => d.slot === 'sky').map((dec, i) => (
                    <text 
                        key={dec.id} 
                        x={80 + i * 20} 
                        y={25} 
                        fontSize={20} 
                        textAnchor="middle"
                    >
                        {dec.emoji}
                    </text>
                ))}
                
                {/* Ground */}
                <rect x="0" y={groundY} width="160" height="60" fill="url(#groundGradient)" opacity={baseOpacity} />
                
                {/* Fence for mid-stages */}
                {stageIndex >= 4 && (
                    <g opacity={baseOpacity}>
                        {[0, 20, 40, 60, 80, 100, 120, 140].map(x => (
                            <rect key={x} x={x + 5} y={groundY - 15} width="3" height="20" fill="#8B4513" />
                        ))}
                        <rect x="0" y={groundY - 10} width="160" height="3" fill="#A0522D" />
                    </g>
                )}
                
                {/* Garden content based on stage */}
                <g transform={`translate(0, ${swayOffset})`} opacity={baseOpacity}>
                    {/* Stage 0: Bare ground with a few dirt patches */}
                    {stageIndex === 0 && (
                        <>
                            <ellipse cx="40" cy={groundY + 20} rx="15" ry="5" fill="#5D4037" opacity={0.5} />
                            <ellipse cx="100" cy={groundY + 30} rx="20" ry="6" fill="#5D4037" opacity={0.5} />
                        </>
                    )}
                    
                    {/* Stage 1-2: Sprouts */}
                    {stageIndex >= 1 && stageIndex < 3 && (
                        <>
                            {[30, 60, 90, 120].map((x, i) => (
                                <g key={i}>
                                    <line x1={x} y1={groundY} x2={x} y2={groundY - 8 - i * 2} stroke="#228B22" strokeWidth="2" />
                                    <ellipse cx={x} cy={groundY - 10 - i * 2} rx="3" ry="2" fill="#32CD32" />
                                </g>
                            ))}
                        </>
                    )}
                    
                    {/* Stage 3-4: Young plants */}
                    {stageIndex >= 3 && stageIndex < 5 && (
                        <>
                            {[25, 55, 85, 115, 140].map((x, i) => (
                                <g key={i} transform={`translate(${x}, ${groundY})`}>
                                    <line x1="0" y1="0" x2="0" y2={-20 - i * 3} stroke="#228B22" strokeWidth="2" />
                                    <ellipse cx="-5" cy={-15 - i * 2} rx="6" ry="4" fill="#32CD32" />
                                    <ellipse cx="5" cy={-18 - i * 2} rx="5" ry="3" fill="#3CB371" />
                                    <ellipse cx="0" cy={-22 - i * 3} rx="4" ry="3" fill="#2E8B57" />
                                </g>
                            ))}
                        </>
                    )}
                    
                    {/* Stage 5-6: Blooming flowers */}
                    {stageIndex >= 5 && stageIndex < 7 && (
                        <>
                            {[20, 45, 70, 95, 120, 145].map((x, i) => (
                                <g key={i} transform={`translate(${x}, ${groundY})`}>
                                    <line x1="0" y1="0" x2="0" y2={-30 - i * 4} stroke="#228B22" strokeWidth="2" />
                                    {[-8, 0, 8].map((lx, j) => (
                                        <ellipse key={j} cx={lx} cy={-20 - i * 2} rx="5" ry="3" fill="#32CD32" />
                                    ))}
                                    <circle cx="0" cy={-32 - i * 4} r={6 + (i % 2)} fill={theme.flowerColors[i % theme.flowerColors.length]} />
                                    <circle cx="0" cy={-32 - i * 4} r="3" fill="#FFD700" />
                                </g>
                            ))}
                        </>
                    )}
                    
                    {/* Stage 7+: Full garden with trees */}
                    {stageIndex >= 7 && (
                        <>
                            {/* Background bushes */}
                            <ellipse cx="30" cy={groundY - 10} rx="25" ry="15" fill="#228B22" />
                            <ellipse cx="130" cy={groundY - 8} rx="22" ry="12" fill="#2E8B57" />
                            
                            {/* Trees */}
                            <g transform={`translate(80, ${groundY})`}>
                                <rect x="-5" y="-60" width="10" height="60" fill="#8B4513" />
                                <ellipse cx="0" cy="-70" rx="30" ry="25" fill="#228B22" />
                                <ellipse cx="-15" cy="-55" rx="15" ry="12" fill="#32CD32" />
                                <ellipse cx="15" cy="-55" rx="15" ry="12" fill="#2E8B57" />
                            </g>
                            
                            {/* Flowers in front */}
                            {[15, 35, 55, 105, 125, 145].map((x, i) => (
                                <g key={i} transform={`translate(${x}, ${groundY})`}>
                                    <line x1="0" y1="0" x2="0" y2="-20" stroke="#228B22" strokeWidth="2" />
                                    <circle cx="0" cy="-22" r="5" fill={theme.flowerColors[i % theme.flowerColors.length]} />
                                    <circle cx="0" cy="-22" r="2" fill="#FFD700" />
                                </g>
                            ))}
                        </>
                    )}
                    
                    {/* Stage 9+: Eden features */}
                    {stageIndex >= 9 && (
                        <>
                            {/* Waterfall/stream */}
                            <path 
                                d="M 5 80 Q 20 90, 40 95 T 80 100" 
                                fill="none" 
                                stroke="#87CEEB" 
                                strokeWidth="4" 
                                opacity={0.7}
                            />
                            {/* Glowing flowers */}
                            {[25, 135].map((x, i) => (
                                <g key={i}>
                                    <circle cx={x} cy={groundY - 15} r="8" fill="#FFD700" opacity={0.3} />
                                    <circle cx={x} cy={groundY - 15} r="5" fill="#FFD700" />
                                </g>
                            ))}
                        </>
                    )}
                </g>
                
                {/* Air decorations (butterflies, bees, birds) */}
                {equippedDecorations.filter(d => d.slot === 'air').map((dec, i) => (
                    <text 
                        key={dec.id} 
                        x={30 + i * 40 + Math.sin(Date.now() / 500 + i) * 10} 
                        y={50 + i * 15} 
                        fontSize={16} 
                        textAnchor="middle"
                        style={{ transition: 'transform 0.5s' }}
                    >
                        {dec.emoji}
                    </text>
                ))}
                
                {/* Ground decorations */}
                {equippedDecorations.filter(d => d.slot === 'ground').map((dec, i) => (
                    <text 
                        key={dec.id} 
                        x={20 + i * 35} 
                        y={groundY + 25} 
                        fontSize={18} 
                        textAnchor="middle"
                    >
                        {dec.emoji}
                    </text>
                ))}
                
                {/* Structure decorations */}
                {equippedDecorations.filter(d => d.slot === 'structure').map((dec, i) => (
                    <text 
                        key={dec.id} 
                        x={40 + i * 50} 
                        y={groundY - 5} 
                        fontSize={22} 
                        textAnchor="middle"
                    >
                        {dec.emoji}
                    </text>
                ))}
                
                {/* Special plants */}
                {equippedPlants.map((plant, i) => (
                    <text 
                        key={plant.id} 
                        x={60 + i * 25} 
                        y={groundY - 20} 
                        fontSize={20} 
                        textAnchor="middle"
                    >
                        {plant.emoji}
                    </text>
                ))}
            </svg>
        );
    };

    return (
        <div
            className={`garden-container flex flex-col items-center ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            style={{
                filter: status === 'at-risk' ? 'drop-shadow(0 0 15px rgba(255, 180, 100, 0.6))' : 
                        status === 'active' ? 'drop-shadow(0 0 15px rgba(100, 200, 100, 0.4))' : 
                        'drop-shadow(0 0 10px rgba(150, 150, 150, 0.2))',
                animation: status === 'at-risk' ? 'pulse-warning 2s ease-in-out infinite' : undefined
            }}
        >
            <style>{`
                @keyframes pulse-warning {
                    0%, 100% { filter: drop-shadow(0 0 15px rgba(255, 180, 100, 0.6)); }
                    50% { filter: drop-shadow(0 0 20px rgba(255, 150, 50, 0.8)); }
                }
            `}</style>

            {renderGarden()}

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
