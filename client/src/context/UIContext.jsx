import { createContext, useState, useCallback } from 'react';

export const UIContext = createContext(null);

export function UIProvider({ children }) {
    const [hideBottomNav, setHideBottomNav] = useState(false);

    const showBottomNav = useCallback(() => setHideBottomNav(false), []);
    const hideNav = useCallback(() => setHideBottomNav(true), []);

    return (
        <UIContext.Provider value={{ hideBottomNav, showBottomNav, hideNav }}>
            {children}
        </UIContext.Provider>
    );
}
