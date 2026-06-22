/**
 * Deterministic hero-tree generator (the blossoming heritage tree).
 *
 * Core idea: generate the FULL mature skeleton once, deterministically, seeded by
 * a STABLE seed (never the streak). Every branch/cluster/blossom carries an
 * `appearAt` threshold in 0..1. Growth then simply REVEALS everything whose
 * threshold <= globalGrowth. So:
 *   - same (growth, seed, lod)  -> byte-identical output (deterministic)
 *   - higher growth             -> a strict superset, existing paths unchanged
 *     (the tree adds branches as it grows; it never reshuffles into a new tree)
 *
 * Form: a WIDE heritage canopy. The trunk is short and forks low; limbs spread
 * outward (oak-like) so the crown is broad, not a vertical lollipop. The foliage
 * is NOT individual leaves — each outer branch tip anchors a soft "cluster" blob,
 * and overlapping blobs read as one flat, luminous mass matching the graphic
 * background. Blossoms are luminous dot accents on the crown (mature chapters).
 *
 * Overall size is applied as a render-time transform in HeroTree (the `scale`
 * field), NOT baked into path data, so path coordinates stay constant across days.
 */

const BASE_X = 200;
const BASE_Y = 300;
const TRUNK_LENGTH = 48;
const TRUNK_WIDTH = 19;
// Keep limbs from ever pointing below the horizon (no down-curling branches).
const MAX_ABS_ANGLE = 1.32;

// Small, fast, deterministic PRNG (mulberry32).
function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const round = (n, p = 2) => {
    const f = 10 ** p;
    return Math.round(n * f) / f;
};

const clampAngle = (a) => Math.max(-MAX_ABS_ANGLE, Math.min(MAX_ABS_ANGLE, a));
const byAppearAt = (a, b) => a.appearAt - b.appearAt;

/**
 * Build the growth-independent mature skeleton for a seed + max depth.
 * Cached so repeated buildTree calls at different growth reuse the same skeleton.
 */
const skeletonCache = new Map();

function buildSkeleton(seed, maxDepth) {
    const cacheKey = `${seed}:${maxDepth}`;
    const cached = skeletonCache.get(cacheKey);
    if (cached) return cached;

    const rng = mulberry32(seed);
    const branches = [];
    const clusters = [];
    const blossoms = [];

    // The branch skeleton reveals quickly (it mostly hides under the foliage); the
    // sense of growth comes from the crown filling out + scale. Branches by depth
    // are all in by ~BRANCH_DONE so a young tree already has limbs to hang foliage.
    const BRANCH_DONE = 0.22;

    const grow = (x, y, angle, length, width, depth) => {
        const ex = x + Math.sin(angle) * length;
        const ey = y - Math.cos(angle) * length;
        // Gentle organic bow via a quadratic control point.
        const cx = x + Math.sin(angle) * length * 0.5 + (rng() - 0.5) * length * 0.2;
        const cy = y - Math.cos(angle) * length * 0.5;
        const branchAppear = round((depth / maxDepth) * BRANCH_DONE, 4);

        branches.push({
            d: `M${round(x)} ${round(y)} Q${round(cx)} ${round(cy)} ${round(ex)} ${round(ey)}`,
            width: round(width, 2),
            depth,
            appearAt: branchAppear,
        });

        const isTerminal = depth >= maxDepth;
        if (isTerminal) {
            // One soft foliage blob anchors each outer tip. Overlapping blobs read
            // as a single broad luminous crown (flat/graphic, no individual leaves).
            const r = round(30 + rng() * 14, 1);
            clusters.push({
                x: round(ex),
                y: round(ey - r * 0.18),
                r,
                depth,
                branchAppear,
                appearAt: 1, // assigned below from crown geometry
            });
            // Blossoms are luminous dot accents on the crown, mature chapters only.
            // They roll in from the moonlit chapter (g ~0.82) onward.
            if (rng() < 0.7) {
                blossoms.push({
                    x: round(ex + (rng() - 0.5) * r * 0.7),
                    y: round(ey - r * 0.2 + (rng() - 0.5) * r * 0.6),
                    scale: round(0.7 + rng() * 0.7, 3),
                    appearAt: round(0.82 + rng() * 0.12, 4),
                });
            }
            return;
        }

        // Trunk (depth 0) forks low into two leads; limbs above fan out wide so the
        // crown spreads horizontally (heritage oak), not straight up.
        const childCount = depth === 0 ? 2 : (rng() < 0.5 ? 3 : 2);
        const spread = 0.52 + depth * 0.05;
        for (let i = 0; i < childCount; i += 1) {
            const dir = childCount === 1 ? 0 : i - (childCount - 1) / 2;
            // Outward bias grows with depth so limbs reach away from the trunk,
            // widening the canopy; capped so nothing curls below the horizon.
            const outward = Math.sign(dir) * spread * 0.6 * Math.min(depth, 3);
            const childAngle = clampAngle(angle + dir * spread + outward + (rng() - 0.5) * 0.14);
            const childLength = length * (0.76 + rng() * 0.06);
            const childWidth = width * 0.68;
            grow(ex, ey, childAngle, childLength, childWidth, depth + 1);
        }
    };

    grow(BASE_X, BASE_Y, 0, TRUNK_LENGTH, TRUNK_WIDTH, 0);

    // Schedule the crown to fill from its centre outward across the whole journey:
    // central blobs appear early (small young crown), outer blobs roll in by ~0.82.
    // Each blob never reveals before the branch that carries it.
    if (clusters.length) {
        const cenX = clusters.reduce((s, c) => s + c.x, 0) / clusters.length;
        const cenY = clusters.reduce((s, c) => s + c.y, 0) / clusters.length;
        const dist = (c) => Math.hypot(c.x - cenX, c.y - cenY);
        clusters.sort((a, b) => dist(a) - dist(b) || b.r - a.r);
        const n = clusters.length;
        clusters.forEach((c, i) => {
            const fill = n > 1 ? i / (n - 1) : 0;
            c.appearAt = round(Math.max(lerp(0.16, 0.82, fill), c.branchAppear + 0.01), 4);
            delete c.branchAppear;
        });
        clusters.sort((a, b) => a.appearAt - b.appearAt || b.r - a.r);
    }

    branches.sort(byAppearAt);
    blossoms.sort(byAppearAt);

    const skeleton = { baseX: BASE_X, baseY: BASE_Y, branches, clusters, blossoms, maxDepth };
    skeletonCache.set(cacheKey, skeleton);
    return skeleton;
}

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Build the visible tree for a given growth value.
 *
 * @param {number} growth   0..1 (globalGrowth from resolveGrowth); reveal threshold
 * @param {number} seed     STABLE integer seed (do not derive from the streak)
 * @param {{branchDepth?:number, clusterCount?:number, blossomCount?:number}} lod
 */
export function buildTree(growth = 0, seed = 0x1a4e, lod = {}) {
    const g = clamp01(growth);
    // Cap structural depth: the foliage mass covers fine branching, so a few bold
    // limbs + a dozen big overlapping blobs read better (and cheaper) than a
    // thicket of twigs. Depth 3 yields ~12 crown blobs.
    const maxDepth = Math.min(lod.branchDepth ?? 4, 3);
    const clusterCap = lod.clusterCount ?? 18;
    const blossomCap = lod.blossomCount ?? 32;

    const skeleton = buildSkeleton(seed, maxDepth);

    const branches = skeleton.branches.filter((b) => g >= b.appearAt);
    const clusters = skeleton.clusters.filter((c) => g >= c.appearAt).slice(0, clusterCap);
    const blossoms = skeleton.blossoms.filter((b) => g >= b.appearAt).slice(0, blossomCap);

    return {
        baseX: skeleton.baseX,
        baseY: skeleton.baseY,
        maxDepth,
        // Render-time scale: the tree is always a meaningful presence (65% minimum).
        // Branch/cluster/blossom REVEAL drives the primary sense of growth.
        scale: round(lerp(0.65, 1, g), 4),
        branches,
        clusters,
        blossoms,
    };
}
