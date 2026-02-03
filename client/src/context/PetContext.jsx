import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import { accessories } from '../utils/pugCustomization';

const STORAGE_KEY = 'riven_pug_customization';

const defaultCustomization = {
    pugType: 'bookworm',
    colorPalette: 'fawn',
    accessories: []
};

export const PetContext = createContext(null);

export function PetProvider({ children }) {
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
    const [loading, setLoading] = useState(false);
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
            setLoading(true);
            authApi.getPetCustomization()
                .then(serverData => {
                    if (serverData && (serverData.pugType || serverData.colorPalette)) {
                        setCustomization(serverData);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
                    }
                })
                .catch(() => {
                    // Failed to fetch, use local
                })
                .finally(() => setLoading(false));
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
    const setPugType = useCallback((pugType) => {
        const newCustomization = { ...customization, pugType };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    const setColorPalette = useCallback((colorPalette) => {
        const newCustomization = { ...customization, colorPalette };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    const toggleAccessory = useCallback((accessoryId) => {
        const isEquipped = customization.accessories.includes(accessoryId);
        let newAccessories;
        
        if (isEquipped) {
            newAccessories = customization.accessories.filter(id => id !== accessoryId);
        } else {
            // Find the slot of the accessory being added
            const newAcc = accessories.find(a => a.id === accessoryId);
            const slot = newAcc?.slot;
            
            // Remove any existing accessory in the same slot
            newAccessories = customization.accessories.filter(id => {
                const acc = accessories.find(a => a.id === id);
                return acc && acc.slot !== slot;
            });
            newAccessories.push(accessoryId);
        }
        
        const newCustomization = { ...customization, accessories: newAccessories };
        updateCustomization(newCustomization);
    }, [customization, updateCustomization]);

    return (
        <PetContext.Provider value={{
            customization,
            loading,
            updateCustomization,
            setPugType,
            setColorPalette,
            toggleAccessory
        }}>
            {children}
        </PetContext.Provider>
    );
}
