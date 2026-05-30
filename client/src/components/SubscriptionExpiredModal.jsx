import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import ModalSurface from './ui/ModalSurface';
import { useAuth } from '../hooks/useAuth';

export default function SubscriptionExpiredModal() {
    const navigate = useNavigate();
    const { isLoggedIn, getUserNotifications, dismissUserNotification } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDismissing, setIsDismissing] = useState(false);

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
            console.warn('[SubscriptionExpiredModal] Failed to load notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [getUserNotifications, isLoggedIn]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

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

    const activeNotification = useMemo(() => (
        notifications.find((notification) => notification.kind === 'subscription_expired') || null
    ), [notifications]);

    const dismissNotification = useCallback(async (destination = null) => {
        if (!activeNotification || isDismissing) return;

        setIsDismissing(true);
        try {
            await dismissUserNotification(activeNotification.id);
            setNotifications((currentNotifications) => (
                currentNotifications.filter((notification) => notification.id !== activeNotification.id)
            ));
            if (destination) {
                navigate(destination);
            }
        } catch (error) {
            console.warn('[SubscriptionExpiredModal] Failed to dismiss notification:', error);
        } finally {
            setIsDismissing(false);
        }
    }, [activeNotification, dismissUserNotification, isDismissing, navigate]);

    if (!isLoggedIn || loading || !activeNotification) {
        return null;
    }

    return (
        <ModalSurface
            isOpen
            onClose={() => dismissNotification()}
            eyebrow="Billing update"
            title={activeNotification.title || 'Your Pro access has ended'}
            description={activeNotification.content || 'Your billing period has ended, so your paid Pro features are no longer active.'}
            size="sm"
            footer={(
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => dismissNotification()}
                        disabled={isDismissing}
                        className="tap-action rounded-[1rem] border border-claude-border/70 bg-claude-bg/55 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Keep studying
                    </button>
                    <button
                        type="button"
                        onClick={() => dismissNotification('/settings')}
                        disabled={isDismissing}
                        className="tap-action rounded-[1rem] bg-claude-text px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        View plans
                    </button>
                </div>
            )}
        >
            <div className="rounded-[1.5rem] border border-claude-border/60 bg-claude-surface/70 p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-display text-base text-claude-text">
                            Free plan active
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-claude-secondary">
                            You can keep using Riven on the free plan, or head to Settings whenever you want to restore or upgrade your premium access again.
                        </p>
                    </div>
                </div>
            </div>
        </ModalSurface>
    );
}
