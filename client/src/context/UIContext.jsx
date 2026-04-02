import { createContext, useState, useCallback, useMemo } from 'react';
export const UIContext = createContext(null);



export function UIProvider({ children }) {
    const [hideBottomNav, setHideBottomNav] = useState(false);
    const [navCollapsed, setNavCollapsed] = useState(
        () => localStorage.getItem('riven:nav-collapsed') === 'true'
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notifPanelOpen, setNotifPanelOpen] = useState(false);

    const showBottomNav = useCallback(() => setHideBottomNav(false), []);
    const hideNav = useCallback(() => setHideBottomNav(true), []);

    const toggleNav = useCallback(() => {
        setNavCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('riven:nav-collapsed', String(next));
            return next;
        });
    }, []);

    const toggleDrawer = useCallback(() => setDrawerOpen(p => !p), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleNotifPanel = useCallback(() => setNotifPanelOpen(p => !p), []);
    const closeNotifPanel = useCallback(() => setNotifPanelOpen(false), []);

    const value = useMemo(() => ({
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
    }), [
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
    ]);

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}
