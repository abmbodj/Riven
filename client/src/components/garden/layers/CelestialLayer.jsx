/**
 * Sky cast: the moon (the scene's single light source), a deterministic starfield
 * and — late in the journey — a quiet constellation. Everything fades in with the
 * light arc: a hint at dusk, prominent under the moonlit canopy, full at cosmic.
 */

const STAR_PATH = 'M0 -6 Q2.8 -2.2 6 0 Q2.8 2.2 0 6 Q-2.8 2.2 -6 0 Q-2.8 -2.2 0 -6 Z';
const range = (n) => Array.from({ length: n }, (_, i) => i);

export default function CelestialLayer({ palette, ids, lod, growth, moon }) {
    const { chapterIndex, globalGrowth } = growth;
    const lightFill = `url(#${ids.light})`;
    const isNight = chapterIndex >= 3; // blue hour onward

    // Moon brightens as the journey matures.
    const moonOpacity = 0.55 + 0.4 * globalGrowth;
    const glowOpacity = 0.18 + 0.2 * globalGrowth;

    const starCount = isNight ? lod.starCount : Math.round(lod.starCount * 0.25);
    const stars = range(starCount).map((i) => ({
        x: 34 + ((i * 47) % 320),
        y: 26 + ((i * 29) % 118),
        scale: 0.58 + ((i % 4) * 0.12),
        opacity: 0.3 + ((i % 3) * 0.14),
    }));

    const showConstellation = lod.enableConstellations && chapterIndex >= 5;
    const constellationPoints = showConstellation
        ? range(5).map((i) => ({
            x: 54 + ((i * 62) % 250),
            y: 32 + ((i * 23) % 82),
            scale: 0.84 + ((i % 3) * 0.16),
        }))
        : [];
    const constellationPath = constellationPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
        .join(' ');

    return (
        <g data-parallax="far">
            {/* Moon glow + disc. */}
            <ellipse
                cx={moon.x}
                cy={moon.y}
                rx={moon.r * 1.7}
                ry={moon.r * 1.45}
                fill={lightFill}
                opacity={glowOpacity}
                className="garden-breath garden-reveal"
            />
            <circle
                cx={moon.x}
                cy={moon.y}
                r={moon.r}
                fill={palette.light}
                opacity={moonOpacity}
                className="garden-breath garden-reveal"
            />

            {/* Starfield. */}
            {stars.map((star, i) => (
                <path
                    key={`star-${i}`}
                    d={STAR_PATH}
                    transform={`translate(${star.x} ${star.y}) scale(${star.scale})`}
                    fill={palette.star}
                    opacity={star.opacity}
                    className="garden-twinkle garden-reveal"
                />
            ))}

            {/* Quiet constellation (cosmic chapters). */}
            {constellationPoints.length ? (
                <g className="garden-reveal" opacity="0.5">
                    <path
                        d={constellationPath}
                        fill="none"
                        stroke={palette.light}
                        strokeWidth="0.9"
                        strokeDasharray="6 16"
                        strokeLinecap="round"
                        opacity="0.4"
                        className="garden-drift"
                        data-x="2"
                        data-y="-1.2"
                        data-duration="18"
                    />
                    {constellationPoints.map((p, i) => (
                        <g key={`constellation-${i}`} className="garden-twinkle" data-origin={`${p.x}px ${p.y}px`}>
                            <path
                                d={STAR_PATH}
                                transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}
                                fill={i % 2 === 0 ? palette.light : palette.leafLight}
                                opacity="0.55"
                            />
                        </g>
                    ))}
                </g>
            ) : null}
        </g>
    );
}
