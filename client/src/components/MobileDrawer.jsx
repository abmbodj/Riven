import { useContext, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import X from 'lucide-react/dist/esm/icons/x';
import Users from 'lucide-react/dist/esm/icons/users';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import Palette from 'lucide-react/dist/esm/icons/palette';
import { UIContext } from '../context/UIContext';
import { prefetchRoute } from '../routes/config.jsx';

const DRAWER_ITEMS = [
    { to: '/friends',  icon: Users,          label: 'Friends',  matchers: ['/friends'],            accent: false },
    { to: '/messages', icon: MessageSquare,   label: 'Messages', matchers: ['/messages'],           accent: false },
    { to: '/garden',   icon: Sprout,          label: 'Garden',   matchers: ['/garden'],             accent: true  },
    { to: '/themes',   icon: Palette,         label: 'Themes',   matchers: ['/themes'],             accent: true  },
];

const routeMatches = (pathname, matchers = []) =>
    matchers.some((m) => pathname === m || pathname.startsWith(`${m}/`));

export default function MobileDrawer() {
    const location = useLocation();
    const { drawerOpen, closeDrawer } = useContext(UIContext) || {};
    const closeButtonRef = useRef(null);
    const drawerRef = useRef(null);

    // Focus close button when drawer opens
    useEffect(() => {
        if (drawerOpen) {
            // Defer to let animation start
            const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
            return () => clearTimeout(t);
        }
    }, [drawerOpen]);

    // Focus trap + Escape
    useEffect(() => {
        if (!drawerOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeDrawer?.();
                return;
            }

            if (e.key !== 'Tab') return;

            const focusable = drawerRef.current?.querySelectorAll(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable?.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [drawerOpen, closeDrawer]);

    return (
        <AnimatePresence>
            {drawerOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={closeDrawer}
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                        aria-hidden="true"
                    />

                    {/* Drawer panel */}
                    <motion.aside
                        ref={drawerRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation drawer"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                        className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-claude-surface border-r border-claude-border/30 md:hidden"
                        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 h-12 border-b border-claude-border/20 shrink-0">
                            <span className="font-display text-base text-claude-text">Menu</span>
                            <button
                                ref={closeButtonRef}
                                type="button"
                                onClick={closeDrawer}
                                aria-label="Close navigation drawer"
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-claude-secondary transition-colors hover:bg-white/[0.07] hover:text-claude-text cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Nav items */}
                        <nav
                            role="navigation"
                            aria-label="Utilities navigation"
                            className="flex-1 p-3 space-y-1 overflow-y-auto"
                        >
                            {DRAWER_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const isActive = routeMatches(location.pathname, item.matchers);

                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        onTouchStart={() => prefetchRoute(item.to)}
                                        onMouseEnter={() => prefetchRoute(item.to)}
                                        onClick={closeDrawer}
                                        className={`group flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                                            isActive
                                                ? `bg-white/[0.09] ${item.accent ? 'text-claude-accent' : 'text-white'}`
                                                : 'text-claude-secondary/70 hover:bg-white/[0.05] hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-200 ${
                                            isActive
                                                ? item.accent ? 'bg-claude-accent/15 text-claude-accent' : 'bg-white/[0.08] text-white'
                                                : 'bg-white/[0.04] text-claude-secondary/50 group-hover:text-claude-secondary group-hover:bg-white/[0.07]'
                                        }`}>
                                            <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                                        </div>
                                        <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-claude-accent" />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Safe area bottom spacer */}
                        <div className="pb-safe shrink-0" />
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
