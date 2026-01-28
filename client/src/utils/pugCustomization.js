/**
 * @typedef {Object} PugType
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - Personality description
 * @property {string} expression - Default expression style
 */

/**
 * @typedef {Object} Accessory
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {number} unlockAt - Streak days required to unlock
 * @property {string} slot - Where it goes (head, face, body, trail)
 */

/**
 * @typedef {Object} ColorPalette
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {number} unlockAt - Streak days required to unlock
 * @property {string} primary - Primary pug color
 * @property {string} secondary - Secondary/accent color
 * @property {string} accent - Accent color for accessories
 */

/**
 * @typedef {Object} PugCustomization
 * @property {string} pugType - Selected pug type id
 * @property {string} colorPalette - Selected color palette id
 * @property {string[]} accessories - Array of equipped accessory ids
 */

const CUSTOMIZATION_STORAGE_KEY = 'riven_pug_customization';

// Pug personality types
export const pugTypes = [
    {
        id: 'bookworm',
        name: 'Studious Gmail',
        description: 'A focused pug who loves learning new tricks. Always has a treat in mind.',
        expression: 'focused'
    },
    {
        id: 'energetic',
        name: 'Zoomie Gmail',
        description: 'A hyperactive pug always ready for a walk! Bounces with excitement.',
        expression: 'excited'
    },
    {
        id: 'sleepy',
        name: 'Napping Gmail',
        description: 'A drowsy pug that snores through study sessions. Often dreams of bacon.',
        expression: 'drowsy'
    },
    {
        id: 'curious',
        name: 'Sniffing Gmail',
        description: 'A wonder-filled pug amazed by every new smell. Wide-eyed and attentive.',
        expression: 'wondering'
    }
];

// Accessories with unlock requirements
export const accessories = [
    // Head items
    { id: 'wizard-hat', name: 'Wizard Hat', unlockAt: 7, slot: 'head', emoji: '🎩' },
    { id: 'graduation-cap', name: 'Graduation Cap', unlockAt: 30, slot: 'head', emoji: '🎓' },
    { id: 'crown', name: 'Royal Crown', unlockAt: 60, slot: 'head', emoji: '👑' },
    { id: 'halo', name: 'Good Boy Halo', unlockAt: 100, slot: 'head', emoji: '😇' },

    // Face items
    { id: 'glasses', name: 'Smarty Glasses', unlockAt: 14, slot: 'face', emoji: '👓' },
    { id: 'monocle', name: 'Fancy Monocle', unlockAt: 21, slot: 'face', emoji: '🧐' },
    { id: 'sunglasses', name: 'Cool Shades', unlockAt: 45, slot: 'face', emoji: '😎' },

    // Body items
    { id: 'scarf', name: 'Winter Scarf', unlockAt: 10, slot: 'body', emoji: '🧣' },
    { id: 'bowtie', name: 'Dapper Bowtie', unlockAt: 25, slot: 'body', emoji: '🎀' },
    { id: 'cape', name: 'Super Pug Cape', unlockAt: 50, slot: 'body', emoji: '🦸' },

    // Trail effects
    { id: 'sparkles', name: 'Magic Sparkles', unlockAt: 5, slot: 'trail', emoji: '✨' },
    { id: 'hearts', name: 'Love Trail', unlockAt: 15, slot: 'trail', emoji: '💕' },
    { id: 'stars', name: 'Star Trail', unlockAt: 35, slot: 'trail', emoji: '⭐' },
    { id: 'rainbow', name: 'Rainbow Trail', unlockAt: 75, slot: 'trail', emoji: '🌈' }
];

// Color palettes with unlock requirements
export const colorPalettes = [
    {
        id: 'fawn',
        name: 'Classic Fawn',
        unlockAt: 0,
        primary: '#E5C29F',
        secondary: '#333333',
        accent: '#8B4513'
    },
    {
        id: 'black',
        name: 'Midnight Black',
        unlockAt: 3,
        primary: '#1A1A1A',
        secondary: '#333333',
        accent: '#555555'
    },
    {
        id: 'apricot',
        name: 'Apricot Dream',
        unlockAt: 10,
        primary: '#FBCEB1',
        secondary: '#4A3728',
        accent: '#D2691E'
    },
    {
        id: 'silver',
        name: 'Silver Mist',
        unlockAt: 20,
        primary: '#C0C0C0',
        secondary: '#2F4F4F',
        accent: '#708090'
    },
    {
        id: 'chocolate',
        name: 'Choco Pug',
        unlockAt: 30,
        primary: '#7B3F00',
        secondary: '#3D2B1F',
        accent: '#A0522D'
    },
    {
        id: 'golden',
        name: 'Golden Retriever?',
        unlockAt: 50,
        primary: '#FFD700',
        secondary: '#B8860B',
        accent: '#DAA520'
    },
    {
        id: 'cosmic',
        name: 'Cosmic Gmail',
        unlockAt: 100,
        primary: '#1a1a2e',
        secondary: '#4a00e0',
        accent: '#8e2de2'
    }
];

/**
 * Check if an accessory is unlocked based on longest streak
 * @param {string} accessoryId 
 * @param {number} longestStreak 
 * @param {boolean} isAdmin - Admin users have all items unlocked
 * @returns {boolean}
 */
export function isAccessoryUnlocked(accessoryId, longestStreak, isAdmin = false) {
    if (isAdmin) return true;
    const accessory = accessories.find(a => a.id === accessoryId);
    return accessory ? longestStreak >= accessory.unlockAt : false;
}

/**
 * Check if a color palette is unlocked based on longest streak
 * @param {string} paletteId 
 * @param {number} longestStreak 
 * @param {boolean} isAdmin - Admin users have all items unlocked
 * @returns {boolean}
 */
export function isPaletteUnlocked(paletteId, longestStreak, isAdmin = false) {
    if (isAdmin) return true;
    const palette = colorPalettes.find(p => p.id === paletteId);
    return palette ? longestStreak >= palette.unlockAt : false;
}

/**
 * Get all unlocked accessories
 * @param {number} longestStreak 
 * @param {boolean} isAdmin - Admin users have all items unlocked
 * @returns {Accessory[]}
 */
export function getUnlockedAccessories(longestStreak, isAdmin = false) {
    if (isAdmin) return accessories;
    return accessories.filter(a => longestStreak >= a.unlockAt);
}

/**
 * Get all unlocked color palettes
 * @param {number} longestStreak 
 * @param {boolean} isAdmin - Admin users have all items unlocked
 * @returns {ColorPalette[]}
 */
export function getUnlockedPalettes(longestStreak, isAdmin = false) {
    if (isAdmin) return colorPalettes;
    return colorPalettes.filter(p => longestStreak >= p.unlockAt);
}

/**
 * Get next unlock milestone
 * @param {number} longestStreak 
 * @returns {{type: 'accessory'|'palette', item: Accessory|ColorPalette, daysAway: number}|null}
 */
export function getNextUnlock(longestStreak) {
    const nextAccessory = accessories
        .filter(a => a.unlockAt > longestStreak)
        .sort((a, b) => a.unlockAt - b.unlockAt)[0];

    const nextPalette = colorPalettes
        .filter(p => p.unlockAt > longestStreak)
        .sort((a, b) => a.unlockAt - b.unlockAt)[0];

    if (!nextAccessory && !nextPalette) return null;

    if (!nextAccessory) return { type: 'palette', item: nextPalette, daysAway: nextPalette.unlockAt - longestStreak };
    if (!nextPalette) return { type: 'accessory', item: nextAccessory, daysAway: nextAccessory.unlockAt - longestStreak };

    if (nextAccessory.unlockAt <= nextPalette.unlockAt) {
        return { type: 'accessory', item: nextAccessory, daysAway: nextAccessory.unlockAt - longestStreak };
    }
    return { type: 'palette', item: nextPalette, daysAway: nextPalette.unlockAt - longestStreak };
}

/**
 * Load saved customization from storage
 * @returns {PugCustomization}
 */
export function loadCustomization() {
    try {
        const stored = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load Gmail customization:', e);
    }
    return {
        pugType: 'bookworm',
        colorPalette: 'fawn',
        accessories: []
    };
}

/**
 * Save customization to storage
 * @param {PugCustomization} customization 
 */
export function saveCustomization(customization) {
    try {
        localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(customization));
    } catch (e) {
        console.error('Failed to save Gmail customization:', e);
    }
}

/**
 * Equip an accessory (validates against streak and slot limits)
 * @param {PugCustomization} current 
 * @param {string} accessoryId 
 * @param {number} longestStreak 
 * @returns {PugCustomization}
 */
export function equipAccessory(current, accessoryId, longestStreak) {
    if (!isAccessoryUnlocked(accessoryId, longestStreak)) {
        return current;
    }

    const accessory = accessories.find(a => a.id === accessoryId);
    if (!accessory) return current;

    // Remove any existing accessory in the same slot
    const filtered = current.accessories.filter(id => {
        const a = accessories.find(acc => acc.id === id);
        return a && a.slot !== accessory.slot;
    });

    return {
        ...current,
        accessories: [...filtered, accessoryId]
    };
}

/**
 * Unequip an accessory
 * @param {PugCustomization} current 
 * @param {string} accessoryId 
 * @returns {PugCustomization}
 */
export function unequipAccessory(current, accessoryId) {
    return {
        ...current,
        accessories: current.accessories.filter(id => id !== accessoryId)
    };
}

/**
 * Set pug type
 * @param {PugCustomization} current 
 * @param {string} pugTypeId 
 * @returns {PugCustomization}
 */
export function setPugType(current, pugTypeId) {
    if (!pugTypes.find(t => t.id === pugTypeId)) {
        return current;
    }
    return { ...current, pugType: pugTypeId };
}

/**
 * Set color palette (validates against streak)
 * @param {PugCustomization} current 
 * @param {string} paletteId 
 * @param {number} longestStreak 
 * @returns {PugCustomization}
 */
export function setColorPalette(current, paletteId, longestStreak) {
    if (!isPaletteUnlocked(paletteId, longestStreak)) {
        return current;
    }
    return { ...current, colorPalette: paletteId };
}
