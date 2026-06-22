/**
 * Growth model — maps a streak day-count to a continuous growth state.
 *
 * Returns BOTH a discrete chapter (for the light/palette arc + milestone
 * detection) and a continuous `globalGrowth` 0..1 that drives the hero tree's
 * scale, branch reveal, leaf/blossom density and light intensity EVERY day.
 *
 * Growth is eased so the early days feel meaningfully alive (front-loaded):
 * day 1 -> 7 already shows visible change, satisfying "the anchor from day one".
 */

import { CHAPTERS } from './chapters';

const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Front-loaded easing: fast early, gentle late.
const easeOutSine = (t) => Math.sin((clamp01(t) * Math.PI) / 2);

const normalizeDays = (streak) => {
    const days = Math.floor(Number(streak));
    return Number.isFinite(days) ? Math.max(0, days) : 0;
};

/**
 * @param {number} streak day count
 * @returns {{
 *   days: number,
 *   chapterIndex: number,
 *   chapter: object,
 *   nextChapter: object|null,
 *   chapterProgress: number,   // 0..1 within the current chapter
 *   globalGrowth: number,      // 0..1 across the whole journey (eased)
 *   daysToNext: number,
 * }}
 */
export function resolveGrowth(streak) {
    const days = normalizeDays(streak);

    let chapterIndex = 0;
    for (let i = 0; i < CHAPTERS.length; i += 1) {
        if (days >= CHAPTERS[i].minDays) chapterIndex = i;
        else break;
    }

    const chapter = CHAPTERS[chapterIndex];
    const nextChapter = CHAPTERS[chapterIndex + 1] ?? null;
    const span = nextChapter ? nextChapter.minDays - chapter.minDays : 0;
    const chapterProgress = nextChapter && span > 0
        ? clamp01((days - chapter.minDays) / span)
        : 1;

    const lastIndex = CHAPTERS.length - 1;
    const linear = clamp01((chapterIndex + chapterProgress) / lastIndex);
    const globalGrowth = easeOutSine(linear);

    return {
        days,
        chapterIndex,
        chapter,
        nextChapter,
        chapterProgress,
        globalGrowth,
        daysToNext: nextChapter ? Math.max(0, nextChapter.minDays - days) : 0,
    };
}

/** Convenience: just the chapter index for a streak (used for milestone detection). */
export function getChapterIndex(streak) {
    return resolveGrowth(streak).chapterIndex;
}
