import { useContext } from 'react';
import { StreakContext } from '../context/StreakContext';

export function useStreakContext() {
    const context = useContext(StreakContext);
    if (!context) {
        throw new Error('useStreakContext must be used within a StreakProvider');
    }
    return context;
}
