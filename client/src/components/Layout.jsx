import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layers, Palette, Home, Plus, WifiOff, Dog } from 'lucide-react';
import { ThemeContext } from '../ThemeContext';

export default function Layout({ children }) {
    const location = useLocation();
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
        <div className="h-[100dvh] bg-claude-bg text-claude-text font-sans flex flex-col overflow-hidden">
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
                <nav className="fixed bottom-0 left-0 right-0 bg-claude-surface/98 backdrop-blur-lg border-t border-claude-border z-20 safe-area-bottom safe-area-left safe-area-right">
                    <div className="flex items-stretch h-16 max-w-md mx-auto">
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
                        <Link
                            to="/themes"
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.pathname === '/themes' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'}`}
                        >
                            <Palette className="w-6 h-6" />
                            <span className="text-[10px] font-semibold">Themes</span>
                        </Link>
                        <Link
                            to="/"
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors text-claude-secondary active:text-claude-text`}
                        >
                            <Layers className="w-6 h-6" />
                            <span className="text-[10px] font-semibold">More</span>
                        </Link>
                    </div>
                </nav>
            )}
        </div>
    );
}
