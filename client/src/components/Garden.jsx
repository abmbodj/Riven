import { useContext, useId } from 'react';
import { GardenContext } from '../context/GardenContext';
import { gardenThemes, getStageIndex, decorations, specialPlants } from '../utils/gardenCustomization';

/**
 * Garden Component — A growing garden that evolves with your streak
 * All decorations and plants rendered as proper SVG art (no emojis)
 */

const sizeMap = {
    sm: { width: 80, height: 80 },
    md: { width: 160, height: 160 },
    lg: { width: 240, height: 240 },
    xl: { width: 320, height: 320 }
};

// Module-level CSS — injected once, shared across all Garden instances
const gardenStyles = `
    @keyframes garden-pulse-warning {
        0%, 100% { filter: drop-shadow(0 0 15px rgba(255, 180, 100, 0.6)); }
        50% { filter: drop-shadow(0 0 20px rgba(255, 150, 50, 0.8)); }
    }
    .garden-sway {
        animation: garden-sway-anim 3s ease-in-out infinite;
        transform-origin: center bottom;
    }
    @keyframes garden-sway-anim {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
    }
    .garden-float {
        animation: garden-float-anim 2.5s ease-in-out infinite;
    }
    @keyframes garden-float-anim {
        0%, 100% { transform: translateX(0) translateY(0); }
        25% { transform: translateX(5px) translateY(-3px); }
        75% { transform: translateX(-5px) translateY(2px); }
    }
    .garden-cloud {
        animation: garden-cloud-drift 12s linear infinite;
    }
    @keyframes garden-cloud-drift {
        0% { transform: translateX(0); }
        100% { transform: translateX(15px); }
    }
`;

// Inject styles once into head
if (typeof document !== 'undefined') {
    const existingStyle = document.getElementById('garden-component-styles');
    if (!existingStyle) {
        const styleEl = document.createElement('style');
        styleEl.id = 'garden-component-styles';
        styleEl.textContent = gardenStyles;
        document.head.appendChild(styleEl);
    }
}

// ─── SVG Decoration Renderers ───────────────────────────────
// Each returns an SVG <g> element positioned at x,y

const renderButterfly = (x, y, color = '#E88AED', delay = 0) => (
    <g transform={`translate(${x}, ${y})`} className="garden-float" style={{ animationDelay: `${delay}s` }}>
        {/* Left wing */}
        <ellipse cx="-6" cy="-2" rx="5" ry="7" fill={color} opacity={0.8} transform="rotate(-15)">
            <animate attributeName="rx" values="5;3;5" dur="0.6s" repeatCount="indefinite" />
        </ellipse>
        {/* Right wing */}
        <ellipse cx="6" cy="-2" rx="5" ry="7" fill={color} opacity={0.8} transform="rotate(15)">
            <animate attributeName="rx" values="5;3;5" dur="0.6s" repeatCount="indefinite" />
        </ellipse>
        {/* Wing details */}
        <ellipse cx="-5" cy="-1" rx="2" ry="3" fill={color} opacity={0.4} />
        <ellipse cx="5" cy="-1" rx="2" ry="3" fill={color} opacity={0.4} />
        {/* Body */}
        <ellipse cx="0" cy="0" rx="1.5" ry="5" fill="#4A3728" />
        {/* Antennae */}
        <line x1="-1" y1="-5" x2="-3" y2="-9" stroke="#4A3728" strokeWidth="0.5" />
        <line x1="1" y1="-5" x2="3" y2="-9" stroke="#4A3728" strokeWidth="0.5" />
        <circle cx="-3" cy="-9" r="0.8" fill="#4A3728" />
        <circle cx="3" cy="-9" r="0.8" fill="#4A3728" />
    </g>
);

const renderLadybug = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Body */}
        <ellipse cx="0" cy="0" rx="6" ry="5" fill="#E53935" />
        {/* Center line */}
        <line x1="0" y1="-5" x2="0" y2="5" stroke="#2D2D2D" strokeWidth="1" />
        {/* Head */}
        <circle cx="0" cy="-5" r="3" fill="#2D2D2D" />
        {/* Spots */}
        <circle cx="-3" cy="-1" r="1.2" fill="#2D2D2D" />
        <circle cx="3" cy="-1" r="1.2" fill="#2D2D2D" />
        <circle cx="-2" cy="3" r="1" fill="#2D2D2D" />
        <circle cx="2" cy="3" r="1" fill="#2D2D2D" />
        {/* Antennae */}
        <line x1="-1" y1="-7" x2="-4" y2="-10" stroke="#2D2D2D" strokeWidth="0.5" />
        <line x1="1" y1="-7" x2="4" y2="-10" stroke="#2D2D2D" strokeWidth="0.5" />
    </g>
);

const renderMushroom = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <rect x="-3" y="-2" width="6" height="10" rx="2" fill="#F5E6D3" />
        {/* Cap */}
        <ellipse cx="0" cy="-4" rx="10" ry="7" fill="#D84315" />
        <ellipse cx="0" cy="-3" rx="9" ry="5" fill="#E65100" />
        {/* Spots */}
        <circle cx="-4" cy="-6" r="1.8" fill="#FFCC80" />
        <circle cx="3" cy="-7" r="1.5" fill="#FFCC80" />
        <circle cx="0" cy="-4" r="1.2" fill="#FFCC80" />
        {/* Rim detail */}
        <ellipse cx="0" cy="-1" rx="8" ry="1" fill="#BF360C" opacity={0.3} />
    </g>
);

const renderBee = (x, y, delay = 0) => (
    <g transform={`translate(${x}, ${y})`} className="garden-float" style={{ animationDelay: `${delay}s` }}>
        {/* Wings */}
        <ellipse cx="-4" cy="-5" rx="4" ry="6" fill="#E3F2FD" opacity={0.6}>
            <animate attributeName="ry" values="6;4;6" dur="0.3s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="4" cy="-5" rx="4" ry="6" fill="#E3F2FD" opacity={0.6}>
            <animate attributeName="ry" values="6;4;6" dur="0.3s" repeatCount="indefinite" />
        </ellipse>
        {/* Body */}
        <ellipse cx="0" cy="0" rx="5" ry="7" fill="#FFC107" />
        {/* Stripes */}
        <rect x="-5" y="-3" width="10" height="2" rx="1" fill="#2D2D2D" />
        <rect x="-4" y="1" width="8" height="2" rx="1" fill="#2D2D2D" />
        <rect x="-3" y="4.5" width="6" height="1.5" rx="0.75" fill="#2D2D2D" />
        {/* Head */}
        <circle cx="0" cy="-7" r="3" fill="#2D2D2D" />
        {/* Eyes */}
        <circle cx="-1.5" cy="-8" r="0.8" fill="white" />
        <circle cx="1.5" cy="-8" r="0.8" fill="white" />
    </g>
);

const renderBirdhouse = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Post */}
        <rect x="-2" y="0" width="4" height="20" fill="#795548" rx="1" />
        {/* House body */}
        <rect x="-10" y="-15" width="20" height="16" rx="2" fill="#A1887F" />
        {/* Roof */}
        <polygon points="-13,-15 0,-25 13,-15" fill="#5D4037" />
        {/* Hole */}
        <circle cx="0" cy="-9" r="3.5" fill="#3E2723" />
        {/* Perch */}
        <rect x="-1" y="-5" width="2" height="4" fill="#795548" rx="0.5" />
        <circle cx="0" cy="-1" r="1.5" fill="#795548" />
    </g>
);

const renderLantern = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Hook */}
        <path d="M -1,-20 Q -1,-25 4,-25 L 4,-22" fill="none" stroke="#5D4037" strokeWidth="1.5" />
        {/* Top cap */}
        <rect x="-5" y="-20" width="10" height="3" rx="1" fill="#8D6E63" />
        {/* Glass body */}
        <rect x="-4" y="-17" width="8" height="14" rx="2" fill="#FFCC80" opacity={0.6} />
        {/* Glow */}
        <circle cx="0" cy="-10" r="6" fill="#FFD54F" opacity={0.2}>
            <animate attributeName="opacity" values="0.15;0.3;0.15" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Flame */}
        <ellipse cx="0" cy="-10" rx="1.5" ry="3" fill="#FF9800">
            <animate attributeName="ry" values="3;2.5;3" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
        {/* Bottom cap */}
        <rect x="-5" y="-3" width="10" height="3" rx="1" fill="#8D6E63" />
    </g>
);

const renderGnome = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Body */}
        <ellipse cx="0" cy="0" rx="7" ry="9" fill="#4CAF50" />
        {/* Belt */}
        <rect x="-7" y="-2" width="14" height="3" fill="#795548" />
        <circle cx="0" cy="-0.5" r="1.5" fill="#FFC107" />
        {/* Beard */}
        <path d="M-5,-4 Q0,5 5,-4" fill="#ECEFF1" />
        {/* Head */}
        <circle cx="0" cy="-9" r="5" fill="#FFCCBC" />
        {/* Eyes */}
        <circle cx="-2" cy="-10" r="0.8" fill="#2D2D2D" />
        <circle cx="2" cy="-10" r="0.8" fill="#2D2D2D" />
        {/* Nose */}
        <circle cx="0" cy="-8" r="1.5" fill="#FFAB91" />
        {/* Hat */}
        <polygon points="-6,-12 0,-24 6,-12" fill="#F44336" />
        <circle cx="0" cy="-24" r="1.5" fill="#FFEB3B" />
    </g>
);

const renderBird = (x, y, color = '#42A5F5', delay = 0) => (
    <g transform={`translate(${x}, ${y})`} className="garden-float" style={{ animationDelay: `${delay}s` }}>
        {/* Body */}
        <ellipse cx="0" cy="0" rx="7" ry="5" fill={color} />
        {/* Head */}
        <circle cx="6" cy="-3" r="4" fill={color} />
        {/* Eye */}
        <circle cx="8" cy="-4" r="1" fill="white" />
        <circle cx="8.3" cy="-4" r="0.5" fill="#2D2D2D" />
        {/* Beak */}
        <polygon points="10,-3 14,-2 10,-1" fill="#FF9800" />
        {/* Wing */}
        <ellipse cx="-2" cy="-1" rx="5" ry="3" fill={color} opacity={0.6} transform="rotate(-10)" />
        {/* Tail */}
        <polygon points="-7,0 -12,-3 -11,2" fill={color} opacity={0.8} />
    </g>
);

const renderFountain = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Base */}
        <ellipse cx="0" cy="5" rx="15" ry="4" fill="#78909C" />
        <rect x="-14" y="-2" width="28" height="8" rx="3" fill="#90A4AE" />
        {/* Bowl */}
        <path d="M-10,-2 Q-10,-8 0,-8 Q10,-8 10,-2" fill="#B0BEC5" />
        {/* Pillar */}
        <rect x="-2" y="-15" width="4" height="10" fill="#B0BEC5" rx="1" />
        {/* Water streams */}
        <path d="M0,-15 Q-5,-10 -7,-5" fill="none" stroke="#64B5F6" strokeWidth="1.5" opacity={0.6}>
            <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M0,-15 Q5,-10 7,-5" fill="none" stroke="#64B5F6" strokeWidth="1.5" opacity={0.6}>
            <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
        </path>
        {/* Water surface */}
        <ellipse cx="0" cy="-4" rx="8" ry="2" fill="#64B5F6" opacity={0.3} />
    </g>
);

const renderBench = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Legs */}
        <rect x="-12" y="-2" width="3" height="12" rx="1" fill="#5D4037" />
        <rect x="9" y="-2" width="3" height="12" rx="1" fill="#5D4037" />
        {/* Seat */}
        <rect x="-14" y="-5" width="28" height="4" rx="1.5" fill="#8D6E63" />
        {/* Back */}
        <rect x="-13" y="-15" width="26" height="3" rx="1" fill="#8D6E63" />
        <rect x="-13" y="-10" width="26" height="3" rx="1" fill="#8D6E63" />
        {/* Support */}
        <rect x="-12" y="-15" width="3" height="13" rx="1" fill="#6D4C41" />
        <rect x="9" y="-15" width="3" height="13" rx="1" fill="#6D4C41" />
    </g>
);

const renderWindchime = (x, y) => (
    <g transform={`translate(${x}, ${y})`} className="garden-sway">
        {/* Top ring */}
        <circle cx="0" cy="0" r="4" fill="none" stroke="#B0BEC5" strokeWidth="1.5" />
        {/* Strings and chimes */}
        {[-6, -3, 0, 3, 6].map((offset, i) => (
            <g key={i}>
                <line x1={offset} y1="4" x2={offset} y2={12 + i * 2} stroke="#90A4AE" strokeWidth="0.5" />
                <rect x={offset - 1.5} y={12 + i * 2} width="3" height={6 + i} rx="1" fill={['#FFD54F', '#B0BEC5', '#CE93D8', '#81D4FA', '#A5D6A7'][i]} opacity={0.8} />
            </g>
        ))}
        {/* Sail */}
        <line x1="0" y1="4" x2="0" y2="25" stroke="#90A4AE" strokeWidth="0.5" />
        <circle cx="0" cy="27" r="3" fill="#FFAB91" opacity={0.6} />
    </g>
);

const renderStatue = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Pedestal */}
        <rect x="-8" y="0" width="16" height="6" rx="1" fill="#90A4AE" />
        <rect x="-6" y="-3" width="12" height="4" rx="1" fill="#B0BEC5" />
        {/* Figure */}
        <ellipse cx="0" cy="-10" rx="5" ry="8" fill="#CFD8DC" />
        {/* Head */}
        <circle cx="0" cy="-18" r="4" fill="#CFD8DC" />
        {/* Wings */}
        <path d="M-5,-12 Q-14,-18 -8,-8" fill="#ECEFF1" opacity={0.8} />
        <path d="M5,-12 Q14,-18 8,-8" fill="#ECEFF1" opacity={0.8} />
        {/* Halo */}
        <ellipse cx="0" cy="-23" rx="5" ry="1.5" fill="none" stroke="#FFD54F" strokeWidth="1" opacity={0.6}>
            <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
        </ellipse>
    </g>
);

const renderRainbow = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {['#E53935', '#FF9800', '#FDD835', '#43A047', '#1E88E5', '#8E24AA'].map((color, i) => (
            <path
                key={i}
                d={`M${-40 + i * 3},0 Q0,${-35 + i * 3} ${40 - i * 3},0`}
                fill="none"
                stroke={color}
                strokeWidth="3"
                opacity={0.5}
            />
        ))}
    </g>
);

const renderFireflies = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {[
            { cx: -15, cy: -5, d: 0 },
            { cx: 10, cy: -12, d: 0.5 },
            { cx: -5, cy: -20, d: 1 },
            { cx: 20, cy: -8, d: 1.5 },
            { cx: -20, cy: -15, d: 2 },
            { cx: 5, cy: 3, d: 0.8 },
        ].map((f, i) => (
            <g key={i}>
                <circle cx={f.cx} cy={f.cy} r="4" fill="#FFEE58" opacity={0.15}>
                    <animate attributeName="opacity" values="0.05;0.25;0.05" dur="2s" begin={`${f.d}s`} repeatCount="indefinite" />
                </circle>
                <circle cx={f.cx} cy={f.cy} r="1.5" fill="#FFEE58" opacity={0.6}>
                    <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2s" begin={`${f.d}s`} repeatCount="indefinite" />
                </circle>
            </g>
        ))}
    </g>
);

const renderPond = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Water */}
        <ellipse cx="0" cy="0" rx="18" ry="8" fill="#42A5F5" opacity={0.4} />
        <ellipse cx="0" cy="0" rx="15" ry="6" fill="#64B5F6" opacity={0.3} />
        {/* Ripples */}
        <ellipse cx="-4" cy="-1" rx="5" ry="2" fill="none" stroke="#90CAF9" strokeWidth="0.5" opacity={0.4}>
            <animate attributeName="rx" values="3;6;3" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
        </ellipse>
        {/* Lily pads */}
        <ellipse cx="6" cy="2" rx="4" ry="2" fill="#66BB6A" opacity={0.7} />
        <ellipse cx="-8" cy="1" rx="3" ry="1.5" fill="#66BB6A" opacity={0.6} />
        {/* Fish */}
        <g>
            <ellipse cx="3" cy="-1" rx="3" ry="1.5" fill="#FF7043" opacity={0.5} />
            <polygon points="6,-1 9,-3 9,1" fill="#FF7043" opacity={0.5} />
        </g>
        {/* Stones around edge */}
        <ellipse cx="-16" cy="3" rx="3" ry="2" fill="#78909C" opacity={0.6} />
        <ellipse cx="15" cy="4" rx="2.5" ry="2" fill="#90A4AE" opacity={0.5} />
    </g>
);

const renderTreehouse = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Tree trunk */}
        <rect x="-4" y="-5" width="8" height="35" rx="3" fill="#6D4C41" />
        {/* Platform */}
        <rect x="-16" y="-8" width="32" height="4" rx="1" fill="#8D6E63" />
        {/* Walls */}
        <rect x="-14" y="-22" width="28" height="15" rx="2" fill="#A1887F" />
        {/* Roof */}
        <polygon points="-16,-22 0,-32 16,-22" fill="#5D4037" />
        {/* Window */}
        <rect x="-4" y="-19" width="8" height="7" rx="1" fill="#FFE082" />
        <line x1="0" y1="-19" x2="0" y2="-12" stroke="#8D6E63" strokeWidth="1" />
        <line x1="-4" y1="-15.5" x2="4" y2="-15.5" stroke="#8D6E63" strokeWidth="1" />
        {/* Leaves */}
        <ellipse cx="-18" cy="-20" rx="10" ry="8" fill="#388E3C" />
        <ellipse cx="18" cy="-18" rx="10" ry="8" fill="#43A047" />
        <ellipse cx="0" cy="-35" rx="12" ry="8" fill="#2E7D32" />
        {/* Ladder */}
        <line x1="10" y1="-5" x2="14" y2="20" stroke="#795548" strokeWidth="1.5" />
        <line x1="14" y1="-5" x2="18" y2="20" stroke="#795548" strokeWidth="1.5" />
        {[0, 5, 10, 15, 20].map((dy, i) => (
            <line key={i} x1={10 + dy * 0.16} y1={-5 + dy} x2={14 + dy * 0.16} y2={-5 + dy} stroke="#795548" strokeWidth="1" />
        ))}
    </g>
);

const renderAurora = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {[
            { color: '#4FC3F7', offset: 0, d: 0 },
            { color: '#81C784', offset: 5, d: 0.5 },
            { color: '#CE93D8', offset: 10, d: 1 },
            { color: '#4FC3F7', offset: 15, d: 1.5 },
        ].map((band, i) => (
            <path
                key={i}
                d={`M-60,${-20 + band.offset} Q-20,${-35 + band.offset} 0,${-25 + band.offset} Q20,${-15 + band.offset} 60,${-25 + band.offset}`}
                fill="none"
                stroke={band.color}
                strokeWidth="6"
                opacity={0.2}
            >
                <animate attributeName="opacity" values="0.1;0.3;0.1" dur="4s" begin={`${band.d}s`} repeatCount="indefinite" />
            </path>
        ))}
    </g>
);

const renderUnicorn = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Body */}
        <ellipse cx="0" cy="0" rx="12" ry="8" fill="#F3E5F5" />
        {/* Legs */}
        <rect x="-8" y="6" width="3" height="10" rx="1" fill="#E1BEE7" />
        <rect x="-3" y="6" width="3" height="10" rx="1" fill="#E1BEE7" />
        <rect x="3" y="6" width="3" height="10" rx="1" fill="#E1BEE7" />
        <rect x="8" y="6" width="3" height="10" rx="1" fill="#E1BEE7" />
        {/* Neck */}
        <path d="M10,-3 Q12,-12 8,-18" fill="#F3E5F5" stroke="#E1BEE7" strokeWidth="6" strokeLinecap="round" />
        {/* Head */}
        <ellipse cx="10" cy="-20" rx="5" ry="4" fill="#F3E5F5" transform="rotate(-10,10,-20)" />
        {/* Eye */}
        <circle cx="12" cy="-21" r="1" fill="#7B1FA2" />
        {/* Horn */}
        <polygon points="9,-24 10,-34 11,-24" fill="#FFD54F" />
        <line x1="9.5" y1="-27" x2="10.5" y2="-27" stroke="#FFC107" strokeWidth="0.5" />
        <line x1="9.7" y1="-30" x2="10.3" y2="-30" stroke="#FFC107" strokeWidth="0.5" />
        {/* Mane */}
        <path d="M8,-15 Q4,-12 6,-8" fill="none" stroke="#CE93D8" strokeWidth="2" />
        <path d="M9,-17 Q5,-15 7,-11" fill="none" stroke="#F48FB1" strokeWidth="2" />
        <path d="M10,-19 Q6,-18 8,-14" fill="none" stroke="#81D4FA" strokeWidth="2" />
        {/* Tail */}
        <path d="M-12,0 Q-18,-5 -15,3 Q-20,0 -16,5" fill="none" stroke="#CE93D8" strokeWidth="2" />
        <path d="M-12,1 Q-20,-3 -17,5" fill="none" stroke="#F48FB1" strokeWidth="1.5" />
        {/* Sparkle */}
        <circle cx="10" cy="-32" r="2" fill="#FFD54F" opacity={0.5}>
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite" />
        </circle>
    </g>
);

// ─── SVG Plant Renderers ────────────────────────────────────

const renderSunflower = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <line x1="0" y1="0" x2="0" y2="-25" stroke="#388E3C" strokeWidth="2.5" />
        {/* Leaves */}
        <ellipse cx="-6" cy="-10" rx="5" ry="2.5" fill="#4CAF50" transform="rotate(-30,-6,-10)" />
        <ellipse cx="5" cy="-16" rx="5" ry="2.5" fill="#4CAF50" transform="rotate(25,5,-16)" />
        {/* Petals */}
        {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((angle, i) => (
            <ellipse
                key={i}
                cx="0"
                cy="-32"
                rx="2.5"
                ry="6"
                fill="#FDD835"
                transform={`rotate(${angle}, 0, -27)`}
            />
        ))}
        {/* Center */}
        <circle cx="0" cy="-27" r="4" fill="#5D4037" />
        <circle cx="-1" cy="-28" r="0.8" fill="#795548" />
        <circle cx="1" cy="-26" r="0.8" fill="#795548" />
    </g>
);

const renderRose = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <line x1="0" y1="0" x2="0" y2="-20" stroke="#2E7D32" strokeWidth="2" />
        {/* Thorns */}
        <line x1="0" y1="-8" x2="3" y2="-10" stroke="#2E7D32" strokeWidth="1" />
        <line x1="0" y1="-14" x2="-3" y2="-16" stroke="#2E7D32" strokeWidth="1" />
        {/* Leaf */}
        <ellipse cx="-5" cy="-6" rx="4" ry="2" fill="#388E3C" transform="rotate(-20,-5,-6)" />
        {/* Petals (layered) */}
        <circle cx="0" cy="-23" r="6" fill="#E53935" />
        <circle cx="-2" cy="-24" r="4" fill="#EF5350" />
        <circle cx="2" cy="-24" r="4" fill="#C62828" />
        <circle cx="0" cy="-22" r="3" fill="#D32F2F" />
        {/* Inner curl */}
        <path d="M-1,-24 Q0,-26 1,-24 Q0,-22 -1,-24" fill="#B71C1C" />
    </g>
);

const renderTulip = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <line x1="0" y1="0" x2="0" y2="-22" stroke="#388E3C" strokeWidth="2" />
        {/* Leaf */}
        <path d="M0,-5 Q-8,-12 -2,-18" fill="#4CAF50" />
        {/* Petals */}
        <path d="M-5,-22 Q-6,-30 0,-32 Q6,-30 5,-22 Z" fill="#E040FB" />
        <path d="M-3,-22 Q-3,-29 0,-31 Q3,-29 3,-22 Z" fill="#CE93D8" />
        {/* Inner line */}
        <line x1="0" y1="-22" x2="0" y2="-28" stroke="#AB47BC" strokeWidth="0.5" />
    </g>
);

const renderCherryBlossom = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Branch */}
        <path d="M0,0 Q-5,-10 -2,-18 Q0,-22 3,-25" fill="none" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" />
        {/* Blossoms */}
        {[
            { cx: -4, cy: -15, r: 4 },
            { cx: 2, cy: -22, r: 3.5 },
            { cx: -1, cy: -18, r: 3 },
            { cx: 4, cy: -25, r: 3 },
        ].map((b, i) => (
            <g key={i}>
                <circle cx={b.cx} cy={b.cy} r={b.r} fill="#F8BBD0" />
                <circle cx={b.cx} cy={b.cy} r={b.r * 0.4} fill="#FCE4EC" />
            </g>
        ))}
        {/* Falling petal */}
        <ellipse cx="6" cy="-10" rx="2" ry="1" fill="#F8BBD0" opacity={0.6} transform="rotate(30,6,-10)">
            <animate attributeName="cy" values="-10;5" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0" dur="4s" repeatCount="indefinite" />
        </ellipse>
    </g>
);

const renderHibiscus = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <line x1="0" y1="0" x2="0" y2="-20" stroke="#2E7D32" strokeWidth="2" />
        {/* Leaf */}
        <ellipse cx="5" cy="-8" rx="5" ry="3" fill="#388E3C" transform="rotate(20,5,-8)" />
        {/* Petals */}
        {[0, 72, 144, 216, 288].map((angle, i) => (
            <ellipse
                key={i}
                cx="0"
                cy="-26"
                rx="4"
                ry="7"
                fill="#E91E63"
                transform={`rotate(${angle}, 0, -22)`}
            />
        ))}
        {/* Center */}
        <circle cx="0" cy="-22" r="3" fill="#FFEB3B" />
        {/* Stamen */}
        <line x1="0" y1="-22" x2="0" y2="-28" stroke="#FF5722" strokeWidth="1.5" />
        <circle cx="0" cy="-28.5" r="1" fill="#FF5722" />
    </g>
);

const renderLotus = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Water surface */}
        <ellipse cx="0" cy="2" rx="14" ry="3" fill="#64B5F6" opacity={0.2} />
        {/* Lily pad */}
        <ellipse cx="0" cy="2" rx="10" ry="3" fill="#66BB6A" opacity={0.6} />
        {/* Outer petals */}
        {[-40, -20, 0, 20, 40].map((angle, i) => (
            <ellipse
                key={i}
                cx="0"
                cy="-6"
                rx="3"
                ry="8"
                fill="#F8BBD0"
                transform={`rotate(${angle}, 0, -2)`}
            />
        ))}
        {/* Inner petals */}
        {[-15, 0, 15].map((angle, i) => (
            <ellipse
                key={i}
                cx="0"
                cy="-8"
                rx="2"
                ry="6"
                fill="#FCE4EC"
                transform={`rotate(${angle}, 0, -4)`}
            />
        ))}
        {/* Center */}
        <circle cx="0" cy="-6" r="2.5" fill="#FFEB3B" />
        {/* Glow */}
        <circle cx="0" cy="-6" r="8" fill="#E1BEE7" opacity={0.1}>
            <animate attributeName="opacity" values="0.05;0.15;0.05" dur="3s" repeatCount="indefinite" />
        </circle>
    </g>
);

const renderCrystalFlower = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <line x1="0" y1="0" x2="0" y2="-18" stroke="#78909C" strokeWidth="2" />
        {/* Crystal petals */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <polygon
                key={i}
                points="0,-25 -3,-20 0,-15 3,-20"
                fill={['#4FC3F7', '#81D4FA', '#B3E5FC', '#4FC3F7', '#81D4FA', '#B3E5FC'][i]}
                opacity={0.7}
                transform={`rotate(${angle}, 0, -20)`}
            />
        ))}
        {/* Core */}
        <circle cx="0" cy="-20" r="3" fill="#E1F5FE" />
        <circle cx="0" cy="-20" r="5" fill="#4FC3F7" opacity={0.15}>
            <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Sparkle */}
        <polygon points="0,-27 1,-25 0,-23 -1,-25" fill="white" opacity={0.6}>
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite" />
        </polygon>
    </g>
);

const renderGoldenBloom = (x, y) => (
    <g transform={`translate(${x}, ${y})`}>
        {/* Stem */}
        <line x1="0" y1="0" x2="0" y2="-22" stroke="#558B2F" strokeWidth="2.5" />
        {/* Leaves */}
        <ellipse cx="-6" cy="-8" rx="5" ry="2.5" fill="#689F38" transform="rotate(-25,-6,-8)" />
        <ellipse cx="5" cy="-14" rx="5" ry="2.5" fill="#689F38" transform="rotate(20,5,-14)" />
        {/* Glow */}
        <circle cx="0" cy="-27" r="10" fill="#FFD54F" opacity={0.15}>
            <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Petals */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <ellipse
                key={i}
                cx="0"
                cy="-33"
                rx="2.5"
                ry="6"
                fill={i % 2 === 0 ? '#FFD54F' : '#FFC107'}
                transform={`rotate(${angle}, 0, -27)`}
            />
        ))}
        {/* Center */}
        <circle cx="0" cy="-27" r="4" fill="#FF8F00" />
        <circle cx="0" cy="-27" r="2" fill="#FFD54F" />
    </g>
);

// ─── Decoration/Plant ID → Renderer Map ─────────────────────

const decorationRenderers = {
    butterfly: (x, y) => renderButterfly(x, y, '#E88AED', 0),
    ladybug: renderLadybug,
    mushroom: renderMushroom,
    bee: (x, y) => renderBee(x, y, 0),
    birdhouse: renderBirdhouse,
    lantern: renderLantern,
    gnome: renderGnome,
    bird: (x, y) => renderBird(x, y, '#42A5F5', 0),
    fountain: renderFountain,
    bench: renderBench,
    windchime: renderWindchime,
    statue: renderStatue,
    rainbow: renderRainbow,
    fireflies: renderFireflies,
    pond: renderPond,
    treehouse: renderTreehouse,
    aurora: renderAurora,
    unicorn: renderUnicorn,
};

const plantRenderers = {
    sunflower: renderSunflower,
    rose: renderRose,
    tulip: renderTulip,
    cherry: renderCherryBlossom,
    hibiscus: renderHibiscus,
    lotus: renderLotus,
    crystal: renderCrystalFlower,
    golden: renderGoldenBloom,
};

// ─── Decoration placement positions ─────────────────────────

const slotPositions = {
    air: [
        { x: 25, y: 40 },
        { x: 55, y: 30 },
        { x: 130, y: 45 },
    ],
    ground: [
        { x: 20, y: 115 },
        { x: 70, y: 120 },
        { x: 130, y: 118 },
    ],
    structure: [
        { x: 40, y: 90 },
        { x: 120, y: 88 },
    ],
    sky: [
        { x: 80, y: 25 },
        { x: 60, y: 15 },
    ],
};

const plantPositions = [
    { x: 50, y: 98 },
    { x: 90, y: 95 },
    { x: 115, y: 98 },
];

// ─── Main Component ─────────────────────────────────────────

export default function Garden({
    streak = 0,
    status = 'active',
    size = 'md',
    showInfo = true,
    onClick
}) {
    const gardenContext = useContext(GardenContext);
    const customization = gardenContext?.customization || { gardenTheme: 'cottage', decorations: [], specialPlants: [] };
    const uniqueId = useId();

    const { width, height } = sizeMap[size] || sizeMap.md;
    const stageIndex = getStageIndex(streak);

    const theme = gardenThemes.find(t => t.id === customization.gardenTheme) || gardenThemes[1];

    const equippedDecorations = (customization.decorations || [])
        .map(id => decorations.find(d => d.id === id))
        .filter(Boolean);

    const equippedPlants = (customization.specialPlants || [])
        .map(id => specialPlants.find(p => p.id === id))
        .filter(Boolean);

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

    const baseOpacity = status === 'broken' ? 0.5 : 1;
    const groundY = 100;

    const skyId = `sky-${uniqueId}`;
    const groundId = `gnd-${uniqueId}`;
    const glowId = `glow-${uniqueId}`;

    const renderGarden = () => (
        <svg
            viewBox="0 0 160 160"
            width={width}
            height={height}
            style={{ overflow: 'visible', background: 'transparent' }}
        >
            <defs>
                <linearGradient id={skyId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={stageIndex >= 7 ? '#FFE4B5' : stageIndex >= 5 ? '#87CEEB' : '#B0C4DE'} />
                    <stop offset="100%" stopColor={stageIndex >= 7 ? '#FFDAB9' : '#E0F0FF'} />
                </linearGradient>
                <linearGradient id={groundId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={theme.groundColor} />
                    <stop offset="100%" stopColor={theme.accentColor} />
                </linearGradient>
                {stageIndex >= 9 && (
                    <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
                    </radialGradient>
                )}
            </defs>

            {/* Sky */}
            <rect x="0" y="0" width="160" height={groundY} rx="8" fill={`url(#${skyId})`} opacity={baseOpacity} />

            {/* Sun/Moon */}
            {stageIndex >= 3 && (
                <>
                    <circle
                        cx="130"
                        cy="30"
                        r={8 + stageIndex}
                        fill={customization.gardenTheme === 'moonlight' ? '#F5F5F5' : '#FFD700'}
                        opacity={0.7}
                    />
                    {stageIndex >= 5 && (
                        <circle
                            cx="130"
                            cy="30"
                            r={12 + stageIndex}
                            fill={customization.gardenTheme === 'moonlight' ? '#F5F5F5' : '#FFD700'}
                            opacity={0.15}
                        />
                    )}
                </>
            )}

            {/* Clouds */}
            {stageIndex >= 5 && (
                <g className="garden-cloud">
                    <ellipse cx="30" cy="25" rx="15" ry="8" fill="white" opacity={0.6} />
                    <ellipse cx="45" cy="22" rx="12" ry="7" fill="white" opacity={0.6} />
                    <ellipse cx="110" cy="35" rx="10" ry="5" fill="white" opacity={0.4} />
                </g>
            )}

            {/* Sky decorations (SVG art) */}
            {equippedDecorations.filter(d => d.slot === 'sky').map((dec, i) => {
                const pos = slotPositions.sky[i] || { x: 80, y: 20 };
                const renderer = decorationRenderers[dec.id];
                return renderer ? <g key={dec.id}>{renderer(pos.x, pos.y)}</g> : null;
            })}

            {/* Ground */}
            <rect x="0" y={groundY} width="160" height="60" fill={`url(#${groundId})`} opacity={baseOpacity} />

            {/* Ground texture lines */}
            {stageIndex >= 2 && (
                <g opacity={0.15}>
                    <line x1="10" y1={groundY + 15} x2="40" y2={groundY + 15} stroke="#000" strokeWidth="0.5" />
                    <line x1="80" y1={groundY + 25} x2="120" y2={groundY + 25} stroke="#000" strokeWidth="0.5" />
                    <line x1="50" y1={groundY + 40} x2="90" y2={groundY + 40} stroke="#000" strokeWidth="0.5" />
                </g>
            )}

            {/* Fence */}
            {stageIndex >= 4 && (
                <g opacity={baseOpacity}>
                    {[0, 20, 40, 60, 80, 100, 120, 140].map(x => (
                        <rect key={x} x={x + 5} y={groundY - 15} width="3" height="20" fill="#8B4513" rx="1" />
                    ))}
                    <rect x="0" y={groundY - 10} width="160" height="3" fill="#A0522D" rx="1" />
                    <rect x="0" y={groundY - 5} width="160" height="2" fill="#A0522D" rx="1" opacity={0.6} />
                </g>
            )}

            {/* Garden content */}
            <g className={status !== 'broken' ? 'garden-sway' : ''} opacity={baseOpacity}>
                {/* Stage 0: Bare ground */}
                {stageIndex === 0 && (
                    <>
                        <ellipse cx="40" cy={groundY + 20} rx="15" ry="5" fill="#5D4037" opacity={0.5} />
                        <ellipse cx="100" cy={groundY + 30} rx="20" ry="6" fill="#5D4037" opacity={0.5} />
                        <ellipse cx="75" cy={groundY + 15} rx="8" ry="3" fill="#5D4037" opacity={0.3} />
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
                        <ellipse cx="30" cy={groundY - 10} rx="25" ry="15" fill="#228B22" />
                        <ellipse cx="130" cy={groundY - 8} rx="22" ry="12" fill="#2E8B57" />
                        <g transform={`translate(80, ${groundY})`}>
                            <rect x="-5" y="-60" width="10" height="60" fill="#8B4513" rx="2" />
                            <ellipse cx="0" cy="-70" rx="30" ry="25" fill="#228B22" />
                            <ellipse cx="-15" cy="-55" rx="15" ry="12" fill="#32CD32" />
                            <ellipse cx="15" cy="-55" rx="15" ry="12" fill="#2E8B57" />
                        </g>
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
                        <circle cx="80" cy={groundY - 30} r="50" fill={`url(#${glowId})`} />
                        <path
                            d="M 5 80 Q 20 90, 40 95 T 80 100"
                            fill="none"
                            stroke="#87CEEB"
                            strokeWidth="4"
                            opacity={0.7}
                            strokeLinecap="round"
                        />
                        {[25, 135].map((x, i) => (
                            <g key={i}>
                                <circle cx={x} cy={groundY - 15} r="10" fill="#FFD700" opacity={0.2}>
                                    <animate attributeName="opacity" values="0.1;0.3;0.1" dur="3s" repeatCount="indefinite" />
                                </circle>
                                <circle cx={x} cy={groundY - 15} r="5" fill="#FFD700" />
                            </g>
                        ))}
                    </>
                )}
            </g>

            {/* Air decorations (SVG art) */}
            {equippedDecorations.filter(d => d.slot === 'air').map((dec, i) => {
                const pos = slotPositions.air[i] || { x: 30 + i * 40, y: 40 };
                const renderer = decorationRenderers[dec.id];
                return renderer ? <g key={dec.id}>{renderer(pos.x, pos.y)}</g> : null;
            })}

            {/* Ground decorations (SVG art) */}
            {equippedDecorations.filter(d => d.slot === 'ground').map((dec, i) => {
                const pos = slotPositions.ground[i] || { x: 20 + i * 35, y: 115 };
                const renderer = decorationRenderers[dec.id];
                return renderer ? <g key={dec.id}>{renderer(pos.x, pos.y)}</g> : null;
            })}

            {/* Structure decorations (SVG art) */}
            {equippedDecorations.filter(d => d.slot === 'structure').map((dec, i) => {
                const pos = slotPositions.structure[i] || { x: 40 + i * 50, y: 90 };
                const renderer = decorationRenderers[dec.id];
                return renderer ? <g key={dec.id}>{renderer(pos.x, pos.y)}</g> : null;
            })}

            {/* Special plants (SVG art) */}
            {equippedPlants.map((plant, i) => {
                const pos = plantPositions[i] || { x: 60 + i * 25, y: 98 };
                const renderer = plantRenderers[plant.id];
                return renderer ? <g key={plant.id}>{renderer(pos.x, pos.y)}</g> : null;
            })}
        </svg>
    );

    return (
        <div
            className={`garden-container flex flex-col items-center ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            style={{
                filter: status === 'at-risk' ? 'drop-shadow(0 0 15px rgba(255, 180, 100, 0.6))' :
                    status === 'active' ? 'drop-shadow(0 0 15px rgba(100, 200, 100, 0.4))' :
                        'drop-shadow(0 0 10px rgba(150, 150, 150, 0.2))',
                animation: status === 'at-risk' ? 'garden-pulse-warning 2s ease-in-out infinite' : undefined
            }}
        >

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
