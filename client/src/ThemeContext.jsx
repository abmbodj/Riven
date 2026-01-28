import React, { createContext, useEffect, useState, useCallback } from 'react';
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
    }, []);

    useEffect(() => {
        let mounted = true;
        api.getThemes().then(data => {
            if (!mounted) return;
            setThemes(data);
            const active = data.find(t => t.is_active) || data[0];
            setActiveTheme(active);
            if (active) applyTheme(active);
        }).catch(err => {
            console.error('Failed to load themes', err);
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
        } catch (err) {
            console.error('Failed to switch theme', err);
        }
    }, [applyTheme]);

    const addTheme = useCallback(async (themeData) => {
        try {
            const newTheme = await api.createTheme(themeData);
            setThemes(prev => [...prev, newTheme]);
            return newTheme;
        } catch (err) {
            console.error('Failed to add theme', err);
            throw err;
        }
    }, []);

    const toggleTheme = useCallback(async () => {
        if (!themes.length || !activeTheme) return;
        const isDark = activeTheme.name.toLowerCase().includes('dark');
        const targetTheme = themes.find(t =>
            isDark ? t.name.toLowerCase().includes('light') : t.name.toLowerCase().includes('dark')
        );
        if (targetTheme) {
            await switchTheme(targetTheme.id);
        }
    }, [themes, activeTheme, switchTheme]);

    return (
        <ThemeContext.Provider value={{ themes, activeTheme, switchTheme, addTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
