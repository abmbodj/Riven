import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Bell from 'lucide-react/dist/esm/icons/bell';
import X from 'lucide-react/dist/esm/icons/x';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NOTIFICATION_STYLES = {
    feedback_considering: {
        border: 'border-claude-accent/25',
        background: 'bg-claude-accent/10',
        iconTone: 'text-claude-accent',
        eyebrow: 'Feedback update',
        Icon: MessageSquare,
    },
    subscription_expired: {
        border: 'border-amber-400/25',
        background: 'bg-amber-400/10',
        iconTone: 'text-amber-400',
        eyebrow: 'Billing update',
        Icon: Sparkles,
    },
    default: {
        border: 'border-blue-400/20',
        background: 'bg-blue-400/10',
        iconTone: 'text-blue-400',
        eyebrow: 'Notification',
        Icon: Bell,
    },
};

export default function UserNotificationsRail() {
    const location = useLocation();
    const { isLoggedIn, getUserNotifications, dismissUserNotification } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const isSettingsPage = location.pathname === '/settings';

    const loadNotifications = useCallback(async () => {
        if (!isLoggedIn) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        try {
            const nextNotifications = await getUserNotifications();
            setNotifications(nextNotifications || []);
        } catch (error) {
            console.warn('[UserNotificationsRail] Failed to load notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [getUserNotifications, isLoggedIn]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications, location.pathname]);

    useEffect(() => {
        if (!isLoggedIn) return undefined;

        const handleWindowFocus = () => {
            loadNotifications();
        };
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadNotifications();
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isLoggedIn, loadNotifications]);

    const handleDismiss = async (notificationId) => {
        try {
            await dismissUserNotification(notificationId);
            setNotifications((currentNotifications) => (
                currentNotifications.filter((notification) => notification.id !== notificationId)
            ));
        } catch (error) {
            console.warn('[UserNotificationsRail] Failed to dismiss notification:', error);
        }
    };

    if (loading || notifications.length === 0) return null;

    return (
        <div className="px-4 pt-3 lg:px-8">
            <div className={`lg:mx-auto lg:max-w-5xl ${isSettingsPage ? 'xl:max-w-7xl' : ''}`}>
                <div role="region" aria-live="polite" aria-label="User notifications" className="space-y-3">
                    <AnimatePresence initial={false}>
                        {notifications.map((notification) => {
                            const styles = NOTIFICATION_STYLES[notification.kind] || NOTIFICATION_STYLES.default;
                            const Icon = styles.Icon;

                            return (
                                <motion.div
                                    key={notification.id}
                                    layout
                                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    className={`relative overflow-hidden rounded-[1.6rem] border ${styles.border} ${styles.background} shadow-[0_16px_36px_rgba(0,0,0,0.18)] backdrop-blur`}
                                >
                                    <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:10px_10px]" />
                                    <div className="relative z-10 flex items-start gap-4 p-4 sm:p-5">
                                        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10 ${styles.iconTone}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-claude-secondary/70">
                                                {styles.eyebrow}
                                            </p>
                                            <h3 className="mt-2 font-display text-[1rem] text-claude-text sm:text-[1.05rem]">
                                                {notification.title}
                                            </h3>
                                            <p className="mt-2 text-[11px] font-mono leading-relaxed text-claude-secondary/85 sm:text-[12px]">
                                                {notification.content}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDismiss(notification.id)}
                                            aria-label={`Dismiss ${notification.title}`}
                                            className="tap-action flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/10 text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:text-claude-text active:scale-95"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
