/**
 * Garden Customization System
 * Your garden grows from a small patch to Eden as you maintain your streak!
 */

const CUSTOMIZATION_STORAGE_KEY = 'riven_garden_customization';

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

// Garden themes/styles
export const gardenThemes = [
    {
        id: 'zen',
        name: 'Zen Garden',
        description: 'Peaceful Japanese-inspired minimalism',
        groundColor: '#C9B896',
        accentColor: '#4A7C59',
        flowerColors: ['#FFFFFF', '#FFB7C5', '#E8CACA']
    },
    {
        id: 'cottage',
        name: 'Cottage Garden',
        description: 'A wild, romantic English garden',
        groundColor: '#7CB342',
        accentColor: '#33691E',
        flowerColors: ['#E91E63', '#9C27B0', '#FFEB3B', '#FF9800']
    },
    {
        id: 'tropical',
        name: 'Tropical Paradise',
        description: 'Exotic plants and vibrant colors',
        groundColor: '#2E7D32',
        accentColor: '#1B5E20',
        flowerColors: ['#FF1744', '#FF9100', '#FFEA00', '#00E676']
    },
    {
        id: 'desert',
        name: 'Desert Bloom',
        description: 'Succulents and cacti in sandy soil',
        groundColor: '#D7CCC8',
        accentColor: '#5D4037',
        flowerColors: ['#FF7043', '#FFB74D', '#AED581', '#81C784']
    },
    {
        id: 'moonlight',
        name: 'Moonlight Garden',
        description: 'Ethereal night-blooming flowers',
        groundColor: '#37474F',
        accentColor: '#263238',
        flowerColors: ['#E1F5FE', '#B3E5FC', '#CE93D8', '#F3E5F5']
    },
    {
        id: 'autumn',
        name: 'Autumn Harvest',
        description: 'Warm fall colors and harvest bounty',
        groundColor: '#8D6E63',
        accentColor: '#4E342E',
        flowerColors: ['#FF5722', '#FF9800', '#FFC107', '#795548']
    }
];

// Decorations with unlock requirements
export const decorations = [
    // Small decorations (early unlocks)
    { id: 'butterfly', name: 'Butterfly', unlockAt: 3, slot: 'air', emoji: '🦋' },
    { id: 'ladybug', name: 'Ladybug', unlockAt: 5, slot: 'ground', emoji: '🐞' },
    { id: 'mushroom', name: 'Mushroom', unlockAt: 7, slot: 'ground', emoji: '🍄' },
    { id: 'bee', name: 'Busy Bee', unlockAt: 10, slot: 'air', emoji: '🐝' },
    
    // Medium decorations
    { id: 'birdhouse', name: 'Birdhouse', unlockAt: 14, slot: 'structure', emoji: '🏠' },
    { id: 'lantern', name: 'Garden Lantern', unlockAt: 21, slot: 'structure', emoji: '🏮' },
    { id: 'gnome', name: 'Garden Gnome', unlockAt: 25, slot: 'ground', emoji: '🧙' },
    { id: 'bird', name: 'Songbird', unlockAt: 30, slot: 'air', emoji: '🐦' },
    
    // Larger decorations
    { id: 'fountain', name: 'Fountain', unlockAt: 45, slot: 'structure', emoji: '⛲' },
    { id: 'bench', name: 'Garden Bench', unlockAt: 50, slot: 'structure', emoji: '🪑' },
    { id: 'windchime', name: 'Wind Chimes', unlockAt: 60, slot: 'air', emoji: '🎐' },
    { id: 'statue', name: 'Angel Statue', unlockAt: 75, slot: 'structure', emoji: '👼' },
    
    // Rare decorations
    { id: 'rainbow', name: 'Rainbow', unlockAt: 100, slot: 'sky', emoji: '🌈' },
    { id: 'fireflies', name: 'Fireflies', unlockAt: 150, slot: 'air', emoji: '✨' },
    { id: 'pond', name: 'Koi Pond', unlockAt: 200, slot: 'structure', emoji: '🐟' },
    { id: 'treehouse', name: 'Treehouse', unlockAt: 365, slot: 'structure', emoji: '🌳' },
    
    // Legendary
    { id: 'aurora', name: 'Aurora Lights', unlockAt: 500, slot: 'sky', emoji: '🌌' },
    { id: 'unicorn', name: 'Unicorn', unlockAt: 1000, slot: 'ground', emoji: '🦄' }
];

// Special plants that can be grown
export const specialPlants = [
    { id: 'sunflower', name: 'Sunflower', unlockAt: 7, emoji: '🌻' },
    { id: 'rose', name: 'Rose', unlockAt: 14, emoji: '🌹' },
    { id: 'tulip', name: 'Tulip', unlockAt: 21, emoji: '🌷' },
    { id: 'cherry', name: 'Cherry Blossom', unlockAt: 30, emoji: '🌸' },
    { id: 'hibiscus', name: 'Hibiscus', unlockAt: 45, emoji: '🌺' },
    { id: 'lotus', name: 'Sacred Lotus', unlockAt: 100, emoji: '🪷' },
    { id: 'crystal', name: 'Crystal Flower', unlockAt: 200, emoji: '💎' },
    { id: 'golden', name: 'Golden Bloom', unlockAt: 365, emoji: '🏆' }
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

/**
 * Check if a decoration is unlocked
 */
export const isDecorationUnlocked = (decorationId, longestStreak) => {
    const decoration = decorations.find(d => d.id === decorationId);
    return decoration ? longestStreak >= decoration.unlockAt : false;
};

/**
 * Check if a theme is unlocked (all themes free for now)
 */
export const isThemeUnlocked = () => {
    return true;
};

/**
 * Check if a special plant is unlocked
 */
export const isPlantUnlocked = (plantId, longestStreak) => {
    const plant = specialPlants.find(p => p.id === plantId);
    return plant ? longestStreak >= plant.unlockAt : false;
};

/**
 * Get the next unlock
 */
export const getNextUnlock = (currentStreak) => {
    const allUnlockables = [
        ...decorations.map(d => ({ ...d, type: 'decoration' })),
        ...specialPlants.map(p => ({ ...p, type: 'plant' }))
    ].sort((a, b) => a.unlockAt - b.unlockAt);

    const nextUnlock = allUnlockables.find(item => item.unlockAt > currentStreak);
    if (!nextUnlock) return null;

    return {
        item: nextUnlock,
        daysAway: nextUnlock.unlockAt - currentStreak
    };
};

/**
 * Load customization from localStorage
 */
export const loadCustomization = () => {
    try {
        const stored = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Failed to load
    }
    return {
        gardenTheme: 'cottage',
        decorations: [],
        specialPlants: []
    };
};

/**
 * Save customization to localStorage
 */
export const saveCustomization = (customization) => {
    try {
        localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(customization));
    } catch {
        // Failed to save
    }
};

export default {
    gardenStages,
    gardenThemes,
    decorations,
    specialPlants,
    getGardenStage,
    getStageIndex,
    isDecorationUnlocked,
    isThemeUnlocked,
    isPlantUnlocked,
    getNextUnlock,
    loadCustomization,
    saveCustomization
};
