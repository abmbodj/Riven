import { useState, useEffect, useRef, useContext } from 'react';
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
import Search from 'lucide-react/dist/esm/icons/search';
import OnboardingArt from './OnboardingArt';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { UIContext } from '../context/UIContext';
import { AuthContext } from '../context/AuthContext';
import gsap from 'gsap';
import { EASE, DURATION } from '../utils/animations';
import GlobalCommandPalette from './GlobalCommandPalette.jsx';

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
        matchers: ['/decks', '/deck', '/create']
    },
    { id: 'fab', isFab: true },
    {
        to: '/classes',
        icon: Calendar,
        label: 'Plan',
        matchers: ['/classes', '/class']
    },
    {
        to: '/account',
        icon: User,
        label: 'Account',
        matchers: ['/account']
    },
];

const utilityLinks = [
    { to: '/garden', icon: Sprout, label: 'Garden', color: 'text-[#7a9e72]' },
    { to: '/themes', icon: Palette, label: 'Themes', color: 'text-claude-accent' },
    { to: '/settings', icon: Settings, label: 'Settings', color: 'text-claude-secondary' },
];

export default function Layout({ children }) {
    const location = useLocation();
    const { hideBottomNav: hideNavFromContext } = useContext(UIContext) || {};
    const { isLoggedIn } = useContext(AuthContext) || {};
    const primaryNavItems = getPrimaryNavItems(isLoggedIn);
    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test');
    const isCreatePage = location.pathname === '/create';
    const isMessagesChat = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const pageContentRef = useRef(null);

    // GSAP page enter animation on route change
    useEffect(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches || !pageContentRef.current) return;

        gsap.fromTo(pageContentRef.current,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.organic, clearProps: 'all' }
        );
    }, [location.pathname]);

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
    const isLegalPage = location.pathname === '/privacy' || location.pathname === '/terms';
    const isLandingPage = location.pathname === '/';
    const hideBottomNav = isStudyOrTest || isCreatePage || isMessagesChat || isLegalPage || hideNavFromContext || (!isLoggedIn && (isAccountPage || isLandingPage));

    // Fullscreen pages that need edge-to-edge backgrounds (no padding from Layout)
    const isFullscreenPage = isStudyOrTest || (!isLoggedIn && (isAccountPage || isLandingPage));
    // Show sidebar on desktop only when logged in and not on a fullscreen page
    const showDesktopSidebar = isLoggedIn && !isStudyOrTest && !isFullscreenPage;

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text overflow-x-hidden">
            {/* Flex wrapper: sidebar + content on desktop */}
            <div className="relative w-full bg-claude-bg flex">

                {/* ===== Desktop Sidebar (hidden on mobile) ===== */}
                {showDesktopSidebar && (
                    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-claude-bg/60 border-r border-white/[0.04] z-30 backdrop-blur-2xl shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3 px-6 pt-8 pb-6 group">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden transition-transform duration-500 group-hover:scale-105 group-hover:bg-white/[0.04] group-hover:border-claude-accent/20">
                                <OnboardingArt className="w-7 h-7 scale-[1.3] mt-1" />
                            </div>
                            <span className="font-display text-xl text-claude-text tracking-tight transition-colors duration-300 group-hover:text-white">Riven</span>
                        </Link>

                        <div className="px-4 pb-3">
                            <button
                                type="button"
                                onClick={() => setIsCommandPaletteOpen(true)}
                                className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-white/15 hover:bg-white/[0.04]"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-claude-accent">
                                    <Search className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-botanical-parchment">Search Riven</p>
                                    <p className="text-xs text-claude-secondary">Jump anywhere fast</p>
                                </div>
                                <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-claude-secondary">
                                    ⌘K
                                </span>
                            </button>
                        </div>

                        {/* Main Nav */}
                        <nav className="flex-1 px-3 py-2 space-y-1.5">
                            {primaryNavItems.filter(item => !item.isFab).map((item) => {
                                const isActive = routeMatches(location.pathname, item.matchers);

                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className={`group flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden ${isActive
                                            ? 'text-white bg-white/[0.03]'
                                            : 'text-claude-secondary/70 hover:text-white hover:bg-white/[0.02] hover:translate-x-1'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-claude-accent shadow-[0_0_12px_rgba(var(--claude-accent-rgb),0.8)]" />
                                        )}
                                        <div className={`relative flex items-center justify-center w-6 h-6 transition-colors duration-300 ${isActive ? 'text-claude-accent' : 'text-claude-secondary/50 group-hover:text-claude-secondary'}`}>
                                            <item.icon strokeWidth={isActive ? 2.5 : 2} className="w-[18px] h-[18px]" />
                                        </div>
                                        <span className={`font-mono text-[11px] tracking-[0.1em] uppercase ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Divider */}
                        <div className="mx-6 h-px bg-white/[0.03] my-2" />

                        {/* Quick Links */}
                        <nav className="px-3 py-4 space-y-1">
                            <h3 className="px-3 mb-3 text-[10px] font-mono uppercase tracking-[0.25em] text-white/30 font-semibold selection:bg-transparent">Utilities</h3>
                            {utilityLinks.map((item) => {
                                const isActive = routeMatches(location.pathname, [item.to]);
                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className={`group flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all duration-300 ${isActive
                                            ? `bg-white/[0.03] ${item.color}`
                                            : 'text-claude-secondary/70 hover:text-white hover:bg-white/[0.02] hover:translate-x-1'
                                            }`}
                                    >
                                        <div className={`relative flex items-center justify-center w-6 h-6 transition-colors duration-300 ${isActive ? item.color : 'text-claude-secondary/40 group-hover:text-claude-secondary'}`}>
                                            <item.icon strokeWidth={isActive ? 2.5 : 2} className="w-[16px] h-[16px]" />
                                        </div>
                                        <span className={`font-mono text-[10px] tracking-[0.1em] uppercase ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Create Deck CTA */}
                        <div className="px-4 py-6 mt-auto">
                            <Link
                                to="/create"
                                className="group relative flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-[#7a9e72]/10 border border-[#7a9e72]/20 text-[#7a9e72] font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-500 hover:bg-[#7a9e72] hover:border-[#7a9e72] hover:text-white hover:shadow-[0_0_20px_rgba(122,158,114,0.3)] hover:-translate-y-0.5 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                                <Plus className="w-[18px] h-[18px] transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
                                <span>Create Deck</span>
                            </Link>
                        </div>

                        {/* Bottom spacer */}
                        <div className="pb-safe" />
                    </aside>
                )}

                {/* ===== Main Content Area ===== */}
                <div className={`flex-1 min-h-dvh overflow-x-hidden ${showDesktopSidebar ? 'lg:ml-[240px]' : ''}`}>
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

                    {/* Main content with page transitions */}
                    <main className={`${isFullscreenPage ? '' : isStudyOrTest ? '' : 'px-4 py-4 lg:px-8 lg:py-6'
                        } ${hideBottomNav ? (isFullscreenPage ? '' : 'pb-6') : 'pb-24 lg:pb-6'
                        } ${!isOffline ? 'safe-area-top' : ''
                        }`}>
                        {/* Center content on desktop with max-width (skip for fullscreen pages) */}
                        <div className={isFullscreenPage ? '' : 'lg:max-w-5xl lg:mx-auto'}>
                            <div
                                ref={pageContentRef}
                                key={location.pathname}
                            >
                                {children}
                            </div>
                        </div>
                    </main>

                    {/* FAB Overlay Menu */}
                    <AnimatePresence>
                        {isFabMenuOpen && !hideBottomNav && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsFabMenuOpen(false)}
                                    className="fixed inset-0 bg-black/50 md:backdrop-blur-sm z-10 cursor-pointer"
                                />
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.9, x: "-50%" }}
                                    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                                    exit={{ opacity: 0, y: 20, scale: 0.9, x: "-50%" }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="fixed bottom-24 left-1/2 glass-panel rounded-2xl z-20 flex flex-col gap-2 p-3 min-w-[220px]"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFabMenuOpen(false);
                                            setIsCommandPaletteOpen(true);
                                        }}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] transition-colors font-mono text-xs font-bold uppercase tracking-widest text-botanical-parchment cursor-pointer touch-target"
                                    >
                                        <Search className="w-5 h-5 text-claude-accent" />
                                        <span>Search</span>
                                    </button>
                                    <Link
                                        to="/create"
                                        onClick={() => setIsFabMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-[#7a9e72]/10 border border-[#7a9e72]/20 transition-colors font-mono text-xs font-bold uppercase tracking-widest text-[#7a9e72] cursor-pointer touch-target"
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span>Create Deck</span>
                                    </Link>
                                    <Link
                                        to="/garden"
                                        onClick={() => setIsFabMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 hover:glass-panel rounded-xl transition-colors font-mono text-xs font-bold uppercase tracking-widest text-[#7a9e72] cursor-pointer touch-target"
                                    >
                                        <Sprout className="w-5 h-5" />
                                        <span>Garden</span>
                                    </Link>
                                    <Link
                                        to="/themes"
                                        onClick={() => setIsFabMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 hover:glass-panel rounded-xl transition-colors font-mono text-xs font-bold uppercase tracking-widest text-claude-accent cursor-pointer touch-target"
                                    >
                                        <Palette className="w-5 h-5" />
                                        <span>Themes</span>
                                    </Link>
                                    <Link
                                        to="/settings"
                                        onClick={() => setIsFabMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 hover:glass-panel rounded-xl transition-colors font-mono text-xs font-bold uppercase tracking-widest text-claude-secondary cursor-pointer touch-target"
                                    >
                                        <Settings className="w-5 h-5 shrink-0" />
                                        <span className="leading-tight">Settings</span>
                                    </Link>
                                    <Link
                                        to="/account"
                                        onClick={() => setIsFabMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 hover:glass-panel rounded-xl transition-colors font-mono text-xs font-bold uppercase tracking-widest text-claude-secondary cursor-pointer touch-target"
                                    >
                                        <User className="w-5 h-5 shrink-0" />
                                        <span className="leading-tight">Profile</span>
                                    </Link>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Bottom navigation — mobile only, hidden on desktop */}
                    {!hideBottomNav && (
                        <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 w-full border-t border-white/5 z-20 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.12)] glass-panel lg:hidden" style={{ borderBottom: 'none' }}>
                            <div className="flex items-stretch h-16 sm:h-20 max-w-5xl mx-auto">
                                {primaryNavItems.map((item) => {
                                    if (item.isFab) {
                                        return (
                                            <button key="fab" onClick={() => setIsFabMenuOpen(!isFabMenuOpen)} aria-label={isFabMenuOpen ? 'Close menu' : 'Open quick actions'} aria-expanded={isFabMenuOpen} className="flex-1 flex items-center justify-center tap-action">
                                                <motion.div
                                                    animate={{ rotate: isFabMenuOpen ? 45 : 0 }}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="w-12 h-12 -mt-4 rounded-full flex items-center justify-center shadow-botanical-glow border-[3px] border-claude-bg"
                                                    style={{ backgroundColor: 'var(--botanical-forest)' }}
                                                >
                                                    <Plus className="w-6 h-6 text-white" />
                                                </motion.div>
                                            </button>
                                        );
                                    }

                                    const isActive = routeMatches(location.pathname, item.matchers);

                                    return (
                                        <Link
                                            key={item.to}
                                            to={item.to}
                                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors tap-action cursor-pointer ${isActive ? 'text-claude-accent' : 'text-claude-secondary hover:text-claude-text'}`}
                                        >
                                            <div className="relative">
                                                <item.icon className="w-5 h-5" />
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="nav-indicator"
                                                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-claude-accent"
                                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-mono font-medium tracking-wide">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </nav>
                    )}
                </div>
            </div>
            <GlobalCommandPalette
                isOpen={isCommandPaletteOpen}
                isLoggedIn={isLoggedIn}
                onClose={() => setIsCommandPaletteOpen(false)}
            />
        </div>
    );
}
