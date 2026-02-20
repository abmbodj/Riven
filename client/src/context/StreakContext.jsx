
import { useStreak } from '../hooks/useStreak';
import { StreakContext } from '../contexts/StreakContext';
export { StreakContext };



export function StreakProvider({ children }) {
    const streak = useStreak();

    return (
        <StreakContext.Provider value={streak}>
            {children}
        </StreakContext.Provider>
    );
}
