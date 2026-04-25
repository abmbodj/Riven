import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import X from 'lucide-react/dist/esm/icons/x';
import { ToastContext } from '../context/ToastContext';
export { ToastContext };

const TOAST_STYLES = {
    success: {
        icon: Check,
        accent: 'text-emerald-300',
        iconWrap: 'border-emerald-400/24 bg-emerald-400/10 text-emerald-300',
        ring: 'before:bg-emerald-300/72',
        glow: 'shadow-[0_18px_40px_rgba(7,24,18,0.26),0_8px_18px_rgba(16,185,129,0.08)]',
        label: 'Notice',
    },
    error: {
        icon: AlertCircle,
        accent: 'text-rose-300',
        iconWrap: 'border-rose-400/24 bg-rose-400/10 text-rose-300',
        ring: 'before:bg-rose-300/72',
        glow: 'shadow-[0_18px_40px_rgba(25,10,12,0.28),0_8px_18px_rgba(244,63,94,0.08)]',
        label: 'Attention',
    },
    warn: {
        icon: AlertTriangle,
        accent: 'text-amber-300',
        iconWrap: 'border-amber-400/24 bg-amber-400/10 text-amber-300',
        ring: 'before:bg-amber-300/72',
        glow: 'shadow-[0_18px_40px_rgba(20,16,6,0.28),0_8px_18px_rgba(251,191,36,0.08)]',
        label: 'Hold on',
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

    const show = useCallback((message, type = 'success', options = {}) => {
        const id = ++idCounter.current;
        setToasts(prev => [...prev, { id, message, type, action: options.action ?? null }]);
        const duration = type === 'warn' ? 6000 : 3500;
        const timerId = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            toastTimers.current.delete(id);
        }, duration);
        toastTimers.current.set(id, timerId);
    }, []);

    const success = useCallback((message) => show(message, 'success'), [show]);
    const error = useCallback((message) => show(message, 'error'), [show]);
    const warn = useCallback((message, action) => show(message, 'warn', { action }), [show]);

    const value = useMemo(() => ({ show, success, error, warn }), [show, success, error, warn]);
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
            className={`pointer-events-auto relative w-full max-w-[min(100%,24rem)] overflow-hidden rounded-[1.25rem] border border-white/9 bg-[color-mix(in_srgb,var(--surface-color)_86%,rgba(255,255,255,0.12))] text-claude-text backdrop-blur-[18px] before:absolute before:bottom-3 before:left-3.5 before:top-3 before:w-[2px] before:rounded-full ${style.ring} ${style.glow}`}
            data-testid={`toast-${toast.type}`}
        >
            <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05)_36%,rgba(255,255,255,0.01)_72%)] opacity-75" />
            <div className="absolute inset-[1px] rounded-[calc(1.25rem-1px)] border border-white/6" />

            <div className="relative flex items-center gap-3 px-3.5 py-3 md:px-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] border ${style.iconWrap}`}>
                    <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1 py-0.5 pr-1">
                    <p className={`font-mono text-[9px] font-bold uppercase leading-none tracking-[0.22em] ${style.accent}`}>
                        {style.label}
                    </p>
                    <p className="mt-1.5 text-sm font-medium leading-[1.22] text-claude-text/95">
                        {toast.message}
                    </p>
                    {toast.action && (
                        <button
                            onClick={() => { toast.action.onClick(); dismiss(toast.id); }}
                            className={`mt-2 text-xs font-semibold underline underline-offset-2 transition-opacity hover:opacity-80 ${style.accent}`}
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>

                <button
                    onClick={() => dismiss(toast.id)}
                    className="tap-action -mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:bg-white/7 hover:text-claude-text active:scale-[0.97]"
                    aria-label="Dismiss notification"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </motion.div>
    );
}
