/**
 * @typedef {Object} GhostType
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
 * @property {string} primary - Primary ghost color
 * @property {string} secondary - Secondary/glow color
 * @property {string} accent - Accent color for accessories
 */

/**
 * @typedef {Object} GhostCustomization
 * @property {string} ghostType - Selected ghost type id
 * @property {string} colorPalette - Selected color palette id
 * @property {string[]} accessories - Array of equipped accessory ids
 */

const CUSTOMIZATION_STORAGE_KEY = 'riven_ghost_customization';

// Ghost personality types
export const ghostTypes = [
    {
        id: 'bookworm',
        name: 'Bookworm',
        description: 'A studious ghost who loves knowledge. Appears focused and determined.',
        expression: 'focused'
    },
    {
        id: 'energetic',
        name: 'Energetic',
        description: 'A hyperactive ghost always ready to learn! Bounces with excitement.',
        expression: 'excited'
    },
    {
        id: 'sleepy',
        name: 'Sleepy',
        description: 'A drowsy ghost that powers through study sessions. Often yawns.',
        expression: 'drowsy'
    },
    {
        id: 'curious',
        name: 'Curious',
        description: 'A wonder-filled ghost amazed by every flashcard. Wide-eyed and attentive.',
        expression: 'wondering'
    }
];

// Accessories with unlock requirements
export const accessories = [
    // Head items
    { id: 'wizard-hat', name: 'Wizard Hat', unlockAt: 7, slot: 'head', emoji: '🎩' },
    { id: 'graduation-cap', name: 'Graduation Cap', unlockAt: 30, slot: 'head', emoji: '🎓' },
    { id: 'crown', name: 'Crown', unlockAt: 60, slot: 'head', emoji: '👑' },
    { id: 'halo', name: 'Halo', unlockAt: 100, slot: 'head', emoji: '😇' },
    
    // Face items
    { id: 'glasses', name: 'Reading Glasses', unlockAt: 14, slot: 'face', emoji: '👓' },
    { id: 'monocle', name: 'Monocle', unlockAt: 21, slot: 'face', emoji: '🧐' },
    { id: 'sunglasses', name: 'Cool Shades', unlockAt: 45, slot: 'face', emoji: '😎' },
    
    // Body items
    { id: 'scarf', name: 'Cozy Scarf', unlockAt: 10, slot: 'body', emoji: '🧣' },
    { id: 'bowtie', name: 'Bow Tie', unlockAt: 25, slot: 'body', emoji: '🎀' },
    { id: 'cape', name: 'Hero Cape', unlockAt: 50, slot: 'body', emoji: '🦸' },
    
    // Trail effects
    { id: 'sparkles', name: 'Sparkle Trail', unlockAt: 5, slot: 'trail', emoji: '✨' },
    { id: 'hearts', name: 'Heart Trail', unlockAt: 15, slot: 'trail', emoji: '💕' },
    { id: 'stars', name: 'Star Trail', unlockAt: 35, slot: 'trail', emoji: '⭐' },
    { id: 'rainbow', name: 'Rainbow Trail', unlockAt: 75, slot: 'trail', emoji: '🌈' }
];

// Color palettes with unlock requirements
export const colorPalettes = [
    {
        id: 'classic',
        name: 'Classic Ghost',
        unlockAt: 0,
        primary: '#E8E8FF',
        secondary: '#B8B8FF',
        accent: '#8888FF'
    },
    {
        id: 'mint',
        name: 'Mint Spirit',
        unlockAt: 3,
        primary: '#E8FFF0',
        secondary: '#A8E8C0',
        accent: '#68C890'
    },
    {
        id: 'sunset',
        name: 'Sunset Specter',
        unlockAt: 10,
        primary: '#FFE8E0',
        secondary: '#FFB8A0',
        accent: '#FF8870'
    },
    {
        id: 'ocean',
        name: 'Ocean Phantom',
        unlockAt: 20,
        primary: '#E0F0FF',
        secondary: '#88C8FF',
        accent: '#4090FF'
    },
    {
        id: 'lavender',
        name: 'Lavender Dream',
        unlockAt: 30,
        primary: '#F0E8FF',
        secondary: '#D0B8FF',
        accent: '#A078FF'
    },
    {
        id: 'golden',
        name: 'Golden Apparition',
        unlockAt: 50,
        primary: '#FFF8E0',
        secondary: '#FFE088',
        accent: '#FFC030'
    },
    {
        id: 'cosmic',
        name: 'Cosmic Entity',
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
 * @returns {boolean}
 */
export function isAccessoryUnlocked(accessoryId, longestStreak) {
    const accessory = accessories.find(a => a.id === accessoryId);
    return accessory ? longestStreak >= accessory.unlockAt : false;
}

/**
 * Check if a color palette is unlocked based on longest streak
 * @param {string} paletteId 
 * @param {number} longestStreak 
 * @returns {boolean}
 */
export function isPaletteUnlocked(paletteId, longestStreak) {
    const palette = colorPalettes.find(p => p.id === paletteId);
    return palette ? longestStreak >= palette.unlockAt : false;
}

/**
 * Get all unlocked accessories
 * @param {number} longestStreak 
 * @returns {Accessory[]}
 */
export function getUnlockedAccessories(longestStreak) {
    return accessories.filter(a => longestStreak >= a.unlockAt);
}

/**
 * Get all unlocked color palettes
 * @param {number} longestStreak 
 * @returns {ColorPalette[]}
 */
export function getUnlockedPalettes(longestStreak) {
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
 * @returns {GhostCustomization}
 */
export function loadCustomization() {
    try {
        const stored = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load ghost customization:', e);
    }
    return {
        ghostType: 'bookworm',
        colorPalette: 'classic',
        accessories: []
    };
}

/**
 * Save customization to storage
 * @param {GhostCustomization} customization 
 */
export function saveCustomization(customization) {
    try {
        localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(customization));
    } catch (e) {
        console.error('Failed to save ghost customization:', e);
    }
}

/**
 * Equip an accessory (validates against streak and slot limits)
 * @param {GhostCustomization} current 
 * @param {string} accessoryId 
 * @param {number} longestStreak 
 * @returns {GhostCustomization}
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
 * @param {GhostCustomization} current 
 * @param {string} accessoryId 
 * @returns {GhostCustomization}
 */
export function unequipAccessory(current, accessoryId) {
    return {
        ...current,
        accessories: current.accessories.filter(id => id !== accessoryId)
    };
}

/**
 * Set ghost type
 * @param {GhostCustomization} current 
 * @param {string} ghostTypeId 
 * @returns {GhostCustomization}
 */
export function setGhostType(current, ghostTypeId) {
    if (!ghostTypes.find(t => t.id === ghostTypeId)) {
        return current;
    }
    return { ...current, ghostType: ghostTypeId };
}

/**
 * Set color palette (validates against streak)
 * @param {GhostCustomization} current 
 * @param {string} paletteId 
 * @param {number} longestStreak 
 * @returns {GhostCustomization}
 */
export function setColorPalette(current, paletteId, longestStreak) {
    if (!isPaletteUnlocked(paletteId, longestStreak)) {
        return current;
    }
    return { ...current, colorPalette: paletteId };
}
