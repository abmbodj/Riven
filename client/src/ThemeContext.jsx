import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [themes, setThemes] = useState([]);
    const [activeTheme, setActiveTheme] = useState(null);

    const applyTheme = (theme) => {
        const root = document.documentElement;
        root.style.setProperty('--bg-color', theme.bg_color);
        root.style.setProperty('--surface-color', theme.surface_color);
        root.style.setProperty('--text-color', theme.text_color);
        root.style.setProperty('--secondary-text-color', theme.secondary_text_color);
        root.style.setProperty('--border-color', theme.border_color);
        root.style.setProperty('--accent-color', theme.accent_color);
    };

    const loadThemes = async () => {
        try {
            const data = await api.getThemes();
            setThemes(data);
            const active = data.find(t => t.is_active) || data[0];
            setActiveTheme(active);
            if (active) applyTheme(active);
        } catch (err) {
            console.error('Failed to load themes', err);
        }
    };

    const switchTheme = async (themeId) => {
        try {
            await api.activateTheme(themeId);
            const theme = themes.find(t => t.id === themeId);
            setActiveTheme(theme);
            applyTheme(theme);
        } catch (err) {
            console.error('Failed to switch theme', err);
        }
    };

    const addTheme = async (themeData) => {
        try {
            const newTheme = await api.createTheme(themeData);
            setThemes([...themes, newTheme]);
            return newTheme;
        } catch (err) {
            console.error('Failed to add theme', err);
            throw err;
        }
    };

    useEffect(() => {
        loadThemes();
    }, []);

    return (
        <ThemeContext.Provider value={{ themes, activeTheme, switchTheme, addTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
