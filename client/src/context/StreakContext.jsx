import React, { createContext } from 'react';
import { useStreak } from '../hooks/useStreak';

export const StreakContext = createContext(null);

export function StreakProvider({ children }) {
    const streak = useStreak();
    
    return (
        <StreakContext.Provider value={streak}>
            {children}
        </StreakContext.Provider>
    );
}
