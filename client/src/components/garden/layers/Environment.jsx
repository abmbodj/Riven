/**
 * The backdrop the hero tree lives in: sky, parallax hills, drifting mist, the
 * pond with its moon reflection and ripples, and the central island the tree
 * grows from. All colours come from the interpolated palette; motion comes from
 * the shared class names driven by useGardenMotion.
 */

const range = (n) => Array.from({ length: n }, (_, i) => i);

export default function Environment({ palette, ids, lod, moon }) {
    const blur = lod.enableBlur ? `url(#${ids.blur})` : undefined;
    const rippleCount = lod.rank >= 2 ? 4 : 3;

    return (
        <g>
            <rect x="0" y="0" width="400" height="400" fill={`url(#${ids.sky})`} />

            {/* Far + near hills (parallax). */}
            <path
                d="M-24 216 C 46 176 110 170 176 190 C 234 208 298 212 424 182 L424 400 L-24 400 Z"
                fill={`url(#${ids.hills})`}
                className="garden-reveal"
                data-parallax="far"
            />
            <path
                d="M-24 246 C 36 214 108 208 180 222 C 250 236 318 240 424 220 L424 400 L-24 400 Z"
                fill={`url(#${ids.hillsNear})`}
                opacity="0.92"
                className="garden-reveal"
                data-parallax="mid"
            />
            <path
                d="M-24 234 C 52 204 142 206 240 226 C 312 242 360 244 424 230"
                fill="none"
                stroke={`url(#${ids.mist})`}
                strokeWidth="20"
                strokeLinecap="round"
                className="garden-drift garden-reveal"
                data-x="6"
                data-y="0"
                data-duration="20"
                data-parallax="far"
            />

            {/* Pond. */}
            <ellipse
                cx="200"
                cy="314"
                rx="168"
                ry="54"
                fill={`url(#${ids.pond})`}
                className="garden-reveal"
                data-parallax="mid"
            />
            {/* Moon reflection on the water. */}
            <ellipse
                cx={moon.x - 12}
                cy="278"
                rx="24"
                ry="74"
                fill={`url(#${ids.reflection})`}
                opacity="0.34"
                filter={blur}
                className="garden-breath garden-reveal"
                data-parallax="mid"
            />
            <ellipse
                cx="206"
                cy="290"
                rx="128"
                ry="22"
                fill={palette.light}
                opacity="0.08"
                filter={blur}
                className="garden-breath garden-reveal"
                data-parallax="mid"
            />
            {range(rippleCount).map((i) => (
                <ellipse
                    key={`ripple-${i}`}
                    cx="200"
                    cy={304 + i * 10}
                    rx={54 + i * 26}
                    ry={8 + i * 2.4}
                    fill="none"
                    stroke={palette.light}
                    strokeOpacity={0.16 - i * 0.024}
                    strokeWidth="1.25"
                    className="garden-ripple garden-reveal"
                    data-opacity={0.16 - i * 0.024}
                    data-parallax="near"
                />
            ))}

            {/* Central island — symmetric around x=200 so it frames the tree cleanly. */}
            <g data-parallax="mid" className="garden-reveal">
                <path
                    d="M78 296 C 90 268 146 252 200 252 C 254 252 310 268 322 296 C 318 320 274 340 200 340 C 126 340 82 320 78 296 Z"
                    fill={`url(#${ids.island})`}
                />
                <path
                    d="M118 284 C 148 270 174 264 200 264 C 226 264 252 270 282 284 C 258 294 232 300 200 300 C 168 300 142 294 118 284 Z"
                    fill={palette.pondGlow}
                    opacity="0.18"
                />
                <ellipse cx="200" cy="298" rx="104" ry="18" fill={palette.light} opacity="0.05" className="garden-breath" />
            </g>
        </g>
    );
}
