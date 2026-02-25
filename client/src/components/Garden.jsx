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
    
    .garden-sway-gentle { animation: garden-sway-gentle-anim 8s ease-in-out infinite alternate; transform-origin: 200px 350px; }
    @keyframes garden-sway-gentle-anim { 0% { transform: rotate(-1deg); } 100% { transform: rotate(1deg); } }

    .garden-float { animation: garden-float-anim 8s ease-in-out infinite alternate; }
    @keyframes garden-float-anim { 0% { transform: translateY(0px); } 100% { transform: translateY(-12px); } }
    
    .garden-float-fast { animation: garden-float-fast-anim 4s ease-in-out infinite alternate; }
    @keyframes garden-float-fast-anim { 0% { transform: translateY(0px); } 100% { transform: translateY(-8px); } }

    .garden-pulse-slow { animation: garden-pulse-anim 4s ease-in-out infinite alternate; }
    @keyframes garden-pulse-anim { 0% { opacity: 0.6; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1.02); } }
    
    .garden-pulse-fast { animation: garden-pulse-fast-anim 2s ease-in-out infinite alternate; }
    @keyframes garden-pulse-fast-anim { 0% { opacity: 0.4; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1.05); } }

    .garden-rotate { animation: garden-rotate-anim 30s linear infinite; transform-origin: 200px 200px; }
    @keyframes garden-rotate-anim { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    .garden-rotate-fast { animation: garden-rotate-fast-anim 15s linear infinite; transform-origin: 200px 200px; }
    @keyframes garden-rotate-fast-anim { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .garden-orbit { animation: garden-orbit-anim 20s linear infinite; transform-origin: 200px 200px; }
    @keyframes garden-orbit-anim { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
    
    .garden-pulse-glow { animation: garden-pulse-glow-anim 3s ease-in-out infinite alternate; }
    @keyframes garden-pulse-glow-anim { 0% { filter: drop-shadow(0 0 5px currentColor); } 100% { filter: drop-shadow(0 0 15px currentColor); } }
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
 * Procedural generation and geometric scaling constraints to grow a magnificent, highly-aesthetic vector artwork out of nothing.
 */
export default function Garden({
    streak = 0,
    status = 'active',
    size = 'md',
    showInfo = true
}) {
    const uniqueId = useId();
    const { width, height } = sizeMap[size] || sizeMap.md;
    const stageIndex = getStageIndex(streak);

    const stageNames = [
        'Barren', 'Sprout', 'Seedling', 'Growing', 'Blooming',
        'Flourishing', 'Oasis', 'Enchanted', 'Mystic Sanctuary', 'Paradise',
        'Eternal Eden', 'Astral Gardens', 'Celestial', 'Cosmic Nexus',
        'Universal Core', 'Infinity Loom'
    ];
    const stageName = stageNames[Math.min(stageIndex, 15)];

    const isWilting = status === 'broken';
    const isAtRisk = status === 'at-risk';

    // 16 Stages of progression
    const palettes = [
        { bg1: '#E8E6E1', bg2: '#D1CFC7', ground: '#9C9681', accent: '#7A7562', leaf: '#8DAA91', energy: '#D1C8B4' }, // 0 Barren
        { bg1: '#E2E8DE', bg2: '#BDD2B6', ground: '#789470', accent: '#4E6E45', leaf: '#A8C999', energy: '#E5F1DB' }, // 1 Sprout
        { bg1: '#DCEBDE', bg2: '#A5C9A6', ground: '#638A64', accent: '#375E38', leaf: '#82B984', energy: '#B7E4BC' }, // 2 Seedling (3d)
        { bg1: '#D4EBE0', bg2: '#8CC4A4', ground: '#4A8E67', accent: '#23613F', leaf: '#57BA82', energy: '#95E3BA' }, // 3 Growing (7d)
        { bg1: '#D7ECD9', bg2: '#A6CFD5', ground: '#519C91', accent: '#1D6864', leaf: '#34A090', energy: '#F2D399' }, // 4 Blooming (14d)
        { bg1: '#CCE4DE', bg2: '#7DC8C4', ground: '#288784', accent: '#0E5755', leaf: '#1AB5AD', energy: '#FFC8B4' }, // 5 Flourishing (30d)
        { bg1: '#C0DEDD', bg2: '#53B2B6', ground: '#1A6E75', accent: '#0B4146', leaf: '#0BAFB8', energy: '#FFA0A0' }, // 6 Oasis (60d)
        { bg1: '#B9CCED', bg2: '#688EEB', ground: '#2F4B98', accent: '#152554', leaf: '#4470DE', energy: '#FFEAB6' }, // 7 Enchanted (100d)
        { bg1: '#D2C2EE', bg2: '#916DD5', ground: '#522E9B', accent: '#271154', leaf: '#7D47E2', energy: '#FFB8D2' }, // 8 Mystic Sanctuary (150d)
        { bg1: '#F4E1FA', bg2: '#C98EE0', ground: '#8532A8', accent: '#400D59', leaf: '#B461D4', energy: '#FFD1E8' }, // 9 Paradise (200d)
        { bg1: '#1A1121', bg2: '#3D2054', ground: '#1A0C27', accent: '#D69AF5', leaf: '#F9C4F8', energy: '#FFD700' }, // 10 Eternal Eden (365d)
        { bg1: '#0F172A', bg2: '#1E293B', ground: '#020617', accent: '#38BDF8', leaf: '#7DD3FC', energy: '#BAE6FD' }, // 11 Astral Gardens (500d)
        { bg1: '#050714', bg2: '#16234B', ground: '#050811', accent: '#7AF0FF', leaf: '#CFF8FF', energy: '#FFFFFF' }, // 12 Celestial (1000d)
        { bg1: '#0F0B1E', bg2: '#2B1A4A', ground: '#05020B', accent: '#F472B6', leaf: '#FDA4AF', energy: '#FFF1F2' }, // 13 Cosmic Nexus (2000d)
        { bg1: '#0A0510', bg2: '#4C1D95', ground: '#000000', accent: '#8B5CF6', leaf: '#C4B5FD', energy: '#FDF4FF' }, // 14 Universal Core (5000d)
        { bg1: '#000000', bg2: '#111827', ground: '#000000', accent: '#10B981', leaf: '#6EE7B7', energy: '#D1FAE5' }  // 15 Infinity Loom (10000d)
    ];

    const clr = palettes[Math.min(stageIndex, 15)];
    const filter = isWilting ? 'grayscale(80%) opacity(70%)' : isAtRisk ? 'saturate(60%) sepia(20%)' : 'none';

    return (
        <div style={{ filter, transition: 'all 1s ease-in-out' }} className="flex flex-col items-center">
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
                    <radialGradient id={`intense-glow-${uniqueId}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={clr.leaf} stopOpacity="1" />
                        <stop offset="30%" stopColor={clr.energy} stopOpacity="0.6" />
                        <stop offset="100%" stopColor={clr.bg2} stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={`ground-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={clr.ground} />
                        <stop offset="100%" stopColor={clr.accent} />
                    </linearGradient>
                    <linearGradient id={`trunk-${uniqueId}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={clr.accent} />
                        <stop offset="50%" stopColor={clr.ground} />
                        <stop offset="100%" stopColor={clr.accent} />
                    </linearGradient>
                </defs>

                {/* --- BACKGROUND EFFECTS --- */}
                {/* Nebula Clouds / Deep Space (Stage 13+) */}
                {stageIndex >= 13 && (
                    <g className="garden-pulse-slow" style={{ opacity: 0.3 }}>
                        <ellipse cx="150" cy="150" rx="120" ry="80" fill={`url(#intense-glow-${uniqueId})`} transform="rotate(30 150 150)" />
                        <ellipse cx="250" cy="250" rx="140" ry="60" fill={`url(#glow-${uniqueId})`} transform="rotate(-45 250 250)" />
                    </g>
                )}

                {/* Orbital Rings / Mandala Background (Stage 9+) */}
                {stageIndex >= 9 && (
                    <g className={stageIndex >= 12 ? "garden-rotate-fast" : "garden-rotate"} style={{ opacity: stageIndex >= 12 ? 0.25 : 0.15 }}>
                        {Array.from({ length: stageIndex >= 13 ? 24 : 12 }).map((_, i) => (
                            <line
                                key={`ray-${i}`}
                                x1="200" y1="0" x2="200" y2="100"
                                stroke={clr.energy} strokeWidth={stageIndex >= 12 ? "3" : "2"}
                                transform={`rotate(${i * (360 / (stageIndex >= 13 ? 24 : 12))} 200 200)`}
                            />
                        ))}
                        <circle cx="200" cy="200" r="140" fill="none" stroke={clr.energy} strokeWidth="1" strokeDasharray="5 15" />
                        <circle cx="200" cy="200" r="180" fill="none" stroke={clr.leaf} strokeWidth="0.5" />
                        {stageIndex >= 11 && (
                            <circle cx="200" cy="200" r="160" fill="none" stroke={clr.accent} strokeWidth="2" strokeDasharray="10 30" />
                        )}
                        {stageIndex >= 14 && (
                            <polygon points="200,20 355,100 355,300 200,380 45,300 45,100" fill="none" stroke={clr.energy} strokeWidth="1" opacity="0.5" />
                        )}
                    </g>
                )}

                {/* Core Sun / Moon / Energy Source */}
                {stageIndex >= 5 && (
                    <circle
                        cx="200" cy={stageIndex >= 9 ? "200" : "120"}
                        r={stageIndex >= 9 ? "160" : stageIndex >= 7 ? "90" : "60"}
                        fill={`url(#glow-${uniqueId})`}
                        className={stageIndex >= 12 ? "garden-pulse-fast" : "garden-pulse-slow"}
                    />
                )}

                {/* --- GROUND TOPOGRAPHY --- */}
                {/* Physical Ground (Stages 0 - 10) */}
                {stageIndex < 11 && (
                    <path
                        d="M-50,330 Q100,280 200,320 T450,310 L450,450 L-50,450 Z"
                        fill={`url(#ground-${uniqueId})`}
                    />
                )}
                {/* Multi-layered landscape for mid-tiers */}
                {stageIndex >= 3 && stageIndex < 11 && (
                    <path
                        d="M-50,360 Q150,310 250,370 T450,350 L450,450 L-50,450 Z"
                        fill={clr.accent}
                        opacity="0.3"
                    />
                )}
                {stageIndex >= 6 && stageIndex < 11 && (
                    <path
                        d="M-50,380 Q200,340 450,380 L450,450 L-50,450 Z"
                        fill={clr.bg2}
                        opacity="0.4"
                    />
                )}

                {/* Floating Island (Stage 11+) */}
                {stageIndex >= 11 && (
                    <g className="garden-float">
                        <path
                            d="M100,280 Q200,260 300,280 Q320,320 200,340 Q80,320 100,280 Z"
                            fill={`url(#ground-${uniqueId})`}
                        />
                        <path
                            d="M120,285 Q200,275 280,285 Q290,300 200,310 Q110,300 120,285 Z"
                            fill={clr.accent}
                            opacity="0.6"
                        />
                        {/* Hanging roots from floating island */}
                        <path d="M150,330 Q160,360 155,380" fill="none" stroke={clr.accent} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
                        <path d="M200,340 Q210,370 205,390" fill="none" stroke={clr.accent} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                        <path d="M250,325 Q240,350 245,370" fill="none" stroke={clr.accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                    </g>
                )}

                {/* --- CENTRAL FLORA / STRUCTURE --- */}
                {/* 
                  Base transform offsets tree up slightly on floating islands to sit on dirt layer.
                  High tiers (13+) float independently.
                */}
                <g
                    className={stageIndex >= 13 ? "garden-float-fast" : stageIndex >= 11 ? "garden-float" : "garden-sway"}
                    transform={stageIndex >= 11 && stageIndex < 13 ? "translate(0, -60)" : "translate(0, 0)"}
                >
                    {/* Trunk / Base Stem */}
                    {stageIndex >= 1 && stageIndex < 13 && (
                        <path
                            d="M200,350 Q205,280 200,180"
                            fill="none"
                            stroke={`url(#trunk-${uniqueId})`}
                            strokeWidth={Math.min((stageIndex + 1) * 3.5, 30)}
                            strokeLinecap="round"
                        />
                    )}
                    {/* Intricate base roots for mid/high stages */}
                    {stageIndex >= 5 && stageIndex < 13 && (
                        <>
                            <path d="M200,350 Q170,360 150,350" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.5} strokeLinecap="round" />
                            <path d="M200,350 Q230,360 250,350" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.5} strokeLinecap="round" />
                        </>
                    )}

                    {/* Primary Seed / Node */}
                    {stageIndex < 13 && (
                        <ellipse
                            cx="200" cy="350"
                            rx={stageIndex === 0 ? 12 : stageIndex >= 11 ? 0 : 25}
                            ry={stageIndex === 0 ? 6 : stageIndex >= 11 ? 0 : 10}
                            fill={clr.accent}
                        />
                    )}

                    {/* Branches */}
                    {stageIndex >= 3 && stageIndex < 13 && (
                        <>
                            <path d="M200,260 Q140,210 100,160" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.5} strokeLinecap="round" />
                            <path d="M200,240 Q260,190 300,140" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.5} strokeLinecap="round" />
                        </>
                    )}
                    {stageIndex >= 5 && stageIndex < 13 && (
                        <>
                            <path d="M200,180 Q130,120 80,70" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.2} strokeLinecap="round" />
                            <path d="M200,160 Q270,100 320,60" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.2} strokeLinecap="round" />
                            <path d="M200,180 Q200,90 200,30" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 1.2} strokeLinecap="round" />
                        </>
                    )}
                    {stageIndex >= 7 && stageIndex < 13 && (
                        <>
                            <path d="M100,160 Q60,130 40,100" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                            <path d="M300,140 Q340,110 360,80" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                            <path d="M140,180 Q100,140 100,100" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                            <path d="M260,165 Q300,125 300,85" fill="none" stroke={clr.accent} strokeWidth={stageIndex * 0.8} strokeLinecap="round" />
                        </>
                    )}

                    {/* Vine overlays */}
                    {stageIndex >= 6 && stageIndex < 13 && (
                        <path
                            d="M200,350 Q220,300 190,250 T200,150"
                            fill="none"
                            stroke={clr.leaf}
                            strokeWidth="3"
                            strokeDasharray="10 5"
                            opacity="0.8"
                        />
                    )}

                    {/* Canopy / Leaf Structures */}
                    {stageIndex >= 2 && stageIndex < 13 && (
                        <circle cx="200" cy="180" r={stageIndex * 5} fill={clr.leaf} opacity="0.9" className="garden-sway-gentle" />
                    )}
                    {stageIndex >= 4 && stageIndex < 13 && (
                        <>
                            <circle cx="100" cy="160" r={stageIndex * 5} fill={clr.energy} opacity="0.85" className="garden-sway-gentle" />
                            <circle cx="300" cy="140" r={stageIndex * 5} fill={clr.energy} opacity="0.85" className="garden-sway-gentle" />
                        </>
                    )}
                    {stageIndex >= 6 && stageIndex < 13 && (
                        <>
                            <circle cx="80" cy="70" r={stageIndex * 4} fill={clr.leaf} opacity="0.8" />
                            <circle cx="320" cy="60" r={stageIndex * 4} fill={clr.leaf} opacity="0.8" />
                            <circle cx="200" cy="30" r={stageIndex * 5} fill={clr.energy} opacity="0.9" />
                            <circle cx="200" cy="110" r={stageIndex * 6} fill={clr.leaf} opacity="0.75" />
                        </>
                    )}
                    {stageIndex >= 8 && stageIndex < 13 && (
                        <>
                            <circle cx="40" cy="100" r={stageIndex * 3} fill={clr.energy} opacity="0.9" />
                            <circle cx="360" cy="80" r={stageIndex * 3} fill={clr.energy} opacity="0.9" />
                            <circle cx="100" cy="100" r={stageIndex * 3.5} fill={clr.leaf} opacity="0.85" />
                            <circle cx="300" cy="85" r={stageIndex * 3.5} fill={clr.leaf} opacity="0.85" />
                        </>
                    )}

                    {/* High-Tier Geometry (Cosmic/Universal/Infinity levels) */}
                    {stageIndex >= 13 && (
                        <g>
                            {/* Central Sacred Geometry */}
                            {Array.from({ length: stageIndex >= 14 ? 36 : 18 }).map((_, i) => (
                                <g key={`mandala-${i}`} transform={`rotate(${i * (360 / (stageIndex >= 14 ? 36 : 18))} 200 200)`}>
                                    <path
                                        d="M200,200 Q280,80 200,20 Q120,80 200,200"
                                        fill={`url(#intense-glow-${uniqueId})`}
                                        opacity={stageIndex >= 15 ? "0.4" : "0.25"}
                                        stroke={clr.energy}
                                        strokeWidth="2"
                                    />
                                    <circle cx="200" cy="20" r={stageIndex >= 14 ? "6" : "4"} fill={clr.energy} className="garden-pulse-glow" />
                                </g>
                            ))}
                            {/* Inner Core */}
                            <circle cx="200" cy="200" r={stageIndex >= 15 ? "55" : "45"} fill={`url(#glow-${uniqueId})`} />
                            <circle cx="200" cy="200" r={stageIndex >= 15 ? "65" : "55"} fill="none" stroke={clr.accent} strokeWidth="4" />
                            <circle cx="200" cy="200" r={stageIndex >= 15 ? "90" : "80"} fill="none" stroke={clr.leaf} strokeWidth="2" strokeDasharray="5 10" />

                            {/* Cosmic Orbiting Orbs */}
                            {stageIndex >= 14 && (
                                <g className="garden-orbit">
                                    <circle cx="200" cy="60" r="10" fill={clr.leaf} opacity="0.9" />
                                    <circle cx="200" cy="340" r="10" fill={clr.leaf} opacity="0.9" />
                                    <circle cx="60" cy="200" r="10" fill={clr.leaf} opacity="0.9" />
                                    <circle cx="340" cy="200" r="10" fill={clr.leaf} opacity="0.9" />
                                    {stageIndex >= 15 && (
                                        <>
                                            <circle cx="101" cy="101" r="8" fill={clr.energy} opacity="0.9" />
                                            <circle cx="299" cy="299" r="8" fill={clr.energy} opacity="0.9" />
                                            <circle cx="101" cy="299" r="8" fill={clr.energy} opacity="0.9" />
                                            <circle cx="299" cy="101" r="8" fill={clr.energy} opacity="0.9" />
                                        </>
                                    )}
                                </g>
                            )}
                        </g>
                    )}
                </g>

                {/* --- FLOATING AMBIENCE / PARTICLES --- */}
                {stageIndex >= 4 && (
                    <g className={stageIndex >= 12 ? "garden-rotate" : "garden-float"} style={{ animationDuration: '12s' }}>
                        {Array.from({ length: stageIndex * (stageIndex >= 13 ? 5 : 4) }).map((_, i) => {
                            // Deterministic pseudo-random distribution around the center using Golden Angle
                            const angle = (i * 137.5) * (Math.PI / 180);
                            const radius = 30 + (i * (180 / (stageIndex * 4)));
                            const cx = 200 + Math.cos(angle) * radius;
                            const cy = 200 + Math.sin(angle) * (radius * (stageIndex >= 13 ? 1 : 0.7)); // Full circular spread for cosmic tiers

                            return (
                                <circle
                                    key={`particle-${i}`}
                                    cx={cx}
                                    cy={cy - (stageIndex < 11 ? 80 : 0)}
                                    r={i % 4 === 0 ? (stageIndex >= 13 ? 3.5 : 2.5) : 1.5}
                                    fill={i % 3 === 0 ? clr.leaf : clr.energy}
                                    opacity={i % 2 === 0 ? "0.9" : "0.5"}
                                    className={i % 5 === 0 ? "garden-pulse-glow" : ""}
                                />
                            );
                        })}
                    </g>
                )}

                {/* Foreground Magical Spores (Stage 10+) */}
                {stageIndex >= 10 && (
                    <g className="garden-float-fast" style={{ opacity: 0.6 }}>
                        {Array.from({ length: 15 }).map((_, i) => (
                            <path
                                key={`spore-${i}`}
                                d={`M${20 + (i * 25)},${380 + (i % 2 === 0 ? -20 : 10)} Q${30 + (i * 25)},${370} ${25 + (i * 25)},${350}`}
                                stroke={clr.energy}
                                strokeWidth="2"
                                fill="none"
                                opacity="0.7"
                                strokeLinecap="round"
                            />
                        ))}
                    </g>
                )}

            </svg>
            {showInfo && (
                <div className="flex flex-col items-center mt-2 gap-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: clr.leaf }}>{stageName}</span>
                    <span className="text-[9px] font-mono opacity-50 text-botanical-sepia">{streak} day streak</span>
                </div>
            )}
        </div>
    );
}
