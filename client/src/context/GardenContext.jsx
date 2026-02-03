import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import { decorations } from '../utils/gardenCustomization';

const STORAGE_KEY = 'riven_garden_customization';

const defaultCustomization = {
    gardenTheme: 'cottage',
    decorations: [],
    specialPlants: []
};

export const GardenContext = createContext(null);

export function GardenProvider({ children }) {
    const { isLoggedIn } = useContext(AuthContext);
    const [customization, setCustomization] = useState(() => {
        // Load from localStorage initially
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : defaultCustomization;
        } catch {
            return defaultCustomization;
        }
    });
    const syncedRef = useRef(false);
    const prevLoggedInRef = useRef(isLoggedIn);

    // Sync from server when logged in
    useEffect(() => {
        // Reset sync flag on logout
        if (prevLoggedInRef.current && !isLoggedIn) {
            syncedRef.current = false;
        }
        prevLoggedInRef.current = isLoggedIn;

        if (isLoggedIn && !syncedRef.current) {
            syncedRef.current = true;
            // Use a flag to track if component is still mounted
            let isMounted = true;
            
            const syncFromServer = async () => {
                try {
                    const serverData = await authApi.getPetCustomization();
                    if (isMounted && serverData && (serverData.gardenTheme || serverData.decorations)) {
                        setCustomization(serverData);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
                    }
                } catch {
                    // Failed to fetch, use local
                }
            };
            
            syncFromServer();
            
            return () => {
                isMounted = false;
            };
        }
    }, [isLoggedIn]);

    // Update customization with immediate sync
    const updateCustomization = useCallback(async (newCustomization) => {
        setCustomization(newCustomization);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCustomization));
        
        // Sync to server if logged in
        if (isLoggedIn) {
            try {
                await authApi.updatePetCustomization(newCustomization);
            } catch {
                // Failed to sync, but local state is updated
            }
        }
    }, [isLoggedIn]);

    // Helper functions for specific updates
    const setGardenTheme = useCallback((gardenTheme) => {
        const newCustomization = { ...customization, gardenTheme };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    const toggleDecoration = useCallback((decorationId) => {
        const isEquipped = customization.decorations?.includes(decorationId);
        let newDecorations;
        
        if (isEquipped) {
            newDecorations = customization.decorations.filter(id => id !== decorationId);
        } else {
            // Find the slot of the decoration being added
            const newDec = decorations.find(d => d.id === decorationId);
            const slot = newDec?.slot;
            
            // Remove any existing decoration in the same slot (one per slot)
            newDecorations = (customization.decorations || []).filter(id => {
                const dec = decorations.find(d => d.id === id);
                return dec && dec.slot !== slot;
            });
            newDecorations.push(decorationId);
        }
        
        const newCustomization = { ...customization, decorations: newDecorations };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    const togglePlant = useCallback((plantId) => {
        const isEquipped = customization.specialPlants?.includes(plantId);
        let newPlants;
        
        if (isEquipped) {
            newPlants = customization.specialPlants.filter(id => id !== plantId);
        } else {
            // Allow multiple plants (up to 3)
            newPlants = [...(customization.specialPlants || [])];
            if (newPlants.length >= 3) {
                newPlants.shift(); // Remove oldest
            }
            newPlants.push(plantId);
        }
        
        const newCustomization = { ...customization, specialPlants: newPlants };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    return (
        <GardenContext.Provider value={{
            customization,
            updateCustomization,
            setGardenTheme,
            toggleDecoration,
            togglePlant
        }}>
            {children}
        </GardenContext.Provider>
    );
}
