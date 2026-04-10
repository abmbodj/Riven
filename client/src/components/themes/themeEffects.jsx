import { motion as Motion } from 'motion/react';
import { EFFECT_INTENSITY_OPTIONS, EFFECT_PRESETS } from './themeEditorConfig';

const THEME_ARCHETYPES = {
    'Tech Innovation': 'cyber',
    'Arctic Frost': 'crystal',
    'Modern Minimal': 'void',
    'Riven': 'default',
    'Riven Light': 'default',
};

function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 1664525 + 1013904223) & 0xffffffff;
        return (value >>> 0) / 4294967296;
    };
}

function generateParticles(seed, count, bounds = { x: [5, 95], y: [5, 90] }) {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, index) => ({
        id: index,
        x: bounds.x[0] + rand() * (bounds.x[1] - bounds.x[0]),
        y: bounds.y[0] + rand() * (bounds.y[1] - bounds.y[0]),
        size: 0.8 + rand() * 1.8,
        delay: rand() * 3,
        duration: 1.5 + rand() * 2.5,
        opacity: 0.35 + rand() * 0.55,
    }));
}

const STAR_PARTICLES = generateParticles(7919, 24);
const STAR_PARTICLES_SM = generateParticles(7919, 10);
const HEART_PARTICLES = generateParticles(1337, 10);
const HEART_PARTICLES_SM = generateParticles(1337, 6);
const SNOW_PARTICLES = generateParticles(2357, 8);
const BUBBLE_PARTICLES = generateParticles(5051, 8);
const BUBBLE_PARTICLES_SM = generateParticles(5051, 5);
const CYBER_NODES = generateParticles(9001, 6, { x: [10, 90], y: [15, 85] });

function hexToRgb(hex) {
    const sanitized = String(hex || '').replace('#', '').trim();
    const normalized = sanitized.length === 3
        ? sanitized.split('').map((char) => char + char).join('')
        : sanitized;

    const value = Number.parseInt(normalized, 16);
    if (Number.isNaN(value)) {
        return { r: 0, g: 0, b: 0 };
    }

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getIntensityCounts(intensity, isHero) {
    const profiles = {
        soft: { particles: isHero ? 8 : 5, nodes: isHero ? 4 : 3, glow: 0.18 },
        medium: { particles: isHero ? 14 : 8, nodes: isHero ? 6 : 4, glow: 0.24 },
        rich: { particles: isHero ? 22 : 12, nodes: isHero ? 8 : 5, glow: 0.3 }
    };

    return profiles[intensity] || profiles.soft;
}

function resolveEffectPreset(theme) {
    if (!theme) return 'none';

    const explicitPreset = typeof theme.effect_preset === 'string' ? theme.effect_preset : '';
    if (theme.is_default) {
        return explicitPreset && explicitPreset !== 'auto' ? explicitPreset : 'auto';
    }

    return explicitPreset || 'none';
}

function hasDefaultOverlay(themeName) {
    return Boolean(THEME_ARCHETYPES[themeName]);
}

export function getThemeEffectLabel(theme) {
    const preset = resolveEffectPreset(theme);
    if (preset === 'auto') return 'Signature';

    const effect = EFFECT_PRESETS.find((item) => item.id === preset);
    if (!effect) return 'None';
    if (preset === 'none') return effect.name;

    const intensity = EFFECT_INTENSITY_OPTIONS.find((item) => item.id === (theme?.effect_intensity || 'soft'));
    return `${effect.name} ${intensity ? `· ${intensity.name}` : ''}`.trim();
}


function StaticEffectWash({ theme, className = '' }) {
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 18% 16%, ${withAlpha(theme.accent_color, 0.18)} 0%, transparent 38%), radial-gradient(circle at 84% 18%, ${withAlpha(theme.accent_color, 0.1)} 0%, transparent 36%), linear-gradient(180deg, transparent 0%, ${withAlpha(theme.accent_color, 0.08)} 100%)`
                }}
            />
            <div
                className="absolute inset-y-0 left-[14%] w-px"
                style={{ backgroundColor: withAlpha(theme.accent_color, 0.3) }}
            />
            <div
                className="absolute inset-x-0 bottom-0 h-1/3"
                style={{ background: `linear-gradient(180deg, transparent 0%, ${withAlpha(theme.accent_color, 0.12)} 100%)` }}
            />
        </div>
    );
}

function DustEffect({ theme, isHero, intensity, className = '' }) {
    const profile = getIntensityCounts(intensity, isHero);
    const particles = generateParticles(6101 + profile.particles, profile.particles, { x: [7, 93], y: [10, 86] });

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 20% 20%, ${withAlpha(theme.accent_color, profile.glow)} 0%, transparent 48%), linear-gradient(180deg, transparent 0%, ${withAlpha(theme.accent_color, 0.08)} 100%)`
                }}
            />
            {particles.map((particle) => (
                <Motion.div
                    key={particle.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${particle.size * (isHero ? 5 : 4)}px`,
                        height: `${particle.size * (isHero ? 5 : 4)}px`,
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        background: `radial-gradient(circle, ${withAlpha(theme.accent_color, 0.65)} 0%, ${withAlpha(theme.accent_color, 0.08)} 72%, transparent 100%)`
                    }}
                    animate={{ y: [0, -18, 0], opacity: [0.15, particle.opacity, 0.12] }}
                    transition={{ duration: 4 + particle.duration, repeat: Infinity, delay: particle.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function StarsEffect({ theme, isHero, intensity, className = '' }) {
    const profile = getIntensityCounts(intensity, isHero);
    const stars = generateParticles(7201 + profile.particles, profile.particles, { x: [6, 94], y: [6, 88] });

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(135deg, ${withAlpha(theme.bg_color, 0.1)} 0%, ${withAlpha(theme.accent_color, 0.14)} 100%)`
                }}
            />
            <div
                className="absolute -top-[12%] right-[-12%] h-[60%] w-[60%] rounded-full"
                style={{ background: `radial-gradient(circle, ${withAlpha(theme.accent_color, profile.glow)} 0%, transparent 70%)` }}
            />
            {stars.map((star) => (
                <Motion.div
                    key={star.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${1 + star.size}px`,
                        height: `${1 + star.size}px`,
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        backgroundColor: withAlpha('#ffffff', 0.9),
                        boxShadow: `0 0 12px ${withAlpha(theme.accent_color, 0.45)}`
                    }}
                    animate={{ opacity: [0.2, star.opacity, 0.18], scale: [1, 1.4, 1] }}
                    transition={{ duration: 2.4 + star.duration, repeat: Infinity, delay: star.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function BubblesEffect({ theme, isHero, intensity, className = '' }) {
    const profile = getIntensityCounts(intensity, isHero);
    const bubbles = generateParticles(8301 + profile.particles, profile.particles, { x: [8, 92], y: [20, 82] });

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg, transparent 0%, ${withAlpha(theme.accent_color, 0.14)} 100%)`
                }}
            />
            {bubbles.map((bubble) => (
                <Motion.div
                    key={bubble.id}
                    className="absolute rounded-full border"
                    style={{
                        width: `${4 + bubble.size * 4}px`,
                        height: `${4 + bubble.size * 4}px`,
                        left: `${bubble.x}%`,
                        bottom: '-8%',
                        borderColor: withAlpha(theme.accent_color, 0.32),
                        backgroundColor: withAlpha(theme.accent_color, 0.06)
                    }}
                    animate={{ y: [0, isHero ? -220 : -120], opacity: [0, bubble.opacity, 0] }}
                    transition={{ duration: 3 + bubble.duration, repeat: Infinity, delay: bubble.delay * 0.5, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
}

function GridEffect({ theme, isHero, intensity, className = '' }) {
    const profile = getIntensityCounts(intensity, isHero);
    const nodes = generateParticles(9401 + profile.nodes, profile.nodes, { x: [12, 88], y: [16, 82] });

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(145deg, ${withAlpha(theme.bg_color, 0.08)} 0%, ${withAlpha(theme.accent_color, 0.12)} 100%)`
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `linear-gradient(${withAlpha(theme.accent_color, 0.08)} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(theme.accent_color, 0.06)} 1px, transparent 1px)`,
                    backgroundSize: isHero ? '22px 22px' : '14px 14px'
                }}
            />
            <div
                className="absolute inset-y-0 right-[14%] w-[36%]"
                style={{
                    background: `linear-gradient(180deg, transparent 0%, ${withAlpha(theme.accent_color, 0.18)} 24%, ${withAlpha(theme.accent_color, 0.04)} 100%)`,
                    clipPath: 'polygon(58% 0, 100% 0, 46% 100%, 4% 100%)'
                }}
            />
            {nodes.map((node) => (
                <Motion.div
                    key={node.id}
                    className="absolute rounded-full"
                    style={{
                        width: isHero ? '4px' : '3px',
                        height: isHero ? '4px' : '3px',
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        backgroundColor: theme.accent_color,
                        boxShadow: `0 0 8px ${withAlpha(theme.accent_color, 0.9)}, 0 0 18px ${withAlpha(theme.accent_color, 0.26)}`
                    }}
                    animate={{ opacity: [0.8, 0.16, 0.8], scale: [1, 1.5, 1] }}
                    transition={{ duration: 1.4 + node.delay * 0.3, repeat: Infinity, delay: node.delay * 0.2 }}
                />
            ))}
        </div>
    );
}

function OverlayCosmos({ isHero, className = '' }) {
    const stars = isHero ? STAR_PARTICLES : STAR_PARTICLES_SM;
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #2a0845 0%, #0a0020 40%, #1a0060 70%, #2a0845 100%)',
                backgroundSize: '300% 300%',
                animation: 'themeAurora 8s ease infinite',
                opacity: 0.7,
            }} />
            <div className="absolute" style={{
                width: '70%', height: '70%',
                top: '-10%', right: '-10%',
                background: 'radial-gradient(ellipse, #7c3aed40 0%, transparent 70%)',
                animation: 'themeGlowPulse 5s ease-in-out infinite',
            }} />
            {stars.map((star) => (
                <div key={star.id} className="absolute rounded-full bg-white" style={{
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                    animationDelay: `${star.delay}s`,
                    animationDuration: `${star.duration}s`,
                    animation: `themeTwinkle ${star.duration}s ${star.delay}s ease-in-out infinite`,
                    opacity: star.opacity,
                }} />
            ))}
        </div>
    );
}

function OverlayDepths({ isHero, className = '' }) {
    const bubbles = isHero ? BUBBLE_PARTICLES : BUBBLE_PARTICLES_SM;
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(180deg, #000814 0%, #001a2e 50%, #00355a 100%)',
                opacity: 0.6,
            }} />
            <div className="absolute inset-0" style={{
                background: 'repeating-linear-gradient(105deg, transparent 0%, #00d4e812 8%, transparent 16%)',
                animation: 'themeCaustic 6s ease-in-out infinite',
                opacity: 0.4,
            }} />
            {bubbles.map((bubble) => (
                <Motion.div key={bubble.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${3 + bubble.size * 2}px`,
                        height: `${3 + bubble.size * 2}px`,
                        left: `${bubble.x}%`,
                        bottom: '-8%',
                        border: '1px solid rgba(0,212,232,0.35)',
                        backgroundColor: 'rgba(0,212,232,0.06)',
                    }}
                    animate={{ y: [0, isHero ? -180 : -90], opacity: [0.7, 0] }}
                    transition={{ duration: 3 + bubble.duration, repeat: Infinity, delay: bubble.delay * 0.6, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
}

function OverlayCyber({ isHero, className = '' }) {
    const rings = isHero ? [110, 150, 190] : [70, 96];
    const nodes = isHero ? CYBER_NODES : CYBER_NODES.slice(0, 4);
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(145deg, #08161b 0%, #0b1f25 48%, #103036 100%)',
                opacity: 0.55,
            }} />
            <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(113,214,202,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(113,214,202,0.06) 1px, transparent 1px)',
                backgroundSize: isHero ? '22px 22px' : '12px 12px',
            }} />
            {rings.map((size, index) => (
                <div
                    key={size}
                    className="absolute rounded-full border"
                    style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        right: isHero ? `${18 + index * 8}px` : `${10 + index * 6}px`,
                        top: isHero ? `${8 + index * 16}px` : `${4 + index * 10}px`,
                        borderColor: `rgba(113, 214, 202, ${0.18 - index * 0.04})`,
                        boxShadow: index === 0 ? '0 0 32px rgba(113,214,202,0.14)' : 'none',
                    }}
                />
            ))}
            <div className="absolute inset-y-0 right-[14%] w-[36%]" style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(113,214,202,0.18) 18%, rgba(113,214,202,0.04) 100%)',
                clipPath: 'polygon(58% 0, 100% 0, 46% 100%, 4% 100%)',
                animation: 'themeShimmer 4.8s ease-in-out infinite',
            }} />
            {nodes.map((node) => (
                <Motion.div key={node.id}
                    className="absolute"
                    style={{
                        width: isHero ? '4px' : '3px',
                        height: isHero ? '4px' : '3px',
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        backgroundColor: '#71d6ca',
                        boxShadow: '0 0 8px rgba(113,214,202,0.9), 0 0 20px rgba(113,214,202,0.32)',
                        borderRadius: '50%',
                    }}
                    animate={{ opacity: [1, 0.1, 1], scale: [1, 1.5, 1] }}
                    transition={{ duration: 1.2 + node.delay * 0.3, repeat: Infinity, delay: node.delay * 0.2 }}
                />
            ))}
            {isHero ? (
                <>
                    <div className="absolute top-3 left-3 h-5 w-5 border-t border-l" style={{ borderColor: 'rgba(113,214,202,0.45)' }} />
                    <div className="absolute bottom-3 right-3 h-5 w-5 border-b border-r" style={{ borderColor: 'rgba(113,214,202,0.45)' }} />
                </>
            ) : null}
        </div>
    );
}

function OverlayBloom({ isHero, className = '' }) {
    const hearts = isHero ? HEART_PARTICLES : HEART_PARTICLES_SM;
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #3d0050 0%, #1a0020 35%, #4a0060 65%, #1a0020 100%)',
                backgroundSize: '400% 400%',
                animation: 'themeAurora 5s ease infinite',
                opacity: 0.65,
            }} />
            <div className="absolute" style={{
                width: '60%', height: '60%',
                top: '-5%', left: '20%',
                background: 'radial-gradient(ellipse, #ff4da640 0%, transparent 70%)',
                animation: 'themeGlowPulse 3.5s ease-in-out infinite',
            }} />
            {hearts.map((heart) => (
                <div key={heart.id} className="absolute select-none" style={{
                    fontSize: `${(isHero ? 10 : 7) + heart.size * 2}px`,
                    left: `${heart.x}%`,
                    bottom: '-5%',
                    color: `hsl(${320 + heart.id * 15}deg 100% 75%)`,
                    animation: `themeHeartFloat ${2 + heart.duration * 0.4}s ${heart.delay * 0.5}s ease-out infinite`,
                    lineHeight: 1,
                }}>♥</div>
            ))}
        </div>
    );
}

function OverlayWarmlight({ isHero, className = '' }) {
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #3d1a00 0%, #1a0800 40%, #2d1000 70%, #3d1a00 100%)',
                backgroundSize: '300% 300%',
                animation: 'themeGradientDrift 10s ease infinite',
                opacity: 0.6,
            }} />
            <div className="absolute" style={{
                width: '80%', height: '80%',
                bottom: '-20%', right: '-20%',
                background: 'radial-gradient(ellipse, #f5a62330 0%, transparent 65%)',
                animation: 'themeGlowPulse 6s ease-in-out infinite',
            }} />
            <div className="absolute inset-y-0 w-1/3" style={{
                background: 'linear-gradient(90deg, transparent, rgba(245,166,35,0.15), transparent)',
                animation: 'themeShimmer 4s ease-in-out infinite',
            }} />
            {isHero ? generateParticles(4242, 8).map((particle) => (
                <Motion.div key={particle.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        backgroundColor: '#f5a623',
                        opacity: 0,
                    }}
                    animate={{ opacity: [0, particle.opacity * 0.4, 0], y: [0, -20] }}
                    transition={{ duration: particle.duration * 1.5, repeat: Infinity, delay: particle.delay, ease: 'easeInOut' }}
                />
            )) : null}
        </div>
    );
}

function OverlayEmber({ className = '' }) {
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(160deg, #3d0800 0%, #1a0500 45%, #2d0a00 100%)',
                backgroundSize: '300% 300%',
                animation: 'themeGradientDrift 8s ease infinite',
                opacity: 0.65,
            }} />
            <div className="absolute" style={{
                width: '90%', height: '60%',
                bottom: '-10%', left: '-5%',
                background: 'radial-gradient(ellipse, #ff603020 0%, transparent 70%)',
                animation: 'themeGlowPulse 4s ease-in-out infinite',
            }} />
            <div className="absolute inset-y-0 w-1/4" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,96,48,0.12), transparent)',
                animation: 'themeShimmer 5s ease-in-out infinite',
            }} />
        </div>
    );
}

function OverlayCrystal({ isHero, className = '' }) {
    const panes = isHero
        ? [
            { width: '36%', height: '84%', left: '-4%', top: '-10%', opacity: 0.38, clipPath: 'polygon(12% 0, 100% 0, 70% 100%, 0 100%)' },
            { width: '42%', height: '66%', left: '28%', top: '-14%', opacity: 0.26, clipPath: 'polygon(18% 0, 100% 0, 82% 100%, 0 100%)' },
            { width: '28%', height: '88%', right: '-4%', top: '10%', opacity: 0.22, clipPath: 'polygon(26% 0, 100% 0, 70% 100%, 0 100%)' },
        ]
        : [
            { width: '40%', height: '82%', left: '-10%', top: '-12%', opacity: 0.32, clipPath: 'polygon(20% 0, 100% 0, 72% 100%, 0 100%)' },
            { width: '28%', height: '70%', right: '-6%', top: '12%', opacity: 0.18, clipPath: 'polygon(30% 0, 100% 0, 70% 100%, 0 100%)' },
        ];

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.88) 0%, rgba(233,243,248,0.8) 48%, rgba(205,228,236,0.72) 100%)',
                opacity: 0.52,
            }} />
            <div className="absolute inset-y-0 -left-[12%] w-[56%]" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 18%, rgba(137,195,212,0.28) 46%, rgba(255,255,255,0.52) 62%, transparent 100%)',
                animation: 'themeShimmer 5.8s ease-in-out infinite',
                filter: 'blur(2px)',
            }} />
            {panes.map((pane, index) => (
                <div
                    key={index}
                    className="absolute border"
                    style={{
                        ...pane,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(137,195,212,0.08) 100%)',
                        borderColor: `rgba(137, 195, 212, ${0.22 - index * 0.04})`,
                        boxShadow: index === 0 ? '0 0 24px rgba(137,195,212,0.14)' : 'none',
                    }}
                />
            ))}
            {SNOW_PARTICLES.slice(0, isHero ? 6 : 4).map((particle) => (
                <div key={particle.id} className="absolute rounded-full" style={{
                    width: `${1 + particle.size}px`,
                    height: `${1 + particle.size}px`,
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(137,195,212,0.18) 65%, transparent 100%)',
                    animation: `themeTwinkle ${particle.duration}s ${particle.delay}s ease-in-out infinite`,
                    boxShadow: '0 0 8px rgba(137,195,212,0.25)',
                }} />
            ))}
        </div>
    );
}

function OverlayVerdant({ themeName, isHero, className = '' }) {
    const accent = themeName === 'Botanical Garden' ? '#5cdb7a' : '#7dde82';
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: `radial-gradient(ellipse at 25% 70%, ${accent}28 0%, transparent 55%), radial-gradient(ellipse at 75% 25%, ${accent}18 0%, transparent 50%)`,
                animation: 'themeColorBloom 6s ease-in-out infinite',
            }} />
            {isHero ? generateParticles(8888, 6).map((particle) => (
                <div key={particle.id} className="absolute rounded-full" style={{
                    width: `${8 + particle.size * 10}px`,
                    height: `${8 + particle.size * 10}px`,
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
                    animation: `themeGlowPulse ${3 + particle.duration}s ${particle.delay}s ease-in-out infinite`,
                }} />
            )) : null}
        </div>
    );
}

function OverlayDusk({ className = '' }) {
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse at 45% 55%, #e8856a28 0%, transparent 60%), radial-gradient(ellipse at 72% 22%, #c4896e20 0%, transparent 50%)',
                animation: 'themeGlowPulse 5s ease-in-out infinite',
            }} />
            <div className="absolute inset-y-0 w-1/3" style={{
                background: 'linear-gradient(90deg, transparent, rgba(232,133,106,0.1), transparent)',
                animation: 'themeShimmer 6s 1s ease-in-out infinite',
            }} />
        </div>
    );
}

function OverlayVoid({ className = '' }) {
    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(239,234,227,0.68) 100%)',
                opacity: 0.48,
            }} />
            <div className="absolute inset-y-0 left-[16%] w-px" style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(200,130,89,0.48) 30%, transparent 100%)',
            }} />
            <div className="absolute inset-y-0 right-[24%] w-[22%]" style={{
                background: 'linear-gradient(180deg, rgba(200,130,89,0.06) 0%, rgba(200,130,89,0.14) 100%)',
                borderLeft: '1px solid rgba(200,130,89,0.2)',
            }} />
            <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(24,21,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(24,21,18,0.03) 1px, transparent 1px)',
                backgroundSize: '100% 20px, 28px 100%',
                maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.32), transparent 100%)',
            }} />
            <div className="absolute inset-y-0 -left-[18%] w-[42%]" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 30%, rgba(200,130,89,0.12) 54%, transparent 100%)',
                animation: 'themeShimmer 7.2s 0.8s ease-in-out infinite',
            }} />
        </div>
    );
}

function DefaultThemeOverlay({ themeName, isHero, className = '' }) {
    const archetype = THEME_ARCHETYPES[themeName] || 'default';

    switch (archetype) {
        case 'cosmos': return <OverlayCosmos isHero={isHero} className={className} />;
        case 'depths': return <OverlayDepths isHero={isHero} className={className} />;
        case 'cyber': return <OverlayCyber isHero={isHero} className={className} />;
        case 'bloom': return <OverlayBloom isHero={isHero} className={className} />;
        case 'warmlight': return <OverlayWarmlight isHero={isHero} className={className} />;
        case 'ember': return <OverlayEmber className={className} />;
        case 'crystal': return <OverlayCrystal isHero={isHero} className={className} />;
        case 'verdant': return <OverlayVerdant themeName={themeName} isHero={isHero} className={className} />;
        case 'dusk': return <OverlayDusk className={className} />;
        case 'void': return <OverlayVoid className={className} />;
        default: return null;
    }
}

function CustomThemeOverlay({ theme, preset, isHero, className = '' }) {
    const intensity = theme?.effect_intensity || 'soft';

    switch (preset) {
        case 'dust':
            return <DustEffect theme={theme} isHero={isHero} intensity={intensity} className={className} />;
        case 'stars':
            return <StarsEffect theme={theme} isHero={isHero} intensity={intensity} className={className} />;
        case 'bubbles':
            return <BubblesEffect theme={theme} isHero={isHero} intensity={intensity} className={className} />;
        case 'grid':
            return <GridEffect theme={theme} isHero={isHero} intensity={intensity} className={className} />;
        default:
            return null;
    }
}

export function ThemeEffectOverlay({ theme, isHero = false, simplifyMotion = false, className = '' }) {
    const preset = resolveEffectPreset(theme);

    if (preset === 'none') return null;

    if (preset === 'auto') {
        if (!hasDefaultOverlay(theme?.name)) return null;
        return simplifyMotion
            ? <StaticEffectWash theme={theme} className={className} />
            : <DefaultThemeOverlay themeName={theme.name} isHero={isHero} className={className} />;
    }

    return simplifyMotion
        ? <StaticEffectWash theme={theme} className={className} />
        : <CustomThemeOverlay theme={theme} preset={preset} isHero={isHero} className={className} />;
}
