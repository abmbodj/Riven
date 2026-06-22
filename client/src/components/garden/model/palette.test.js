import { describe, it, expect } from 'vitest';
import { lerpColor, interpolatePalette, paletteForChapter, resolvePalette } from './palette';
import { CHAPTERS, PALETTE_KEYS } from './chapters';

const HEX = /^#[0-9a-f]{6}$/;

describe('lerpColor', () => {
    it('hits exact endpoints', () => {
        expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000');
        expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff');
    });

    it('lerps to the midpoint', () => {
        expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    });

    it('clamps t outside 0..1', () => {
        expect(lerpColor('#000000', '#ffffff', -2)).toBe('#000000');
        expect(lerpColor('#000000', '#ffffff', 5)).toBe('#ffffff');
    });

    it('supports 3-digit hex input', () => {
        expect(lerpColor('#000', '#fff', 1)).toBe('#ffffff');
    });
});

describe('interpolatePalette', () => {
    const a = CHAPTERS[0].palette;
    const b = CHAPTERS[1].palette;

    it('returns the same palette when both inputs are identical', () => {
        for (const t of [0, 0.3, 0.5, 0.91, 1]) {
            expect(interpolatePalette(a, a, t)).toEqual(a);
        }
    });

    it('hits exact endpoints', () => {
        expect(interpolatePalette(a, b, 0)).toEqual(a);
        expect(interpolatePalette(a, b, 1)).toEqual(b);
    });

    it('preserves the key set and emits valid hex', () => {
        const out = interpolatePalette(a, b, 0.42);
        expect(Object.keys(out)).toEqual(Object.keys(a));
        for (const key of Object.keys(out)) expect(out[key]).toMatch(HEX);
    });
});

describe('resolvePalette / paletteForChapter', () => {
    it('produces a full, valid palette for any streak', () => {
        for (const streak of [0, 7, 45, 200, 365, 800]) {
            const p = resolvePalette(streak);
            expect(Object.keys(p)).toEqual(PALETTE_KEYS);
            for (const key of PALETTE_KEYS) expect(p[key]).toMatch(HEX);
        }
    });

    it('clamps the final chapter to its own palette', () => {
        const lastIndex = CHAPTERS.length - 1;
        expect(paletteForChapter(lastIndex, 1)).toEqual(CHAPTERS[lastIndex].palette);
    });
});
