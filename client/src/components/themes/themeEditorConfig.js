import { FOUNDATION_THEME_NAMES } from '../../themeCatalog.js';

export { FOUNDATION_THEME_NAMES };

export const DEFAULT_THEME_DARK = {
    name: 'After Hours',
    bg_color: '#101a20',
    surface_color: '#16252d',
    text_color: '#edf0ea',
    secondary_text_color: '#8da1a6',
    border_color: '#24343c',
    accent_color: '#cfa76a',
    font_family_display: 'Instrument Serif',
    font_family_body: 'Space Grotesk'
};

export const DEFAULT_THEME_LIGHT = {
    name: 'Paper Studio',
    bg_color: '#f6f1e8',
    surface_color: '#fffaf2',
    text_color: '#18262d',
    secondary_text_color: '#60737a',
    border_color: '#d7cec1',
    accent_color: '#c88a56',
    font_family_display: 'Instrument Serif',
    font_family_body: 'Space Grotesk'
};

export const FONT_PRESETS = [
    {
        id: 'riven-editorial',
        name: 'Riven Editorial',
        display: 'Instrument Serif',
        body: 'Space Grotesk',
        description: 'Current Riven default pairing with contrast and clarity.'
    },
    {
        id: 'studio-sans',
        name: 'Studio Sans',
        display: 'Space Grotesk',
        body: 'Space Grotesk',
        description: 'Clean product mode for sharper, more utilitarian themes.'
    },
    {
        id: 'signal-mono',
        name: 'Signal Mono',
        display: 'JetBrains Mono',
        body: 'Space Grotesk',
        description: 'Tighter, more technical voice without losing legibility.'
    },
    {
        id: 'library-legacy',
        name: 'Library Legacy',
        display: 'Cormorant Garamond',
        body: 'Lora',
        description: 'The older Riven editorial stack for softer, literary themes.'
    }
];

export const ACCENT_PRESETS = [
    { name: 'Lantern', color: '#cfa76a' },
    { name: 'Cedar', color: '#c87f5a' },
    { name: 'Sage', color: '#88b08b' },
    { name: 'Tidal', color: '#74a8bf' },
    { name: 'Iris', color: '#9587d6' },
    { name: 'Rose', color: '#d989a9' },
    { name: 'Signal', color: '#52d1c6' },
    { name: 'Cobalt', color: '#6195ff' }
];

export const STYLE_PRESETS = [
    {
        id: 'night-shift',
        name: 'Night Shift',
        eyebrow: 'Dark / Editorial',
        description: 'Low-light, warm accent, balanced for long study sessions.',
        theme: {
            bg_color: '#101a20',
            surface_color: '#16252d',
            text_color: '#edf0ea',
            secondary_text_color: '#8da1a6',
            border_color: '#24343c',
            accent_color: '#cfa76a',
            font_family_display: 'Instrument Serif',
            font_family_body: 'Space Grotesk'
        }
    },
    {
        id: 'paper-stack',
        name: 'Paper Stack',
        eyebrow: 'Light / Editorial',
        description: 'Warm paper palette with stronger contrast for daytime use.',
        theme: {
            bg_color: '#f6f1e8',
            surface_color: '#fffaf2',
            text_color: '#18262d',
            secondary_text_color: '#60737a',
            border_color: '#d7cec1',
            accent_color: '#c88a56',
            font_family_display: 'Instrument Serif',
            font_family_body: 'Space Grotesk'
        }
    },
    {
        id: 'lab-glow',
        name: 'Lab Glow',
        eyebrow: 'Dark / Technical',
        description: 'Sharper contrast and signal teal for productivity-heavy themes.',
        theme: {
            bg_color: '#091117',
            surface_color: '#0f1b22',
            text_color: '#eef5f7',
            secondary_text_color: '#7e99a5',
            border_color: '#17303a',
            accent_color: '#52d1c6',
            font_family_display: 'Space Grotesk',
            font_family_body: 'Space Grotesk'
        }
    },
    {
        id: 'moss-notes',
        name: 'Moss Notes',
        eyebrow: 'Dark / Organic',
        description: 'Earthier, softer palette that still stays recognizably Riven.',
        theme: {
            bg_color: '#101713',
            surface_color: '#17211b',
            text_color: '#ecf1e7',
            secondary_text_color: '#92a690',
            border_color: '#26352c',
            accent_color: '#88b08b',
            font_family_display: 'Instrument Serif',
            font_family_body: 'Space Grotesk'
        }
    },
    {
        id: 'violet-ledger',
        name: 'Violet Ledger',
        eyebrow: 'Dark / Expressive',
        description: 'Moodier purple accent with cleaner typography for focus views.',
        theme: {
            bg_color: '#13131f',
            surface_color: '#1c1d2d',
            text_color: '#f1eef8',
            secondary_text_color: '#9da0bc',
            border_color: '#2c3046',
            accent_color: '#9587d6',
            font_family_display: 'Instrument Serif',
            font_family_body: 'Space Grotesk'
        }
    }
];

export const COLOR_FIELDS = [
    'bg_color',
    'surface_color',
    'text_color',
    'secondary_text_color',
    'border_color',
    'accent_color'
];

export const COLOR_FIELD_LABELS = {
    bg_color: 'Canvas',
    surface_color: 'Panels',
    text_color: 'Primary text',
    secondary_text_color: 'Secondary text',
    border_color: 'Borders',
    accent_color: 'Accent'
};

export function buildThemeDraft(theme = {}) {
    return {
        ...DEFAULT_THEME_DARK,
        ...theme,
        name: theme.name ?? '',
        font_family_display: theme.font_family_display || DEFAULT_THEME_DARK.font_family_display,
        font_family_body: theme.font_family_body || DEFAULT_THEME_DARK.font_family_body
    };
}

export function getBaseTheme(mode) {
    return mode === 'light' ? DEFAULT_THEME_LIGHT : DEFAULT_THEME_DARK;
}

export function visuallyMatchesTheme(theme, comparison) {
    if (!theme || !comparison) return false;

    return COLOR_FIELDS.every((field) => theme[field] === comparison[field])
        && theme.font_family_display === comparison.font_family_display
        && theme.font_family_body === comparison.font_family_body;
}
