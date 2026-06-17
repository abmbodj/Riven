/**
 * Garden Customization System
 * Your garden grows from a small patch to Eden as you maintain your streak!
 */

// Garden stages based on streak
export const gardenStages = [
    { minDays: 0, name: 'Barren Plot', description: 'A small patch of dirt waiting for seeds' },
    { minDays: 1, name: 'Sprouting Seeds', description: 'Tiny green sprouts peek through the soil' },
    { minDays: 3, name: 'Young Seedlings', description: 'Small plants reaching for the sun' },
    { minDays: 7, name: 'Growing Garden', description: 'A variety of young plants taking shape' },
    { minDays: 14, name: 'Blooming Patch', description: 'Colorful flowers begin to bloom' },
    { minDays: 30, name: 'Flourishing Garden', description: 'A lush garden full of life' },
    { minDays: 60, name: 'Thriving Oasis', description: 'A beautiful sanctuary of nature' },
    { minDays: 90, name: 'Enchanted Grove', description: 'A magical garden with rare flora' },
    { minDays: 120, name: 'Mystic Sanctuary', description: 'Ancient trees and mystical energies intertwine' },
    { minDays: 180, name: 'Paradise Garden', description: 'A slice of paradise on earth' },
    { minDays: 240, name: 'Eternal Eden', description: 'The legendary Garden of Eden itself' },
    { minDays: 300, name: 'Astral Gardens', description: 'Floating islands amongst the stars' },
    { minDays: 365, name: 'Celestial Eden', description: 'A garden touched by the divine' },
    { minDays: 450, name: 'Cosmic Nexus', description: 'The heart of a blossoming galaxy' },
    { minDays: 600, name: 'Universal Core', description: 'The pure essence of creation' },
    { minDays: 730, name: 'Infinity Loom', description: 'Weaving the fabric of reality itself' }
];

const normalizeStreak = (streak) => {
    const days = Math.floor(Number(streak));
    return Number.isFinite(days) ? Math.max(0, days) : 0;
};

/**
 * Get the current garden stage based on streak
 */
export const getGardenStage = (streak) => {
    const normalizedStreak = normalizeStreak(streak);
    let stage = gardenStages[0];
    for (const s of gardenStages) {
        if (normalizedStreak >= s.minDays) {
            stage = s;
        } else {
            break;
        }
    }
    return stage;
};

/**
 * Get stage index for rendering
 */
export const getStageIndex = (streak) => {
    const normalizedStreak = normalizeStreak(streak);
    let index = 0;
    for (let i = 0; i < gardenStages.length; i++) {
        if (normalizedStreak >= gardenStages[i].minDays) {
            index = i;
        } else {
            break;
        }
    }
    return index;
};

/**
 * Get stage and next-milestone progress for a streak.
 */
export const getGardenProgress = (streak) => {
    const normalizedStreak = normalizeStreak(streak);
    const stageIndex = getStageIndex(normalizedStreak);
    const currentStage = gardenStages[stageIndex];
    const nextStage = gardenStages[stageIndex + 1] ?? null;

    if (!nextStage) {
        return {
            currentStage,
            nextStage,
            stageIndex,
            daysToNext: 0,
            percent: 100,
        };
    }

    const stageSpan = nextStage.minDays - currentStage.minDays;
    const stageProgress = normalizedStreak - currentStage.minDays;
    const percent = stageSpan > 0
        ? Math.round(Math.min(1, Math.max(0, stageProgress / stageSpan)) * 100)
        : 100;

    return {
        currentStage,
        nextStage,
        stageIndex,
        daysToNext: Math.max(0, nextStage.minDays - normalizedStreak),
        percent,
    };
};
