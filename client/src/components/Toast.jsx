import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import X from 'lucide-react/dist/esm/icons/x';
import { ToastContext } from '../context/ToastContext';
export { ToastContext };

const TOAST_STYLES = {
    success: {
        icon: Check,
        accent: 'text-emerald-300',
        iconWrap: 'border-emerald-400/20 bg-emerald-400/12 text-emerald-300',
        ring: 'before:bg-emerald-300/80',
        glow: 'shadow-[0_22px_48px_rgba(7,24,18,0.34),0_10px_24px_rgba(16,185,129,0.12)]',
    },
    error: {
        icon: AlertCircle,
        accent: 'text-rose-300',
        iconWrap: 'border-rose-400/20 bg-rose-400/12 text-rose-300',
        ring: 'before:bg-rose-300/80',
        glow: 'shadow-[0_22px_48px_rgba(25,10,12,0.36),0_10px_24px_rgba(244,63,94,0.12)]',
    },
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idCounter = useRef(0);
    const toastTimers = useRef(new Map());
    const prefersReducedMotion = useReducedMotion();

    useEffect(() => {
        const timers = toastTimers.current;
        return () => {
            timers.forEach(timerId => clearTimeout(timerId));
            timers.clear();
        };
    }, []);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        const timerId = toastTimers.current.get(id);
        if (timerId) {
            clearTimeout(timerId);
            toastTimers.current.delete(id);
        }
    }, []);

    const show = useCallback((message, type = 'success') => {
        const id = ++idCounter.current;
        setToasts(prev => [...prev, { id, message, type }]);
        const timerId = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            toastTimers.current.delete(id);
        }, 3500);
        toastTimers.current.set(id, timerId);
    }, []);

    const success = useCallback((message) => show(message, 'success'), [show]);
    const error = useCallback((message) => show(message, 'error'), [show]);

    const value = useMemo(() => ({ show, success, error }), [show, success, error]);
    const initialAnimation = prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: 22, y: -10, scale: 0.98 };
    const animateAnimation = prefersReducedMotion
        ? { opacity: 1 }
        : { opacity: 1, x: 0, y: 0, scale: 1 };
    const exitAnimation = prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: 28, y: -6, scale: 0.98 };
    const transition = prefersReducedMotion
        ? { duration: 0.16, ease: 'easeOut' }
        : { type: 'spring', stiffness: 320, damping: 28, mass: 0.9 };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="pointer-events-none fixed inset-x-4 top-[calc(var(--safe-area-top)+0.9rem)] z-[9999] flex flex-col items-center gap-2.5 md:inset-x-auto md:right-5 md:top-[calc(var(--safe-area-top)+1rem)] md:w-[min(24rem,calc(100vw-2rem))] md:items-stretch"
                data-testid="toast-viewport"
            >
                <AnimatePresence mode="popLayout">
                    {toasts.map(toast => (
                        <ToastCard
                            key={toast.id}
                            toast={toast}
                            dismiss={dismiss}
                            initialAnimation={initialAnimation}
                            animateAnimation={animateAnimation}
                            exitAnimation={exitAnimation}
                            transition={transition}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

function ToastCard({
    toast,
    dismiss,
    initialAnimation,
    animateAnimation,
    exitAnimation,
    transition,
}) {
    const style = TOAST_STYLES[toast.type] ?? TOAST_STYLES.success;
    const Icon = style.icon;

    return (
        <motion.div
            layout
            initial={initialAnimation}
            animate={animateAnimation}
            exit={exitAnimation}
            transition={transition}
            className={`pointer-events-auto relative w-full max-w-[min(100%,24rem)] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[color-mix(in_srgb,var(--surface-color)_90%,rgba(255,255,255,0.08))] text-claude-text backdrop-blur-xl before:absolute before:bottom-4 before:left-4 before:top-4 before:w-[3px] before:rounded-full ${style.ring} ${style.glow}`}
            data-testid={`toast-${toast.type}`}
        >
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_40%,transparent_72%)] opacity-80" />
            <div className="absolute inset-[1px] rounded-[calc(1.4rem-1px)] border border-white/5" />

            <div className="relative flex items-start gap-3.5 px-4 py-3.5 md:px-[18px]">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border ${style.iconWrap}`}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1 pr-1">
                    <p className={`font-mono text-[9px] font-bold uppercase tracking-[0.22em] ${style.accent}`}>
                        {toast.type === 'success' ? 'Notice' : 'Attention'}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5 text-claude-text/95">
                        {toast.message}
                    </p>
                </div>

                <button
                    onClick={() => dismiss(toast.id)}
                    className="tap-action -mr-1 -mt-1 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:bg-white/6 hover:text-claude-text active:scale-[0.97]"
                    aria-label="Dismiss notification"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </motion.div>
    );
}
