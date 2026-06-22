/**
 * Garden chapters — the rebuilt "luminous depth" growth arc.
 *
 * One hero tree grows continuously with the streak, punctuated by 7 signature
 * chapters. Thresholds reuse the milestone days users already know from the
 * legacy 16-stage ladder (0 / 7 / 30 / 90 / 180 / 365 / 730) so progress lines up.
 *
 * The light arc moves: dawn -> day -> dusk -> blue hour -> MOONLIT (the signature
 * peak) -> deep blossom night -> restrained cosmic.
 *
 * Each palette keeps the exact key set the SVG <defs> consume, so layers and
 * gradients need no shape changes. Colours are interpolated between adjacent
 * chapters every day (see palette.js), so the scene drifts smoothly, never steps.
 */

// Palette keys (must stay in sync with GardenDefs gradients):
// skyTop, skyBottom, mist, hillFar, hillNear, pond, pondGlow, island,
// bark, leaf, leafLight, blossom, blossomCore, light, star

export const CHAPTERS = [
    {
        index: 0,
        key: 'first-light',
        minDays: 0,
        name: 'First Light',
        description: 'A seed rests in warm dawn light, waiting to wake.',
        light: 'dawn',
        palette: {
            skyTop: '#f4e9dc', skyBottom: '#e6c9b0', mist: '#fff4e8',
            hillFar: '#c9b6a3', hillNear: '#9c8a76', pond: '#b9c2b3', pondGlow: '#f0e7d4',
            island: '#8a7860', bark: '#6f5d48', leaf: '#8fa67c', leafLight: '#d8e4c2',
            blossom: '#f6e3d6', blossomCore: '#e0b88e', light: '#fff3df', star: '#f7ecda',
        },
    },
    {
        index: 1,
        key: 'quiet-sprout',
        minDays: 7,
        name: 'Quiet Sprout',
        description: 'First leaves open under a soft, fresh-green day.',
        light: 'day',
        palette: {
            skyTop: '#e3eee6', skyBottom: '#bcd6c8', mist: '#eef9ef',
            hillFar: '#9db8a4', hillNear: '#6f9079', pond: '#79a596', pondGlow: '#d9efe0',
            island: '#6d7459', bark: '#5b5240', leaf: '#6fa87a', leafLight: '#cfeecb',
            blossom: '#f4ece0', blossomCore: '#d9bb8f', light: '#f3fbe9', star: '#eef8ef',
        },
    },
    {
        index: 2,
        key: 'young-sapling',
        minDays: 30,
        name: 'Young Sapling',
        description: 'A sapling stretches into golden evening light.',
        light: 'dusk',
        palette: {
            skyTop: '#f0dcc0', skyBottom: '#d99e6e', mist: '#ffe9cf',
            hillFar: '#b58f6d', hillNear: '#7d5f48', pond: '#8a7a64', pondGlow: '#f2d7a8',
            island: '#6e5a44', bark: '#574535', leaf: '#7e9c63', leafLight: '#d7d99a',
            blossom: '#f7dcc3', blossomCore: '#deb96a', light: '#ffe7c4', star: '#f7e3c4',
        },
    },
    {
        index: 3,
        key: 'rooted-grove',
        minDays: 90,
        name: 'Rooted Grove',
        description: 'Roots run deep as the sky settles into blue hour.',
        light: 'dusk',
        palette: {
            skyTop: '#cdd2e0', skyBottom: '#7e88ad', mist: '#dde3f3',
            hillFar: '#65708f', hillNear: '#3c4564', pond: '#4a5878', pondGlow: '#c2cbe6',
            island: '#4c5163', bark: '#393d50', leaf: '#6f93a8', leafLight: '#cfe0ee',
            blossom: '#f0e4ee', blossomCore: '#d3a9c2', light: '#eef2ff', star: '#eef4ff',
        },
    },
    {
        index: 4,
        key: 'moonlit-canopy',
        minDays: 180,
        name: 'Moonlit Canopy',
        description: 'The full canopy glows beneath the rising moon.',
        light: 'moonlit',
        palette: {
            skyTop: '#0f2128', skyBottom: '#20424b', mist: '#7fb0bd',
            hillFar: '#244852', hillNear: '#122a31', pond: '#143942', pondGlow: '#76b1bd',
            island: '#2c4248', bark: '#5e7d86', leaf: '#93c9c2', leafLight: '#dcfaf4',
            blossom: '#f0eaf6', blossomCore: '#cfc0e4', light: '#eafaff', star: '#fff7d8',
        },
    },
    {
        index: 5,
        key: 'blossom-crown',
        minDays: 365,
        name: 'Blossom Crown',
        description: 'Luminous blossoms crown a year of devotion.',
        light: 'moonlit',
        palette: {
            skyTop: '#0a1a26', skyBottom: '#173043', mist: '#84a8cf',
            hillFar: '#1d3b54', hillNear: '#0d1f2c', pond: '#102f44', pondGlow: '#7aa6cf',
            island: '#243646', bark: '#4f6f81', leaf: '#8fcabb', leafLight: '#ddfff2',
            blossom: '#fbe6f1', blossomCore: '#f0b9d2', light: '#fbf2ff', star: '#ffffff',
        },
    },
    {
        index: 6,
        key: 'cosmic-heritage',
        minDays: 730,
        name: 'Cosmic Heritage',
        description: 'An ancient tree woven into a quiet cosmos.',
        light: 'cosmic',
        palette: {
            skyTop: '#05080f', skyBottom: '#0f1d33', mist: '#8fb6df',
            hillFar: '#122842', hillNear: '#070d16', pond: '#0a2034', pondGlow: '#86b0d5',
            island: '#182636', bark: '#2f4c61', leaf: '#9bdbcf', leafLight: '#e9fff7',
            blossom: '#f9efff', blossomCore: '#e0cdfa', light: '#fbfdff', star: '#ffffff',
        },
    },
];

export const CHAPTER_COUNT = CHAPTERS.length;
export const PALETTE_KEYS = Object.keys(CHAPTERS[0].palette);
