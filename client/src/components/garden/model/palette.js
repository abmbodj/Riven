/**
 * Palette interpolation for the garden.
 *
 * Colours are lerped in JS (not CSS color-mix) so the result can feed individual
 * SVG gradient <stop> colours AND survive the SVG -> canvas raster step used by
 * the Phase 3 share export. Mirrors the hex lerp pattern in themeGradientRecipe.js.
 *
 * Between adjacent chapters we cross-fade by an eased chapterProgress, so the
 * scene drifts a little every day rather than snapping at thresholds.
 */

import { CHAPTERS } from './chapters';
import { resolveGrowth } from './growth';

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

function hexToRgb(hex) {
    const clean = String(hex).replace('#', '').trim();
    const full = clean.length === 3
        ? clean.split('').map((c) => c + c).join('')
        : clean;
    const int = Number.parseInt(full, 16);
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
    };
}

function channelToHex(value) {
    const v = Math.round(Math.min(255, Math.max(0, value)));
    return v.toString(16).padStart(2, '0');
}

function rgbToHex({ r, g, b }) {
    return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

/** Linear interpolate two hex colours. t is clamped to 0..1. */
export function lerpColor(a, b, t) {
    const amount = clamp01(t);
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex({
        r: ca.r + (cb.r - ca.r) * amount,
        g: ca.g + (cb.g - ca.g) * amount,
        b: ca.b + (cb.b - ca.b) * amount,
    });
}

/** Interpolate every key of two palettes (key set follows paletteA). */
export function interpolatePalette(paletteA, paletteB, t) {
    const out = {};
    for (const key of Object.keys(paletteA)) {
        out[key] = lerpColor(paletteA[key], paletteB[key] ?? paletteA[key], t);
    }
    return out;
}

/** Palette for a given chapter + within-chapter progress. */
export function paletteForChapter(chapterIndex, chapterProgress) {
    const a = CHAPTERS[chapterIndex].palette;
    const b = (CHAPTERS[chapterIndex + 1] ?? CHAPTERS[chapterIndex]).palette;
    return interpolatePalette(a, b, easeInOutSine(chapterProgress));
}

/** Resolve the interpolated palette straight from a streak number. */
export function resolvePalette(streak) {
    const { chapterIndex, chapterProgress } = resolveGrowth(streak);
    return paletteForChapter(chapterIndex, chapterProgress);
}
