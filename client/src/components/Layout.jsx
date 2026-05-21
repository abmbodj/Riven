import { lazy, Suspense, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Home from 'lucide-react/dist/esm/icons/home';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off';
import User from 'lucide-react/dist/esm/icons/user';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Users from 'lucide-react/dist/esm/icons/users';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Settings from 'lucide-react/dist/esm/icons/settings';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import OnboardingArt from './OnboardingArt';
import { motion, AnimatePresence } from 'motion/react';
import { prefetchRoute } from '../routes/config.jsx';
import { UIContext } from '../context/UIContext';
import { AuthContext, AuthStatusContext } from '../context/AuthContext';
import { useAppUpdate } from '../context/AppUpdateContext.jsx';
import TopBar from './TopBar.jsx';
import { useNotificationSync } from '../hooks/useNotificationSync';
import {
    COLLAPSED_NAV_WIDTH,
    COMPACT_NAV_WIDTH,
    COMPACT_VISUAL_THRESHOLD,
    DEFAULT_NAV_WIDTH,
    MAX_NAV_WIDTH,
    MIN_NAV_WIDTH,
    SIDEBAR_COLLAPSE_THRESHOLD,
    SIDEBAR_EXPAND_THRESHOLD,
} from '../context/UIContext.jsx';

const GlobalCommandPalette = lazy(() => import('./GlobalCommandPalette.jsx'));
const GlobalThemeOverlay = lazy(() => import('./GlobalThemeOverlay.jsx'));
const MobileBottomNav = lazy(() => import('./MobileBottomNav.jsx'));
const MobileDrawer = lazy(() => import('./MobileDrawer.jsx'));
const CreateSheet = lazy(() => import('./CreateSheet.jsx'));
const FloatingRecordingWidget = lazy(() => import('./audio/FloatingRecordingWidget.jsx'));

const routeMatches = (pathname, matchers = []) => matchers.some((matcher) => (
    pathname === matcher || pathname.startsWith(`${matcher}/`)
));

const getPrimaryNavItems = (isLoggedIn) => [
    {
        to: isLoggedIn ? '/dashboard' : '/',
        icon: Home,
        label: 'Today',
        matchers: isLoggedIn ? ['/dashboard'] : ['/']
    },
    {
        to: '/decks',
        icon: Layers,
        label: 'Study',
        matchers: ['/decks', '/deck', '/create', '/notes', '/note', '/guides', '/guide', '/exams', '/exam', '/youtube']
    },
    { id: 'fab', isFab: true },
    {
        to: '/classes',
        icon: Calendar,
        label: 'Classes',
        matchers: ['/classes', '/class']
    },
    {
        to: '/groups',
        icon: Users,
        label: 'Groups',
        matchers: ['/groups']
    },
];

const utilityLinks = [
    { to: '/garden',   icon: Sprout,   label: 'Garden',   color: 'text-claude-accent'    },
    { to: '/themes',   icon: Palette,  label: 'Themes',   color: 'text-claude-accent'    },
    { to: '/account',  icon: User,     label: 'Account',  color: 'text-claude-secondary' },
    { to: '/settings', icon: Settings, label: 'Settings', color: 'text-claude-secondary' },
];

const getInitialOfflineState = () => {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine === false;
};

export function resolveSidebarDragState(clientX) {
    const proposedWidth = clientX + 8;
    if (proposedWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
        return {
            collapsed: true,
            width: COMPACT_NAV_WIDTH,
        };
    }

    return {
        collapsed: false,
        width: Math.min(MAX_NAV_WIDTH, Math.max(MIN_NAV_WIDTH, proposedWidth)),
    };
}

export default function Layout({ children }) {
    const location = useLocation();
    const {
        hideBottomNav: hideNavFromContext,
        navCollapsed,
        toggleNav,
        setNavCollapsed,
        navWidth = DEFAULT_NAV_WIDTH,
        setNavWidth,
        studyMode,
        contextToolbar,
        drawerOpen,
    } = useContext(UIContext) || {};
    const authStatus = useContext(AuthStatusContext);
    const legacyAuthState = useContext(AuthContext);
    const { isLoggedIn } = authStatus || legacyAuthState || {};
    const {
        isUpdateAvailable,
        isRefreshingUpdate,
        dismissUpdate,
        refreshToLatestVersion,
    } = useAppUpdate();
    useNotificationSync();
    const primaryNavItems = getPrimaryNavItems(isLoggedIn);

    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test') || /^\/exam\/[^/]+$/.test(location.pathname);
    const isCreatePage = location.pathname === '/create';
    const isEditProfilePage = location.pathname === '/edit-profile';
    const isMessagesChat = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
    const [isOffline, setIsOffline] = useState(getInitialOfflineState);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [createSheetOpen, setCreateSheetOpen] = useState(false);
    const [hasOpenedCommandPalette, setHasOpenedCommandPalette] = useState(false);
    const [hasOpenedCreateSheet, setHasOpenedCreateSheet] = useState(false);
    const [hasOpenedDrawer, setHasOpenedDrawer] = useState(false);
    const [isSidebarResizing, setIsSidebarResizing] = useState(false);
    const pageContentRef = useRef(null);
    const sidebarResizeFrameRef = useRef(0);

    // Lightweight page enter animation on route change.
    useEffect(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches || !pageContentRef.current) return;
        if (typeof pageContentRef.current.animate !== 'function') return;

        const animation = pageContentRef.current.animate(
            [
                { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );

        return () => animation.cancel();
    }, [location.pathname]);

    useEffect(() => {
        if (isCommandPaletteOpen) setHasOpenedCommandPalette(true);
    }, [isCommandPaletteOpen]);

    useEffect(() => {
        if (createSheetOpen) setHasOpenedCreateSheet(true);
    }, [createSheetOpen]);

    useEffect(() => {
        if (drawerOpen) setHasOpenedDrawer(true);
    }, [drawerOpen]);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const targetTag = event.target?.tagName;
            const isTypingField = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || event.target?.isContentEditable;

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsCommandPaletteOpen(true);
                return;
            }

            if (isTypingField) return;

            if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
                event.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isAccountPage = location.pathname === '/account';
    const isOnboardingPage = location.pathname === '/onboarding';
    const isLegalPage = location.pathname === '/privacy' || location.pathname === '/terms';
    const isLandingPage = location.pathname === '/';
    const isSettingsPage = location.pathname === '/settings';
    const isGuidePage = /^\/guide\/[^/]+$/.test(location.pathname);
    const isWideDesktopPage = isSettingsPage || isGuidePage;
    const pageOwnsTopSafeArea = isOnboardingPage || isLandingPage || isMessagesChat;
    const hideBottomNav = isStudyOrTest || isCreatePage || isEditProfilePage || isMessagesChat || isLegalPage || isOnboardingPage || hideNavFromContext || (!isLoggedIn && (isAccountPage || isLandingPage));

    // Fullscreen pages that need edge-to-edge backgrounds (no padding from Layout)
    const isFullscreenPage = isStudyOrTest || isOnboardingPage || (!isLoggedIn && (isAccountPage || isLandingPage));
    // Show sidebar on desktop only when logged in and not on a fullscreen page
    const showDesktopSidebar = isLoggedIn && !isStudyOrTest && !isFullscreenPage;
    // Show top bar when logged in and not on fullscreen pages
    const showTopBar = isLoggedIn && !isFullscreenPage && !isStudyOrTest;

    const desktopSidebarWidth = navCollapsed ? COLLAPSED_NAV_WIDTH : navWidth;
    const isCompactSidebar = !navCollapsed && navWidth <= COMPACT_VISUAL_THRESHOLD;

    const handleSidebarResize = useCallback((clientX) => {
        if (typeof clientX !== 'number' || !setNavWidth || !setNavCollapsed) return;
        const nextState = resolveSidebarDragState(clientX);
        setNavCollapsed(nextState.collapsed);
        setNavWidth(nextState.width);
    }, [setNavCollapsed, setNavWidth]);

    const startSidebarResize = useCallback((event) => {
        if (!showDesktopSidebar || !setNavWidth || !setNavCollapsed) return;
        event.preventDefault();
        setIsSidebarResizing(true);
        if (navCollapsed && event.clientX + 8 >= SIDEBAR_EXPAND_THRESHOLD) {
            setNavCollapsed(false);
            setNavWidth(COMPACT_NAV_WIDTH);
        }
    }, [navCollapsed, setNavCollapsed, setNavWidth, showDesktopSidebar]);

    useEffect(() => {
        if (!isSidebarResizing) return undefined;

        const handlePointerMove = (event) => {
            const clientX = event.clientX;
            cancelAnimationFrame(sidebarResizeFrameRef.current);
            sidebarResizeFrameRef.current = window.requestAnimationFrame(() => {
                handleSidebarResize(clientX);
            });
        };

        const stopSidebarResize = () => {
            cancelAnimationFrame(sidebarResizeFrameRef.current);
            setIsSidebarResizing(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopSidebarResize);
        window.addEventListener('pointercancel', stopSidebarResize);

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        return () => {
            cancelAnimationFrame(sidebarResizeFrameRef.current);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopSidebarResize);
            window.removeEventListener('pointercancel', stopSidebarResize);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [handleSidebarResize, isSidebarResizing]);

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text overflow-x-hidden">
            <Suspense fallback={null}>
                <GlobalThemeOverlay />
            </Suspense>

            {/* Skip to main content (accessibility) */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-claude-surface focus:text-claude-text focus:border focus:border-claude-border/30 focus:text-sm focus:font-mono"
            >
                Skip to content
            </a>

            {/* Flex wrapper: sidebar + content on desktop */}
            <div className="relative w-full bg-claude-bg flex">

                {/* ===== Desktop / Tablet Sidebar (md+) ===== */}
                {showDesktopSidebar && (
                    <aside
                        className={`
                            hidden md:flex md:flex-col
                            fixed inset-y-0 left-0 z-30
                            motion-safe:transition-[width] motion-safe:duration-[250ms] motion-safe:ease-out
                            overflow-hidden
                        `}
                        style={{ width: `${desktopSidebarWidth}px` }}
                    >
                        <div className="desktop-sidebar-shell relative flex h-full flex-col overflow-hidden rounded-[2rem] mx-2 my-2">
                            <div className="relative flex h-full flex-col">
                                {/* Logo — only visible when expanded */}
                                <Link
                                    to="/"
                                    className={`flex items-center group transition-opacity duration-150 ${
                                        isCompactSidebar ? 'gap-2 px-3 pt-5 pb-3' : 'gap-3 px-4 pt-6 pb-4'
                                    } ${navCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                    aria-hidden={navCollapsed}
                                    tabIndex={navCollapsed ? -1 : 0}
                                >
                                    <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] overflow-hidden transition-transform duration-500 group-hover:scale-105 group-hover:bg-white/[0.1] group-hover:border-claude-accent/20">
                                        <OnboardingArt className="w-7 h-7 scale-[1.3] mt-1" />
                                    </div>
                                    <span className={`font-display text-claude-text tracking-tight transition-colors duration-300 group-hover:text-white whitespace-nowrap ${
                                        isCompactSidebar ? 'text-lg' : 'text-xl'
                                    }`}>Riven</span>
                                </Link>

                                {/* Collapsed logo icon */}
                                {navCollapsed && (
                                    <div className="flex items-center justify-center pt-6 pb-4">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10 overflow-hidden">
                                            <OnboardingArt className="w-7 h-7 scale-[1.3] mt-1" />
                                        </div>
                                    </div>
                                )}

                                {/* Main Nav */}
                                <nav
                                    role="navigation"
                                    aria-label="Main"
                                    className="flex-1 px-2 py-2 space-y-1"
                                >
                                    {primaryNavItems.filter(item => !item.isFab).map((item) => {
                                        const isActive = routeMatches(location.pathname, item.matchers);

                                        return (
                                            <Link
                                                key={item.to}
                                                to={item.to}
                                                title={navCollapsed ? item.label : undefined}
                                                onMouseEnter={() => prefetchRoute(item.to)}
                                                className={`group relative overflow-hidden rounded-xl flex items-center transition-all duration-300 cursor-pointer ${
                                                    navCollapsed ? 'justify-center px-2 py-2.5 gap-3.5' : isCompactSidebar ? 'px-2.5 py-2.5 gap-2.5' : 'px-3 py-2.5 gap-3.5'
                                                } ${isActive
                                                    ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                                    : 'text-claude-secondary/70 hover:bg-white/[0.05] hover:text-white hover:translate-x-1'
                                                }`}
                                            >
                                                {isActive && !navCollapsed && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-claude-accent shadow-[0_0_12px_rgba(var(--claude-accent-rgb),0.8)]" />
                                                )}
                                                {isActive && navCollapsed && (
                                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-claude-accent" />
                                                )}
                                                <div className={`relative flex items-center justify-center w-6 h-6 shrink-0 transition-colors duration-300 ${isActive ? 'text-claude-accent' : 'text-claude-secondary/50 group-hover:text-claude-secondary'}`}>
                                                    <item.icon strokeWidth={isActive ? 2.5 : 2} className="w-[18px] h-[18px]" />
                                                </div>
                                                <span
                                                    aria-hidden={navCollapsed}
                                                    className={`font-mono uppercase whitespace-nowrap overflow-hidden transition-[opacity,width] duration-150 ${
                                                        isCompactSidebar ? 'text-[10px] tracking-[0.08em]' : 'text-[11px] tracking-[0.1em]'
                                                    } ${
                                                        isActive ? 'font-semibold' : 'font-medium'
                                                    } ${navCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}
                                                >
                                                    {item.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </nav>

                                {/* Utility Links — hidden when collapsed */}
                                {!navCollapsed && (
                                    <nav className="px-2 py-3 space-y-1">
                                        <div className={`mb-2 ${isCompactSidebar ? 'px-2.5' : 'px-3'}`}>
                                            <h3 className={`font-mono font-semibold uppercase text-claude-secondary/50 selection:bg-transparent ${
                                                isCompactSidebar ? 'text-[9px] tracking-[0.18em]' : 'text-[10px] tracking-[0.25em]'
                                            }`}>Utilities</h3>
                                        </div>
                                        {utilityLinks.map((item) => {
                                            const isActive = routeMatches(location.pathname, [item.to]);
                                            return (
                                                <Link
                                                    key={item.to}
                                                    to={item.to}
                                                    onMouseEnter={() => prefetchRoute(item.to)}
                                                    className={`group flex items-center rounded-xl transition-all duration-300 cursor-pointer ${
                                                        isCompactSidebar ? 'gap-2.5 px-2.5 py-2' : 'gap-3.5 px-3 py-2'
                                                    } ${
                                                        isActive
                                                            ? `bg-white/[0.08] ${item.color}`
                                                            : 'text-claude-secondary/70 hover:text-white hover:bg-white/[0.05] hover:translate-x-1'
                                                    }`}
                                                >
                                                    <div className={`relative flex items-center justify-center w-6 h-6 shrink-0 transition-colors duration-300 ${isActive ? item.color : 'text-claude-secondary/40 group-hover:text-claude-secondary'}`}>
                                                        <item.icon strokeWidth={isActive ? 2.5 : 2} className="w-[16px] h-[16px]" />
                                                    </div>
                                                    <span className={`font-mono uppercase whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'} ${
                                                        isCompactSidebar ? 'text-[9px] tracking-[0.08em]' : 'text-[10px] tracking-[0.1em]'
                                                    }`}>{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </nav>
                                )}

                                {/* Utility icon row when collapsed */}
                                {navCollapsed && (
                                    <nav
                                        role="navigation"
                                        aria-label="Utilities"
                                        className="px-2 py-3 space-y-1"
                                    >
                                        {utilityLinks.map((item) => {
                                            const isActive = routeMatches(location.pathname, [item.to]);
                                            return (
                                                <Link
                                                    key={item.to}
                                                    to={item.to}
                                                    title={item.label}
                                                    onMouseEnter={() => prefetchRoute(item.to)}
                                                    className={`group flex items-center justify-center w-full py-2 rounded-xl transition-all duration-300 cursor-pointer ${
                                                        isActive
                                                            ? `bg-white/[0.08] ${item.color}`
                                                            : 'text-claude-secondary/40 hover:text-claude-secondary hover:bg-white/[0.05]'
                                                    }`}
                                                >
                                                    <item.icon strokeWidth={isActive ? 2.5 : 2} className="w-[16px] h-[16px]" />
                                                </Link>
                                            );
                                        })}
                                    </nav>
                                )}

                                {/* Create Note CTA — hidden when collapsed */}
                                {!navCollapsed && (
                                    <div className={`mt-auto ${isCompactSidebar ? 'px-2.5 py-3' : 'px-3 py-4'}`}>
                                        <Link
                                            to="/note/new"
                                            className={`group relative flex items-center justify-center w-full rounded-2xl bg-claude-accent/10 border border-claude-accent/20 text-claude-accent font-mono font-bold uppercase transition-all duration-500 hover:bg-claude-accent hover:border-claude-accent hover:text-white hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 overflow-hidden cursor-pointer ${
                                                isCompactSidebar ? 'gap-2 py-3 text-[10px] tracking-[0.1em]' : 'gap-2.5 py-3.5 text-[11px] tracking-[0.15em]'
                                            }`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                                            <Plus className="w-[18px] h-[18px] transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
                                            <span>Create Note</span>
                                        </Link>
                                    </div>
                                )}

                                {/* Collapse / expand toggle button */}
                                <div className={`px-2 py-3 mt-auto border-t border-claude-border/20 flex ${navCollapsed ? 'justify-center' : 'justify-end'}`}>
                                    <button
                                        type="button"
                                        onClick={toggleNav}
                                        title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                        aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                        className="flex h-8 w-8 items-center justify-center rounded-xl text-claude-secondary/50 transition-colors hover:bg-white/[0.07] hover:text-claude-secondary cursor-pointer"
                                    >
                                        <ChevronLeft className={`w-4 h-4 motion-safe:transition-transform motion-safe:duration-[250ms] ${navCollapsed ? 'rotate-180' : 'rotate-0'}`} />
                                    </button>
                                </div>

                                {/* Bottom spacer */}
                                <div className="pb-safe" />
                            </div>
                        </div>

                        <button
                            type="button"
                            aria-label={navCollapsed ? 'Drag to expand sidebar' : 'Resize sidebar'}
                            title={navCollapsed ? 'Drag to expand sidebar' : 'Drag to resize sidebar'}
                            onPointerDown={startSidebarResize}
                            className={`absolute inset-y-6 right-0 hidden w-4 -translate-x-1/2 cursor-col-resize md:block transition-opacity ${isSidebarResizing ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus:opacity-100'}`}
                        >
                            <span className="mx-auto block h-full w-px rounded-full bg-claude-accent/45 shadow-[0_0_12px_rgba(222,185,106,0.22)]" />
                        </button>
                    </aside>
                )}

                {/* ===== Main Content Area ===== */}
                <div
                    className={`
                        flex-1 min-h-dvh overflow-x-hidden
                        ${showDesktopSidebar ? 'motion-safe:transition-[margin] motion-safe:duration-[250ms] motion-safe:ease-out' : ''}
                    `}
                    style={showDesktopSidebar ? { marginLeft: `${desktopSidebarWidth}px` } : undefined}
                >
                    <AnimatePresence>
                        {isUpdateAvailable && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                role="status"
                                aria-live="polite"
                                className="sticky top-0 z-40 border-b border-claude-accent/30 bg-claude-surface/95 px-4 py-3 backdrop-blur safe-area-top overflow-hidden"
                            >
                                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0">
                                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-claude-accent">
                                            New version available
                                        </p>
                                        <p className="mt-1 text-sm text-claude-text">
                                            Refresh to load the latest production changes without waiting for a crash.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 self-start md:self-auto">
                                        <button
                                            type="button"
                                            onClick={dismissUpdate}
                                            className="rounded-xl border border-claude-border/50 px-3 py-2 text-xs font-mono uppercase tracking-[0.16em] text-claude-secondary transition-colors hover:border-claude-border hover:text-claude-text"
                                        >
                                            Later
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void refreshToLatestVersion();
                                            }}
                                            disabled={isRefreshingUpdate}
                                            className="inline-flex items-center gap-2 rounded-xl bg-claude-accent px-4 py-2 text-xs font-mono uppercase tracking-[0.16em] text-[#10271b] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isRefreshingUpdate ? 'animate-spin' : ''}`} />
                                            Refresh now
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Offline banner */}
                    <AnimatePresence>
                        {isOffline && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                role="alert"
                                aria-live="polite"
                                className="sticky top-0 z-30 bg-yellow-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium safe-area-top overflow-hidden"
                            >
                                <WifiOff className="w-4 h-4" />
                                <span className="font-mono text-xs tracking-wide">Offline — changes saved locally</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Top bar */}
                    {showTopBar && (
                        <TopBar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
                    )}

                    {/* Main content with page transitions */}
                    <main
                        id="main-content"
                        className={`[overflow-x:clip] ${
                            isFullscreenPage ? '' : isStudyOrTest ? '' : isMessagesChat ? 'lg:px-8 lg:py-6' : 'px-4 py-4 lg:px-8 lg:py-6'
                        } ${
                            hideBottomNav
                                ? ((isFullscreenPage || isMessagesChat) ? '' : 'pb-6')
                                : contextToolbar
                                    ? 'pb-[calc(10rem+env(safe-area-inset-bottom,0px))] md:pb-6'
                                    : 'pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6'
                        } ${
                            !isOffline && !pageOwnsTopSafeArea && !showTopBar ? 'safe-area-top' : ''
                        }`}
                    >
                        {/* Center content on desktop with max-width (skip for fullscreen pages) */}
                        <div className={isFullscreenPage ? '' : `lg:mx-auto ${isWideDesktopPage ? 'lg:max-w-none' : 'lg:max-w-5xl'}`}>
                            <div
                                ref={pageContentRef}
                                key={location.pathname}
                            >
                                {children}
                            </div>
                        </div>
                    </main>

                    {/* Mobile bottom navigation */}
                    {!hideBottomNav && (
                        <Suspense fallback={null}>
                            <MobileBottomNav
                                primaryNavItems={primaryNavItems}
                                onFabPress={() => setCreateSheetOpen(true)}
                                studyMode={studyMode}
                                contextToolbar={contextToolbar}
                            />
                        </Suspense>
                    )}

                    <Suspense fallback={null}>
                        <FloatingRecordingWidget hideBottomNav={hideBottomNav} />
                    </Suspense>
                </div>
            </div>

            {/* Mobile drawer (slides from left, mobile-only) */}
            {hasOpenedDrawer && (
                <Suspense fallback={null}>
                    <MobileDrawer />
                </Suspense>
            )}

            {/* Create sheet (FAB bottom sheet) */}
            {hasOpenedCreateSheet && (
                <Suspense fallback={null}>
                    <CreateSheet
                        open={createSheetOpen}
                        onClose={() => setCreateSheetOpen(false)}
                    />
                </Suspense>
            )}

            {hasOpenedCommandPalette && (
                <Suspense fallback={null}>
                    <GlobalCommandPalette
                        isOpen={isCommandPaletteOpen}
                        isLoggedIn={isLoggedIn}
                        onClose={() => setIsCommandPaletteOpen(false)}
                    />
                </Suspense>
            )}
        </div>
    );
}
