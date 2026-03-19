import { useGSAP } from '../hooks/useGSAP';
import gsap from 'gsap';
import { useTheme } from '../hooks/useTheme';
import { useMobileVisualBudget } from '../hooks/useMobileVisualBudget';

/** Static accent wash — no GSAP, no particles (mobile / coarse pointer). */
function LightThemeAtmosphere({ accent, containerRef }) {
    return (
        <div ref={containerRef}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse 92% 56% at 50% 24%, ${accent}18 0%, transparent 58%), radial-gradient(ellipse 72% 50% at 80% 76%, ${accent}0c 0%, transparent 54%)`,
                }}
            />
        </div>
    );
}

// ─── Deterministic seeded random ─────────────────────────────────────────────
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 4294967296;
    };
}

function generateParticles(seed, count) {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 2 + rand() * 96,        // % across full viewport width
        y: 2 + rand() * 96,        // % across full viewport height
        size: 0.8 + rand() * 2.2,
        delay: rand() * 8,
        duration: 4 + rand() * 6,
        opacity: 0.22 + rand() * 0.42,
        drift: rand(),              // 0–1 normalized drift magnitude
        spin: rand(),               // 0–1 normalized rotation
    }));
}

function radialParticleBackground(accent, { highlight = 0.92, core = 'cc', mid = '42', outer = '10' } = {}) {
    return `radial-gradient(circle, rgba(255,255,255,${highlight}) 0%, ${accent}${core} 28%, ${accent}${mid} 62%, ${accent}${outer} 80%, transparent 100%)`;
}

function particleGlow(accent, size, intensity = 1) {
    const near = (size * (2.2 + intensity * 1.1)).toFixed(1);
    const far = (size * (4.8 + intensity * 2.8)).toFixed(1);
    const nearAlpha = intensity >= 1 ? 'aa' : intensity >= 0.7 ? '88' : '55';
    const farAlpha = intensity >= 1 ? '4a' : intensity >= 0.7 ? '34' : '22';
    return `0 0 ${near}px ${accent}${nearAlpha}, 0 0 ${far}px ${accent}${farAlpha}`;
}

// ─── Stable particle sets (module-level — never re-generated) ────────────────
const P_MOTES   = generateParticles(4949, 32); // forest dust / sage temple
const P_EMBERS  = generateParticles(6677, 24); // dawn ember sparks
const P_MIST    = generateParticles(1122, 18); // misty shore fog orbs
const P_FIREFLY = generateParticles(5511, 16); // amber lantern fireflies
const P_STARS   = generateParticles(3571, 28); // moonlit cove stars
const P_RAIN    = generateParticles(8833, 24); // rain garden droplets
const P_PETALS  = generateParticles(2233, 22); // cherry blossom petals
const P_POLLEN  = generateParticles(7777, 24); // lavender pollen spores

// ─── Theme → archetype map ────────────────────────────────────────────────────
const THEME_MAP = {
    'Sage Temple':    'forest',
    'Dawn Ember':     'ember',
    'Misty Shore':    'mist',
    'Amber Lantern':  'lantern',
    'Moonlit Cove':   'moon',
    'Rain Garden':    'rain',
    'Cherry Blossom': 'sakura',
    'Lavender Dusk':  'lavender',
};

// ─── Main export ──────────────────────────────────────────────────────────────
export default function GlobalThemeOverlay() {
    const { activeTheme } = useTheme();
    const lightAtmosphere = useMobileVisualBudget();
    if (!activeTheme) return null;
    const archetype = THEME_MAP[activeTheme.name];
    if (!archetype) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden="true">
            <GlobalOverlayContent archetype={archetype} accent={activeTheme.accent_color} lightAtmosphere={lightAtmosphere} />
        </div>
    );
}

function GlobalOverlayContent({ archetype, accent, lightAtmosphere }) {
    switch (archetype) {
        case 'forest':   return <ForestOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'ember':    return <EmberOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'mist':     return <MistOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'lantern':  return <LanternOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'moon':     return <MoonOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'rain':     return <RainOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'sakura':   return <SakuraOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        case 'lavender': return <LavenderOverlay accent={accent} lightAtmosphere={lightAtmosphere} />;
        default: return null;
    }
}

// ─── Forest — Sage Temple ─────────────────────────────────────────────────────
// Dust motes drifting upward through dappled canopy light, bamboo silhouette
function ForestOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-mote').forEach((el, i) => {
            const p = P_MOTES[i % P_MOTES.length];
            gsap.timeline({ repeat: -1, delay: p.delay })
                .fromTo(el,
                    { opacity: 0, y: 0, x: 0 },
                    { opacity: p.opacity * 0.36, duration: p.duration * 0.22, ease: 'sine.in' }
                )
                .to(el, {
                    opacity: 0,
                    y: -(30 + p.drift * 32),
                    x: (p.spin - 0.5) * 26,
                    duration: p.duration * 0.78,
                    ease: 'power1.out',
                });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Dappled canopy light — scattered across screen */}
            <div className="absolute -top-1/4 left-1/5 w-2/5 h-2/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}0d 0%, transparent 60%)`,
                animation: 'themeColorBloom 9s ease-in-out infinite',
            }} />
            <div className="absolute top-1/3 -right-1/8 w-1/4 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}07 0%, transparent 65%)`,
                animation: 'themeColorBloom 13s 4s ease-in-out infinite',
            }} />
            <div className="absolute bottom-1/3 left-1/8 w-1/5 h-1/4 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}06 0%, transparent 60%)`,
                animation: 'themeColorBloom 11s 7s ease-in-out infinite',
            }} />
            <div className="absolute top-2/3 right-1/4 w-1/6 h-1/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}05 0%, transparent 60%)`,
                animation: 'themeColorBloom 15s 2s ease-in-out infinite',
            }} />

            {/* Dust motes — full screen scatter */}
            {P_MOTES.map(p => (
                <div key={p.id} className="p-mote absolute rounded-full" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (p.size * 1.1) + 'px', height: (p.size * 1.1) + 'px',
                    background: radialParticleBackground(accent, { highlight: 0.88, core: 'b0', mid: '30', outer: '08' }),
                    boxShadow: particleGlow(accent, p.size, 0.45),
                    filter: `blur(${p.size * 0.22}px)`,
                    willChange: 'transform, opacity',
                }} />
            ))}

            {/* Bamboo silhouette — right edge */}
            <svg className="absolute right-0 top-0 h-full opacity-[0.055]" width="56" viewBox="0 0 56 800" fill="none">
                <line x1="36" y1="0" x2="36" y2="800" stroke={accent} strokeWidth="1.5" />
                <line x1="20" y1="0" x2="20" y2="800" stroke={accent} strokeWidth="1" />
                {[70, 185, 295, 410, 520, 640, 745].map((y, i) => (
                    <g key={i}>
                        <line x1="28" y1={y} x2="44" y2={y} stroke={accent} strokeWidth="1.5" />
                        <path d={`M36 ${y} Q52 ${y + 10} 54 ${y + 28}`} stroke={accent} strokeWidth="0.8" strokeLinecap="round" />
                        <path d={`M36 ${y + 18} Q52 ${y + 26} 53 ${y + 46}`} stroke={accent} strokeWidth="0.65" strokeLinecap="round" />
                    </g>
                ))}
                {[110, 225, 345, 465, 580].map((y, i) => (
                    <g key={i}>
                        <line x1="12" y1={y} x2="20" y2={y} stroke={accent} strokeWidth="1.1" />
                        <path d={`M20 ${y} Q6 ${y + 8} 3 ${y + 24}`} stroke={accent} strokeWidth="0.65" strokeLinecap="round" />
                    </g>
                ))}
            </svg>
        </div>
    );
}

// ─── Ember — Dawn Ember ───────────────────────────────────────────────────────
// Warm glowing sparks rising from random positions across the full screen
function EmberOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-ember').forEach((el, i) => {
            const p = P_EMBERS[i % P_EMBERS.length];
            gsap.timeline({ repeat: -1, delay: p.delay })
                .fromTo(el,
                    { opacity: 0, y: 0, x: 0, scale: 0.3 },
                    { opacity: p.opacity * 0.64, scale: 1, duration: p.duration * 0.18, ease: 'power2.in' }
                )
                .to(el, {
                    opacity: 0,
                    y: -(55 + p.drift * 65),
                    x: (p.spin - 0.5) * 38,
                    scale: 0.15,
                    duration: p.duration * 0.82,
                    ease: 'power2.out',
                });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Warm atmospheric glow — bottom */}
            <div className="absolute -bottom-1/6 left-1/4 right-1/4 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse at 50% 100%, ${accent}10 0%, transparent 70%)`,
                animation: 'themeGlowPulse 7s ease-in-out infinite',
            }} />
            {/* Top right warmth */}
            <div className="absolute -top-1/5 right-1/5 w-1/3 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}09 0%, transparent 65%)`,
                animation: 'themeGlowPulse 11s 4s ease-in-out infinite',
            }} />
            {/* Left mid warm bloom */}
            <div className="absolute top-2/5 -left-1/8 w-1/4 h-1/4 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}07 0%, transparent 60%)`,
                animation: 'themeGlowPulse 9s 2s ease-in-out infinite',
            }} />

            {/* Ember sparks — scattered full screen */}
            {P_EMBERS.map(p => (
                <div key={p.id} className="p-ember absolute rounded-full" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (1.8 + p.size * 0.9) + 'px', height: (1.8 + p.size * 0.9) + 'px',
                    background: radialParticleBackground(accent, { highlight: 0.98, core: 'ff', mid: '88', outer: '18' }),
                    boxShadow: particleGlow(accent, p.size + 1, 1.2),
                    filter: `blur(${p.size * 0.12}px)`,
                    willChange: 'transform, opacity',
                }} />
            ))}
        </div>
    );
}

// ─── Mist — Misty Shore ───────────────────────────────────────────────────────
// Soft fog orbs drifting horizontally, tiny motes scattered across the view
function MistOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        // Large fog orbs drift slowly
        selector('.p-fog').forEach((el, i) => {
            const p = P_MIST[i % P_MIST.length];
            gsap.timeline({ repeat: -1, delay: p.delay * 0.5 })
                .fromTo(el,
                    { opacity: 0, x: 0 },
                    { opacity: p.opacity * 0.14, duration: p.duration * 0.25, ease: 'sine.in' }
                )
                .to(el, {
                    x: (p.spin - 0.5) * 90,
                    opacity: p.opacity * 0.11,
                    duration: p.duration * 0.75,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: 3,
                })
                .to(el, { opacity: 0, duration: p.duration * 0.2, ease: 'sine.out' });
        });

        // Tiny drifting motes
        selector('.p-mote').forEach((el, i) => {
            const p = P_MIST[i % P_MIST.length];
            gsap.timeline({ repeat: -1, delay: p.delay })
                .fromTo(el,
                    { opacity: 0, x: 0, y: 0 },
                    { opacity: p.opacity * 0.3, duration: p.duration * 0.2, ease: 'sine.in' }
                )
                .to(el, {
                    opacity: 0,
                    x: (p.spin - 0.5) * 40,
                    y: (p.drift - 0.4) * 18,
                    duration: p.duration * 0.8,
                    ease: 'none',
                });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Static misty veils */}
            <div className="absolute -top-1/4 -left-1/4 w-3/4 h-1/2 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}06 0%, transparent 65%)`,
                animation: 'themeMistDrift 18s ease-in-out infinite',
            }} />
            <div className="absolute top-1/3 -right-1/6 w-2/5 h-2/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}05 0%, transparent 65%)`,
                animation: 'themeMistDrift 22s 7s ease-in-out infinite',
            }} />
            <div className="absolute bottom-1/4 left-1/3 w-1/3 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}04 0%, transparent 60%)`,
                animation: 'themeMistDrift 16s 3s ease-in-out infinite',
            }} />

            {/* Large fog orbs — full screen */}
            {P_MIST.map(p => (
                <div key={p.id} className="p-fog absolute rounded-full" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (55 + p.drift * 80) + 'px', height: (38 + p.drift * 50) + 'px',
                    background: `radial-gradient(ellipse, ${accent}0d 0%, ${accent}06 46%, transparent 100%)`,
                    boxShadow: particleGlow(accent, 18 + p.drift * 12, 0.35),
                    filter: `blur(${18 + p.drift * 18}px)`,
                    transform: 'translate(-50%, -50%)',
                    opacity: 0,
                    willChange: 'transform, opacity',
                }} />
            ))}

            {/* Tiny motes — full screen scatter */}
            {P_MIST.map(p => (
                <div key={`m${p.id}`} className="p-mote absolute rounded-full" style={{
                    left: (p.x + 2) % 96 + '%', top: (p.y + 3) % 96 + '%',
                    width: (p.size * 0.9) + 'px', height: (p.size * 0.9) + 'px',
                    background: radialParticleBackground(accent, { highlight: 0.8, core: '9c', mid: '24', outer: '08' }),
                    boxShadow: particleGlow(accent, p.size, 0.38),
                    willChange: 'transform, opacity',
                }} />
            ))}
        </div>
    );
}

// ─── Lantern — Amber Lantern ──────────────────────────────────────────────────
// Firefly-like glowing dots floating gently across the full screen
function LanternOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-fly').forEach((el, i) => {
            const p = P_FIREFLY[i % P_FIREFLY.length];
            // Gentle bobbing movement
            gsap.to(el, {
                y: (p.spin - 0.5) * 22,
                x: (p.drift - 0.5) * 16,
                duration: 2.8 + p.drift * 3.2,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: p.delay,
            });
            // Separate opacity pulse (firefly blink)
            gsap.to(el, {
                opacity: p.opacity * 0.74,
                duration: 1.4 + p.spin * 1.8,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: p.delay * 0.4,
            });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Central warm lantern glow */}
            <div className="absolute top-1/4 left-1/4 w-2/4 h-1/2 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}0f 0%, transparent 65%)`,
                animation: 'themeLanternWarm 6s ease-in-out infinite',
            }} />
            {/* Bottom warmth gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-1/4" style={{
                background: `linear-gradient(0deg, ${accent}07 0%, transparent 100%)`,
            }} />
            {/* Top left secondary glow */}
            <div className="absolute -top-1/5 -left-1/8 w-1/3 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}07 0%, transparent 65%)`,
                animation: 'themeLanternWarm 9s 3s ease-in-out infinite',
            }} />

            {/* Firefly dots — full screen */}
            {P_FIREFLY.map(p => (
                <div key={p.id} className="p-fly absolute rounded-full" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (2.4 + p.size * 1.1) + 'px', height: (2.4 + p.size * 1.1) + 'px',
                    background: radialParticleBackground(accent, { highlight: 1, core: 'ff', mid: '7a', outer: '18' }),
                    boxShadow: particleGlow(accent, p.size + 2, 1.1),
                    opacity: 0,
                    willChange: 'transform, opacity',
                }} />
            ))}
        </div>
    );
}

// ─── Moon — Moonlit Cove ──────────────────────────────────────────────────────
// Silver stars twinkling across the full sky, crescent moon SVG accent
function MoonOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-star').forEach((el, i) => {
            const p = P_STARS[i % P_STARS.length];
            gsap.to(el, {
                opacity: p.opacity * 0.68,
                scale: 1.75,
                duration: 1.4 + p.spin * 2.8,
                repeat: -1,
                yoyo: true,
                ease: 'power1.inOut',
                delay: p.delay * 0.5,
            });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Moonlight column from top-center */}
            <div className="absolute -top-1/3 left-1/3 w-1/3 h-2/3" style={{
                background: `radial-gradient(ellipse at 50% 0%, ${accent}0b 0%, transparent 70%)`,
                animation: 'themeGlowPulse 10s ease-in-out infinite',
            }} />
            {/* Horizon shimmer */}
            <div className="absolute bottom-0 left-0 right-0 h-1/5" style={{
                background: `linear-gradient(0deg, ${accent}05 0%, transparent 100%)`,
            }} />
            {/* Upper-left secondary glow */}
            <div className="absolute top-1/6 -left-1/6 w-2/5 h-2/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}06 0%, transparent 65%)`,
                animation: 'themeGlowPulse 13s 5s ease-in-out infinite',
            }} />

            {/* Star field — full screen scatter */}
            {P_STARS.map(p => (
                <div key={p.id} className="p-star absolute rounded-full" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (p.size * 0.82 + 0.6) + 'px', height: (p.size * 0.82 + 0.6) + 'px',
                    background: radialParticleBackground(accent, { highlight: 1, core: 'd6', mid: '52', outer: '10' }),
                    opacity: p.opacity * 0.18,
                    boxShadow: `0 0 ${p.size * 1.2}px rgba(255,255,255,0.78), ${particleGlow(accent, p.size + 0.8, 0.6)}`,
                    willChange: 'transform, opacity',
                }} />
            ))}

            {/* Crescent moon — top right, very subtle */}
            <svg className="absolute top-6 right-10 opacity-[0.08]" width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M33 22C33 28.075 28.075 33 22 33C15.925 33 11 28.075 11 22C11 16.97 14.3 12.72 18.8 11.24C17.2 13.02 16.3 15.35 16.3 17.88C16.3 23.53 20.86 28.09 26.51 28.09C29.41 28.09 32.04 26.88 33.92 24.88C33.31 23.96 33 22.97 33 22Z" fill={accent} />
            </svg>
        </div>
    );
}

// ─── Rain — Rain Garden ───────────────────────────────────────────────────────
// Soft rain streaks distributed across the full screen, zen stone ripples
function RainOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-rain').forEach((el, i) => {
            const p = P_RAIN[i % P_RAIN.length];
            gsap.fromTo(el,
                { y: -(60 + p.drift * 180) + 'px', opacity: 0 },
                {
                    y: '110vh',
                    opacity: p.opacity * 0.36,
                    duration: 4.5 + p.drift * 4.5,
                    delay: p.delay * 0.7,
                    repeat: -1,
                    ease: 'none',
                }
            );
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Soft atmospheric blue-grey veil */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                background: `radial-gradient(ellipse at 30% 25%, ${accent}60 0%, transparent 50%), radial-gradient(ellipse at 72% 75%, ${accent}40 0%, transparent 45%)`,
            }} />
            {/* Top mist */}
            <div className="absolute -top-1/5 left-1/5 w-3/5 h-2/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}06 0%, transparent 65%)`,
                animation: 'themeMistDrift 20s ease-in-out infinite',
            }} />

            {/* Rain streaks — distributed across full width */}
            {P_RAIN.map(p => (
                <div key={p.id} className="p-rain absolute" style={{
                    left: p.x + '%',
                    top: p.y + '%',
                    width: (1 + p.size * 0.08) + 'px',
                    height: (14 + p.drift * 18) + 'px',
                    background: `linear-gradient(180deg, transparent 0%, ${accent}70 16%, rgba(255,255,255,0.92) 54%, ${accent}26 100%)`,
                    boxShadow: `0 0 ${1.5 + p.size * 0.3}px ${accent}44`,
                    opacity: 0,
                    borderRadius: '1px',
                    willChange: 'transform, opacity',
                }} />
            ))}

            {/* Stone ripple SVG — bottom center */}
            <svg className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-[0.055]" width="220" height="90" viewBox="0 0 220 90" fill="none">
                <ellipse cx="110" cy="45" rx="22" ry="9" stroke={accent} strokeWidth="0.9" />
                <ellipse cx="110" cy="45" rx="44" ry="17" stroke={accent} strokeWidth="0.7" />
                <ellipse cx="110" cy="45" rx="70" ry="26" stroke={accent} strokeWidth="0.55" />
                <ellipse cx="110" cy="45" rx="98" ry="36" stroke={accent} strokeWidth="0.4" />
                <ellipse cx="110" cy="45" rx="108" ry="42" stroke={accent} strokeWidth="0.3" />
            </svg>
        </div>
    );
}

// ─── Sakura — Cherry Blossom ──────────────────────────────────────────────────
// Petals drifting and rotating across the full screen, ornate branch SVG
function SakuraOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-petal').forEach((el, i) => {
            const p = P_PETALS[i % P_PETALS.length];
            gsap.timeline({ repeat: -1, delay: p.delay })
                .fromTo(el,
                    { opacity: 0, y: 0, rotation: (p.spin - 0.5) * 35, x: 0 },
                    { opacity: p.opacity * 0.58, duration: p.duration * 0.14, ease: 'power1.in' }
                )
                .to(el, {
                    opacity: 0,
                    y: 95 + p.drift * 65,
                    rotation: (p.spin - 0.5) * 85,
                    x: (p.spin - 0.5) * 44,
                    duration: p.duration * 0.86,
                    ease: 'sine.out',
                });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Soft pink atmospheric bloom — top */}
            <div className="absolute -top-1/4 left-1/5 w-3/5 h-2/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}12 0%, transparent 65%)`,
                animation: 'themeGlowPulse 9s ease-in-out infinite',
            }} />
            {/* Right mid bloom */}
            <div className="absolute top-1/2 -right-1/8 w-1/4 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}08 0%, transparent 65%)`,
                animation: 'themeGlowPulse 12s 5s ease-in-out infinite',
            }} />

            {/* Petal particles — full screen scatter */}
            {P_PETALS.map(p => (
                <div key={p.id} className="p-petal absolute" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (6 + p.size * 1.6) + 'px',
                    height: (3.8 + p.size * 1.05) + 'px',
                    background: `linear-gradient(135deg, rgba(255,255,255,0.92) 0%, ${accent}f2 32%, ${accent}c8 72%, ${accent}4a 100%)`,
                    borderRadius: '50% 50% 50% 0',
                    opacity: 0,
                    filter: `blur(${p.size * 0.18}px)`,
                    boxShadow: particleGlow(accent, p.size + 1.4, 0.6),
                    border: `1px solid ${accent}24`,
                    transformOrigin: 'center',
                    willChange: 'transform, opacity',
                }} />
            ))}

            {/* Sakura branch — top-right decorative art */}
            <svg className="absolute top-0 right-0 opacity-[0.15]" width="255" height="195" viewBox="0 0 255 195" fill="none">
                {/* Main branch */}
                <path d="M255 0 C236 21 221 43 205 63 C188 82 171 98 154 122 C141 141 132 159 124 178" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />
                {/* Upper sub-branch */}
                <path d="M205 63 C191 53 176 44 163 38" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
                {/* Mid sub-branch */}
                <path d="M171 98 C161 86 152 80 144 74" stroke={accent} strokeWidth="1.05" strokeLinecap="round" />
                {/* Lower sub-branch */}
                <path d="M154 122 C141 110 133 105 123 100" stroke={accent} strokeWidth="0.95" strokeLinecap="round" />
                {/* Tiny twig */}
                <path d="M220 42 C212 34 204 30 196 27" stroke={accent} strokeWidth="0.8" strokeLinecap="round" />

                {/* Blossom cluster 1 — upper branch tip */}
                <circle cx="161" cy="37" r="5" fill={accent} opacity="0.42" />
                <circle cx="155" cy="32" r="3.8" fill={accent} opacity="0.36" />
                <circle cx="167" cy="32" r="3.2" fill={accent} opacity="0.3" />
                <circle cx="159" cy="27" r="2.8" fill={accent} opacity="0.24" />
                <circle cx="168" cy="38" r="2.5" fill="white" opacity="0.14" />

                {/* Blossom cluster 2 — twig tip */}
                <circle cx="194" cy="26" r="4" fill={accent} opacity="0.32" />
                <circle cx="188" cy="22" r="3" fill={accent} opacity="0.26" />
                <circle cx="199" cy="22" r="2.5" fill={accent} opacity="0.22" />

                {/* Blossom cluster 3 — mid branch */}
                <circle cx="143" cy="73" r="4.5" fill={accent} opacity="0.36" />
                <circle cx="137" cy="68" r="3.5" fill={accent} opacity="0.3" />
                <circle cx="149" cy="68" r="3" fill={accent} opacity="0.24" />
                <circle cx="141" cy="63" r="2.5" fill={accent} opacity="0.2" />

                {/* Blossom cluster 4 — lower branch */}
                <circle cx="121" cy="99" r="4" fill={accent} opacity="0.3" />
                <circle cx="115" cy="94" r="3" fill={accent} opacity="0.24" />
                <circle cx="127" cy="94" r="2.5" fill={accent} opacity="0.2" />

                {/* Scattered loose petals near branch */}
                <circle cx="236" cy="18" r="2" fill={accent} opacity="0.18" />
                <circle cx="186" cy="52" r="1.8" fill={accent} opacity="0.16" />
                <circle cx="134" cy="86" r="1.6" fill={accent} opacity="0.14" />
                <circle cx="175" cy="110" r="1.5" fill={accent} opacity="0.12" />
            </svg>
        </div>
    );
}

// ─── Lavender — Lavender Dusk ─────────────────────────────────────────────────
// Tiny pollen/spore particles floating upward, deep purple atmospheric blooms
function LavenderOverlay({ accent, lightAtmosphere }) {
    const { container } = useGSAP(({ selector }) => {
        if (lightAtmosphere) return;
        selector('.p-pollen').forEach((el, i) => {
            const p = P_POLLEN[i % P_POLLEN.length];
            gsap.timeline({ repeat: -1, delay: p.delay })
                .fromTo(el,
                    { opacity: 0, y: 0, x: 0 },
                    { opacity: p.opacity * 0.4, duration: p.duration * 0.24, ease: 'sine.in' }
                )
                .to(el, {
                    opacity: 0,
                    y: -(18 + p.drift * 28),
                    x: (p.spin - 0.5) * 20,
                    duration: p.duration * 0.76,
                    ease: 'power1.out',
                });
        });
    }, [lightAtmosphere]);

    if (lightAtmosphere) {
        return <LightThemeAtmosphere accent={accent} containerRef={container} />;
    }

    return (
        <div ref={container}>
            {/* Deep atmospheric bloom — top-center */}
            <div className="absolute -top-1/4 left-1/6 w-2/3 h-3/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}0d 0%, transparent 65%)`,
                animation: 'themeColorBloom 11s ease-in-out infinite',
            }} />
            {/* Bottom right secondary bloom */}
            <div className="absolute bottom-1/5 -right-1/6 w-2/5 h-2/5 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}07 0%, transparent 65%)`,
                animation: 'themeColorBloom 15s 6s ease-in-out infinite',
            }} />
            {/* Left mid subtle bloom */}
            <div className="absolute top-2/5 -left-1/8 w-1/4 h-1/3 rounded-full" style={{
                background: `radial-gradient(ellipse, ${accent}05 0%, transparent 60%)`,
                animation: 'themeColorBloom 13s 3s ease-in-out infinite',
            }} />

            {/* Pollen spores — full screen scatter */}
            {P_POLLEN.map(p => (
                <div key={p.id} className="p-pollen absolute rounded-full" style={{
                    left: p.x + '%', top: p.y + '%',
                    width: (p.size * 0.95) + 'px', height: (p.size * 0.95) + 'px',
                    background: radialParticleBackground(accent, { highlight: 0.86, core: 'c8', mid: '38', outer: '10' }),
                    boxShadow: particleGlow(accent, p.size + 0.6, 0.55),
                    opacity: 0,
                    filter: `blur(${p.size * 0.16}px)`,
                    willChange: 'transform, opacity',
                }} />
            ))}
        </div>
    );
}
