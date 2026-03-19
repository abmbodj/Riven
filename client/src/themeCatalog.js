export const THEME_VISUAL_FIELDS = [
    'bg_color',
    'surface_color',
    'text_color',
    'secondary_text_color',
    'border_color',
    'accent_color',
    'font_family_display',
    'font_family_body',
];

export const DEPRECATED_DEFAULT_THEME_NAMES = [
    'Botanical Garden',
    'Desert Rose',
    'Forest Canopy',
    'Golden Hour',
    'Midnight Galaxy',
    'Ocean Depths',
    'Rose',
    'Sunset Blvd',
];

const DEFAULT_THEME_CATALOG = [
    {
        collection: 'foundation',
        name: 'Riven',
        bg_color: '#162a31',
        surface_color: '#1e3840',
        text_color: '#e4ddd0',
        secondary_text_color: '#8fa6a8',
        border_color: '#233e46',
        accent_color: '#deb96a',
        font_family_display: 'Cormorant Garamond',
        font_family_body: 'Lora',
        is_active: 1,
        is_default: 1,
    },
    {
        collection: 'foundation',
        name: 'Riven Light',
        bg_color: '#f5f0e8',
        surface_color: '#ffffff',
        text_color: '#1e3840',
        secondary_text_color: '#6b7d7f',
        border_color: '#ddd5c8',
        accent_color: '#deb96a',
        font_family_display: 'Cormorant Garamond',
        font_family_body: 'Lora',
        is_active: 0,
        is_default: 1,
    },
    {
        collection: 'foundation',
        name: 'Arctic Frost',
        bg_color: '#eaf2f6',
        surface_color: '#f9fdff',
        text_color: '#163038',
        secondary_text_color: '#607983',
        border_color: '#cad8de',
        accent_color: '#89c3d4',
        font_family_display: 'Instrument Serif',
        font_family_body: 'Space Grotesk',
        is_active: 0,
        is_default: 1,
    },
    {
        collection: 'foundation',
        name: 'Modern Minimal',
        bg_color: '#efeae3',
        surface_color: '#fbf8f3',
        text_color: '#181512',
        secondary_text_color: '#70665d',
        border_color: '#d7cec2',
        accent_color: '#c88259',
        font_family_display: 'Space Grotesk',
        font_family_body: 'Space Grotesk',
        is_active: 0,
        is_default: 1,
    },
    {
        collection: 'foundation',
        name: 'Tech Innovation',
        bg_color: '#061317',
        surface_color: '#0b1d22',
        text_color: '#e7faf8',
        secondary_text_color: '#88a7ab',
        border_color: '#1f3a40',
        accent_color: '#71d6ca',
        font_family_display: 'JetBrains Mono',
        font_family_body: 'Space Grotesk',
        is_active: 0,
        is_default: 1,
    },
];

export const FOUNDATION_THEME_NAMES = DEFAULT_THEME_CATALOG
    .filter((theme) => theme.collection === 'foundation')
    .map((theme) => theme.name);

export function getDefaultThemes() {
    return DEFAULT_THEME_CATALOG.map(({ collection, ...theme }) => ({ ...theme }));
}
