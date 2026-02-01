import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Palette, Home, Plus, WifiOff, Dog, User, Shield } from 'lucide-react';
import { ThemeContext } from '../ThemeContext';
import { AuthContext } from '../context/AuthContext';

export default function Layout({ children }) {
    const location = useLocation();
    const { isAdmin } = useContext(AuthContext);
    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test');
    const isCreatePage = location.pathname === '/create';
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    useContext(ThemeContext); // Ensure theme is loaded

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

    // Hide bottom nav on study/test and create pages for cleaner UX
    const hideBottomNav = isStudyOrTest || isCreatePage;

    return (
        <div className="min-h-[100dvh] bg-claude-bg text-claude-text font-sans">
            {/* Background pattern for desktop */}
            <div className="fixed inset-0 bg-claude-bg pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-claude-accent/[0.02] via-transparent to-claude-accent/[0.02]" />
            </div>

            {/* Main container - centered with max width */}
            <div className="relative min-h-[100dvh] w-full max-w-lg mx-auto flex flex-col bg-claude-bg md:border-x md:border-claude-border/50 md:shadow-2xl md:shadow-black/20">
                {/* Offline banner */}
                {isOffline && (
                    <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium safe-area-top shrink-0">
                        <WifiOff className="w-4 h-4" />
                        <span>You're offline - changes saved locally</span>
                    </div>
                )}

                {/* Main content - scrollable */}
                <main className={`flex-1 overflow-y-auto overscroll-contain ${isStudyOrTest ? '' : 'px-4 py-4'} ${hideBottomNav ? 'pb-6' : 'pb-24'} ${!isOffline ? 'safe-area-top' : ''}`}>
                    <div className="animate-in fade-in duration-200">
                        {children}
                    </div>
                </main>

                {/* Bottom navigation - mobile-first PWA style */}
                {!hideBottomNav && (
                    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-claude-surface/98 backdrop-blur-lg border-t border-claude-border md:border-x md:border-claude-border/50 z-20 safe-area-bottom">
                        <div className="flex items-stretch h-16">
                            <Link
                                to="/"
                                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.pathname === '/' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'}`}
                            >
                                <Home className="w-6 h-6" />
                                <span className="text-[10px] font-semibold">Library</span>
                            </Link>
                            <Link
                                to="/pet"
                                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.pathname === '/pet' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'}`}
                            >
                                <Dog className="w-6 h-6" />
                                <span className="text-[10px] font-semibold">Pet</span>
                            </Link>
                            <Link
                                to="/create"
                                className="flex-1 flex items-center justify-center"
                            >
                                <div className="w-14 h-14 -mt-5 bg-claude-accent rounded-full flex items-center justify-center shadow-lg shadow-claude-accent/30 active:scale-95 transition-transform border-4 border-claude-bg">
                                    <Plus className="w-7 h-7 text-white" />
                                </div>
                            </Link>
                            {isAdmin ? (
                                <Link
                                    to="/admin"
                                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.pathname === '/admin' ? 'text-red-500' : 'text-red-400 active:text-red-500'}`}
                                >
                                    <Shield className="w-6 h-6" />
                                    <span className="text-[10px] font-semibold">Admin</span>
                                </Link>
                            ) : (
                                <Link
                                    to="/themes"
                                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.pathname === '/themes' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'}`}
                                >
                                    <Palette className="w-6 h-6" />
                                    <span className="text-[10px] font-semibold">Themes</span>
                                </Link>
                            )}
                            <Link
                                to="/account"
                                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.pathname === '/account' || location.pathname === '/shared' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'}`}
                            >
                                <User className="w-6 h-6" />
                                <span className="text-[10px] font-semibold">Account</span>
                            </Link>
                        </div>
                    </nav>
                )}
            </div>
        </div>
    );
}
