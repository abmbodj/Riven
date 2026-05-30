import { useContext, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Menu from 'lucide-react/dist/esm/icons/menu';
import PanelLeft from 'lucide-react/dist/esm/icons/panel-left';
import Search from 'lucide-react/dist/esm/icons/search';
import Bell from 'lucide-react/dist/esm/icons/bell';
import { UIContext } from '../context/UIContext';
import { AuthContext } from '../context/AuthContext';
import UserNotificationsRail from './UserNotificationsRail';
import SubscriptionExpiredModal from './SubscriptionExpiredModal';

const ROUTE_TITLES = [
    { prefix: '/dashboard', title: 'Today' },
    { prefix: '/decks', title: 'Study' },
    { prefix: '/deck', title: 'Study' },
    { prefix: '/create', title: 'Create' },
    { prefix: '/notes', title: 'Notes' },
    { prefix: '/note', title: 'Notes' },
    { prefix: '/guides', title: 'Tutor Sessions' },
    { prefix: '/guide', title: 'River Session' },
    { prefix: '/exams', title: 'Exams' },
    { prefix: '/exam', title: 'Exams' },
    { prefix: '/youtube', title: 'YouTube' },
    { prefix: '/classes', title: 'Classes' },
    { prefix: '/class', title: 'Classes' },
    { prefix: '/groups', title: 'Groups' },
    { prefix: '/messages', title: 'Messages' },
    { prefix: '/friends', title: 'Friends' },
    { prefix: '/garden', title: 'Garden' },
    { prefix: '/themes', title: 'Themes' },
    { prefix: '/account', title: 'Account' },
    { prefix: '/settings', title: 'Settings' },
    { prefix: '/edit-profile', title: 'Edit Profile' },
    { prefix: '/admin', title: 'Admin' },
    { prefix: '/profile', title: 'Profile' },
    { prefix: '/', title: 'Riven' },
];

function getPageTitle(pathname) {
    for (const { prefix, title } of ROUTE_TITLES) {
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
            return title;
        }
    }
    return 'Riven';
}

export default function TopBar({ onOpenCommandPalette }) {
    const location = useLocation();
    const { toggleNav, toggleDrawer, notifPanelOpen, toggleNotifPanel, closeNotifPanel } = useContext(UIContext) || {};
    const { user, isLoggedIn } = useContext(AuthContext) || {};
    const bellRef = useRef(null);
    const panelRef = useRef(null);

    const pageTitle = getPageTitle(location.pathname);
    const avatarInitial = (user?.displayName || user?.username || '?')[0].toUpperCase();

    // Close notification panel on click outside
    useEffect(() => {
        if (!notifPanelOpen) return;
        const handleClick = (e) => {
            if (
                bellRef.current && !bellRef.current.contains(e.target) &&
                panelRef.current && !panelRef.current.contains(e.target)
            ) {
                closeNotifPanel?.();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [notifPanelOpen, closeNotifPanel]);

    // Close notification panel on Escape
    useEffect(() => {
        if (!notifPanelOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') closeNotifPanel?.();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [notifPanelOpen, closeNotifPanel]);

    return (
        <>
            <header
                role="banner"
                className="sticky top-0 z-30 bg-claude-surface/80 backdrop-blur-sm border-b border-claude-border/30"
            >
                {/* Safe area spacer — pushes bar below status bar */}
                <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />
                <div className="h-10 md:h-12 flex items-center justify-between px-4">
            {/* Left: hamburger (mobile) / sidebar toggle (desktop) */}
            <div className="flex items-center">
                {/* Mobile: hamburger → drawer */}
                <button
                    type="button"
                    onClick={toggleDrawer}
                    aria-label="Open navigation drawer"
                    className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl text-claude-secondary transition-colors hover:bg-white/[0.07] hover:text-claude-text cursor-pointer"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Desktop: panel-left → collapse sidebar */}
                <button
                    type="button"
                    onClick={toggleNav}
                    aria-label="Toggle sidebar"
                    className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl text-claude-secondary transition-colors hover:bg-white/[0.07] hover:text-claude-text cursor-pointer"
                >
                    <PanelLeft className="w-5 h-5" />
                </button>
            </div>

            {/* Center: page title */}
            <span className="font-display text-sm tracking-wide text-claude-text select-none">
                {pageTitle}
            </span>

            {/* Right: search (mobile) / bell + avatar (desktop) */}
            <div className="flex items-center gap-1">
                {/* Mobile: search icon */}
                <button
                    type="button"
                    onClick={onOpenCommandPalette}
                    aria-label="Search"
                    className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl text-claude-secondary transition-colors hover:bg-white/[0.07] hover:text-claude-text cursor-pointer"
                >
                    <Search className="w-5 h-5" />
                </button>

                {/* Desktop: notification bell */}
                {isLoggedIn && (
                    <div className="relative hidden md:block">
                        <button
                            ref={bellRef}
                            type="button"
                            onClick={toggleNotifPanel}
                            aria-label="Notifications"
                            aria-expanded={notifPanelOpen}
                            aria-haspopup="true"
                            className="h-9 w-9 items-center justify-center rounded-xl text-claude-secondary transition-colors hover:bg-white/[0.07] hover:text-claude-text cursor-pointer hidden md:flex"
                        >
                            <Bell className="w-5 h-5" />
                        </button>

                        {/* Notification dropdown panel */}
                        <AnimatePresence>
                            {notifPanelOpen && (
                                <motion.div
                                    ref={panelRef}
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    className="absolute right-0 top-full mt-2 w-[360px] rounded-[1.6rem] bg-claude-surface border border-claude-border/30 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl overflow-hidden"
                                >
                                    <div className="max-h-[480px] overflow-y-auto [&>div]:px-3 [&>div]:pt-3">
                                        <UserNotificationsRail />
                                    </div>
                                    <div className="px-4 py-3 border-t border-claude-border/20 flex items-center justify-between">
                                        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-claude-secondary/60">Notifications</span>
                                        <button
                                            type="button"
                                            onClick={closeNotifPanel}
                                            className="font-mono text-[10px] uppercase tracking-[0.15em] text-claude-secondary/60 hover:text-claude-text transition-colors cursor-pointer"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Desktop: avatar → /account */}
                {isLoggedIn && (
                    <Link
                        to="/account"
                        aria-label="Account"
                        className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-claude-accent/15 border border-claude-accent/25 text-claude-accent font-mono text-[11px] font-bold uppercase tracking-wide transition-colors hover:bg-claude-accent/25 cursor-pointer overflow-hidden"
                    >
                        {user?.avatar ? (
                            <img
                                src={user.avatar}
                                alt={user.displayName || user.username || 'Account'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            avatarInitial
                        )}
                    </Link>
                )}
            </div>
                </div>
            </header>
            {isLoggedIn ? <SubscriptionExpiredModal /> : null}
        </>
    );
}
