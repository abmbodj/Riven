import { describe, it, expect } from 'vitest';
import { resolveGrowth, getChapterIndex } from './growth';
import { CHAPTERS } from './chapters';

describe('resolveGrowth', () => {
    it('maps milestone thresholds to the right chapter index', () => {
        expect(getChapterIndex(0)).toBe(0);
        expect(getChapterIndex(6)).toBe(0);
        expect(getChapterIndex(7)).toBe(1);
        expect(getChapterIndex(29)).toBe(1);
        expect(getChapterIndex(30)).toBe(2);
        expect(getChapterIndex(89)).toBe(2);
        expect(getChapterIndex(90)).toBe(3);
        expect(getChapterIndex(180)).toBe(4);
        expect(getChapterIndex(365)).toBe(5);
        expect(getChapterIndex(730)).toBe(6);
        expect(getChapterIndex(99999)).toBe(6);
    });

    it('chapterProgress is 0 at a boundary and approaches 1 just below the next', () => {
        expect(resolveGrowth(7).chapterProgress).toBe(0);
        expect(resolveGrowth(30).chapterProgress).toBe(0);
        // Chapter 1 spans 7..30 (span 23); day 29 -> 22/23.
        expect(resolveGrowth(29).chapterProgress).toBeCloseTo(22 / 23, 5);
    });

    it('globalGrowth is 0 at day 0, 1 at the final chapter, and monotonic non-decreasing', () => {
        expect(resolveGrowth(0).globalGrowth).toBe(0);
        expect(resolveGrowth(730).globalGrowth).toBeCloseTo(1, 5);

        let prev = -1;
        for (let d = 0; d <= 1000; d += 1) {
            const g = resolveGrowth(d).globalGrowth;
            expect(g).toBeGreaterThanOrEqual(prev);
            expect(g).toBeGreaterThanOrEqual(0);
            expect(g).toBeLessThanOrEqual(1);
            prev = g;
        }
    });

    it('pins the final chapter (progress 1, no days to next)', () => {
        const last = resolveGrowth(730);
        expect(last.chapterIndex).toBe(CHAPTERS.length - 1);
        expect(last.nextChapter).toBeNull();
        expect(last.chapterProgress).toBe(1);
        expect(last.daysToNext).toBe(0);
    });

    it('reports days-to-next correctly mid-chapter', () => {
        expect(resolveGrowth(7).daysToNext).toBe(23); // 30 - 7
        expect(resolveGrowth(100).daysToNext).toBe(80); // 180 - 100
    });

    it('normalizes invalid input to a day-0 garden', () => {
        expect(resolveGrowth(-5).days).toBe(0);
        expect(resolveGrowth(NaN).days).toBe(0);
        expect(resolveGrowth(undefined).chapterIndex).toBe(0);
        expect(resolveGrowth(12.9).days).toBe(12);
    });
});
