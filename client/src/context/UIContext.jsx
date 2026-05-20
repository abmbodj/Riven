import { createContext, useState, useCallback, useMemo } from 'react';
export const UIContext = createContext(null);

const NAV_COLLAPSED_STORAGE_KEY = 'riven:nav-collapsed';
const NAV_WIDTH_STORAGE_KEY = 'riven:nav-width';
export const COLLAPSED_NAV_WIDTH = 64;
export const DEFAULT_NAV_WIDTH = 220;
export const COMPACT_NAV_WIDTH = 168;
export const COMPACT_VISUAL_THRESHOLD = 208;
export const SIDEBAR_COLLAPSE_THRESHOLD = 144;
export const SIDEBAR_EXPAND_THRESHOLD = 132;
export const MIN_NAV_WIDTH = COMPACT_NAV_WIDTH;
export const MAX_NAV_WIDTH = 340;

function clampNavWidth(value) {
    if (!Number.isFinite(value)) return DEFAULT_NAV_WIDTH;
    return Math.min(MAX_NAV_WIDTH, Math.max(MIN_NAV_WIDTH, value));
}

export function UIProvider({ children }) {
    const [hideBottomNav, setHideBottomNav] = useState(false);
    const [navCollapsed, setNavCollapsedState] = useState(
        () => localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === 'true'
    );
    const [navWidth, setNavWidthState] = useState(() => {
        const storedValue = Number(localStorage.getItem(NAV_WIDTH_STORAGE_KEY));
        return clampNavWidth(storedValue);
    });
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notifPanelOpen, setNotifPanelOpen] = useState(false);

    // Study session state — set by GuideView, read by MobileBottomNav via Layout
    const [studyMode, setStudyModeState] = useState(null);

    // Contextual toolbar — set by pages (e.g. NoteEditor) for multi-level bottom nav
    const [contextToolbar, setContextToolbarState] = useState(null);
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

    const setNavCollapsed = useCallback((nextValue) => {
        setNavCollapsedState(Boolean(nextValue));
        localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(Boolean(nextValue)));
    }, []);

    const toggleNav = useCallback(() => {
        setNavCollapsedState(prev => {
            const next = !prev;
            localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    const setNavWidth = useCallback((nextWidth) => {
        const clampedWidth = clampNavWidth(nextWidth);
        setNavWidthState(clampedWidth);
        localStorage.setItem(NAV_WIDTH_STORAGE_KEY, String(clampedWidth));
    }, []);

    const toggleDrawer = useCallback(() => setDrawerOpen(p => !p), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleNotifPanel = useCallback(() => setNotifPanelOpen(p => !p), []);
    const closeNotifPanel = useCallback(() => setNotifPanelOpen(false), []);

    const setStudyMode = useCallback((actions) => setStudyModeState(actions), []);
    const clearStudyMode = useCallback(() => setStudyModeState(null), []);

    const setContextToolbar = useCallback((items) => setContextToolbarState(items), []);
    const clearContextToolbar = useCallback(() => setContextToolbarState(null), []);

    const value = useMemo(() => ({
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav, setNavCollapsed,
        navWidth, setNavWidth,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
        studyMode, setStudyMode, clearStudyMode,
        contextToolbar, setContextToolbar, clearContextToolbar,
    }), [
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav, setNavCollapsed,
        navWidth, setNavWidth,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
        studyMode, setStudyMode, clearStudyMode,
        contextToolbar, setContextToolbar, clearContextToolbar,
    ]);

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}
