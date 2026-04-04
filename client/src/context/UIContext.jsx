import { createContext, useState, useCallback, useMemo } from 'react';
export const UIContext = createContext(null);

export function UIProvider({ children }) {
    const [hideBottomNav, setHideBottomNav] = useState(false);
    const [navCollapsed, setNavCollapsed] = useState(
        () => localStorage.getItem('riven:nav-collapsed') === 'true'
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notifPanelOpen, setNotifPanelOpen] = useState(false);

    // Study session state — set by GuideView, read by MobileBottomNav via Layout
    const [studyMode, setStudyModeState] = useState(null);
    // studyMode shape: {
    //   currentIndex: number,
    //   totalSections: number,
    //   onSections: () => void,
    //   onDetails: () => void,
    //   onNote: () => void,
    //   onPrev: () => void,
    //   onNext: () => void,
    //   canPrev: boolean,
    //   canNext: boolean,
    // } | null

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

    const setStudyMode = useCallback((actions) => setStudyModeState(actions), []);
    const clearStudyMode = useCallback(() => setStudyModeState(null), []);

    const value = useMemo(() => ({
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
        studyMode, setStudyMode, clearStudyMode,
    }), [
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
        studyMode, setStudyMode, clearStudyMode,
    ]);

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}
