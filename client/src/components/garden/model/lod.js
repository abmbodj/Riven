/**
 * Level-of-detail / performance budget.
 *
 * Single source of truth for every density + effect toggle in the scene, so the
 * same component renders a flawless 60fps baseline on mid-range mobile and layers
 * on richness only where the hardware (and size) allow. Replaces the scattered
 * `stageIndex >= N ? ... : ...` ternaries of the legacy component.
 *
 *   size          : 'sm' | 'md' | 'lg' | 'xl' (sm = gallery chip)
 *   constrained   : true on low-power devices (useMobileVisualBudget)
 *   status        : 'active' | 'at-risk' | 'broken' (gentle falloff, never punishing)
 *   globalGrowth  : 0..1, lets density scale up as the tree matures
 */

const SIZE_RANK = { sm: 0, md: 1, lg: 2, xl: 3 };
const SIZE_SCALE = [0.4, 0.62, 0.85, 1];

export function getLod(size = 'md', constrained = false, status = 'active', globalGrowth = 0) {
    const rank = SIZE_RANK[size] ?? 1;
    const isChip = rank === 0;           // gallery / tiny
    const isCompact = rank <= 1;         // sm + md

    const statusDensity = status === 'broken' ? 0.45 : status === 'at-risk' ? 0.72 : 1;
    const budgetScale = constrained ? 0.6 : 1;
    const sizeScale = SIZE_SCALE[rank] ?? 0.85;
    // Maturity adds a little life but never starves a young tree of leaves.
    const growthScale = 0.55 + (0.45 * Math.min(1, Math.max(0, globalGrowth)));

    const density = statusDensity * budgetScale * sizeScale * growthScale;
    const scaled = (base) => Math.max(0, Math.round(base * density));

    return {
        size,
        rank,
        density,
        // Tree structure
        branchDepth: isChip ? 3 : 4,
        // Foliage is a few big overlapping blobs (one broad crown), not many leaves.
        clusterCount: scaled(isChip ? 6 : 14),
        blossomCount: scaled(isChip ? 10 : 28),
        // Atmosphere / particles
        fireflyCount: isChip ? 0 : scaled(constrained ? 6 : 11),
        pollenCount: isChip ? 0 : scaled(constrained ? 6 : 14),
        starCount: scaled(isChip ? 6 : constrained ? 10 : 18),
        // Effect toggles (the expensive bits)
        enableBlur: !isCompact && !constrained,
        enableGlow: rank >= 2 || !constrained,
        enableParallax: rank >= 2 && !constrained,
        enableConstellations: rank >= 1 && !constrained,
        enableMotion: true,
    };
}

/** Static, motionless budget for the past-streaks gallery (many instances). */
export function getGalleryLod(globalGrowth = 0) {
    return { ...getLod('sm', true, 'active', globalGrowth), enableMotion: false, enableParallax: false };
}
