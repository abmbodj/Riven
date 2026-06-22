import { describe, it, expect } from 'vitest';
import { buildTree } from './treeStructure';

const SEED = 0x2f9a3;
const LOD = { branchDepth: 5, clusterCount: 1000, blossomCount: 1000 };

describe('buildTree', () => {
    it('is deterministic for the same (growth, seed, lod)', () => {
        const a = buildTree(0.5, SEED, LOD);
        const b = buildTree(0.5, SEED, LOD);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('grows additively — higher growth is a superset with unchanged paths', () => {
        const young = buildTree(0.3, SEED, LOD);
        const older = buildTree(0.6, SEED, LOD);

        expect(older.branches.length).toBeGreaterThanOrEqual(young.branches.length);
        expect(older.clusters.length).toBeGreaterThanOrEqual(young.clusters.length);

        // Every branch present when young must still exist, unchanged, when older.
        young.branches.forEach((branch, i) => {
            expect(older.branches[i].d).toBe(branch.d);
            expect(older.branches[i].width).toBe(branch.width);
        });
    });

    it('reveals a real tree by maturity and only a sprout at the start', () => {
        const sprout = buildTree(0, SEED, LOD);
        const grand = buildTree(1, SEED, LOD);

        expect(sprout.branches.length).toBeGreaterThan(0); // trunk always present
        expect(grand.branches.length).toBeGreaterThan(sprout.branches.length);
        expect(grand.clusters.length).toBeGreaterThan(0);
        expect(grand.blossoms.length).toBeGreaterThan(0);
    });

    it('keeps blossoms to mature growth only', () => {
        expect(buildTree(0.4, SEED, LOD).blossoms.length).toBe(0);
        expect(buildTree(1, SEED, LOD).blossoms.length).toBeGreaterThan(0);
    });

    it('caps branch depth via the LOD budget', () => {
        const shallow = buildTree(1, SEED, { branchDepth: 3, clusterCount: 1000, blossomCount: 1000 });
        const maxDepth = Math.max(...shallow.branches.map((b) => b.depth));
        expect(maxDepth).toBeLessThanOrEqual(3);
    });

    it('respects cluster and blossom caps', () => {
        const capped = buildTree(1, SEED, { branchDepth: 5, clusterCount: 6, blossomCount: 4 });
        expect(capped.clusters.length).toBeLessThanOrEqual(6);
        expect(capped.blossoms.length).toBeLessThanOrEqual(4);
    });

    it('builds a wide crown (foliage spans well beyond the trunk)', () => {
        const grand = buildTree(1, SEED, LOD);
        // Visible crown extent includes each blob's radius.
        const minX = Math.min(...grand.clusters.map((c) => c.x - c.r));
        const maxX = Math.max(...grand.clusters.map((c) => c.x + c.r));
        // Trunk sits at x=200 in a 400-wide viewBox; a heritage crown should span
        // a broad, graphic width (~half the frame) without overflowing it.
        expect(maxX - minX).toBeGreaterThan(150);
        expect(minX).toBeGreaterThan(20);
        expect(maxX).toBeLessThan(380);
    });

    it('scales up with growth', () => {
        expect(buildTree(1, SEED, LOD).scale).toBeGreaterThan(buildTree(0, SEED, LOD).scale);
    });
});
