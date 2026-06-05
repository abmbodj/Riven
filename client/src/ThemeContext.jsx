import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from './api';
import { ThemeContext } from './context/themeContext';
import useAuth from './hooks/useAuth';
import { getDefaultThemes } from './themeCatalog.js';
import { buildGradientCss, normalizeGradientRecipe } from './utils/themeGradientRecipe';

function normalizeThemeForContext(theme) {
    if (!theme) return theme;

    const isDefaultTheme = Boolean(theme.is_default);
    const recipe = normalizeGradientRecipe(theme);

    return {
        ...theme,
        font_family_display: theme.font_family_display || 'Cormorant Garamond',
        font_family_body: theme.font_family_body || 'Lora',
        effect_preset: theme.effect_preset || (isDefaultTheme ? 'auto' : 'none'),
        effect_intensity: theme.effect_intensity || (isDefaultTheme ? 'medium' : 'soft'),
        ...recipe,
    };
}

function getRivenFallbackTheme() {
    const rivenTheme = getDefaultThemes().find((theme) => theme.name === 'Riven') || {};
    return normalizeThemeForContext({
        id: 'fallback-riven',
        ...rivenTheme,
        name: rivenTheme.name || 'Riven',
        is_active: 1,
        is_default: 1,
    });
}

function getPreferredFallbackTheme(themes) {
    return themes.find((theme) => theme.name === 'Riven' && theme.is_default)
        || themes.find((theme) => theme.is_default)
        || themes[0]
        || getRivenFallbackTheme();
}

function markThemeActive(themes, activeTheme) {
    if (!activeTheme) return themes;

    let foundTheme = false;
    const nextThemes = themes.map((theme) => {
        const isActive = theme.id === activeTheme.id;
        foundTheme = foundTheme || isActive;
        return { ...theme, is_active: isActive ? 1 : 0 };
    });

    return foundTheme
        ? nextThemes
        : [...nextThemes, { ...activeTheme, is_active: 1 }];
}

function resolveColorScheme(hexColor) {
    if (!hexColor) return 'dark';

    const sanitized = hexColor.replace('#', '').trim();
    const normalized = sanitized.length === 3
        ? sanitized.split('').map((char) => char + char).join('')
        : sanitized;
    const value = Number.parseInt(normalized, 16);

    if (Number.isNaN(value)) return 'dark';

    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    return luminance > 0.58 ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const [themes, setThemes] = useState([]);
    const [activeTheme, setActiveTheme] = useState(null);
    const [appliedTheme, setAppliedTheme] = useState(null);

    const applyTheme = useCallback((theme) => {
        const resolvedTheme = normalizeThemeForContext(theme);
        if (!resolvedTheme) return;
        const root = document.documentElement;
        root.style.setProperty('--bg-color', resolvedTheme.bg_color);
        root.style.setProperty('--surface-color', resolvedTheme.surface_color);
        root.style.setProperty('--text-color', resolvedTheme.text_color);
        root.style.setProperty('--secondary-text-color', resolvedTheme.secondary_text_color);
        root.style.setProperty('--border-color', resolvedTheme.border_color);
        root.style.setProperty('--accent-color', resolvedTheme.accent_color);
        const recipe = normalizeGradientRecipe(resolvedTheme);
        root.style.setProperty('--theme-background-style', recipe.background_style);
        root.style.setProperty('--theme-gradient-background', buildGradientCss({ ...resolvedTheme, ...recipe }, 0.86));

        // Apply font families
        if (resolvedTheme.font_family_display) {
            root.style.setProperty('--font-display', resolvedTheme.font_family_display);
        }
        if (resolvedTheme.font_family_body) {
            root.style.setProperty('--font-body', resolvedTheme.font_family_body);
        }

        const colorScheme = resolveColorScheme(resolvedTheme.bg_color);
        root.style.colorScheme = colorScheme;

        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta && resolvedTheme.bg_color) {
            themeColorMeta.setAttribute('content', resolvedTheme.bg_color);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        api.getThemes().then(async (data) => {
            if (!mounted) return;
            const normalizedThemes = (data || []).map(normalizeThemeForContext);
            const existingActive = normalizedThemes.find(t => t.is_active);
            let active = existingActive || null;

            if (!active && normalizedThemes.length) {
                const fallbackTheme = getPreferredFallbackTheme(normalizedThemes);
                active = { ...fallbackTheme, is_active: 1 };

                if (isLoggedIn && fallbackTheme?.id) {
                    try {
                        active = normalizeThemeForContext(await api.activateTheme(fallbackTheme.id));
                    } catch {
                        // Use the local Riven/default fallback even if remote repair fails.
                    }
                }
            }

            const resolvedActive = normalizeThemeForContext(active || getRivenFallbackTheme());
            const nextThemes = normalizedThemes.length
                ? markThemeActive(normalizedThemes, resolvedActive)
                : [resolvedActive];
            setThemes(nextThemes);
            setActiveTheme(resolvedActive);
            setAppliedTheme(resolvedActive);
            applyTheme(resolvedActive);
        }).catch(() => {
            if (!mounted) return;
            const fallbackTheme = getRivenFallbackTheme();
            setThemes([fallbackTheme]);
            setActiveTheme(fallbackTheme);
            setAppliedTheme(fallbackTheme);
            applyTheme(fallbackTheme);
        });
        return () => { mounted = false; };
    }, [applyTheme, isLoggedIn]);

    const switchTheme = useCallback(async (themeId) => {
        const activatedTheme = normalizeThemeForContext(await api.activateTheme(themeId));

        setThemes((previous) => {
            let foundTheme = false;

            const nextThemes = previous.map((theme) => {
                const isTarget = theme.id === themeId;
                foundTheme = foundTheme || isTarget;

                return isTarget
                    ? { ...activatedTheme, is_active: 1 }
                    : { ...theme, is_active: 0 };
            });

            return foundTheme
                ? nextThemes
                : [...nextThemes, { ...activatedTheme, is_active: 1 }];
        });
        setActiveTheme(activatedTheme);
        setAppliedTheme(activatedTheme);
        applyTheme(activatedTheme);

        return activatedTheme;
    }, [applyTheme]);

    const addTheme = useCallback(async (themeData) => {
        const newTheme = normalizeThemeForContext(await api.createTheme(themeData));
        setThemes(prev => [...prev, newTheme]);
        return newTheme;
    }, []);

    const updateTheme = useCallback(async (themeId, themeData) => {
        const updatedTheme = normalizeThemeForContext(await api.updateTheme(themeId, themeData));
        setThemes(prev => prev.map(t => t.id === themeId ? updatedTheme : t));
        // If this is the active theme, re-apply it
        if (activeTheme?.id === themeId) {
            setActiveTheme(updatedTheme);
            setAppliedTheme(updatedTheme);
            applyTheme(updatedTheme);
        }
        return updatedTheme;
    }, [activeTheme, applyTheme]);

    const deleteTheme = useCallback(async (themeId) => {
        // Don't allow deleting the active theme
        if (activeTheme?.id === themeId) {
            throw new Error('Cannot delete the active theme. Switch to another theme first.');
        }
        await api.deleteTheme(themeId);
        setThemes(prev => prev.filter(t => t.id !== themeId));
    }, [activeTheme]);

    const applyDraftTheme = useCallback((theme, options = {}) => {
        if (!theme) return;
        if (options.commit !== false) {
            setAppliedTheme(theme);
        }
        applyTheme(theme);
    }, [applyTheme]);

    const restoreActiveTheme = useCallback(() => {
        if (!activeTheme) return;
        setAppliedTheme(activeTheme);
        applyTheme(activeTheme);
    }, [activeTheme, applyTheme]);

    const value = useMemo(() => ({
        themes,
        activeTheme,
        appliedTheme,
        switchTheme,
        addTheme,
        updateTheme,
        deleteTheme,
        applyDraftTheme,
        restoreActiveTheme
    }), [themes, activeTheme, appliedTheme, switchTheme, addTheme, updateTheme, deleteTheme, applyDraftTheme, restoreActiveTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
