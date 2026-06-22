import { describe, it, expect } from 'vitest';
import { getLod, getGalleryLod } from './lod';

describe('getLod', () => {
    it('keeps the gallery chip cheap (no blur, no particles, shallow tree)', () => {
        const lod = getLod('sm', false, 'active', 1);
        expect(lod.enableBlur).toBe(false);
        expect(lod.fireflyCount).toBe(0);
        expect(lod.pollenCount).toBe(0);
        expect(lod.branchDepth).toBe(3);
    });

    it('unlocks blur only at large sizes on capable devices', () => {
        expect(getLod('xl', false, 'active', 1).enableBlur).toBe(true);
        expect(getLod('xl', true, 'active', 1).enableBlur).toBe(false); // constrained
        expect(getLod('md', false, 'active', 1).enableBlur).toBe(false); // compact
    });

    it('keeps the canopy to a few bold limbs (foliage mass covers the rest)', () => {
        expect(getLod('sm', false, 'active', 1).branchDepth).toBe(3);
        expect(getLod('xl', true, 'active', 1).branchDepth).toBe(4);
        expect(getLod('xl', false, 'active', 1).branchDepth).toBe(4);
    });

    it('reduces density for at-risk and broken (gentle, never zero)', () => {
        const active = getLod('xl', false, 'active', 1);
        const atRisk = getLod('xl', false, 'at-risk', 1);
        const broken = getLod('xl', false, 'broken', 1);

        expect(atRisk.clusterCount).toBeLessThan(active.clusterCount);
        expect(broken.clusterCount).toBeLessThan(atRisk.clusterCount);
        expect(broken.clusterCount).toBeGreaterThan(0);
    });

    it('grows foliage density with maturity', () => {
        const young = getLod('xl', false, 'active', 0);
        const mature = getLod('xl', false, 'active', 1);
        expect(mature.clusterCount).toBeGreaterThan(young.clusterCount);
    });
});

describe('getGalleryLod', () => {
    it('is static (motion + parallax off)', () => {
        const lod = getGalleryLod(1);
        expect(lod.enableMotion).toBe(false);
        expect(lod.enableParallax).toBe(false);
    });
});
