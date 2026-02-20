import { createContext } from 'react';

export const GardenContext = createContext(null);

export function GardenProvider({ children }) {
    return (
        <GardenContext.Provider value={{}}>
            {children}
        </GardenContext.Provider>
    );
}
