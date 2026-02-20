import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import { GardenContext } from '../contexts/GardenContext';
export { GardenContext };



export function GardenProvider({ children }) {
    const { isLoggedIn } = useContext(AuthContext);
    const [customization, setCustomization] = useState({ stageOverride: null });
    const syncedRef = useRef(false);
    const prevLoggedInRef = useRef(isLoggedIn);

    // Fetch from server when logged in
    useEffect(() => {
        if (prevLoggedInRef.current && !isLoggedIn) {
            syncedRef.current = false;
            setTimeout(() => setCustomization({ stageOverride: null }), 0);
        }
        prevLoggedInRef.current = isLoggedIn;

        if (isLoggedIn && !syncedRef.current) {
            syncedRef.current = true;

            const timeoutId = setTimeout(() => {
                authApi.getPetCustomization()
                    .then(serverData => {
                        if (serverData) {
                            setCustomization(serverData);
                        }
                    })
                    .catch(() => { });
            }, 500);

            return () => clearTimeout(timeoutId);
        }
    }, [isLoggedIn]);

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

    const setStageOverride = useCallback((stage) => {
        setCustomization(prev => {
            const next = { ...prev, stageOverride: stage };
            updateCustomization(next);
            return next;
        });
    }, [updateCustomization]);

    return (
        <GardenContext.Provider value={{
            customization,
            setStageOverride
        }}>
            {children}
        </GardenContext.Provider>
    );
}
