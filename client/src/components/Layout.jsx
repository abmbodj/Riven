import { useState, useEffect, useRef, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Home from 'lucide-react/dist/esm/icons/home';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off';
import Mail from 'lucide-react/dist/esm/icons/mail';
import X from 'lucide-react/dist/esm/icons/x';
import User from 'lucide-react/dist/esm/icons/user';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Users from 'lucide-react/dist/esm/icons/users';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Search from 'lucide-react/dist/esm/icons/search';
import OnboardingArt from './OnboardingArt';
import { motion, AnimatePresence } from 'motion/react';
import { UIContext } from '../context/UIContext';
import { AuthContext } from '../context/AuthContext';
import gsap from 'gsap';
import { EASE, DURATION } from '../utils/animations';
import GlobalCommandPalette from './GlobalCommandPalette.jsx';
import GlobalThemeOverlay from './GlobalThemeOverlay.jsx';
import MobileBottomNav from './MobileBottomNav.jsx';
import { useToast } from '../hooks/useToast';
import { sendVerificationEmail } from '../api/authApi';

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
        matchers: ['/decks', '/deck', '/create', '/notes', '/note', '/guides', '/guide', '/exams', '/exam']
    },
    { id: 'fab', isFab: true },
    {
        to: '/classes',
        icon: Calendar,
        label: 'Plan',
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
    { to: '/garden', icon: Sprout, label: 'Garden', color: 'text-claude-accent' },
    { to: '/themes', icon: Palette, label: 'Themes', color: 'text-claude-accent' },
    { to: '/account', icon: User, label: 'Account', color: 'text-claude-secondary' },
    { to: '/settings', icon: Settings, label: 'Settings', color: 'text-claude-secondary' },
];

export default function Layout({ children }) {
    const location = useLocation();
    const { hideBottomNav: hideNavFromContext } = useContext(UIContext) || {};
    const { isLoggedIn, user } = useContext(AuthContext) || {};
    const primaryNavItems = getPrimaryNavItems(isLoggedIn);
    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test') || /^\/exam\/[^/]+$/.test(location.pathname);
    const isCreatePage = location.pathname === '/create';
    const isMessagesChat = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(false);
    const toast = useToast();
    const pageContentRef = useRef(null);
    const showVerifyBanner = isLoggedIn && user && user.email_verified === false && !verifyBannerDismissed;

    const handleResendVerification = async () => {
        if (resendingEmail || resendCooldown) return;
        setResendingEmail(true);
        try {
            await sendVerificationEmail();
            toast.success('Verification email sent — check your inbox');
            setResendCooldown(true);
            setTimeout(() => setResendCooldown(false), 60000);
        } catch {
            toast.error('Failed to send verification email');
        } finally {
            setResendingEmail(false);
        }
    };

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
            <GlobalThemeOverlay />
            {/* Flex wrapper: sidebar + content on desktop */}
            <div className="relative w-full bg-claude-bg flex">

                {/* ===== Desktop Sidebar (hidden on mobile) ===== */}
                {showDesktopSidebar && (
                    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] p-4 lg:block">
                        <div className="desktop-sidebar-shell relative flex h-full flex-col overflow-hidden rounded-[2rem]">
                            <div className="relative flex h-full flex-col">
                                {/* Logo */}
                                <Link to="/" className="flex items-center gap-3 px-6 pt-8 pb-6 group">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] overflow-hidden transition-transform duration-500 group-hover:scale-105 group-hover:bg-white/[0.1] group-hover:border-claude-accent/20">
                                        <OnboardingArt className="w-7 h-7 scale-[1.3] mt-1" />
                                    </div>
                                    <span className="font-display text-xl text-claude-text tracking-tight transition-colors duration-300 group-hover:text-white">Riven</span>
                                </Link>

                                <div className="px-4 pb-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsCommandPaletteOpen(true)}
                                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/15 hover:bg-white/[0.08]"
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-claude-accent">
                                            <Search className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-claude-text">Search Riven</p>
                                            <p className="text-xs text-claude-secondary">Jump anywhere fast</p>
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-claude-secondary">
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
                                                className={`group relative overflow-hidden rounded-xl px-3 py-2.5 flex items-center gap-3.5 transition-all duration-300 ${isActive
                                                    ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                                    : 'text-claude-secondary/70 hover:bg-white/[0.05] hover:text-white hover:translate-x-1'
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

                                {/* Quick Links */}
                                <nav className="px-3 py-4 space-y-1">
                                    <div className="mb-3 px-3">
                                        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-[0.25em] text-claude-secondary/50 selection:bg-transparent">Utilities</h3>
                                    </div>
                                    {utilityLinks.map((item) => {
                                        const isActive = routeMatches(location.pathname, [item.to]);
                                        return (
                                            <Link
                                                key={item.to}
                                                to={item.to}
                                                className={`group flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all duration-300 ${isActive
                                                    ? `bg-white/[0.08] ${item.color}`
                                                    : 'text-claude-secondary/70 hover:text-white hover:bg-white/[0.05] hover:translate-x-1'
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
                                <div className="mt-auto px-4 py-6">
                                    <Link
                                        to="/create"
                                        className="group relative flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-claude-accent/10 border border-claude-accent/20 text-claude-accent font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-500 hover:bg-claude-accent hover:border-claude-accent hover:text-white hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                                        <Plus className="w-[18px] h-[18px] transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
                                        <span>Create Deck</span>
                                    </Link>
                                </div>

                                {/* Bottom spacer */}
                                <div className="pb-safe" />
                            </div>
                        </div>
                    </aside>
                )}

                {/* ===== Main Content Area ===== */}
                <div className={`flex-1 min-h-dvh overflow-x-hidden ${showDesktopSidebar ? 'lg:ml-[256px]' : ''}`}>
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

                    {/* Email verification banner */}
                    <AnimatePresence>
                        {showVerifyBanner && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                role="alert"
                                aria-live="polite"
                                className="sticky top-0 z-30 bg-claude-accent text-botanical-ink px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-medium overflow-hidden"
                            >
                                <Mail className="w-4 h-4 shrink-0" />
                                <span className="font-mono text-xs tracking-wide">Please verify your email address</span>
                                <button
                                    type="button"
                                    onClick={handleResendVerification}
                                    disabled={resendingEmail || resendCooldown}
                                    className="ml-1 px-3 py-1 rounded-full bg-botanical-ink/15 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-botanical-ink/25 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                                >
                                    {resendingEmail ? 'Sending...' : resendCooldown ? 'Sent' : 'Resend Email'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVerifyBannerDismissed(true)}
                                    aria-label="Dismiss verification banner"
                                    className="ml-1 p-1 rounded-full hover:bg-botanical-ink/15 transition-colors touch-target"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main content with page transitions */}
                    <main className={`[overflow-x:clip] ${isFullscreenPage ? '' : isStudyOrTest ? '' : isMessagesChat ? 'lg:px-8 lg:py-6' : 'px-4 py-4 lg:px-8 lg:py-6'
                        } ${hideBottomNav ? ((isFullscreenPage || isMessagesChat) ? '' : 'pb-6') : 'pb-28 lg:pb-6'
                        } ${!isOffline && !showVerifyBanner ? 'safe-area-top' : ''
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

                    {/* Mobile bottom navigation + FAB overlay */}
                    {!hideBottomNav && (
                        <MobileBottomNav
                            primaryNavItems={primaryNavItems}
                            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                        />
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
