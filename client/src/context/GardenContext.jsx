import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import { decorations } from '../utils/gardenCustomization';

const defaultCustomization = {
    gardenTheme: 'cottage',
    decorations: [],
    specialPlants: []
};

export const GardenContext = createContext(null);

export function GardenProvider({ children }) {
    const { isLoggedIn } = useContext(AuthContext);
    const [customization, setCustomization] = useState(defaultCustomization);
    const syncedRef = useRef(false);
    const prevLoggedInRef = useRef(isLoggedIn);

    // Fetch from server when logged in
    useEffect(() => {
        if (prevLoggedInRef.current && !isLoggedIn) {
            syncedRef.current = false;
            setCustomization(defaultCustomization);
        }
        prevLoggedInRef.current = isLoggedIn;

        if (isLoggedIn && !syncedRef.current) {
            syncedRef.current = true;

            const timeoutId = setTimeout(() => {
                authApi.getPetCustomization()
                    .then(serverData => {
                        if (serverData) {
                            setCustomization(prev => ({
                                ...defaultCustomization, // Ensure defaults
                                ...prev,
                                ...serverData, // Override with server data
                                // Ensure arrays are actually arrays
                                decorations: Array.isArray(serverData.decorations) ? serverData.decorations : [],
                                specialPlants: Array.isArray(serverData.specialPlants) ? serverData.specialPlants : []
                            }));
                        }
                    })
                    .catch(() => { });
            }, 500);

            return () => clearTimeout(timeoutId);
        }
    }, [isLoggedIn]);

    // Update customization — server-only sync
    const updateCustomization = useCallback(async (newCustomization) => {
        setCustomization(newCustomization);
        if (isLoggedIn) {
            try {
                await authApi.updatePetCustomization(newCustomization);
            } catch {
                // Failed to sync
            }
        }
    }, [isLoggedIn]);

    const setGardenTheme = useCallback((gardenTheme) => {
        setCustomization(prev => {
            const newCustomization = { ...prev, gardenTheme };
            updateCustomization(newCustomization);
            return newCustomization;
        });
    }, [updateCustomization]);

    const toggleDecoration = useCallback((decorationId) => {
        setCustomization(prev => {
            const currentDecs = Array.isArray(prev.decorations) ? prev.decorations : [];
            const isEquipped = currentDecs.includes(decorationId);
            let newDecorations;

            if (isEquipped) {
                newDecorations = currentDecs.filter(id => id !== decorationId);
            } else {
                const newDec = decorations.find(d => d.id === decorationId);
                const slot = newDec?.slot;
                newDecorations = currentDecs.filter(id => {
                    const dec = decorations.find(d => d.id === id);
                    return dec && dec.slot !== slot;
                });
                newDecorations.push(decorationId);
            }

            const newCustomization = { ...prev, decorations: newDecorations };
            updateCustomization(newCustomization);
            return newCustomization;
        });
    }, [updateCustomization]);

    const togglePlant = useCallback((plantId) => {
        setCustomization(prev => {
            const currentPlants = Array.isArray(prev.specialPlants) ? prev.specialPlants : [];
            const isEquipped = currentPlants.includes(plantId);
            let newPlants;

            if (isEquipped) {
                newPlants = currentPlants.filter(id => id !== plantId);
            } else {
                newPlants = [...currentPlants];
                if (newPlants.length >= 3) {
                    newPlants.shift();
                }
                newPlants.push(plantId);
            }

            const newCustomization = { ...prev, specialPlants: newPlants };
            updateCustomization(newCustomization);
            return newCustomization;
        });
    }, [updateCustomization]);

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
