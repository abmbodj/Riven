export const DEFAULT_THEME_DARK = {
    name: 'Riven',
    bg_color: '#162a31',
    surface_color: '#1e3840',
    text_color: '#e4ddd0',
    secondary_text_color: '#8fa6a8',
    border_color: '#233e46',
    accent_color: '#deb96a',
    font_family_display: 'Cormorant Garamond',
    font_family_body: 'Lora',
    effect_preset: 'none',
    effect_intensity: 'soft',
    background_style: 'solid',
    gradient_colors: [],
    gradient_angle: 135,
    gradient_intensity: 'medium'
};

export const DEFAULT_THEME_LIGHT = {
    name: 'Riven Light',
    bg_color: '#f5f0e8',
    surface_color: '#ffffff',
    text_color: '#1e3840',
    secondary_text_color: '#6b7d7f',
    border_color: '#ddd5c8',
    accent_color: '#deb96a',
    font_family_display: 'Cormorant Garamond',
    font_family_body: 'Lora',
    effect_preset: 'none',
    effect_intensity: 'soft',
    background_style: 'solid',
    gradient_colors: [],
    gradient_angle: 135,
    gradient_intensity: 'medium'
};

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export const MIN_GRADIENT_STOPS = 2;
export const MAX_GRADIENT_STOPS = 5;
export const DEFAULT_GRADIENT_ANGLE = 135;
export const DEFAULT_GRADIENT_INTENSITY = 'medium';

export const GRADIENT_INTENSITY_OPTIONS = [
    { id: 'soft', name: 'Soft', description: 'Quiet color wash, closest to classic Riven.' },
    { id: 'medium', name: 'Medium', description: 'Visible atmosphere without overwhelming study surfaces.' },
    { id: 'rich', name: 'Rich', description: 'Bolder Arc-like color presence with stronger glow.' }
];

function isValidHex(value) {
    return typeof value === 'string' && HEX_PATTERN.test(value.trim());
}

function normalizeHex(value, fallback = '#162a31') {
    if (!value) return fallback;
    const trimmed = String(value).trim();
    if (HEX_PATTERN.test(trimmed)) return trimmed.toLowerCase();
    const short = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (!short) return fallback;
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
}

function parseGradientColors(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function hexToRgb(hex) {
    const normalized = normalizeHex(hex).replace('#', '');
    const value = Number.parseInt(normalized, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function rgbToHex({ r, g, b }) {
    return `#${[r, g, b]
        .map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0'))
        .join('')}`;
}

function mixHex(left, right, amount = 0.5) {
    const a = hexToRgb(left);
    const b = hexToRgb(right);
    return rgbToHex({
        r: a.r + (b.r - a.r) * amount,
        g: a.g + (b.g - a.g) * amount,
        b: a.b + (b.b - a.b) * amount
    });
}

function getReadableMode(themeOrMode) {
    if (themeOrMode === 'dark' || themeOrMode === 'light') return themeOrMode;
    const bg = typeof themeOrMode === 'object' ? themeOrMode?.bg_color : themeOrMode;
    const { r, g, b } = hexToRgb(bg || DEFAULT_THEME_DARK.bg_color);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.58 ? 'light' : 'dark';
}

export function normalizeGradientColors(colors, fallback = [DEFAULT_THEME_DARK.bg_color, DEFAULT_THEME_DARK.accent_color]) {
    const normalized = parseGradientColors(colors)
        .map((color) => normalizeHex(color, null))
        .filter(isValidHex)
        .slice(0, MAX_GRADIENT_STOPS);

    const next = normalized.length >= MIN_GRADIENT_STOPS
        ? normalized
        : fallback.map((color) => normalizeHex(color)).slice(0, MAX_GRADIENT_STOPS);

    while (next.length < MIN_GRADIENT_STOPS) {
        next.push(DEFAULT_THEME_DARK.accent_color.toLowerCase());
    }

    return next;
}

export function normalizeGradientRecipe(theme = {}) {
    const mode = getReadableMode(theme);
    const isGradient = theme.background_style === 'gradient';
    const fallbackColors = mode === 'light'
        ? [DEFAULT_THEME_LIGHT.bg_color, theme.accent_color || DEFAULT_THEME_LIGHT.accent_color]
        : [theme.bg_color || DEFAULT_THEME_DARK.bg_color, theme.accent_color || DEFAULT_THEME_DARK.accent_color];

    return {
        background_style: isGradient ? 'gradient' : 'solid',
        gradient_colors: isGradient
            ? normalizeGradientColors(theme.gradient_colors, fallbackColors)
            : normalizeGradientColors([], fallbackColors).slice(0, 0),
        gradient_angle: Number.isFinite(Number(theme.gradient_angle))
            ? Math.round(Number(theme.gradient_angle))
            : DEFAULT_GRADIENT_ANGLE,
        gradient_intensity: GRADIENT_INTENSITY_OPTIONS.some((option) => option.id === theme.gradient_intensity)
            ? theme.gradient_intensity
            : DEFAULT_GRADIENT_INTENSITY
    };
}

export function buildGradientCss(theme = {}, alpha = 1) {
    const recipe = normalizeGradientRecipe(theme);
    const colors = recipe.background_style === 'gradient'
        ? recipe.gradient_colors
        : [theme.bg_color || DEFAULT_THEME_DARK.bg_color, theme.surface_color || DEFAULT_THEME_DARK.surface_color];
    const stops = colors.map((color, index) => {
        const position = colors.length === 1 ? 0 : Math.round((index / (colors.length - 1)) * 100);
        return `${color}${alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : ''} ${position}%`;
    });
    return `linear-gradient(${recipe.gradient_angle}deg, ${stops.join(', ')})`;
}

export function deriveThemeFromGradientRecipe(theme = {}) {
    const recipe = normalizeGradientRecipe({ ...theme, background_style: theme.background_style || 'gradient' });
    if (recipe.background_style !== 'gradient') return { ...theme, ...recipe };

    const mode = getReadableMode(theme);
    const [first, second, third = second] = recipe.gradient_colors;
    const intensity = {
        soft: 0.16,
        medium: 0.24,
        rich: 0.33
    }[recipe.gradient_intensity] || 0.24;
    const accent = normalizeHex(theme.accent_color || third || second);
    const base = mode === 'light' ? DEFAULT_THEME_LIGHT : DEFAULT_THEME_DARK;

    if (mode === 'light') {
        const bg = mixHex(base.bg_color, first, intensity * 0.55);
        const surface = mixHex('#ffffff', second, intensity * 0.26);
        return {
            ...theme,
            ...recipe,
            bg_color: bg,
            surface_color: surface,
            text_color: '#17242a',
            secondary_text_color: mixHex('#61747b', accent, 0.08),
            border_color: mixHex('#d9d3ca', second, intensity * 0.38),
            accent_color: accent
        };
    }

    const bg = mixHex('#071116', first, 0.46 + intensity);
    const surface = mixHex(bg, second, 0.20 + intensity * 0.45);
    return {
        ...theme,
        ...recipe,
        bg_color: bg,
        surface_color: surface,
        text_color: '#f2eee7',
        secondary_text_color: mixHex('#8fa6a8', third, 0.18),
        border_color: mixHex(surface, accent, 0.24 + intensity * 0.24),
        accent_color: accent
    };
}
