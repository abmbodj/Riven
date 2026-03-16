import { createContext, useState, useCallback, useMemo } from 'react';
export const UIContext = createContext(null);



export function UIProvider({ children }) {
    const [hideBottomNav, setHideBottomNav] = useState(false);

    const showBottomNav = useCallback(() => setHideBottomNav(false), []);
    const hideNav = useCallback(() => setHideBottomNav(true), []);

    const value = useMemo(() => ({ hideBottomNav, showBottomNav, hideNav }), [hideBottomNav, showBottomNav, hideNav]);

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}
