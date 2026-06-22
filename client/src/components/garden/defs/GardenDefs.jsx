/**
 * All palette-driven SVG <defs> for the garden scene: gradients + the (sparing)
 * blur/glow filters. Ids are per-instance (passed in) so multiple Gardens on one
 * page — e.g. the past-streaks gallery — never collide and cross-bleed fills.
 *
 * Filters are gated by the LOD budget: at most one canopy/atmosphere blur, never
 * per-element. When blur is off the scene still reads via the radial gradients.
 */

export default function GardenDefs({ palette, ids, lod }) {
    return (
        <defs>
            <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.skyTop} />
                <stop offset="58%" stopColor={palette.skyTop} stopOpacity="0.7" />
                <stop offset="100%" stopColor={palette.skyBottom} />
            </linearGradient>

            <linearGradient id={ids.hills} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.hillFar} stopOpacity="0.4" />
                <stop offset="100%" stopColor={palette.hillFar} />
            </linearGradient>
            <linearGradient id={ids.hillsNear} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.hillNear} stopOpacity="0.26" />
                <stop offset="100%" stopColor={palette.hillNear} />
            </linearGradient>

            <linearGradient id={ids.mist} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={palette.mist} stopOpacity="0" />
                <stop offset="50%" stopColor={palette.mist} stopOpacity="0.34" />
                <stop offset="100%" stopColor={palette.mist} stopOpacity="0" />
            </linearGradient>

            <radialGradient id={ids.pond} cx="50%" cy="45%" r="70%">
                <stop offset="0%" stopColor={palette.pondGlow} stopOpacity="0.82" />
                <stop offset="28%" stopColor={palette.pond} stopOpacity="0.88" />
                <stop offset="100%" stopColor={palette.hillNear} />
            </radialGradient>
            <linearGradient id={ids.reflection} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.light} stopOpacity="0.5" />
                <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
            </linearGradient>

            <linearGradient id={ids.island} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.island} />
                <stop offset="100%" stopColor={palette.bark} />
            </linearGradient>

            {/* Bark with a rim of light up one side for volume. */}
            <linearGradient id={ids.bark} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor={palette.bark} />
                <stop offset="72%" stopColor={palette.bark} />
                <stop offset="100%" stopColor={palette.light} stopOpacity="0.9" />
            </linearGradient>

            {/* Gem-like translucent leaf: saturated base lifting to a light edge. */}
            <linearGradient id={ids.leaf} x1="0" y1="1" x2="0.8" y2="0">
                <stop offset="0%" stopColor={palette.leaf} />
                <stop offset="100%" stopColor={palette.leafLight} />
            </linearGradient>

            {/* Soft foliage blob — front canopy mass. Lit core fading to a soft edge
                so overlapping blobs blend into one luminous crown (no per-blob blur). */}
            <radialGradient id={ids.foliage} cx="42%" cy="34%" r="68%">
                <stop offset="0%" stopColor={palette.leafLight} stopOpacity="0.96" />
                <stop offset="46%" stopColor={palette.leaf} stopOpacity="0.92" />
                <stop offset="100%" stopColor={palette.leaf} stopOpacity="0.16" />
            </radialGradient>
            {/* Deeper back-layer foliage for canopy volume/shadow. */}
            <radialGradient id={ids.foliageDeep} cx="50%" cy="46%" r="66%">
                <stop offset="0%" stopColor={palette.leaf} stopOpacity="0.78" />
                <stop offset="62%" stopColor={palette.bark} stopOpacity="0.5" />
                <stop offset="100%" stopColor={palette.bark} stopOpacity="0.08" />
            </radialGradient>

            <linearGradient id={ids.blossom} x1="0" y1="1" x2="0.75" y2="0">
                <stop offset="0%" stopColor={palette.blossom} />
                <stop offset="100%" stopColor={palette.light} />
            </linearGradient>

            {/* The single soft light source: moon glow / canopy glow / heart ember. */}
            <radialGradient id={ids.light} cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor={palette.light} stopOpacity="0.92" />
                <stop offset="44%" stopColor={palette.light} stopOpacity="0.44" />
                <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
            </radialGradient>

            {/* Warm ember used for at-risk / dormant states. */}
            <radialGradient id={ids.ember} cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={palette.blossomCore} stopOpacity="0.9" />
                <stop offset="55%" stopColor={palette.blossomCore} stopOpacity="0.35" />
                <stop offset="100%" stopColor={palette.blossomCore} stopOpacity="0" />
            </radialGradient>

            <radialGradient id={ids.vignette} cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={palette.skyTop} stopOpacity="0" />
                <stop offset="82%" stopColor={palette.hillNear} stopOpacity="0" />
                <stop offset="100%" stopColor={palette.hillNear} stopOpacity="0.18" />
            </radialGradient>

            {lod.enableBlur ? (
                <filter id={ids.blur}>
                    <feGaussianBlur stdDeviation="10" />
                </filter>
            ) : null}

            {lod.enableGlow ? (
                <filter id={ids.glow} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation={lod.enableBlur ? '4.5' : '2'} result="blurred" />
                    <feMerge>
                        <feMergeNode in="blurred" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            ) : null}
        </defs>
    );
}
