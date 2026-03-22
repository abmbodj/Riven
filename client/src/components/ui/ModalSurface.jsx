import React, { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const SIZE_CLASSES = {
    sm: 'md:max-w-md',
    md: 'md:max-w-2xl',
};

const TONE_CLASSES = {
    default: {
        panel: 'border-claude-border bg-claude-bg/96 shadow-[0_30px_90px_rgba(0,0,0,0.38)]',
        overlay: 'bg-claude-bg/72 md:backdrop-blur-md',
        handle: 'bg-claude-surface/80',
        headerBorder: 'border-claude-border/80',
        headerEyebrow: 'border-claude-accent/20 bg-claude-accent/10 text-claude-accent',
        title: 'text-claude-text',
        description: 'text-claude-secondary',
        closeButton: 'border-claude-border bg-claude-bg/15 text-claude-secondary hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-text',
        accent: 'bg-[radial-gradient(circle_at_top_left,rgba(168,192,127,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(216,182,106,0.14),transparent_32%)]',
        footer: 'border-claude-border/80 bg-claude-bg/55',
    },
    danger: {
        panel: 'border-red-500/25 bg-[#120f14]/98 shadow-[0_30px_90px_rgba(0,0,0,0.45)]',
        overlay: 'bg-black/72 md:backdrop-blur-md',
        handle: 'bg-red-500/25',
        headerBorder: 'border-red-500/18',
        headerEyebrow: 'border-red-500/20 bg-red-500/10 text-red-300',
        title: 'text-red-50',
        description: 'text-red-100/75',
        closeButton: 'border-red-500/20 bg-red-500/8 text-red-200/75 hover:-translate-y-0.5 hover:border-red-400/40 hover:text-red-50',
        accent: 'bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(127,29,29,0.22),transparent_42%)]',
        footer: 'border-red-500/18 bg-red-950/18',
    },
};

export default function ModalSurface({
    isOpen,
    onClose,
    title,
    eyebrow,
    description,
    tone = 'default',
    size = 'md',
    scrollClassName = '',
    contentClassName = '',
    footer = null,
    children,
}) {
    useBodyScrollLock(isOpen);

    const titleId = useId();
    const descriptionId = useId();
    const toneClasses = TONE_CLASSES[tone] || TONE_CLASSES.default;
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
    const hasHeader = Boolean(eyebrow || title || description);
    const bodyPadding = footer
        ? 'px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5'
        : 'px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4 sm:px-6 sm:pb-6 sm:pt-5';

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen ? (
                <div className="fixed inset-0 z-[999] flex items-end justify-center px-2 pt-[max(env(safe-area-inset-top,0px),0.75rem)] md:items-center md:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`absolute inset-0 ${toneClasses.overlay}`}
                        onClick={onClose}
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? titleId : undefined}
                        aria-describedby={description ? descriptionId : undefined}
                        initial={{ opacity: 0, y: 32, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                        className={`relative flex max-h-[calc(100dvh-max(env(safe-area-inset-top,0px),0.75rem))] w-full flex-col overflow-hidden rounded-t-[2rem] border md:max-h-[94vh] md:rounded-[2rem] ${sizeClass} ${toneClasses.panel} ${contentClassName}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={`pointer-events-none absolute inset-0 ${toneClasses.accent}`} />

                        <div className="relative flex justify-center pt-4 md:hidden">
                            <div className={`h-1.5 w-12 rounded-full ${toneClasses.handle}`} />
                        </div>

                        {hasHeader ? (
                            <div className={`relative flex items-start justify-between gap-4 border-b px-5 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-5 ${toneClasses.headerBorder}`}>
                                <div className="min-w-0 flex-1">
                                    {eyebrow ? (
                                        <div className={`mb-3 inline-flex items-center rounded-full border px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] ${toneClasses.headerEyebrow}`}>
                                            {eyebrow}
                                        </div>
                                    ) : null}
                                    {title ? (
                                        <h2 id={titleId} className={`font-display text-[1.8rem] font-bold italic leading-none tracking-tight ${toneClasses.title}`}>
                                            {title}
                                        </h2>
                                    ) : null}
                                    {description ? (
                                        <p id={descriptionId} className={`mt-3 max-w-2xl text-sm leading-relaxed ${toneClasses.description}`}>
                                            {description}
                                        </p>
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`tap-action mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 active:scale-95 ${toneClasses.closeButton}`}
                                    aria-label={title ? `Close ${title}` : 'Close dialog'}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        ) : null}

                        <div className={`modal-scroll-content relative flex-1 overflow-y-auto overscroll-contain ${bodyPadding} ${scrollClassName}`}>
                            {children}
                        </div>

                        {footer ? (
                            <div className={`relative border-t px-5 py-4 sm:px-6 ${toneClasses.footer}`}>
                                {footer}
                            </div>
                        ) : null}
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}
