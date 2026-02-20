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
    { minDays: 100, name: 'Enchanted Grove', description: 'A magical garden with rare flora' },
    { minDays: 200, name: 'Paradise Garden', description: 'A slice of paradise on earth' },
    { minDays: 365, name: 'Eternal Eden', description: 'The legendary Garden of Eden itself' },
    { minDays: 1000, name: 'Celestial Eden', description: 'A garden touched by the divine' }
];

/**
 * Get the current garden stage based on streak
 */
export const getGardenStage = (streak) => {
    let stage = gardenStages[0];
    for (const s of gardenStages) {
        if (streak >= s.minDays) {
            stage = s;
        } else {
            break;
        }
    }
    return stage;
};

/**
 * Get stage index for rendering (0-10)
 */
export const getStageIndex = (streak) => {
    let index = 0;
    for (let i = 0; i < gardenStages.length; i++) {
        if (streak >= gardenStages[i].minDays) {
            index = i;
        } else {
            break;
        }
    }
    return index;
};

export default {
    gardenStages,
    getGardenStage,
    getStageIndex
};

