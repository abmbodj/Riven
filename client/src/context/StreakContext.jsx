import React, { createContext, useContext } from 'react';
import { useStreak } from '../hooks/useStreak';

const StreakContext = createContext(null);

export function StreakProvider({ children }) {
    const streak = useStreak();
    
    return (
        <StreakContext.Provider value={streak}>
            {children}
        </StreakContext.Provider>
    );
}

export function useStreakContext() {
    const context = useContext(StreakContext);
    if (!context) {
        throw new Error('useStreakContext must be used within a StreakProvider');
    }
    return context;
}
