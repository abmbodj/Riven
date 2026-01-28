import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, Palette, Home, Plus, WifiOff, Sun, Moon } from 'lucide-react';
import { ThemeContext } from '../ThemeContext';

export default function Layout({ children }) {
    const location = useLocation();
    const isStudyOrTest = location.pathname.includes('/study') || location.pathname.includes('/test');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const { activeTheme, toggleTheme } = useContext(ThemeContext);
    const isDarkMode = activeTheme?.name.toLowerCase().includes('dark');

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

    return (
        <div className="h-[100dvh] bg-claude-bg text-claude-text font-sans flex flex-col overflow-hidden">
            {/* Offline banner */}
            {isOffline && (
                <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium safe-area-top">
                    <WifiOff className="w-4 h-4" />
                    <span>You're offline</span>
                </div>
            )}

            {/* Top header - simplified for mobile */}
            <header className={`bg-claude-bg/90 backdrop-blur-md sticky top-0 z-10 border-b border-claude-border/50 ${!isOffline ? 'safe-area-top' : ''}`}>
                <div className="px-4 h-14 flex items-center justify-between">
                    <div className="w-10" /> {/* Spacer */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-claude-text rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-claude-bg fill-current" />
                        </div>
                        <span className="font-display font-bold text-xl tracking-tight">Riven</span>
                    </Link>
                    <button
                        onClick={toggleTheme}
                        className="w-10 h-10 flex items-center justify-center text-claude-secondary active:text-claude-text rounded-xl"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Main content - scrollable */}
            <main className="flex-1 px-4 py-6 pb-36 overflow-y-auto overscroll-contain">
                {children}
            </main>

            {/* Bottom navigation - mobile style */}
            {!isStudyOrTest && (
                <nav className="fixed bottom-0 left-0 right-0 bg-claude-surface/95 backdrop-blur-md border-t border-claude-border safe-area-bottom z-20">
                    <div className="flex items-center justify-around h-16 max-w-md mx-auto">
                        <Link
                            to="/"
                            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors ${location.pathname === '/' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'
                                }`}
                        >
                            <Home className="w-6 h-6" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Library</span>
                        </Link>
                        <Link
                            to="/create"
                            className="flex flex-col items-center gap-1 px-4 py-2 -mt-6"
                        >
                            <div className="w-14 h-14 bg-claude-accent rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                                <Plus className="w-7 h-7 text-white" />
                            </div>
                        </Link>
                        <Link
                            to="/themes"
                            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors ${location.pathname === '/themes' ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'
                                }`}
                        >
                            <Palette className="w-6 h-6" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Themes</span>
                        </Link>
                    </div>
                </nav>
            )}
        </div>
    );
}
