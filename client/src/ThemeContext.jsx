import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from './api';
import { ThemeContext } from './context/themeContext';
import useAuth from './hooks/useAuth';
import { buildGradientCss, normalizeGradientRecipe } from './utils/themeGradientRecipe';

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
        if (!theme) return;
        const root = document.documentElement;
        root.style.setProperty('--bg-color', theme.bg_color);
        root.style.setProperty('--surface-color', theme.surface_color);
        root.style.setProperty('--text-color', theme.text_color);
        root.style.setProperty('--secondary-text-color', theme.secondary_text_color);
        root.style.setProperty('--border-color', theme.border_color);
        root.style.setProperty('--accent-color', theme.accent_color);
        const recipe = normalizeGradientRecipe(theme);
        root.style.setProperty('--theme-background-style', recipe.background_style);
        root.style.setProperty('--theme-gradient-background', buildGradientCss({ ...theme, ...recipe }, 0.86));

        // Apply font families
        if (theme.font_family_display) {
            root.style.setProperty('--font-display', theme.font_family_display);
        }
        if (theme.font_family_body) {
            root.style.setProperty('--font-body', theme.font_family_body);
        }

        const colorScheme = resolveColorScheme(theme.bg_color);
        root.style.colorScheme = colorScheme;

        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta && theme.bg_color) {
            themeColorMeta.setAttribute('content', theme.bg_color);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        api.getThemes().then(data => {
            if (!mounted) return;
            setThemes(data);
            const active = data.find(t => t.is_active) || data[0];
            setActiveTheme(active);
            setAppliedTheme(active);
            if (active) applyTheme(active);
        }).catch(() => {
            // Failed to load themes silently
        });
        return () => { mounted = false; };
    }, [applyTheme, isLoggedIn]);

    const switchTheme = useCallback(async (themeId) => {
        const activatedTheme = await api.activateTheme(themeId);

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
        const newTheme = await api.createTheme(themeData);
        setThemes(prev => [...prev, newTheme]);
        return newTheme;
    }, []);

    const updateTheme = useCallback(async (themeId, themeData) => {
        const updatedTheme = await api.updateTheme(themeId, themeData);
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
