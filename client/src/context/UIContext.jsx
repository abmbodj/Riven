import { useState, useCallback } from 'react';
import { UIContext } from '../contexts/UIContext';
export { UIContext };



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
