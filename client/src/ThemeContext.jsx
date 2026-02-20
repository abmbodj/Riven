import { createContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
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
    }, [applyTheme]);

    const switchTheme = useCallback(async (themeId) => {
        try {
            await api.activateTheme(themeId);
            setThemes(prev => {
                const theme = prev.find(t => t.id === themeId);
                setActiveTheme(theme);
                applyTheme(theme);
                return prev;
            });
        } catch {
            // Failed to switch theme silently
        }
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
