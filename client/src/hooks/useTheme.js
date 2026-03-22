import { useContext } from 'react';
import { ThemeContext } from '../context/themeContext';

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        return {
            themes: [],
            activeTheme: null,
            appliedTheme: null,
            switchTheme: () => {},
            addTheme: () => {},
            updateTheme: () => {},
            deleteTheme: () => {},
            applyDraftTheme: () => {},
            restoreActiveTheme: () => {}
        };
    }
    return context;
}
