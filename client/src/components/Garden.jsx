import { useId } from 'react';
import { getStageIndex } from '../utils/gardenCustomization';

const sizeMap = {
    sm: { width: 80, height: 80 },
    md: { width: 160, height: 160 },
    lg: { width: 240, height: 240 },
    xl: { width: 320, height: 320 }
};

const gardenStyles = `
    .garden-sway { animation: garden-sway-anim 6s ease-in-out infinite alternate; transform-origin: 200px 350px; }
    @keyframes garden-sway-anim { 0% { transform: rotate(-2deg); } 100% { transform: rotate(2deg); } }
    
    .garden-float { animation: garden-float-anim 8s ease-in-out infinite alternate; }
    @keyframes garden-float-anim { 0% { transform: translateY(0px); } 100% { transform: translateY(-12px); } }
    
    .garden-pulse-slow { animation: garden-pulse-anim 4s ease-in-out infinite alternate; }
    @keyframes garden-pulse-anim { 0% { opacity: 0.6; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1.02); } }
    
    .garden-rotate { animation: garden-rotate-anim 30s linear infinite; transform-origin: 200px 200px; }
    @keyframes garden-rotate-anim { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    .garden-orbit { animation: garden-orbit-anim 20s linear infinite; transform-origin: 200px 200px; }
    @keyframes garden-orbit-anim { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
`;

if (typeof document !== 'undefined') {
    if (!document.getElementById('garden-masterpiece-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'garden-masterpiece-styles';
        styleEl.textContent = gardenStyles;
        document.head.appendChild(styleEl);
    }
}

/**
 * Garden Masterpiece component
 * Utilizes purely geometric scaling constraints to grow a magnificent, highly-aesthetic vector artwork out of nothing.
 * Replaces old disjointed emojis/customizer with beautiful, cohesive stage-based generative progression.
 */
export default function Garden({
    streak = 0,
    status = 'active',
    size = 'md'
}) {
    const uniqueId = useId();
    const { width, height } = sizeMap[size] || sizeMap.md;
    const stageIndex = getStageIndex(streak);

    const isWilting = status === 'broken';
    const isAtRisk = status === 'at-risk';

    // 0: Barren, 1: Sprout, 2: Seedling, 3: Growing (7d), 4: Bloom (14d), 5: Flourish (30d)
    // 6: Oasis (60d), 7: Enchanted (100d), 8: Paradise (200d), 9: Eden (365d), 10: Celestial (1000d)

    // Palette evolution, meticulously crafted color layers inspired by "canvas-design"
    const palettes = [
        { bg1: '#E8E6E1', bg2: '#D1CFC7', ground: '#9C9681', accent: '#7A7562', leaf: '#8DAA91', energy: '#D1C8B4' }, // 0 Barren
        { bg1: '#E2E8DE', bg2: '#BDD2B6', ground: '#789470', accent: '#4E6E45', leaf: '#A8C999', energy: '#E5F1DB' }, // 1 Sprout
        { bg1: '#DCEBDE', bg2: '#A5C9A6', ground: '#638A64', accent: '#375E38', leaf: '#82B984', energy: '#B7E4BC' }, // 2 Seedling
        { bg1: '#D4EBE0', bg2: '#8CC4A4', ground: '#4A8E67', accent: '#23613F', leaf: '#57BA82', energy: '#95E3BA' }, // 3 Growing
        { bg1: '#D7ECD9', bg2: '#A6CFD5', ground: '#519C91', accent: '#1D6864', leaf: '#34A090', energy: '#F2D399' }, // 4 Blooming
        { bg1: '#CCE4DE', bg2: '#7DC8C4', ground: '#288784', accent: '#0E5755', leaf: '#1AB5AD', energy: '#FFC8B4' }, // 5 Flourishing
        { bg1: '#C0DEDD', bg2: '#53B2B6', ground: '#1A6E75', accent: '#0B4146', leaf: '#0BAFB8', energy: '#FFA0A0' }, // 6 Oasis
        { bg1: '#B9CCED', bg2: '#688EEB', ground: '#2F4B98', accent: '#152554', leaf: '#4470DE', energy: '#FFEAB6' }, // 7 Enchanted
        { bg1: '#D2C2EE', bg2: '#916DD5', ground: '#522E9B', accent: '#271154', leaf: '#7D47E2', energy: '#FFB8D2' }, // 8 Paradise
        { bg1: '#1A1121', bg2: '#3D2054', ground: '#1A0C27', accent: '#D69AF5', leaf: '#F9C4F8', energy: '#FFD700' }, // 9 Eden
        { bg1: '#050714', bg2: '#16234B', ground: '#050811', accent: '#7AF0FF', leaf: '#CFF8FF', energy: '#FFFFFF' }  // 10 Celestial
    ];

    const clr = palettes[Math.min(stageIndex, 10)];

    // State alterations (wilting / at-risk) using CSS filters for sophisticated visual fading
    const filter = isWilting ? 'grayscale(80%) opacity(70%)' : isAtRisk ? 'saturate(60%) sepia(20%)' : 'none';

    return (
        <div style={{ filter, transition: 'all 1s ease-in-out' }} className="flex flex-col items-center justify-center">
            <svg
                viewBox="0 0 400 400"
                width={width}
                height={height}
                className="rounded-3xl shadow-2xl overflow-hidden transition-all duration-1000 ease-in-out"
                style={{ background: `linear-gradient(145deg, ${clr.bg1}, ${clr.bg2})` }}
            >
                <defs>
                    <radialGradient id={`glow-${uniqueId}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={clr.energy} stopOpacity="0.8" />
                        <stop offset="50%" stopColor={clr.energy} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={clr.energy} stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={`ground-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={clr.ground} />
                        <stop offset="100%" stopColor={clr.accent} />
                    </linearGradient>
                </defs>

                {/* --- BACKGROUND RHYTHM --- */}
                {/* Orbital Rings for High Stages */}
                {stageIndex >= 9 && (
                    <g className="garden-rotate" style={{ opacity: 0.15 }}>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <line
                                key={`ray-${i}`}
                                x1="200" y1="0" x2="200" y2="100"
                                stroke={clr.energy} strokeWidth="2"
                                transform={`rotate(${i * 30} 200 200)`}
                            />
                        ))}
                        <circle cx="200" cy="200" r="140" fill="none" stroke={clr.energy} strokeWidth="1" strokeDasharray="5 15" />
                        <circle cx="200" cy="200" r="180" fill="none" stroke={clr.leaf} strokeWidth="0.5" />
                    </g>
                )}

                {/* Energy Core / Sun / Moon */}
                {stageIndex >= 5 && (
                    <circle
                        cx="200" cy={stageIndex >= 9 ? "200" : "120"}
                        r={stageIndex >= 9 ? "160" : "60"}
                        fill={`url(#glow-${uniqueId})`}
                        className="garden-pulse-slow"
                    />
                )}

                {/* --- GROUND TOPOGRAPHY --- */}
                {stageIndex < 9 && (
                    <path
                        d="M-50,330 Q100,280 200,320 T450,310 L450,450 L-50,450 Z"
                        fill={`url(#ground-${uniqueId})`}
                    />
                )}
                {stageIndex >= 3 && stageIndex < 9 && (
                    <path
                        d="M-50,360 Q150,310 250,370 T450,350 L450,450 L-50,450 Z"
                        fill={clr.accent}
                        opacity="0.3"
                    />
                )}

                {/* --- CENTRAL FLORA / STRUCTURE --- */}
                <g className={stageIndex >= 9 ? "garden-float" : "garden-sway"}>
                    {/* Trunk / Base Stem */}
                    {stageIndex >= 1 && stageIndex < 9 && (
                        <path
                            d="M200,350 Q205,280 200,200"
                            fill="none"
                            stroke={clr.accent}
                            strokeWidth={Math.min(stageIndex * 2.5, 20)}
                            strokeLinecap="round"
                        />
                    )}

                    {/* Primary Seed / Node */}
                    {stageIndex < 9 && (
                        <ellipse
                            cx="200" cy="350"
                            rx={stageIndex === 0 ? 12 : 20}
                            ry={stageIndex === 0 ? 6 : 8}
                            fill={clr.accent}
                        />
                    )}

                    {/* Branches */}
                    {stageIndex >= 3 && stageIndex < 9 && (
                        <>
                            <path d="M200,260 Q150,220 120,170" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.2} strokeLinecap="round" />
                            <path d="M200,240 Q250,200 280,150" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.2} strokeLinecap="round" />
                        </>
                    )}
                    {stageIndex >= 5 && stageIndex < 9 && (
                        <>
                            <path d="M200,200 Q140,140 100,90" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                            <path d="M200,180 Q260,120 300,70" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                            <path d="M200,200 Q200,120 200,50" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                        </>
                    )}
                    {stageIndex >= 7 && stageIndex < 9 && (
                        <>
                            <path d="M120,170 Q80,140 60,110" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.5} strokeLinecap="round" />
                            <path d="M280,150 Q320,120 340,90" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.5} strokeLinecap="round" />
                        </>
                    )}

                    {/* Canopy / Leaf Structures */}
                    {stageIndex >= 2 && stageIndex < 9 && (
                        <circle cx="200" cy="200" r={stageIndex * 4} fill={clr.leaf} opacity="0.9" />
                    )}
                    {stageIndex >= 4 && stageIndex < 9 && (
                        <>
                            <circle cx="120" cy="170" r={stageIndex * 5} fill={clr.energy} opacity="0.85" />
                            <circle cx="280" cy="150" r={stageIndex * 5} fill={clr.energy} opacity="0.85" />
                        </>
                    )}
                    {stageIndex >= 6 && stageIndex < 9 && (
                        <>
                            <circle cx="100" cy="90" r={40} fill={clr.leaf} opacity="0.8" />
                            <circle cx="300" cy="70" r={45} fill={clr.leaf} opacity="0.8" />
                            <circle cx="200" cy="50" r={55} fill={clr.energy} opacity="0.9" />
                            <circle cx="200" cy="130" r={65} fill={clr.leaf} opacity="0.75" />
                        </>
                    )}
                    {stageIndex >= 8 && stageIndex < 9 && (
                        <>
                            <circle cx="60" cy="110" r={25} fill={clr.energy} opacity="0.9" />
                            <circle cx="340" cy="90" r={25} fill={clr.energy} opacity="0.9" />
                        </>
                    )}

                    {/* High-Tier Geometry (Eden/Celestial) */}
                    {stageIndex >= 9 && (
                        <g>
                            {/* Central Mandala */}
                            {Array.from({ length: stageIndex >= 10 ? 24 : 12 }).map((_, i) => (
                                <g key={`mandala-${i}`} transform={`rotate(${i * (360 / (stageIndex >= 10 ? 24 : 12))} 200 200)`}>
                                    <path
                                        d="M200,200 Q260,100 200,30 Q140,100 200,200"
                                        fill={clr.leaf}
                                        opacity="0.2"
                                        stroke={clr.energy}
                                        strokeWidth="1.5"
                                    />
                                    <circle cx="200" cy="30" r="4" fill={clr.energy} />
                                </g>
                            ))}
                            {/* Inner Core */}
                            <circle cx="200" cy="200" r="35" fill={clr.energy} />
                            <circle cx="200" cy="200" r="45" fill="none" stroke={clr.accent} strokeWidth="3" />
                            <circle cx="200" cy="200" r="70" fill="none" stroke={clr.leaf} strokeWidth="1.5" strokeDasharray="3 6" />
                            {stageIndex === 10 && (
                                <g className="garden-orbit">
                                    <circle cx="200" cy="50" r="6" fill={clr.energy} />
                                    <circle cx="200" cy="350" r="6" fill={clr.energy} />
                                    <circle cx="50" cy="200" r="6" fill={clr.energy} />
                                    <circle cx="350" cy="200" r="6" fill={clr.energy} />
                                </g>
                            )}
                        </g>
                    )}
                </g>

                {/* --- FLOATING AMBIENCE --- */}
                {stageIndex >= 4 && (
                    <g className="garden-float" style={{ animationDuration: '10s' }}>
                        {Array.from({ length: stageIndex * 3 }).map((_, i) => {
                            // Deterministic pseudo-random distribution around the center
                            const angle = (i * 137.5) * (Math.PI / 180); // Golden angle
                            const radius = 30 + (i * (150 / (stageIndex * 3)));
                            const cx = 200 + Math.cos(angle) * radius;
                            const cy = 200 + Math.sin(angle) * (radius * (stageIndex >= 9 ? 1 : 0.7)); // flatten for tree stages

                            return (
                                <circle
                                    key={`particle-${i}`}
                                    cx={cx}
                                    cy={cy - (stageIndex < 9 ? 60 : 0)}
                                    r={i % 3 === 0 ? 2.5 : 1.5}
                                    fill={clr.energy}
                                    opacity="0.75"
                                />
                            );
                        })}
                    </g>
                )}
            </svg>
        </div>
    );
}
