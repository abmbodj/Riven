import { motion } from 'motion/react';
import { useTheme } from '../hooks/useTheme';

// Deterministic pseudo-random from a seed
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 4294967296;
    };
}

function generateParticles(seed, count, bounds = { x: [2, 98], y: [2, 98] }) {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: bounds.x[0] + rand() * (bounds.x[1] - bounds.x[0]),
        y: bounds.y[0] + rand() * (bounds.y[1] - bounds.y[0]),
        size: 0.6 + rand() * 1.5,
        delay: rand() * 5,
        duration: 2 + rand() * 4,
        opacity: 0.3 + rand() * 0.5,
    }));
}

// Stable particle sets for global overlays
const GLOBAL_STARS = generateParticles(3571, 16);
const GLOBAL_HEARTS = generateParticles(1337, 8);
const GLOBAL_BUBBLES = generateParticles(7171, 7);
const GLOBAL_SNOW = generateParticles(2357, 10);
const GLOBAL_MOTES = generateParticles(4949, 8);
const GLOBAL_CYBER_NODES = generateParticles(9001, 5, { x: [5, 95], y: [10, 90] });

const THEME_MAP = {
    'Midnight Galaxy': 'cosmos',
    'Ocean Depths': 'depths',
    'Tech Innovation': 'cyber',
    'Rose': 'bloom',
    'Golden Hour': 'warmlight',
    'Sunset Blvd': 'ember',
    'Arctic Frost': 'crystal',
    'Botanical Garden': 'verdant',
    'Forest Canopy': 'verdant',
    'Desert Rose': 'dusk',
};

export default function GlobalThemeOverlay() {
    const { activeTheme } = useTheme();
    if (!activeTheme) return null;

    const archetype = THEME_MAP[activeTheme.name];
    if (!archetype) return null; // Riven, Riven Light, Modern Minimal — no global overlay

    return (
        <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden="true">
            <GlobalOverlayContent archetype={archetype} theme={activeTheme} />
        </div>
    );
}

function GlobalOverlayContent({ archetype, theme }) {
    switch (archetype) {
        case 'cosmos': return <GlobalCosmos accent={theme.accent_color} />;
        case 'depths': return <GlobalDepths accent={theme.accent_color} />;
        case 'cyber': return <GlobalCyber accent={theme.accent_color} />;
        case 'bloom': return <GlobalBloom accent={theme.accent_color} />;
        case 'warmlight': return <GlobalWarmlight accent={theme.accent_color} />;
        case 'ember': return <GlobalEmber accent={theme.accent_color} />;
        case 'crystal': return <GlobalCrystal accent={theme.accent_color} />;
        case 'verdant': return <GlobalVerdant accent={theme.accent_color} />;
        case 'dusk': return <GlobalDusk accent={theme.accent_color} />;
        default: return null;
    }
}

// ─── Cosmos ─ Midnight Galaxy ────────────────────────────────────────────────

function GlobalCosmos({ accent }) {
    return (<>
        {/* Subtle nebula glow */}
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}12 0%, transparent 70%)`,
            animation: 'themeGlowPulse 8s ease-in-out infinite',
        }} />
        <div className="absolute -bottom-1/4 -left-1/4 w-2/5 h-2/5 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}0a 0%, transparent 65%)`,
            animation: 'themeGlowPulse 10s 3s ease-in-out infinite',
        }} />
        {/* Twinkling stars */}
        {GLOBAL_STARS.map(s => (
            <div key={s.id} className="absolute rounded-full bg-white" style={{
                width: s.size + 'px', height: s.size + 'px',
                left: s.x + '%', top: s.y + '%',
                animation: `themeTwinkle ${s.duration + 2}s ${s.delay}s ease-in-out infinite`,
                opacity: s.opacity * 0.35,
            }} />
        ))}
    </>);
}

// ─── Depths ─ Ocean Depths ───────────────────────────────────────────────────

function GlobalDepths({ accent }) {
    return (<>
        {/* Caustic light */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
            background: 'repeating-linear-gradient(105deg, transparent 0%, rgba(0,212,232,0.08) 8%, transparent 16%)',
            animation: 'themeCaustic 8s ease-in-out infinite',
        }} />
        {/* Slow bubbles */}
        {GLOBAL_BUBBLES.map(b => (
            <motion.div key={b.id}
                className="absolute rounded-full"
                style={{
                    width: (2 + b.size * 2) + 'px', height: (2 + b.size * 2) + 'px',
                    left: b.x + '%', bottom: '-2%',
                    border: `1px solid ${accent}25`,
                    backgroundColor: `${accent}08`,
                }}
                animate={{ y: [0, -window.innerHeight * 0.7], opacity: [0.4, 0] }}
                transition={{ duration: 8 + b.duration * 2, repeat: Infinity, delay: b.delay * 1.5, ease: 'easeOut' }}
            />
        ))}
    </>);
}

// ─── Cyber ─ Tech Innovation ─────────────────────────────────────────────────

function GlobalCyber({ accent }) {
    return (<>
        {/* Very faint grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `linear-gradient(${accent}40 1px, transparent 1px), linear-gradient(90deg, ${accent}40 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
        }} />
        {/* Scanline */}
        <div className="absolute left-0 right-0" style={{
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
            animation: 'themeScanline 6s linear infinite',
            opacity: 0.4,
        }} />
        {/* Data nodes */}
        {GLOBAL_CYBER_NODES.map(n => (
            <motion.div key={n.id}
                className="absolute rounded-full"
                style={{
                    width: '2px', height: '2px',
                    left: n.x + '%', top: n.y + '%',
                    backgroundColor: accent,
                    boxShadow: `0 0 4px ${accent}`,
                }}
                animate={{ opacity: [0.5, 0.05, 0.5] }}
                transition={{ duration: 2 + n.delay * 0.5, repeat: Infinity, delay: n.delay * 0.3 }}
            />
        ))}
    </>);
}

// ─── Bloom ─ Rose ────────────────────────────────────────────────────────────

function GlobalBloom({ accent }) {
    return (<>
        {/* Pink atmosphere */}
        <div className="absolute -top-1/3 left-1/4 w-1/2 h-1/2 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}10 0%, transparent 70%)`,
            animation: 'themeGlowPulse 6s ease-in-out infinite',
        }} />
        {/* Floating hearts */}
        {GLOBAL_HEARTS.map(h => (
            <div key={h.id} className="absolute select-none" style={{
                fontSize: (6 + h.size * 2) + 'px',
                left: h.x + '%', bottom: '-3%',
                color: accent,
                opacity: 0.2,
                animation: `themeHeartFloat ${4 + h.duration}s ${h.delay * 0.8}s ease-out infinite`,
                lineHeight: 1,
            }}>♥</div>
        ))}
    </>);
}

// ─── Warmlight ─ Golden Hour ─────────────────────────────────────────────────

function GlobalWarmlight({ accent }) {
    return (<>
        {/* Warm bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3" style={{
            background: `linear-gradient(0deg, ${accent}08 0%, transparent 100%)`,
        }} />
        {/* Shimmer */}
        <div className="absolute inset-y-0 w-1/4 opacity-[0.06]" style={{
            background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
            animation: 'themeShimmer 8s ease-in-out infinite',
        }} />
        {/* Dust motes */}
        {GLOBAL_MOTES.map(p => (
            <motion.div key={p.id}
                className="absolute rounded-full"
                style={{ width: p.size + 'px', height: p.size + 'px', left: p.x + '%', top: p.y + '%', backgroundColor: accent }}
                animate={{ opacity: [0, p.opacity * 0.15, 0], y: [0, -30] }}
                transition={{ duration: p.duration * 2, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
        ))}
    </>);
}

// ─── Ember ─ Sunset Blvd ─────────────────────────────────────────────────────

function GlobalEmber({ accent }) {
    return (<>
        {/* Corner ember glow */}
        <div className="absolute -bottom-1/4 -left-1/4 w-2/5 h-2/5 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}0c 0%, transparent 65%)`,
            animation: 'themeGlowPulse 7s ease-in-out infinite',
        }} />
        {/* Shimmer */}
        <div className="absolute inset-y-0 w-1/5 opacity-[0.05]" style={{
            background: `linear-gradient(90deg, transparent, ${accent}20, transparent)`,
            animation: 'themeShimmer 9s ease-in-out infinite',
        }} />
    </>);
}

// ─── Crystal ─ Arctic Frost ──────────────────────────────────────────────────

function GlobalCrystal({ accent }) {
    return (<>
        {/* Shimmer */}
        <div className="absolute inset-y-0 w-1/3 opacity-[0.04]" style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'themeShimmer 7s ease-in-out infinite',
        }} />
        {/* Snowflakes */}
        {GLOBAL_SNOW.map(s => (
            <div key={s.id} className="absolute select-none" style={{
                fontSize: (8 + s.size) + 'px',
                left: s.x + '%', top: s.y + '%',
                color: `${accent}40`,
                animation: `themeTwinkle ${s.duration + 2}s ${s.delay}s ease-in-out infinite`,
                opacity: 0.25,
            }}>❄</div>
        ))}
    </>);
}

// ─── Verdant ─ Botanical / Forest ────────────────────────────────────────────

function GlobalVerdant({ accent }) {
    return (<>
        {/* Dappled canopy light */}
        <div className="absolute -top-1/4 left-1/3 w-1/3 h-1/3 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}0c 0%, transparent 60%)`,
            animation: 'themeColorBloom 8s ease-in-out infinite',
        }} />
        <div className="absolute top-1/2 -right-1/6 w-1/4 h-1/4 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}08 0%, transparent 65%)`,
            animation: 'themeColorBloom 10s 4s ease-in-out infinite',
        }} />
    </>);
}

// ─── Dusk ─ Desert Rose ──────────────────────────────────────────────────────

function GlobalDusk({ accent }) {
    return (<>
        {/* Warm corner glow */}
        <div className="absolute -top-1/4 -right-1/4 w-2/5 h-2/5 rounded-full" style={{
            background: `radial-gradient(ellipse, ${accent}0a 0%, transparent 65%)`,
            animation: 'themeGlowPulse 8s 2s ease-in-out infinite',
        }} />
        {/* Silk shimmer */}
        <div className="absolute inset-y-0 w-1/4 opacity-[0.04]" style={{
            background: `linear-gradient(90deg, transparent, ${accent}18, transparent)`,
            animation: 'themeShimmer 10s 3s ease-in-out infinite',
        }} />
    </>);
}
