import { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Home from 'lucide-react/dist/esm/icons/home';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import User from 'lucide-react/dist/esm/icons/user';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { ThemeContext } from '../ThemeContext';
import { UIContext } from '../context/UIContext';
import { AuthContext } from '../context/AuthContext';

const navItems = [
    { to: '/', icon: Home, label: 'Library', matchExact: true },
    { to: '/garden', icon: Sprout, label: 'Garden' },
    { to: '/create', isFab: true },
    { to: '/themes', icon: Palette, label: 'Themes' },
    { to: '/account', icon: User, label: 'Account', alsoMatch: '/shared' },
];

export default function Layout({ children }) {
    const location = useLocation();
    const { hideBottomNav: hideNavFromContext } = useContext(UIContext) || {};
    const { isLoggedIn } = useContext(AuthContext) || {};
    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test');
    const isCreatePage = location.pathname === '/create';
    const isMessagesChat = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    useContext(ThemeContext);

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

    const isAccountPage = location.pathname === '/account';
    const hideBottomNav = isStudyOrTest || isCreatePage || isMessagesChat || hideNavFromContext || (!isLoggedIn && isAccountPage);

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text">
            {/* Main container */}
            <div className="relative min-h-dvh w-full max-w-lg mx-auto bg-claude-bg md:border-x md:border-claude-border/50 md:shadow-2xl md:shadow-black/20">
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
                <main className={`${isStudyOrTest ? '' : 'px-4 py-4'} ${hideBottomNav ? 'pb-6' : 'pb-24'} ${!isOffline ? 'safe-area-top' : ''}`}>
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        {children}
                    </motion.div>
                </main>

                {/* Bottom navigation */}
                {!hideBottomNav && (
                    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto border-t border-claude-border/60 md:border-x md:border-claude-border/50 z-20 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" style={{ backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', background: 'rgba(22, 42, 49, 0.92)' }}>
                        <div className="flex items-stretch h-16 sm:h-20">
                            {navItems.map((item) => {
                                if (item.isFab) {
                                    return (
                                        <Link key="fab" to="/create" className="flex-1 flex items-center justify-center tap-action">
                                            <motion.div
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.9 }}
                                                className="w-12 h-12 -mt-4 rounded-full flex items-center justify-center shadow-botanical-glow border-[3px] border-claude-bg"
                                                style={{ backgroundColor: 'var(--botanical-forest)' }}
                                            >
                                                <Sprout className="w-6 h-6 text-white" />
                                            </motion.div>
                                        </Link>
                                    );
                                }

                                const isActive = item.matchExact
                                    ? location.pathname === item.to
                                    : location.pathname === item.to || location.pathname.startsWith(item.to) || (item.alsoMatch && location.pathname === item.alsoMatch);

                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors tap-action ${isActive ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'}`}
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
    );
}
