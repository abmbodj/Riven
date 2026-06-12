import { motion as Motion } from 'motion/react';
import { EFFECT_INTENSITY_OPTIONS, EFFECT_PRESETS } from './themeEditorConfig';
import {
    generateParticles,
    getParticleProfile,
    getThemeParticleTokens,
    particleGlow,
    radialParticleBackground,
    withAlpha
} from './themeParticles';

const THEME_ARCHETYPES = {
    'Riven': 'riven',
    'Riven Light': 'riven-light',
    'Manuscript': 'manuscript',
    'Deep Current': 'depths',
    'Signal Glass': 'signal',
};

const RIVEN_SPORES = generateParticles(1447, 22, { x: [7, 94], y: [8, 88] });
const RIVEN_LIGHT_MOTES = generateParticles(1448, 18, { x: [6, 94], y: [8, 88] });
const MANUSCRIPT_FIBERS = generateParticles(3811, 20, { x: [8, 92], y: [7, 90] });
const DEPTH_PARTICLES = generateParticles(5051, 22, { x: [6, 94], y: [12, 88] });
const SIGNAL_NODES = generateParticles(9001, 14, { x: [10, 90], y: [14, 84] });
const GLINTS = generateParticles(4242, 12, { x: [8, 92], y: [8, 86] });

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

function overlayClass(className) {
    return `absolute inset-0 overflow-hidden pointer-events-none ${className}`;
}

function StaticEffectWash({ theme, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);

    return (
        <div data-particle-overlay="static" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 18% 16%, ${withAlpha(accent, 0.16)} 0%, transparent 38%), radial-gradient(circle at 84% 18%, ${withAlpha(accent, 0.1)} 0%, transparent 36%), linear-gradient(180deg, transparent 0%, ${withAlpha(background, 0.12)} 100%)`
                }}
            />
            <div
                className="absolute inset-y-0 left-[14%] w-px"
                style={{ backgroundColor: withAlpha(accent, 0.28) }}
            />
            <div
                className="absolute inset-x-0 bottom-0 h-1/3"
                style={{ background: `linear-gradient(180deg, transparent 0%, ${withAlpha(accent, 0.1)} 100%)` }}
            />
        </div>
    );
}

function DustEffect({ theme, isHero, intensity, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const profile = getParticleProfile(intensity, isHero);
    const particles = generateParticles(6101 + profile.particles, profile.particles, { x: [7, 93], y: [10, 88] });

    return (
        <div data-particle-overlay="dust" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 20% 20%, ${withAlpha(accent, profile.glow)} 0%, transparent 48%), radial-gradient(circle at 78% 70%, ${withAlpha(accent, profile.glow * 0.48)} 0%, transparent 42%), linear-gradient(180deg, transparent 0%, ${withAlpha(background, 0.12)} 100%)`
                }}
            />
            {particles.map((particle) => (
                <Motion.div
                    key={particle.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${particle.size * (isHero ? 5.5 : 4)}px`,
                        height: `${particle.size * (isHero ? 5.5 : 4)}px`,
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        background: radialParticleBackground(accent, {
                            coreAlpha: 0.52 * profile.opacity,
                            midAlpha: 0.18 * profile.opacity,
                            outerAlpha: 0.06
                        }),
                        boxShadow: particleGlow(accent, particle.size + 1, profile.glow * 2.4),
                        willChange: 'transform, opacity',
                    }}
                    animate={{
                        y: [0, -(18 + particle.drift * profile.travel * 0.24), 0],
                        x: [0, (particle.spin - 0.5) * 18, 0],
                        opacity: [0.08, particle.opacity * profile.opacity, 0.06],
                        scale: [0.72, 1.08, 0.8],
                    }}
                    transition={{ duration: 5 + particle.duration, repeat: Infinity, delay: particle.delay * 0.28, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function StarsEffect({ theme, isHero, intensity, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const profile = getParticleProfile(intensity, isHero);
    const stars = generateParticles(7201 + profile.particles, profile.particles, { x: [6, 94], y: [6, 88] });

    return (
        <div data-particle-overlay="stars" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(135deg, ${withAlpha(background, 0.18)} 0%, ${withAlpha(accent, 0.16)} 100%)`
                }}
            />
            <div
                className="absolute -top-[12%] right-[-12%] h-[60%] w-[60%] rounded-full"
                style={{ background: `radial-gradient(circle, ${withAlpha(accent, profile.glow)} 0%, transparent 70%)` }}
            />
            {stars.map((star) => {
                const isGlint = star.id % 6 === 0;
                return (
                    <Motion.div
                        key={star.id}
                        className="absolute rounded-full"
                        style={{
                            width: `${(isGlint ? 2.2 : 1) + star.size}px`,
                            height: `${(isGlint ? 2.2 : 1) + star.size}px`,
                            left: `${star.x}%`,
                            top: `${star.y}%`,
                            background: radialParticleBackground(isGlint ? '#ffffff' : accent, {
                                highlight: 1,
                                coreAlpha: isGlint ? 0.88 : 0.62,
                                midAlpha: 0.28,
                                outerAlpha: 0.08
                            }),
                            boxShadow: `0 0 ${8 + star.size * 2}px ${withAlpha(accent, 0.5)}`,
                            willChange: 'transform, opacity',
                        }}
                        animate={{
                            opacity: [0.14, star.opacity * profile.opacity, 0.12],
                            scale: [0.8, isGlint ? 1.8 : 1.34, 0.88],
                        }}
                        transition={{ duration: 2.8 + star.duration * 0.42, repeat: Infinity, delay: star.delay * 0.24, ease: 'easeInOut' }}
                    />
                );
            })}
        </div>
    );
}

function BubblesEffect({ theme, isHero, intensity, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const profile = getParticleProfile(intensity, isHero);
    const bubbles = generateParticles(8301 + profile.particles, profile.particles, { x: [8, 92], y: [18, 82] });

    return (
        <div data-particle-overlay="bubbles" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse at 50% 100%, ${withAlpha(accent, profile.glow)} 0%, transparent 58%), linear-gradient(180deg, transparent 0%, ${withAlpha(background, 0.18)} 100%)`
                }}
            />
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    background: `repeating-linear-gradient(105deg, transparent 0%, ${withAlpha(accent, 0.08)} 8%, transparent 17%)`,
                    animation: 'themeCaustic 8s ease-in-out infinite',
                }}
            />
            {bubbles.map((bubble) => (
                <Motion.div
                    key={bubble.id}
                    className="absolute rounded-full border"
                    style={{
                        width: `${5 + bubble.size * 5}px`,
                        height: `${5 + bubble.size * 5}px`,
                        left: `${bubble.x}%`,
                        bottom: '-10%',
                        borderColor: withAlpha(accent, 0.36),
                        backgroundColor: withAlpha(accent, 0.08),
                        boxShadow: particleGlow(accent, bubble.size + 1, profile.glow * 1.5),
                        willChange: 'transform, opacity',
                    }}
                    animate={{
                        y: [0, -profile.travel],
                        x: [0, (bubble.spin - 0.5) * 28],
                        opacity: [0, bubble.opacity * profile.opacity, 0],
                    }}
                    transition={{ duration: 4.2 + bubble.duration * 0.52, repeat: Infinity, delay: bubble.delay * 0.24, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
}

function GridEffect({ theme, isHero, intensity, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const profile = getParticleProfile(intensity, isHero);
    const nodes = generateParticles(9401 + profile.nodes, profile.nodes, { x: [12, 88], y: [16, 82] });

    return (
        <div data-particle-overlay="grid" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(145deg, ${withAlpha(background, 0.18)} 0%, ${withAlpha(accent, 0.14)} 100%)`
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `linear-gradient(${withAlpha(accent, 0.1)} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(accent, 0.07)} 1px, transparent 1px)`,
                    backgroundSize: isHero ? '22px 22px' : '14px 14px'
                }}
            />
            <Motion.div
                className="absolute inset-x-0 h-px"
                style={{
                    top: '20%',
                    background: `linear-gradient(90deg, transparent 0%, ${withAlpha(accent, 0.36)} 50%, transparent 100%)`,
                    boxShadow: `0 0 18px ${withAlpha(accent, 0.22)}`,
                }}
                animate={{ y: ['0%', isHero ? '190px' : '92px'], opacity: [0, 0.8, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div
                className="absolute inset-y-0 right-[14%] w-[36%]"
                style={{
                    background: `linear-gradient(180deg, transparent 0%, ${withAlpha(accent, 0.2)} 24%, ${withAlpha(accent, 0.04)} 100%)`,
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
                        backgroundColor: accent,
                        boxShadow: particleGlow(accent, node.size + 1, 1.1),
                        willChange: 'transform, opacity',
                    }}
                    animate={{ opacity: [0.84, 0.16, 0.84], scale: [1, 1.58, 1] }}
                    transition={{ duration: 1.5 + node.delay * 0.14, repeat: Infinity, delay: node.delay * 0.18 }}
                />
            ))}
        </div>
    );
}

function OverlayRiven({ theme, isHero, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const spores = isHero ? RIVEN_SPORES : RIVEN_SPORES.slice(0, 10);

    return (
        <div data-particle-overlay="riven" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 20% 18%, ${withAlpha(accent, 0.17)} 0%, transparent 42%), radial-gradient(circle at 76% 72%, ${withAlpha('#4e7f71', 0.14)} 0%, transparent 48%), linear-gradient(180deg, transparent 0%, ${withAlpha(background, 0.18)} 100%)`
                }}
            />
            <div
                className="absolute inset-y-0 right-[18%] w-[30%]"
                style={{
                    background: `linear-gradient(180deg, transparent 0%, ${withAlpha(accent, 0.16)} 38%, transparent 100%)`,
                    clipPath: 'polygon(66% 0, 100% 0, 48% 100%, 14% 100%)',
                    animation: 'themeShimmer 7.5s ease-in-out infinite',
                }}
            />
            {spores.map((spore) => (
                <Motion.div
                    key={spore.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${1.8 + spore.size * (isHero ? 2.8 : 1.8)}px`,
                        height: `${1.8 + spore.size * (isHero ? 2.8 : 1.8)}px`,
                        left: `${spore.x}%`,
                        top: `${spore.y}%`,
                        background: radialParticleBackground(accent, { coreAlpha: 0.62, midAlpha: 0.2, outerAlpha: 0.05 }),
                        boxShadow: particleGlow(accent, spore.size + 1, 0.62),
                    }}
                    animate={{
                        y: [0, -(16 + spore.drift * 34), 0],
                        x: [0, (spore.spin - 0.5) * 22, 0],
                        opacity: [0.08, spore.opacity * 0.86, 0.08],
                    }}
                    transition={{ duration: 6 + spore.duration * 0.55, repeat: Infinity, delay: spore.delay * 0.22, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function OverlayRivenLight({ theme, isHero, className = '' }) {
    const { accent } = getThemeParticleTokens(theme);
    const motes = isHero ? RIVEN_LIGHT_MOTES : RIVEN_LIGHT_MOTES.slice(0, 9);

    return (
        <div data-particle-overlay="riven-light" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 18% 16%, ${withAlpha(accent, 0.16)} 0%, transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.26) 0%, ${withAlpha('#f3eadf', 0.34)} 100%)`
                }}
            />
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(86,72,50,0.12) 1px, transparent 0)',
                    backgroundSize: '10px 10px',
                }}
            />
            {motes.map((mote) => (
                <Motion.div
                    key={mote.id}
                    className="absolute rounded-full"
                    style={{
                        width: `${1.4 + mote.size * (isHero ? 2.5 : 1.6)}px`,
                        height: `${1.4 + mote.size * (isHero ? 2.5 : 1.6)}px`,
                        left: `${mote.x}%`,
                        top: `${mote.y}%`,
                        background: radialParticleBackground(accent, { highlight: 0.96, coreAlpha: 0.5, midAlpha: 0.18, outerAlpha: 0.04 }),
                        boxShadow: particleGlow(accent, mote.size + 1, 0.44),
                    }}
                    animate={{
                        opacity: [0.08, mote.opacity * 0.72, 0.08],
                        y: [0, -(8 + mote.drift * 20), 0],
                    }}
                    transition={{ duration: 6.5 + mote.duration * 0.5, repeat: Infinity, delay: mote.delay * 0.24, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function OverlayManuscript({ theme, isHero, className = '' }) {
    const { accent, text } = getThemeParticleTokens(theme);
    const flecks = isHero ? MANUSCRIPT_FIBERS : MANUSCRIPT_FIBERS.slice(0, 10);

    return (
        <div data-particle-overlay="manuscript" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg, rgba(255,255,255,0.5) 0%, ${withAlpha(accent, 0.1)} 100%)`
                }}
            />
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    backgroundImage: `linear-gradient(${withAlpha(text, 0.04)} 1px, transparent 1px), radial-gradient(circle at 1px 1px, ${withAlpha(accent, 0.12)} 1px, transparent 0)`,
                    backgroundSize: '100% 22px, 11px 11px',
                }}
            />
            <div
                className="absolute inset-y-0 left-[18%] w-px"
                style={{ background: `linear-gradient(180deg, transparent 0%, ${withAlpha(accent, 0.4)} 36%, transparent 100%)` }}
            />
            {flecks.map((fleck) => (
                <Motion.div
                    key={fleck.id}
                    className="absolute"
                    style={{
                        width: `${3 + fleck.size * 2.4}px`,
                        height: '1px',
                        left: `${fleck.x}%`,
                        top: `${fleck.y}%`,
                        background: withAlpha(text, 0.18 + fleck.opacity * 0.22),
                        borderRadius: '999px',
                        transform: `rotate(${(fleck.spin - 0.5) * 26}deg)`,
                    }}
                    animate={{ opacity: [0.1, fleck.opacity * 0.74, 0.1], x: [0, (fleck.spin - 0.5) * 10, 0] }}
                    transition={{ duration: 5 + fleck.duration * 0.5, repeat: Infinity, delay: fleck.delay * 0.2, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function OverlayDepths({ theme, isHero, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const particles = isHero ? DEPTH_PARTICLES : DEPTH_PARTICLES.slice(0, 10);

    return (
        <div data-particle-overlay="depths" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg, ${withAlpha(background, 0.12)} 0%, ${withAlpha('#001a2e', 0.36)} 54%, ${withAlpha(accent, 0.16)} 100%)`
                }}
            />
            <div
                className="absolute inset-0 opacity-70"
                style={{
                    background: `repeating-linear-gradient(105deg, transparent 0%, ${withAlpha(accent, 0.1)} 8%, transparent 18%)`,
                    animation: 'themeCaustic 8.5s ease-in-out infinite',
                }}
            />
            {particles.map((particle) => {
                const isBubble = particle.id % 4 === 0;
                return (
                    <Motion.div
                        key={particle.id}
                        className="absolute rounded-full"
                        style={{
                            width: `${isBubble ? 4 + particle.size * 3 : 2 + particle.size * 1.4}px`,
                            height: `${isBubble ? 4 + particle.size * 3 : 2 + particle.size * 1.4}px`,
                            left: `${particle.x}%`,
                            bottom: isBubble ? '-8%' : `${particle.y}%`,
                            border: isBubble ? `1px solid ${withAlpha(accent, 0.32)}` : undefined,
                            background: isBubble
                                ? withAlpha(accent, 0.07)
                                : radialParticleBackground(accent, { coreAlpha: 0.46, midAlpha: 0.16, outerAlpha: 0.05 }),
                            boxShadow: particleGlow(accent, particle.size + 1, isBubble ? 0.34 : 0.68),
                        }}
                        animate={isBubble
                            ? { y: [0, -(isHero ? 180 : 96)], x: [0, (particle.spin - 0.5) * 22], opacity: [0, 0.62, 0] }
                            : { y: [0, -(12 + particle.drift * 18), 0], opacity: [0.08, particle.opacity * 0.76, 0.08] }}
                        transition={{ duration: 4.8 + particle.duration * 0.5, repeat: Infinity, delay: particle.delay * 0.24, ease: 'easeInOut' }}
                    />
                );
            })}
        </div>
    );
}

function OverlaySignal({ theme, isHero, className = '' }) {
    const { accent, background } = getThemeParticleTokens(theme);
    const nodes = isHero ? SIGNAL_NODES : SIGNAL_NODES.slice(0, 7);
    const rings = isHero ? [112, 150, 192] : [70, 98];

    return (
        <div data-particle-overlay="signal" className={overlayClass(className)}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(145deg, ${withAlpha(background, 0.34)} 0%, ${withAlpha(accent, 0.14)} 100%)`
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `linear-gradient(${withAlpha(accent, 0.1)} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(accent, 0.07)} 1px, transparent 1px)`,
                    backgroundSize: isHero ? '22px 22px' : '12px 12px',
                }}
            />
            {rings.map((size, index) => (
                <div
                    key={size}
                    className="absolute rounded-full border"
                    style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        right: isHero ? `${18 + index * 8}px` : `${10 + index * 6}px`,
                        top: isHero ? `${8 + index * 16}px` : `${4 + index * 10}px`,
                        borderColor: withAlpha(accent, 0.2 - index * 0.04),
                        boxShadow: index === 0 ? `0 0 32px ${withAlpha(accent, 0.14)}` : 'none',
                    }}
                />
            ))}
            <Motion.div
                className="absolute inset-y-0 right-[14%] w-[36%]"
                style={{
                    background: `linear-gradient(180deg, transparent 0%, ${withAlpha(accent, 0.22)} 18%, ${withAlpha(accent, 0.04)} 100%)`,
                    clipPath: 'polygon(58% 0, 100% 0, 46% 100%, 4% 100%)',
                }}
                animate={{ opacity: [0.28, 0.7, 0.28] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
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
                        backgroundColor: accent,
                        boxShadow: particleGlow(accent, node.size + 1, 1.1),
                    }}
                    animate={{ opacity: [1, 0.12, 1], scale: [1, 1.52, 1] }}
                    transition={{ duration: 1.3 + node.delay * 0.16, repeat: Infinity, delay: node.delay * 0.18 }}
                />
            ))}
            {GLINTS.slice(0, isHero ? 6 : 3).map((glint) => (
                <Motion.div
                    key={glint.id}
                    className="absolute h-px"
                    style={{
                        width: `${18 + glint.size * 8}px`,
                        left: `${glint.x}%`,
                        top: `${glint.y}%`,
                        background: `linear-gradient(90deg, transparent, ${withAlpha(accent, 0.54)}, transparent)`,
                    }}
                    animate={{ opacity: [0, 0.72, 0], x: [0, 24] }}
                    transition={{ duration: 2.4 + glint.duration * 0.22, repeat: Infinity, delay: glint.delay * 0.22, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function DefaultThemeOverlay({ theme, isHero, className = '' }) {
    const archetype = THEME_ARCHETYPES[theme?.name] || 'default';

    switch (archetype) {
        case 'riven':
            return <OverlayRiven theme={theme} isHero={isHero} className={className} />;
        case 'riven-light':
            return <OverlayRivenLight theme={theme} isHero={isHero} className={className} />;
        case 'manuscript':
            return <OverlayManuscript theme={theme} isHero={isHero} className={className} />;
        case 'depths':
            return <OverlayDepths theme={theme} isHero={isHero} className={className} />;
        case 'signal':
            return <OverlaySignal theme={theme} isHero={isHero} className={className} />;
        default:
            return null;
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
            : <DefaultThemeOverlay theme={theme} isHero={isHero} className={className} />;
    }

    return simplifyMotion
        ? <StaticEffectWash theme={theme} className={className} />
        : <CustomThemeOverlay theme={theme} preset={preset} isHero={isHero} className={className} />;
}
