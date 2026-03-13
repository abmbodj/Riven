import { createElement, useEffect } from 'react';
import { AnimatePresence, motion as Motion } from 'motion/react';
import { Check, Monitor, Moon, Palette, Smartphone, Sparkles, Sun, X } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import {
    ACCENT_PRESETS,
    COLOR_FIELDS,
    COLOR_FIELD_LABELS,
    FONT_PRESETS,
    STYLE_PRESETS,
    getBaseTheme,
    visuallyMatchesTheme
} from './themeEditorConfig';

function hexToRgb(hex) {
    const sanitized = hex.replace('#', '').trim();
    const normalized = sanitized.length === 3
        ? sanitized.split('').map((char) => char + char).join('')
        : sanitized;

    const value = Number.parseInt(normalized, 16);
    if (Number.isNaN(value)) {
        return { r: 0, g: 0, b: 0 };
    }

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isDarkTheme(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.58;
}

function Section({ eyebrow, title, description, children, theme }) {
    return (
        <section
            className="rounded-[1.5rem] border p-3.5 shadow-sm md:rounded-[1.75rem] md:p-5"
            style={{
                borderColor: withAlpha(theme.border_color, 0.9),
                backgroundColor: withAlpha(theme.surface_color, 0.9),
                boxShadow: `0 24px 80px ${withAlpha(theme.bg_color, 0.18)}`
            }}
        >
            <div className="mb-3 md:mb-4">
                <p
                    className="text-[10px] font-bold uppercase tracking-[0.24em]"
                    style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}
                >
                    {eyebrow}
                </p>
                <h3
                    className="mt-1 text-[1.65rem] leading-tight md:text-2xl"
                    style={{ color: theme.text_color, fontFamily: theme.font_family_display }}
                >
                    {title}
                </h3>
                {description ? (
                    <p
                        className="mt-1 text-sm leading-5 md:leading-6"
                        style={{ color: withAlpha(theme.secondary_text_color, 0.92), fontFamily: theme.font_family_body }}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </section>
    );
}

function ModeButton({ active, icon: Icon, label, helper, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action flex min-h-[96px] flex-col justify-between rounded-[1.35rem] border p-3.5 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 md:min-h-[108px] md:rounded-[1.5rem] md:p-4"
            style={{
                borderColor: active ? theme.accent_color : withAlpha(theme.border_color, 0.85),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.12) : withAlpha(theme.bg_color, 0.36),
                boxShadow: active ? `0 18px 40px ${withAlpha(theme.accent_color, 0.2)}` : 'none'
            }}
        >
            <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{
                    borderColor: active ? withAlpha(theme.accent_color, 0.55) : withAlpha(theme.border_color, 0.7),
                    backgroundColor: active ? withAlpha(theme.accent_color, 0.18) : withAlpha(theme.surface_color, 0.95),
                    color: active ? theme.accent_color : theme.text_color
                }}
            >
                {createElement(Icon, { className: 'h-5 w-5' })}
            </div>
            <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: theme.text_color }}>
                    {label}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                    {helper}
                </p>
            </div>
        </button>
    );
}

function PresetCard({ preset, active, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action rounded-[1.35rem] border p-3.5 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 md:rounded-[1.5rem] md:p-4"
            style={{
                borderColor: active ? preset.theme.accent_color : withAlpha(theme.border_color, 0.8),
                background: `linear-gradient(135deg, ${withAlpha(preset.theme.bg_color, 0.98)} 0%, ${withAlpha(preset.theme.surface_color, 0.98)} 100%)`,
                boxShadow: active ? `0 16px 40px ${withAlpha(preset.theme.accent_color, 0.18)}` : 'none'
            }}
        >
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: preset.theme.secondary_text_color }}>
                        {preset.eyebrow}
                    </p>
                    <h4
                        className="mt-1 text-xl leading-tight md:text-2xl"
                        style={{ color: preset.theme.text_color, fontFamily: preset.theme.font_family_display }}
                    >
                        {preset.name}
                    </h4>
                </div>
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{
                        borderColor: withAlpha(preset.theme.accent_color, 0.4),
                        backgroundColor: active ? preset.theme.accent_color : withAlpha(preset.theme.surface_color, 0.8),
                        color: active ? preset.theme.bg_color : preset.theme.accent_color
                    }}
                >
                    <Check className="h-4 w-4" />
                </div>
            </div>
            <div className="mb-3 flex gap-2">
                {COLOR_FIELDS.map((field) => (
                    <span
                        key={field}
                        className="h-8 flex-1 rounded-full border"
                        style={{
                            backgroundColor: preset.theme[field],
                            borderColor: withAlpha(preset.theme.text_color, 0.08)
                        }}
                    />
                ))}
            </div>
            <p className="text-sm leading-5 md:leading-6" style={{ color: withAlpha(preset.theme.secondary_text_color, 0.95) }}>
                {preset.description}
            </p>
        </button>
    );
}

function SwatchButton({ swatch, active, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action flex w-full min-w-0 flex-col items-center gap-3 rounded-[1.15rem] border px-3 py-3 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 md:rounded-[1.25rem]"
            style={{
                borderColor: active ? swatch.color : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(swatch.color, 0.14) : withAlpha(theme.bg_color, 0.38),
                boxShadow: active ? `0 16px 30px ${withAlpha(swatch.color, 0.18)}` : 'none'
            }}
        >
            <span
                className="block h-10 w-10 rounded-full border"
                style={{
                    backgroundColor: swatch.color,
                    borderColor: active ? withAlpha(theme.text_color, 0.14) : 'transparent'
                }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.text_color }}>
                {swatch.name}
            </span>
        </button>
    );
}

function FontCard({ preset, active, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action rounded-[1.35rem] border p-3.5 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 md:rounded-[1.5rem] md:p-4"
            style={{
                borderColor: active ? theme.accent_color : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.08) : withAlpha(theme.bg_color, 0.34),
                boxShadow: active ? `0 16px 30px ${withAlpha(theme.accent_color, 0.16)}` : 'none'
            }}
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                        Typography
                    </p>
                    <h4 className="mt-1 text-xl leading-tight md:text-2xl" style={{ color: theme.text_color, fontFamily: preset.display }}>
                        {preset.name}
                    </h4>
                </div>
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{
                        borderColor: withAlpha(theme.border_color, 0.8),
                        backgroundColor: active ? theme.accent_color : withAlpha(theme.surface_color, 0.92),
                        color: active ? theme.bg_color : theme.accent_color
                    }}
                >
                    <Check className="h-4 w-4" />
                </div>
            </div>
            <p className="text-sm" style={{ color: theme.text_color, fontFamily: preset.display }}>
                The semester is under control.
            </p>
            <p className="mt-2 text-sm leading-5 md:leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: preset.body }}>
                {preset.description}
            </p>
        </button>
    );
}

function ColorField({ field, theme, onChange }) {
    return (
        <label
            className="block rounded-[1.2rem] border p-3 md:rounded-[1.4rem]"
            style={{
                borderColor: withAlpha(theme.border_color, 0.82),
                backgroundColor: withAlpha(theme.bg_color, 0.34)
            }}
        >
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                {COLOR_FIELD_LABELS[field]}
            </span>
            <div className="mt-3 flex items-center gap-3">
                <span
                    className="relative block h-11 w-11 overflow-hidden rounded-2xl border"
                    style={{ borderColor: withAlpha(theme.border_color, 0.86), backgroundColor: theme[field] }}
                >
                    <input
                        type="color"
                        value={theme[field]}
                        onChange={(event) => onChange(field, event.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: theme.text_color }}>
                        {theme[field]}
                    </p>
                    <p className="text-xs" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                        Precise token override
                    </p>
                </div>
            </div>
        </label>
    );
}

function PreviewDesktop({ theme }) {
    return (
        <div
            className="overflow-hidden rounded-[1.55rem] border md:rounded-[1.8rem]"
            style={{
                borderColor: withAlpha(theme.border_color, 0.9),
                backgroundColor: theme.bg_color,
                color: theme.text_color,
                boxShadow: `0 30px 80px ${withAlpha(theme.bg_color, 0.3)}`
            }}
        >
            <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderBottomColor: withAlpha(theme.border_color, 0.86), backgroundColor: withAlpha(theme.surface_color, 0.82) }}
            >
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent_color }} />
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}>
                        Dashboard
                    </p>
                </div>
                <div
                    className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{
                        borderColor: withAlpha(theme.accent_color, 0.36),
                        backgroundColor: withAlpha(theme.accent_color, 0.12),
                        color: theme.accent_color
                    }}
                >
                    Ready
                </div>
            </div>
            <div className="grid gap-3 p-3 md:p-4">
                <div
                    className="rounded-[1.35rem] border p-3 md:rounded-[1.5rem] md:p-4"
                    style={{ borderColor: withAlpha(theme.border_color, 0.86), backgroundColor: withAlpha(theme.surface_color, 0.96) }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                        Today
                    </p>
                    <h4 className="mt-2 text-[1.65rem] leading-none md:text-3xl" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                        Study Queue
                    </h4>
                    <p className="mt-2 text-sm leading-5 md:leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                        Strong hierarchy, softer surfaces, and a single accent line up with newer Riven screens.
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        {['Due', 'Streak', 'Groups'].map((label, index) => (
                            <div
                                key={label}
                                className="rounded-2xl border px-3 py-3"
                                style={{
                                    borderColor: withAlpha(theme.border_color, 0.76),
                                    backgroundColor: index === 1 ? withAlpha(theme.accent_color, 0.12) : withAlpha(theme.bg_color, 0.38)
                                }}
                            >
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                                    {label}
                                </p>
                                <p className="mt-2 text-xl leading-none" style={{ color: index === 1 ? theme.accent_color : theme.text_color, fontFamily: theme.font_family_display }}>
                                    {index === 0 ? '18' : index === 1 ? '42' : '3'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                    <div
                        className="rounded-[1.25rem] border p-3 md:rounded-[1.4rem] md:p-4"
                        style={{ borderColor: withAlpha(theme.border_color, 0.84), backgroundColor: withAlpha(theme.surface_color, 0.94) }}
                    >
                        <div className="flex items-center justify-between">
                            <h5 className="text-lg" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                                Focus Session
                            </h5>
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.accent_color }}>
                                25 min
                            </span>
                        </div>
                        <div className="mt-4 h-2 rounded-full" style={{ backgroundColor: withAlpha(theme.border_color, 0.7) }}>
                            <div className="h-2 rounded-full" style={{ width: '68%', backgroundColor: theme.accent_color }} />
                        </div>
                        <div className="mt-4 space-y-2">
                            {[0, 1, 2].map((item) => (
                                <div
                                    key={item}
                                    className="rounded-xl border px-3 py-2.5"
                                    style={{ borderColor: withAlpha(theme.border_color, 0.76), backgroundColor: withAlpha(theme.bg_color, 0.36) }}
                                >
                                    <p className="text-sm" style={{ color: theme.text_color, fontFamily: theme.font_family_body }}>
                                        Lecture review #{item + 1}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        className="rounded-[1.25rem] border p-3 md:rounded-[1.4rem] md:p-4"
                        style={{ borderColor: withAlpha(theme.border_color, 0.84), backgroundColor: withAlpha(theme.surface_color, 0.94) }}
                    >
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}>
                            CTA
                        </p>
                        <button
                            type="button"
                            className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-[0.18em]"
                            style={{
                                backgroundColor: theme.accent_color,
                                color: isDarkTheme(theme.accent_color) ? '#f8fbfd' : '#0b1418'
                            }}
                        >
                            Start review
                        </button>
                        <div className="mt-4 rounded-2xl border px-3 py-3" style={{ borderColor: withAlpha(theme.border_color, 0.78) }}>
                            <p className="text-xs" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                                Inputs, cards, hierarchy, and motion all read clearly in desktop layouts.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PreviewPhone({ theme }) {
    return (
        <div
            className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[2rem] border p-2"
            style={{
                borderColor: withAlpha(theme.border_color, 0.92),
                backgroundColor: withAlpha(theme.bg_color, 0.92),
                boxShadow: `0 26px 80px ${withAlpha(theme.bg_color, 0.34)}`
            }}
        >
            <div
                className="overflow-hidden rounded-[1.6rem] border"
                style={{
                    borderColor: withAlpha(theme.border_color, 0.82),
                    backgroundColor: theme.bg_color,
                    color: theme.text_color
                }}
            >
                <div className="flex justify-center py-2">
                    <span className="h-1.5 w-16 rounded-full" style={{ backgroundColor: withAlpha(theme.secondary_text_color, 0.45) }} />
                </div>
                <div className="space-y-3 px-4 pb-4 pt-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}>
                                Mobile
                            </p>
                            <h5 className="mt-1 text-xl leading-none" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                                Quick Study
                            </h5>
                        </div>
                        <div
                            className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                            style={{
                                borderColor: withAlpha(theme.accent_color, 0.34),
                                backgroundColor: withAlpha(theme.accent_color, 0.12),
                                color: theme.accent_color
                            }}
                        >
                            8 cards
                        </div>
                    </div>

                    <div
                        className="rounded-[1.4rem] border p-3"
                        style={{
                            borderColor: withAlpha(theme.border_color, 0.82),
                            backgroundColor: withAlpha(theme.surface_color, 0.96)
                        }}
                    >
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                            Next
                        </p>
                        <p className="mt-2 text-lg leading-tight" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                            Biology flashcards
                        </p>
                        <p className="mt-2 text-xs leading-5" style={{ color: withAlpha(theme.secondary_text_color, 0.94), fontFamily: theme.font_family_body }}>
                            Tap targets stay large, contrast stays readable, and the accent does the guiding.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="w-full rounded-[1.2rem] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                        style={{
                            backgroundColor: theme.accent_color,
                            color: isDarkTheme(theme.accent_color) ? '#f8fbfd' : '#0b1418'
                        }}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}

function PreviewColumn({ theme, compact = false, mobileFirst = false }) {
    const previewSections = [
        {
            key: 'desktop',
            label: 'Desktop',
            icon: Monitor,
            component: <PreviewDesktop theme={theme} />
        },
        {
            key: 'mobile',
            label: 'Mobile',
            icon: Smartphone,
            component: <PreviewPhone theme={theme} />
        }
    ];

    const orderedPreviewSections = mobileFirst
        ? [previewSections[1], previewSections[0]]
        : previewSections;

    return (
        <div className="space-y-4">
            <div
                className="rounded-[1.75rem] border p-4"
                style={{
                    borderColor: withAlpha(theme.border_color, 0.88),
                    backgroundColor: withAlpha(theme.surface_color, 0.92)
                }}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: theme.accent_color }} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                        Live preview
                    </p>
                </div>
                <h4 className="mt-2 text-2xl leading-tight" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                    {theme.name?.trim() || 'Untitled atmosphere'}
                </h4>
                <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                    The editor now previews both viewport classes before you save, which is the missing piece in the old builder.
                </p>
            </div>

            {orderedPreviewSections.map((section) => {
                const Icon = section.icon;

                return (
                    <div key={section.key} className={compact ? 'space-y-4' : 'space-y-5'}>
                        <div className="flex items-center gap-2 px-1">
                            <Icon className="h-4 w-4" style={{ color: theme.accent_color }} />
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}>
                                {section.label}
                            </p>
                        </div>
                        {section.component}
                    </div>
                );
            })}
        </div>
    );
}

export default function ThemeEditorModal({
    isOpen,
    editingTheme,
    themeForm,
    setThemeForm,
    editorMode,
    setEditorMode,
    onClose,
    onSubmit,
    haptics
}) {
    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const activeBase = visuallyMatchesTheme(themeForm, getBaseTheme('light')) ? 'light' : 'dark';

    const updateTheme = (next) => {
        setThemeForm((previous) => ({
            ...previous,
            ...(typeof next === 'function' ? next(previous) : next)
        }));
    };

    const pulse = (type = 'light') => {
        if (haptics?.[type]) {
            haptics[type]();
        }
    };

    const applyBaseTheme = (mode) => {
        pulse('light');
        setEditorMode('curated');
        updateTheme((previous) => ({
            ...getBaseTheme(mode),
            name: previous.name
        }));
    };

    const applyStylePreset = (preset) => {
        pulse('light');
        setEditorMode('curated');
        updateTheme((previous) => ({
            ...preset.theme,
            name: previous.name
        }));
    };

    const applyAccent = (accent) => {
        pulse('light');
        updateTheme({ accent_color: accent, });
    };

    const applyFontPreset = (preset) => {
        pulse('light');
        updateTheme({
            font_family_display: preset.display,
            font_family_body: preset.body
        });
    };

    const setColorValue = (field, value) => {
        setEditorMode('custom');
        updateTheme({ [field]: value });
    };

    const title = editingTheme ? 'Refine Theme' : 'Theme Studio';

    return (
        <AnimatePresence>
            {isOpen ? (
                <div className="fixed inset-0 z-[100] flex items-end justify-center px-2 pt-[max(env(safe-area-inset-top,0px),0.75rem)] md:p-6">
                    <Motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        aria-label="Close theme editor"
                    />

                    <Motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="theme-editor-title"
                        initial={{ opacity: 0, y: 40, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                        className="modal-content relative flex max-h-[calc(100dvh-max(env(safe-area-inset-top,0px),0.75rem))] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] border md:max-h-[94vh] md:rounded-[2rem]"
                        style={{
                            borderColor: withAlpha(themeForm.border_color, 0.95),
                            background: `linear-gradient(180deg, ${withAlpha(themeForm.bg_color, 0.98)} 0%, ${withAlpha(themeForm.surface_color, 0.98)} 100%)`,
                            color: themeForm.text_color,
                            boxShadow: `0 40px 140px ${withAlpha(themeForm.bg_color, 0.5)}`
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: `radial-gradient(circle at top right, ${withAlpha(themeForm.accent_color, 0.18)} 0%, transparent 34%), radial-gradient(circle at bottom left, ${withAlpha(themeForm.text_color, 0.05)} 0%, transparent 42%)`
                            }}
                        />

                        <div className="relative flex justify-center pt-4 md:hidden">
                            <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: withAlpha(themeForm.secondary_text_color, 0.4) }} />
                        </div>

                        <div className="relative flex items-start justify-between gap-4 border-b px-4 pb-4 pt-3 md:items-center md:px-8 md:py-6" style={{ borderBottomColor: withAlpha(themeForm.border_color, 0.92) }}>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95) }}>
                                    Create Theme
                                </p>
                                <h2 id="theme-editor-title" className="mt-2 text-[2rem] leading-none md:text-4xl" style={{ fontFamily: themeForm.font_family_display }}>
                                    {title}
                                </h2>
                                <p className="mt-2 max-w-2xl pr-2 text-sm leading-5 md:pr-0 md:leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: themeForm.font_family_body }}>
                                    One continuous flow: start with the phone read, keep scrolling, and finish on the desktop pass before you save.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="tap-action flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 md:h-11 md:w-11"
                                style={{
                                    borderColor: withAlpha(themeForm.border_color, 0.82),
                                    backgroundColor: withAlpha(themeForm.surface_color, 0.9),
                                    color: themeForm.text_color
                                }}
                                aria-label="Close theme editor"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form id="theme-editor-form" onSubmit={onSubmit} className="modal-scroll-content relative min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
                            <div className="grid gap-5 px-4 pb-32 pt-4 md:grid-cols-[minmax(0,1fr)_380px] md:gap-6 md:px-8 md:pb-8 md:pt-6">
                                <div className="space-y-5">
                                    <Section
                                        eyebrow="Identity"
                                        title="Name and intent"
                                        description="Give the theme a name first. Everything else should reinforce that tone."
                                        theme={themeForm}
                                    >
                                        <label className="block">
                                            <span className="sr-only">Theme name</span>
                                            <input
                                                type="text"
                                                value={themeForm.name}
                                                onChange={(event) => updateTheme({ name: event.target.value })}
                                                placeholder="Night lectures, paper desk, focus mode..."
                                                autoFocus
                                                className="w-full rounded-[1.2rem] border px-4 py-3.5 text-[2rem] outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] md:rounded-[1.4rem] md:py-4 md:text-4xl"
                                                style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.9),
                                                    backgroundColor: withAlpha(themeForm.bg_color, 0.38),
                                                    color: themeForm.text_color,
                                                    fontFamily: themeForm.font_family_display
                                                }}
                                            />
                                        </label>
                                    </Section>

                                    <div className="md:hidden">
                                        <Section
                                            eyebrow="Preview"
                                            title="Start on phone, keep scrolling"
                                            description="The preview is fully linear on mobile now. Read the phone version first, then continue straight down into the desktop pass."
                                            theme={themeForm}
                                        >
                                            <div
                                                className="mt-4 rounded-[1.35rem] border p-3"
                                                style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.84),
                                                    backgroundColor: withAlpha(themeForm.bg_color, 0.34)
                                                }}
                                            >
                                                <PreviewColumn theme={themeForm} compact mobileFirst />
                                            </div>
                                        </Section>
                                    </div>

                                    <Section
                                        eyebrow="Foundation"
                                        title="Start from the right lighting"
                                        description="Pick the base atmosphere that best matches how the theme will actually be used."
                                        theme={themeForm}
                                    >
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <ModeButton
                                                active={activeBase === 'dark'}
                                                icon={Moon}
                                                label="Dark studio"
                                                helper="Best for late sessions and richer accent contrast."
                                                onClick={() => applyBaseTheme('dark')}
                                                theme={themeForm}
                                            />
                                            <ModeButton
                                                active={activeBase === 'light'}
                                                icon={Sun}
                                                label="Light paper"
                                                helper="Cleaner daytime read with warmer surfaces."
                                                onClick={() => applyBaseTheme('light')}
                                                theme={themeForm}
                                            />
                                        </div>
                                    </Section>

                                    <Section
                                        eyebrow="Curated"
                                        title="Riven-ready directions"
                                        description="These presets are designed for the current product language, not the older theme screen."
                                        theme={themeForm}
                                    >
                                        <div className="grid gap-3 xl:grid-cols-2">
                                            {STYLE_PRESETS.map((preset) => (
                                                <PresetCard
                                                    key={preset.id}
                                                    preset={preset}
                                                    active={visuallyMatchesTheme(themeForm, preset.theme)}
                                                    onClick={() => applyStylePreset(preset)}
                                                    theme={themeForm}
                                                />
                                            ))}
                                        </div>
                                    </Section>

                                    <Section
                                        eyebrow="Accent"
                                        title="Choose the signal color"
                                        description="Accent should guide attention, not repaint the whole experience."
                                        theme={themeForm}
                                    >
                                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                                            {ACCENT_PRESETS.map((swatch) => (
                                                <SwatchButton
                                                    key={swatch.color}
                                                    swatch={swatch}
                                                    active={themeForm.accent_color === swatch.color}
                                                    onClick={() => applyAccent(swatch.color)}
                                                    theme={themeForm}
                                                />
                                            ))}
                                        </div>
                                    </Section>

                                    <Section
                                        eyebrow="Typography"
                                        title="Match the voice"
                                        description="Use the default editorial stack unless you have a specific reason to skew sharper or more technical."
                                        theme={themeForm}
                                    >
                                        <div className="grid gap-3 xl:grid-cols-2">
                                            {FONT_PRESETS.map((preset) => (
                                                <FontCard
                                                    key={preset.id}
                                                    preset={preset}
                                                    active={
                                                        themeForm.font_family_display === preset.display
                                                        && themeForm.font_family_body === preset.body
                                                    }
                                                    onClick={() => applyFontPreset(preset)}
                                                    theme={themeForm}
                                                />
                                            ))}
                                        </div>
                                    </Section>

                                    <Section
                                        eyebrow="Precision"
                                        title="Fine tune the tokens"
                                        description="Curated keeps you close to the system. Custom lets you override each token when you need exact control."
                                        theme={themeForm}
                                    >
                                        <div
                                            className="mb-4 inline-flex rounded-full border p-1"
                                            style={{
                                                borderColor: withAlpha(themeForm.border_color, 0.82),
                                                backgroundColor: withAlpha(themeForm.bg_color, 0.34)
                                            }}
                                        >
                                            {[
                                                { id: 'curated', label: 'Curated', icon: Sparkles },
                                                { id: 'custom', label: 'Custom', icon: Palette }
                                            ].map((mode) => {
                                                const Icon = mode.icon;

                                                return (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => setEditorMode(mode.id)}
                                                        className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200"
                                                        style={{
                                                            backgroundColor: editorMode === mode.id ? themeForm.accent_color : 'transparent',
                                                            color: editorMode === mode.id ? (isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418') : themeForm.text_color,
                                                            opacity: editorMode === mode.id ? 1 : 0.72
                                                        }}
                                                    >
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {mode.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {editorMode === 'custom' ? (
                                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                {COLOR_FIELDS.map((field) => (
                                                    <ColorField
                                                        key={field}
                                                        field={field}
                                                        theme={themeForm}
                                                        onChange={setColorValue}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div
                                                className="rounded-[1.4rem] border px-4 py-4"
                                                style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.82),
                                                    backgroundColor: withAlpha(themeForm.bg_color, 0.34)
                                                }}
                                            >
                                                <p className="text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95), fontFamily: themeForm.font_family_body }}>
                                                    Stay in curated mode for stronger visual consistency. Jump to custom only when you need token-level changes that the preset system cannot express.
                                                </p>
                                            </div>
                                        )}
                                    </Section>
                                </div>

                                <aside className="hidden md:block md:self-start md:sticky md:top-0">
                                    <PreviewColumn theme={themeForm} />
                                </aside>
                            </div>
                        </form>

                        <div
                            className="relative border-t bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.02))] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 md:px-8 md:py-4"
                            style={{ borderTopColor: withAlpha(themeForm.border_color, 0.92), backgroundColor: withAlpha(themeForm.bg_color, 0.92) }}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95) }}>
                                        Save
                                    </p>
                                    <p className="mt-1 text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: themeForm.font_family_body }}>
                                        The saved theme can still be refined later from your gallery.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="tap-action rounded-full border px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
                                        style={{
                                            borderColor: withAlpha(themeForm.border_color, 0.86),
                                            backgroundColor: withAlpha(themeForm.surface_color, 0.96),
                                            color: themeForm.text_color
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        form="theme-editor-form"
                                        className="tap-action rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
                                        style={{
                                            backgroundColor: themeForm.accent_color,
                                            color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418',
                                            boxShadow: `0 20px 40px ${withAlpha(themeForm.accent_color, 0.26)}`
                                        }}
                                    >
                                        {editingTheme ? 'Save refinements' : 'Create theme'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}
