import { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { ThemeContext } from './context/themeContext';
import useAuth from './hooks/useAuth';

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

    const applyTheme = useCallback((theme) => {
        if (!theme) return;
        const root = document.documentElement;
        root.style.setProperty('--bg-color', theme.bg_color);
        root.style.setProperty('--surface-color', theme.surface_color);
        root.style.setProperty('--text-color', theme.text_color);
        root.style.setProperty('--secondary-text-color', theme.secondary_text_color);
        root.style.setProperty('--border-color', theme.border_color);
        root.style.setProperty('--accent-color', theme.accent_color);

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
            if (active) applyTheme(active);
        }).catch(() => {
            // Failed to load themes silently
        });
        return () => { mounted = false; };
    }, [applyTheme, isLoggedIn]);

    const switchTheme = useCallback(async (themeId) => {
        try {
            await api.activateTheme(themeId);
            const theme = themes.find(t => t.id === themeId);
            if (theme) {
                setActiveTheme(theme);
                applyTheme(theme);
            }
        } catch {
            // Failed to switch theme silently
        }
    }, [applyTheme, themes]);

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

    return (
        <ThemeContext.Provider value={{ themes, activeTheme, switchTheme, addTheme, updateTheme, deleteTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
