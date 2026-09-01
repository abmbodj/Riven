const PERSIST_KEY = 'riven_groups_cache_v1';
const THEME_CACHE_KEY = 'theme:active';
const COLOR_TOKENS = {
    bg_color: '--bg-color',
    surface_color: '--surface-color',
    text_color: '--text-color',
    secondary_text_color: '--secondary-text-color',
    border_color: '--border-color',
    accent_color: '--accent-color',
};

function isSafeCssColor(value) {
    return typeof value === 'string'
        && value.length <= 64
        && /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\)|[a-z]+)$/i.test(value.trim());
}

export function applyCachedThemeColors() {
    if (typeof document === 'undefined' || typeof sessionStorage === 'undefined') return false;

    try {
        const parsed = JSON.parse(sessionStorage.getItem(PERSIST_KEY) || 'null');
        const entry = parsed?.entries?.[THEME_CACHE_KEY];
        if (!entry || Number(entry.expiresAt) <= Date.now()) return false;

        let applied = false;
        for (const [property, token] of Object.entries(COLOR_TOKENS)) {
            const value = entry.value?.[property];
            if (!isSafeCssColor(value)) continue;
            document.documentElement.style.setProperty(token, value.trim());
            applied = true;
        }
        return applied;
    } catch {
        return false;
    }
}
