/**
 * The hero: a wide blossoming heritage tree rendered from the deterministic
 * skeleton.
 *
 * The crown is NOT individual leaves — it's a few large, overlapping soft-gradient
 * "foliage blobs" (clusters) that read as one broad luminous mass, matching the
 * flat/graphic background. Growth reveals more clusters/branches/blossoms (already
 * filtered in buildTree) and scales the whole tree via a single transform, so it
 * spreads up and out from the island without the path data ever changing.
 *
 * "Wow but calm": a broad grand canopy + a soft glow + a persistent heart ember;
 * motion is one slow sway. The ember stays lit through at-risk/dormant states so
 * the tree always reads as alive, ready to rebloom.
 */

function BlossomDot({ x, y, scale, coreFill, glowFill }) {
    return (
        <g transform={`translate(${x} ${y})`} className="garden-twinkle" data-origin={`${x}px ${y}px`}>
            <circle r={3.4 * scale} fill={glowFill} opacity="0.4" />
            <circle r={1.5 * scale} fill={coreFill} />
        </g>
    );
}

export default function HeroTree({ tree, palette, ids, status }) {
    const { baseX, baseY, scale, branches, clusters, blossoms } = tree;

    const foliageFill = `url(#${ids.foliage})`;
    const foliageDeepFill = `url(#${ids.foliageDeep})`;
    const blossomFill = `url(#${ids.blossom})`;
    const barkStroke = `url(#${ids.bark})`;
    const lightFill = `url(#${ids.light})`;
    const emberFill = `url(#${ids.ember})`;

    const dormant = status === 'broken';
    const atRisk = status === 'at-risk';
    const foliageOpacity = dormant ? 0.42 : atRisk ? 0.8 : 1;
    const blossomOpacity = dormant ? 0.28 : atRisk ? 0.68 : 1;
    const emberOpacity = dormant ? 0.9 : atRisk ? 0.72 : 0.26;

    const hasCanopy = clusters.length > 0;

    // Frame the soft glow to the actual crown bounds so it stays behind the mass.
    let glow = null;
    if (hasCanopy) {
        const xs = clusters.map((c) => c.x);
        const ys = clusters.map((c) => c.y);
        const rMax = Math.max(...clusters.map((c) => c.r));
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        glow = {
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            rx: (maxX - minX) / 2 + rMax * 0.9,
            ry: (maxY - minY) / 2 + rMax * 0.8,
        };
    }

    const scaleTransform = `translate(${baseX} ${baseY}) scale(${scale}) translate(${-baseX} ${-baseY})`;

    return (
        <g data-parallax="mid" transform={scaleTransform}>
            <g className="garden-sway garden-reveal" data-origin={`${baseX}px ${baseY}px`} data-rotate="0.4" data-duration="13">
                {/* Soft canopy glow behind the crown. */}
                {glow ? (
                    <ellipse
                        cx={glow.cx}
                        cy={glow.cy}
                        rx={glow.rx}
                        ry={glow.ry}
                        fill={lightFill}
                        opacity={dormant ? 0.06 : 0.18}
                        className="garden-breath"
                    />
                ) : null}

                {/* Branches (deepest first so the trunk reads on top). */}
                {branches.map((b, i) => (
                    <path
                        key={`branch-${i}`}
                        d={b.d}
                        fill="none"
                        stroke={barkStroke}
                        strokeWidth={b.width}
                        strokeLinecap="round"
                    />
                ))}

                {/* Heart ember at the trunk fork — life that never goes out. */}
                <circle
                    cx={baseX}
                    cy={baseY - 40}
                    r="15"
                    fill={emberFill}
                    opacity={emberOpacity}
                    className="garden-breath"
                    data-origin={`${baseX}px ${baseY - 40}px`}
                />

                {/* Foliage crown: deep back layer first, then the lit front blobs.
                    Overlapping translucent radials merge into one luminous mass. */}
                <g opacity={foliageOpacity}>
                    {clusters.map((c, i) => (
                        <ellipse
                            key={`back-${i}`}
                            cx={c.x}
                            cy={c.y + c.r * 0.12}
                            rx={c.r * 1.12}
                            ry={c.r * 1.0}
                            fill={foliageDeepFill}
                        />
                    ))}
                    {clusters.map((c, i) => (
                        <ellipse
                            key={`front-${i}`}
                            cx={c.x}
                            cy={c.y}
                            rx={c.r}
                            ry={c.r * 0.92}
                            fill={foliageFill}
                            className={i % 3 === 0 ? 'garden-breath' : undefined}
                            data-origin={`${c.x}px ${c.y}px`}
                        />
                    ))}
                </g>

                {/* Blossoms — luminous dot accents (mature chapters only). */}
                <g opacity={blossomOpacity}>
                    {blossoms.map((b, i) => (
                        <BlossomDot
                            key={`blossom-${i}`}
                            x={b.x}
                            y={b.y}
                            scale={b.scale}
                            coreFill={palette.blossomCore}
                            glowFill={blossomFill}
                        />
                    ))}
                </g>
            </g>
        </g>
    );
}
