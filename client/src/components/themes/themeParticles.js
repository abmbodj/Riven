export function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 1664525 + 1013904223) & 0xffffffff;
        return (value >>> 0) / 4294967296;
    };
}

export function generateParticles(seed, count, bounds = { x: [5, 95], y: [5, 90] }) {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, index) => ({
        id: index,
        x: bounds.x[0] + rand() * (bounds.x[1] - bounds.x[0]),
        y: bounds.y[0] + rand() * (bounds.y[1] - bounds.y[0]),
        size: 0.8 + rand() * 2.2,
        delay: rand() * 7,
        duration: 3.5 + rand() * 6.5,
        opacity: 0.24 + rand() * 0.52,
        drift: rand(),
        spin: rand(),
    }));
}

export function hexToRgb(hex) {
    const sanitized = String(hex || '').replace('#', '').trim();
    const normalized = sanitized.length === 3
        ? sanitized.split('').map((char) => char + char).join('')
        : sanitized;

    const value = Number.parseInt(normalized, 16);
    if (Number.isNaN(value)) {
        return { r: 222, g: 185, b: 106 };
    }

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

export function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexOpacityToAlpha(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const parsed = Number.parseInt(value, 16);
    if (Number.isNaN(parsed)) return fallback;
    return Number((parsed / 255).toFixed(3));
}

export function radialParticleBackground(
    accent,
    {
        highlight = 0.9,
        core,
        mid,
        outer,
        coreAlpha = 0.74,
        midAlpha = 0.24,
        outerAlpha = 0.08
    } = {}
) {
    const resolvedCore = hexOpacityToAlpha(core, coreAlpha);
    const resolvedMid = hexOpacityToAlpha(mid, midAlpha);
    const resolvedOuter = hexOpacityToAlpha(outer, outerAlpha);
    return `radial-gradient(circle, rgba(255,255,255,${highlight}) 0%, ${withAlpha(accent, resolvedCore)} 30%, ${withAlpha(accent, resolvedMid)} 62%, ${withAlpha(accent, resolvedOuter)} 82%, transparent 100%)`;
}

export function particleGlow(accent, size, intensity = 1) {
    const near = (size * (2.4 + intensity * 1.2)).toFixed(1);
    const far = (size * (5.2 + intensity * 3)).toFixed(1);
    const nearAlpha = Math.min(0.74, 0.22 + intensity * 0.28).toFixed(2);
    const farAlpha = Math.min(0.28, 0.08 + intensity * 0.09).toFixed(2);
    return `0 0 ${near}px ${withAlpha(accent, nearAlpha)}, 0 0 ${far}px ${withAlpha(accent, farAlpha)}`;
}

export function getParticleProfile(intensity = 'soft', isHero = false) {
    const profiles = {
        soft: {
            particles: isHero ? 9 : 5,
            nodes: isHero ? 4 : 3,
            glow: 0.16,
            travel: isHero ? 130 : 72,
            opacity: 0.68,
        },
        medium: {
            particles: isHero ? 15 : 8,
            nodes: isHero ? 6 : 4,
            glow: 0.24,
            travel: isHero ? 190 : 104,
            opacity: 0.84,
        },
        rich: {
            particles: isHero ? 24 : 13,
            nodes: isHero ? 9 : 6,
            glow: 0.32,
            travel: isHero ? 260 : 144,
            opacity: 1,
        },
    };

    return profiles[intensity] || profiles.soft;
}

export function getThemeParticleTokens(theme = {}) {
    return {
        accent: theme.accent_color || '#deb96a',
        background: theme.bg_color || '#162a31',
        surface: theme.surface_color || '#223b43',
        text: theme.text_color || '#f5f0e8',
        border: theme.border_color || '#3f5f65',
    };
}
