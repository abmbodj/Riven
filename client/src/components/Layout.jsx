import { useState, useEffect, useContext } from 'react';
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
import Leaf from 'lucide-react/dist/esm/icons/leaf';
import OnboardingArt from './OnboardingArt';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { UIContext } from '../context/UIContext';
import { AuthContext } from '../context/AuthContext';

const navItems = [
    { to: '/', icon: Home, label: 'Home', matchExact: true },
    { to: '/classes', icon: Calendar, label: 'Classes' },
    { id: 'fab', isFab: true },
    { to: '/decks', icon: Layers, label: 'Decks', alsoMatch: '/deck' },
    { to: '/account', icon: User, label: 'Account', alsoMatch: '/shared' },
];

const sidebarQuickLinks = [
    { to: '/garden', icon: Sprout, label: 'Garden', color: 'text-[#7a9e72]' },
    { to: '/themes', icon: Palette, label: 'Themes', color: 'text-claude-accent' },
    { to: '/groups', icon: Users, label: 'Study Groups', color: 'text-claude-secondary' },
];

export default function Layout({ children }) {
    const location = useLocation();
    const { hideBottomNav: hideNavFromContext } = useContext(UIContext) || {};
    const { isLoggedIn } = useContext(AuthContext) || {};
    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test');
    const isCreatePage = location.pathname === '/create';
    const isMessagesChat = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

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
        setIsFabMenuOpen(false);
    }, [location.pathname]);

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
            <div className="relative min-h-dvh w-full bg-claude-bg flex">

                {/* ===== Desktop Sidebar (hidden on mobile) ===== */}
                {showDesktopSidebar && (
                    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[220px] bg-claude-surface/50 border-r border-claude-border/50 z-30 backdrop-blur-sm">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2.5 px-5 pt-6 pb-4">
                            <div className="w-7 h-7 border border-claude-accent/30 rounded-full flex items-center justify-center bg-white/5 overflow-hidden">
                                <OnboardingArt className="w-6 h-6 scale-[1.3] mt-1" />
                            </div>
                            <span className="font-display text-lg text-claude-text tracking-tight">Riven</span>
                        </Link>

                        {/* Main Nav */}
                        <nav className="flex-1 px-3 py-2 space-y-1">
                            {navItems.filter(item => !item.isFab).map((item) => {
                                const isActive = item.matchExact
                                    ? location.pathname === item.to
                                    : location.pathname === item.to || location.pathname.startsWith(item.to) || (item.alsoMatch && location.pathname === item.alsoMatch);

                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-150 relative ${isActive
                                            ? 'bg-claude-accent/10 text-claude-accent'
                                            : 'text-claude-secondary hover:text-claude-text hover:bg-white/[0.06]'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-claude-accent" />
                                        )}
                                        <item.icon className="w-[18px] h-[18px]" />
                                        <span className="font-mono text-xs tracking-wide uppercase">{item.label}</span>
                                        {isActive && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-claude-accent" />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Divider */}
                        <div className="mx-5 h-px bg-claude-border/50" />

                        {/* Quick Links */}
                        <nav className="px-3 py-3 space-y-1">
                            <span className="px-3 text-[9px] font-mono uppercase tracking-[0.2em] text-claude-secondary/50">Quick Access</span>
                            {sidebarQuickLinks.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/5 ${location.pathname === item.to ? item.color : 'text-claude-secondary hover:text-claude-text'
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    <span className="font-mono text-xs tracking-wide uppercase">{item.label}</span>
                                </Link>
                            ))}
                        </nav>

                        {/* Create Deck CTA */}
                        <div className="px-3 py-4 mt-auto">
                            <Link
                                to="/create"
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-botanical-forest/80 hover:bg-botanical-forest text-white font-mono text-xs font-bold uppercase tracking-widest transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-botanical-forest/20"
                            >
                                <Plus className="w-4 h-4" />
                                Create Deck
                            </Link>
                        </div>

                        {/* Bottom spacer */}
                        <div className="pb-safe" />
                    </aside>
                )}

                {/* ===== Main Content Area ===== */}
                <div className={`flex-1 min-h-dvh overflow-x-hidden ${showDesktopSidebar ? 'lg:ml-[220px]' : ''}`}>
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
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                            >
                                {children}
                            </motion.div>
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
                                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 cursor-pointer"
                                />
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.9, x: "-50%" }}
                                    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                                    exit={{ opacity: 0, y: 20, scale: 0.9, x: "-50%" }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="fixed bottom-24 left-1/2 glass-panel rounded-2xl z-20 flex flex-col gap-2 p-3 min-w-[180px]"
                                >
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
                                        to="/groups"
                                        onClick={() => setIsFabMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 hover:glass-panel rounded-xl transition-colors font-mono text-xs font-bold uppercase tracking-widest text-claude-secondary cursor-pointer touch-target"
                                    >
                                        <Users className="w-5 h-5 shrink-0" />
                                        <span className="leading-tight">Study Groups</span>
                                    </Link>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Bottom navigation — mobile only, hidden on desktop */}
                    {!hideBottomNav && (
                        <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 w-full border-t border-white/5 z-20 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.12)] glass-panel lg:hidden" style={{ borderBottom: 'none' }}>
                            <div className="flex items-stretch h-16 sm:h-20 max-w-5xl mx-auto">
                                {navItems.map((item) => {
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

                                    const isActive = item.matchExact
                                        ? location.pathname === item.to
                                        : location.pathname === item.to || location.pathname.startsWith(item.to) || (item.alsoMatch && location.pathname === item.alsoMatch);

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
        </div>
    );
}
