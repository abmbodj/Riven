import { useContext } from 'react';
import { ThemeContext } from '../context/themeContext';

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        return { themes: [], activeTheme: null, switchTheme: () => {}, addTheme: () => {} };
    }
    return context;
}
