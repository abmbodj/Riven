/**
 * Fireflies + pollen — the "alive" layer. Counts come entirely from the LOD
 * budget (already folded with status density, so at-risk/dormant settle quietly).
 * Positions are a deterministic golden-angle scatter, so they never reshuffle on
 * re-render. Glow is applied only when the budget allows it.
 */

const radialScatter = (count, cx, cy, rx, ry, angleOffset = 0) =>
    Array.from({ length: count }, (_, i) => {
        const angle = ((i * 137.5) + angleOffset) * (Math.PI / 180);
        const ratio = 0.22 + (((i + 1) / (count + 1)) * 0.78);
        return {
            x: cx + Math.cos(angle) * rx * ratio,
            y: cy + Math.sin(angle) * ry * ratio,
            scale: 0.68 + ((i % 4) * 0.14),
        };
    });

export default function ParticleField({ palette, ids, lod, status }) {
    const glow = lod.enableGlow ? `url(#${ids.glow})` : undefined;
    const quiet = status === 'broken' ? 0.4 : status === 'at-risk' ? 0.7 : 1;

    const fireflies = radialScatter(lod.fireflyCount, 220, 186, 150, 104, 11);
    const pollen = radialScatter(lod.pollenCount, 198, 222, 168, 126, 17);

    return (
        <>
            {fireflies.map((p, i) => (
                <g
                    key={`firefly-${i}`}
                    className="garden-drift garden-reveal"
                    data-x={i % 2 === 0 ? '2.5' : '-2.5'}
                    data-y={-3 - (i % 3)}
                    data-duration={7 + ((i % 5) * 0.7)}
                    data-parallax="near"
                >
                    <circle
                        cx={p.x}
                        cy={p.y}
                        r={2.1 * p.scale}
                        fill={palette.light}
                        opacity={0.8 * quiet}
                        filter={glow}
                        className="garden-twinkle"
                    />
                </g>
            ))}

            <g data-parallax="near" opacity={quiet}>
                {pollen.map((p, i) => (
                    <circle
                        key={`pollen-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={1.2 * p.scale}
                        fill={i % 3 === 0 ? palette.leafLight : palette.light}
                        opacity="0.4"
                        className="garden-drift garden-twinkle garden-reveal"
                        data-x={i % 2 === 0 ? '1.8' : '-1.8'}
                        data-y={-2 - (i % 2)}
                        data-duration={10 + ((i % 4) * 0.9)}
                    />
                ))}
            </g>
        </>
    );
}
