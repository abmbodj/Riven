import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Search from 'lucide-react/dist/esm/icons/search';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Settings from 'lucide-react/dist/esm/icons/settings';
import User from 'lucide-react/dist/esm/icons/user';

const routeMatches = (pathname, matchers = []) =>
    matchers.some((m) => pathname === m || pathname.startsWith(`${m}/`));

const fabMenuItems = [
    { to: null, id: 'search', icon: Search, label: 'Search', accent: true },
    { to: '/create', id: 'create', icon: Plus, label: 'Create Deck', accent: true },
    { to: '/garden', id: 'garden', icon: Sprout, label: 'Garden', accent: true },
    { to: '/themes', id: 'themes', icon: Palette, label: 'Themes', accent: true },
    { to: '/settings', id: 'settings', icon: Settings, label: 'Settings' },
    { to: '/account', id: 'account', icon: User, label: 'Profile' },
];

export default function MobileBottomNav({
    primaryNavItems,
    onOpenCommandPalette,
}) {
    const location = useLocation();
    const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

    const handleFabMenuAction = (item) => {
        setIsFabMenuOpen(false);
        if (item.id === 'search' && onOpenCommandPalette) {
            onOpenCommandPalette();
        }
    };

    return (
        <>
            {/* FAB Overlay Menu */}
            <AnimatePresence>
                {isFabMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setIsFabMenuOpen(false)}
                            className="fixed inset-0 z-40 cursor-pointer lg:hidden"
                            style={{
                                background: 'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.45) 100%)',
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 24, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                            className="fixed bottom-28 left-4 right-4 z-50 mx-auto max-w-[320px] lg:hidden"
                        >
                            <div className="mobile-fab-menu rounded-3xl p-2 flex flex-col gap-1">
                                {fabMenuItems.map((item, i) => {
                                    const Icon = item.icon;
                                    const isLink = item.to !== null;
                                    const Comp = isLink ? Link : 'button';
                                    const compProps = isLink
                                        ? { to: item.to, onClick: () => handleFabMenuAction(item) }
                                        : { type: 'button', onClick: () => handleFabMenuAction(item) };

                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.04, duration: 0.25 }}
                                        >
                                            <Comp
                                                {...compProps}
                                                className={`flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl transition-colors duration-200 cursor-pointer touch-target ${
                                                    item.id === 'create'
                                                        ? 'bg-claude-accent/12 border border-claude-accent/20'
                                                        : 'hover:bg-white/[0.06] border border-transparent'
                                                }`}
                                            >
                                                <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                                                    item.id === 'create'
                                                        ? 'bg-claude-accent/15'
                                                        : 'bg-white/[0.06]'
                                                }`}>
                                                    <Icon className={`w-[18px] h-[18px] ${
                                                        item.accent ? 'text-claude-accent' : 'text-claude-secondary'
                                                    }`} />
                                                </div>
                                                <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${
                                                    item.accent ? 'text-claude-text' : 'text-claude-secondary'
                                                }`}>
                                                    {item.label}
                                                </span>
                                            </Comp>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Navigation Bar */}
            <nav
                aria-label="Main navigation"
                className="fixed bottom-0 left-0 right-0 z-40 pb-safe lg:hidden"
            >
                <div className="mx-3 mb-2">
                    <div className="mobile-bottom-nav-shell rounded-[1.75rem] overflow-hidden">
                        <div className="flex items-stretch h-[68px]">
                            {primaryNavItems.map((item) => {
                                if (item.isFab) {
                                    return (
                                        <button
                                            key="fab"
                                            onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
                                            aria-label={isFabMenuOpen ? 'Close menu' : 'Open quick actions'}
                                            aria-expanded={isFabMenuOpen}
                                            className="flex-1 flex items-center justify-center tap-action"
                                        >
                                            <motion.div
                                                animate={{ rotate: isFabMenuOpen ? 45 : 0 }}
                                                whileTap={{ scale: 0.88 }}
                                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                                className="mobile-fab-button w-[52px] h-[52px] -mt-3 rounded-full flex items-center justify-center overflow-visible"
                                            >
                                                <Plus className="w-6 h-6 text-white relative z-10" strokeWidth={2.5} />
                                            </motion.div>
                                        </button>
                                    );
                                }

                                const isActive = routeMatches(location.pathname, item.matchers);
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className="flex-1 flex flex-col items-center justify-center gap-1 tap-action cursor-pointer group"
                                    >
                                        <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-colors duration-200">
                                            {isActive && (
                                                <motion.div
                                                    layoutId="mobile-nav-pill"
                                                    className="absolute inset-0 rounded-2xl bg-claude-accent/12 border border-claude-accent/15"
                                                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                                />
                                            )}
                                            <Icon
                                                className={`w-[20px] h-[20px] relative z-[1] transition-colors duration-200 ${
                                                    isActive
                                                        ? 'text-claude-accent'
                                                        : 'text-claude-secondary group-hover:text-claude-text'
                                                }`}
                                                strokeWidth={isActive ? 2.2 : 1.8}
                                            />
                                        </div>
                                        <span
                                            className={`text-[9px] font-mono font-semibold uppercase tracking-[0.1em] transition-colors duration-200 ${
                                                isActive
                                                    ? 'text-claude-accent'
                                                    : 'text-claude-secondary/70 group-hover:text-claude-secondary'
                                            }`}
                                        >
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </nav>
        </>
    );
}
