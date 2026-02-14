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
                        if (serverData && (serverData.gardenTheme || serverData.decorations)) {
                            setCustomization(serverData);
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
        const newCustomization = { ...customization, gardenTheme };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    const toggleDecoration = useCallback((decorationId) => {
        const isEquipped = customization.decorations?.includes(decorationId);
        let newDecorations;

        if (isEquipped) {
            newDecorations = customization.decorations.filter(id => id !== decorationId);
        } else {
            const newDec = decorations.find(d => d.id === decorationId);
            const slot = newDec?.slot;
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
            newPlants = [...(customization.specialPlants || [])];
            if (newPlants.length >= 3) {
                newPlants.shift();
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
