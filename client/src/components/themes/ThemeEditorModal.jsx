import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'motion/react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Monitor,
    Moon,
    Palette,
    Smartphone,
    Sun,
    Wand2,
    X
} from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import {
    ACCENT_PRESETS,
    COLOR_FIELDS,
    COLOR_FIELD_LABELS,
    EFFECT_INTENSITY_OPTIONS,
    EFFECT_PRESETS,
    FONT_PRESETS,
    MOBILE_MOOD_PRESETS,
    STYLE_PRESETS,
    getBaseTheme,
    getMoodTheme,
    visuallyMatchesTheme
} from './themeEditorConfig';
import { getThemeEffectLabel, ThemeEffectOverlay } from './themeEffects.jsx';

const STUDIO_TABS = [
    {
        id: 'core',
        label: 'Core',
        eyebrow: 'Core controls',
        title: 'Choose the atmosphere',
        description: 'Start with the mood, accent, type, and effects before opening any deeper tuning.'
    },
    {
        id: 'advanced',
        label: 'Advanced',
        eyebrow: 'Advanced controls',
        title: 'Fine-tune the palette',
        description: 'Open the precise token controls only when the curated mix needs more adjustment.'
    },
    {
        id: 'review',
        label: 'Review',
        eyebrow: 'Review & save',
        title: 'Name it and save',
        description: 'Check the final atmosphere, give it a clear name, and save it back to your gallery.'
    }
];

const PALETTE_FIELDS = COLOR_FIELDS.filter((field) => field !== 'accent_color');
const MOOD_MATCH_FIELDS = ['bg_color', 'surface_color', 'text_color', 'secondary_text_color', 'border_color'];

function matchesMediaQuery(query) {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia(query).matches;
}

function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => matchesMediaQuery(query));

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(query);
        const handleChange = (event) => setMatches(event.matches);

        setMatches(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, [query]);

    return matches;
}

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

function paletteMatches(theme, comparison) {
    return PALETTE_FIELDS.every((field) => theme[field] === comparison[field]);
}

function inferStarter(theme) {
    const lightBase = getBaseTheme('light');
    const darkBase = getBaseTheme('dark');

    if (visuallyMatchesTheme(theme, darkBase)) {
        return { label: 'Dark studio', helper: 'Base theme' };
    }

    if (visuallyMatchesTheme(theme, lightBase)) {
        return { label: 'Light paper', helper: 'Base theme' };
    }

    const presetMatch = STYLE_PRESETS.find((preset) => visuallyMatchesTheme(theme, preset.theme));
    if (presetMatch) {
        return { label: presetMatch.name, helper: 'Curated starter' };
    }

    const paletteMatch = STYLE_PRESETS.find((preset) => paletteMatches(theme, preset.theme));
    if (paletteMatch) {
        return { label: paletteMatch.name, helper: 'Curated palette' };
    }

    if (paletteMatches(theme, darkBase)) {
        return { label: 'Dark studio', helper: 'Base palette' };
    }

    if (paletteMatches(theme, lightBase)) {
        return { label: 'Light paper', helper: 'Base palette' };
    }

    return { label: 'Custom blend', helper: 'Fine-tuned palette' };
}

function inferAccent(theme) {
    const preset = ACCENT_PRESETS.find((item) => item.color.toLowerCase() === theme.accent_color.toLowerCase());
    return preset ? preset.name : theme.accent_color.toUpperCase();
}

function inferFont(theme) {
    const preset = FONT_PRESETS.find((item) => (
        item.display === theme.font_family_display
        && item.body === theme.font_family_body
    ));

    return preset ? preset.name : 'Custom type';
}

function hasFineTunedPalette(theme) {
    return ![getBaseTheme('dark'), getBaseTheme('light'), ...STYLE_PRESETS.map((preset) => preset.theme)]
        .some((comparison) => paletteMatches(theme, comparison));
}

function inferMode(theme) {
    return isDarkTheme(theme.bg_color) ? 'dark' : 'light';
}

function inferMood(theme, mode) {
    const match = MOBILE_MOOD_PRESETS.find((preset) => {
        const comparison = getMoodTheme(mode, preset.id);
        return MOOD_MATCH_FIELDS.every((field) => theme[field] === comparison[field]);
    });

    return match?.id || 'calm';
}

function StudioSection({ eyebrow, title, description, children, theme }) {
    return (
        <section
            className="rounded-[1.65rem] border p-4 md:rounded-[1.9rem] md:p-5"
            style={{
                borderColor: withAlpha(theme.border_color, 0.88),
                backgroundColor: withAlpha(theme.surface_color, 0.9),
                boxShadow: `0 22px 70px ${withAlpha(theme.bg_color, 0.16)}`
            }}
        >
            <div className="mb-4">
                <p
                    className="text-[10px] font-bold uppercase tracking-[0.24em]"
                    style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}
                >
                    {eyebrow}
                </p>
                <h3
                    className="mt-2 text-[1.75rem] leading-tight md:text-[2rem]"
                    style={{ color: theme.text_color, fontFamily: theme.font_family_display }}
                >
                    {title}
                </h3>
                {description ? (
                    <p
                        className="mt-2 max-w-2xl text-sm leading-6"
                        style={{ color: withAlpha(theme.secondary_text_color, 0.94), fontFamily: theme.font_family_body }}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </section>
    );
}

function BaseChoiceCard({ active, icon: Icon, label, helper, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action flex min-h-[124px] flex-col justify-between rounded-[1.4rem] border p-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
            style={{
                borderColor: active ? withAlpha(theme.accent_color, 0.55) : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.1) : withAlpha(theme.bg_color, 0.34),
                boxShadow: active ? `0 20px 38px ${withAlpha(theme.accent_color, 0.16)}` : 'none'
            }}
        >
            <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{
                    borderColor: active ? withAlpha(theme.accent_color, 0.45) : withAlpha(theme.border_color, 0.74),
                    backgroundColor: active ? withAlpha(theme.accent_color, 0.16) : withAlpha(theme.surface_color, 0.96),
                    color: active ? theme.accent_color : theme.text_color
                }}
            >
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: theme.text_color }}>
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
            className="tap-action rounded-[1.45rem] border p-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
            style={{
                borderColor: active ? preset.theme.accent_color : withAlpha(theme.border_color, 0.8),
                background: `linear-gradient(135deg, ${withAlpha(preset.theme.bg_color, 0.98)} 0%, ${withAlpha(preset.theme.surface_color, 0.98)} 100%)`,
                boxShadow: active ? `0 22px 42px ${withAlpha(preset.theme.accent_color, 0.18)}` : 'none'
            }}
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <p
                        className="text-[10px] font-bold uppercase tracking-[0.22em]"
                        style={{ color: withAlpha(preset.theme.secondary_text_color, 0.95) }}
                    >
                        {preset.eyebrow}
                    </p>
                    <h4
                        className="mt-1 text-xl leading-tight"
                        style={{ color: preset.theme.text_color, fontFamily: preset.theme.font_family_display }}
                    >
                        {preset.name}
                    </h4>
                </div>
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{
                        borderColor: withAlpha(preset.theme.accent_color, 0.34),
                        backgroundColor: active ? preset.theme.accent_color : withAlpha(preset.theme.surface_color, 0.86),
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
            <p className="text-sm leading-6" style={{ color: withAlpha(preset.theme.secondary_text_color, 0.95) }}>
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
            className="tap-action flex w-full min-w-0 flex-col items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-center transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
            style={{
                borderColor: active ? swatch.color : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(swatch.color, 0.14) : withAlpha(theme.bg_color, 0.34),
                boxShadow: active ? `0 16px 30px ${withAlpha(swatch.color, 0.16)}` : 'none'
            }}
        >
            <span
                className="block h-10 w-10 rounded-full border"
                style={{
                    backgroundColor: swatch.color,
                    borderColor: active ? withAlpha(theme.text_color, 0.18) : 'transparent'
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
            className="tap-action rounded-[1.4rem] border p-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
            style={{
                borderColor: active ? withAlpha(theme.accent_color, 0.55) : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.08) : withAlpha(theme.bg_color, 0.34),
                boxShadow: active ? `0 18px 32px ${withAlpha(theme.accent_color, 0.14)}` : 'none'
            }}
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                        Typography
                    </p>
                    <h4 className="mt-1 text-xl leading-tight" style={{ color: theme.text_color, fontFamily: preset.display }}>
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
            <p className="text-base leading-tight" style={{ color: theme.text_color, fontFamily: preset.display }}>
                The semester is under control.
            </p>
            <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: preset.body }}>
                {preset.description}
            </p>
        </button>
    );
}

function MoodCard({ preset, active, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action rounded-[1.35rem] border p-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
            style={{
                borderColor: active ? withAlpha(theme.accent_color, 0.55) : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.1) : withAlpha(theme.bg_color, 0.34),
                boxShadow: active ? `0 18px 30px ${withAlpha(theme.accent_color, 0.14)}` : 'none'
            }}
        >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                Mood
            </p>
            <h4 className="mt-2 text-lg leading-tight" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                {preset.name}
            </h4>
            <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                {preset.description}
            </p>
        </button>
    );
}

function EffectCard({ effect, active, onClick, theme, themePreview, simplifyMotion = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action rounded-[1.35rem] border p-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
            style={{
                borderColor: active ? withAlpha(theme.accent_color, 0.55) : withAlpha(theme.border_color, 0.82),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.1) : withAlpha(theme.bg_color, 0.34),
                boxShadow: active ? `0 18px 30px ${withAlpha(theme.accent_color, 0.14)}` : 'none'
            }}
        >
            <div
                className="relative mb-4 h-24 overflow-hidden rounded-[1.1rem] border"
                style={{
                    borderColor: withAlpha(theme.border_color, 0.76),
                    background: `linear-gradient(135deg, ${withAlpha(theme.surface_color, 0.98)} 0%, ${withAlpha(theme.bg_color, 0.98)} 100%)`
                }}
            >
                <ThemeEffectOverlay
                    theme={{ ...themePreview, effect_preset: effect.id }}
                    simplifyMotion={simplifyMotion}
                />
                <div className="relative z-10 flex h-full flex-col justify-between p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.9) }}>
                            {effect.id === 'none' ? 'Static' : 'Effect'}
                        </span>
                        {active ? (
                            <span
                                className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                                style={{
                                    backgroundColor: withAlpha(theme.accent_color, 0.16),
                                    color: theme.accent_color
                                }}
                            >
                                Selected
                            </span>
                        ) : null}
                    </div>
                    <div className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{
                        width: 'fit-content',
                        backgroundColor: withAlpha(theme.bg_color, 0.56),
                        color: theme.text_color
                    }}>
                        {effect.name}
                    </div>
                </div>
            </div>
            <h4 className="text-base leading-tight" style={{ color: theme.text_color }}>
                {effect.name}
            </h4>
            <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                {effect.description}
            </p>
        </button>
    );
}

function SegmentedChoices({ options, value, onChange, theme, ariaLabel, size = 'default' }) {
    return (
        <div
            className="inline-flex flex-wrap rounded-full border p-1"
            style={{
                borderColor: withAlpha(theme.border_color, 0.82),
                backgroundColor: withAlpha(theme.bg_color, 0.34)
            }}
            aria-label={ariaLabel}
            role="group"
        >
            {options.map((option) => {
                const active = value === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onChange(option.id)}
                        className={`tap-action rounded-full font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 ${size === 'compact' ? 'px-3 py-2 text-[10px]' : 'px-3.5 py-2.5 text-[11px]'}`}
                        style={{
                            backgroundColor: active ? theme.accent_color : 'transparent',
                            color: active ? (isDarkTheme(theme.accent_color) ? '#f8fbfd' : '#0b1418') : theme.text_color,
                            opacity: active ? 1 : 0.76
                        }}
                    >
                        {option.name}
                    </button>
                );
            })}
        </div>
    );
}

function ColorField({ field, theme, onChange }) {
    return (
        <label
            className="block rounded-[1.2rem] border p-3"
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

function SummaryChip({ label, value, theme }) {
    return (
        <div
            className="rounded-full border px-3 py-2"
            style={{
                borderColor: withAlpha(theme.border_color, 0.82),
                backgroundColor: withAlpha(theme.bg_color, 0.38)
            }}
        >
            <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.9) }}>
                {label}
            </p>
            <p className="mt-1 text-sm" style={{ color: theme.text_color }}>
                {value}
            </p>
        </div>
    );
}

function PreviewToggle({ viewport, setViewport, theme }) {
    return (
        <div
            className="inline-flex rounded-full border p-1"
            style={{
                borderColor: withAlpha(theme.border_color, 0.82),
                backgroundColor: withAlpha(theme.bg_color, 0.34)
            }}
        >
            {[
                { id: 'phone', label: 'Phone preview', icon: Smartphone },
                { id: 'desktop', label: 'Desktop preview', icon: Monitor }
            ].map((option) => {
                const Icon = option.icon;
                const active = viewport === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setViewport(option.id)}
                        aria-pressed={active}
                        aria-label={option.label}
                        className="tap-action flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200"
                        style={{
                            backgroundColor: active ? theme.accent_color : 'transparent',
                            color: active ? (isDarkTheme(theme.accent_color) ? '#f8fbfd' : '#0b1418') : theme.text_color,
                            opacity: active ? 1 : 0.72
                        }}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {option.id === 'phone' ? 'Phone' : 'Desktop'}
                    </button>
                );
            })}
        </div>
    );
}

function PreviewDesktop({ theme, simplifyEffects }) {
    return (
        <div
            className="relative overflow-hidden rounded-[1.6rem] border"
            style={{
                borderColor: withAlpha(theme.border_color, 0.9),
                backgroundColor: theme.bg_color,
                color: theme.text_color,
                boxShadow: `0 30px 80px ${withAlpha(theme.bg_color, 0.26)}`
            }}
        >
            <ThemeEffectOverlay theme={theme} simplifyMotion={simplifyEffects} />
            <div
                className="relative z-10 flex items-center justify-between border-b px-4 py-3"
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
            <div className="relative z-10 grid gap-3 p-3">
                <div
                    className="rounded-[1.35rem] border p-4"
                    style={{ borderColor: withAlpha(theme.border_color, 0.86), backgroundColor: withAlpha(theme.surface_color, 0.96) }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                        Today
                    </p>
                    <h4 className="mt-2 text-3xl leading-none" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                        Study Queue
                    </h4>
                    <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                        Strong hierarchy, softer surfaces, and a single accent line keep the screen clear.
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
                        className="rounded-[1.25rem] border p-4"
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
                        className="rounded-[1.25rem] border p-4"
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
                                Inputs, cards, hierarchy, and motion stay readable on larger layouts.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PreviewPhone({ theme, simplifyEffects }) {
    return (
        <div
            className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[2rem] border p-2"
            style={{
                borderColor: withAlpha(theme.border_color, 0.92),
                backgroundColor: withAlpha(theme.bg_color, 0.92),
                boxShadow: `0 26px 80px ${withAlpha(theme.bg_color, 0.3)}`
            }}
        >
            <div
                className="relative overflow-hidden rounded-[1.6rem] border"
                style={{
                    borderColor: withAlpha(theme.border_color, 0.82),
                    backgroundColor: theme.bg_color,
                    color: theme.text_color
                }}
            >
                <ThemeEffectOverlay theme={theme} simplifyMotion={simplifyEffects} />
                <div className="flex justify-center py-2">
                    <span className="h-1.5 w-16 rounded-full" style={{ backgroundColor: withAlpha(theme.secondary_text_color, 0.45) }} />
                </div>
                <div className="relative z-10 space-y-3 px-4 pb-4 pt-1">
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

function PreviewSurface({ theme, viewport, setViewport, compact, summary, expanded, showViewportToggle = true, simplifyEffects = false }) {
    const scale = compact ? (viewport === 'phone' ? 0.92 : 0.74) : 1;
    const frameHeight = compact ? (viewport === 'phone' ? 320 : 250) : 'auto';

    return (
        <div
            className="rounded-[1.7rem] border p-4"
            style={{
                borderColor: withAlpha(theme.border_color, 0.88),
                backgroundColor: withAlpha(theme.surface_color, 0.92)
            }}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                        Live preview
                    </p>
                    <h4 className="mt-2 text-2xl leading-tight" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                        {theme.name?.trim() || 'Untitled atmosphere'}
                    </h4>
                    <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                        {!showViewportToggle
                            ? 'A single phone preview updates live as you personalize the atmosphere.'
                            : expanded
                            ? 'Use review mode to check the final hierarchy before you save.'
                            : 'Switch between phone and desktop without stacking both previews at once.'}
                    </p>
                </div>
                {showViewportToggle ? <PreviewToggle viewport={viewport} setViewport={setViewport} theme={theme} /> : null}
            </div>

            {summary?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                    {summary.map((item) => (
                        <SummaryChip key={item.label} label={item.label} value={item.value} theme={theme} />
                    ))}
                </div>
            ) : null}

            <div
                className="mt-5 overflow-hidden rounded-[1.6rem]"
                style={{ height: frameHeight === 'auto' ? undefined : frameHeight }}
            >
                <div
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center'
                    }}
                >
                    {viewport === 'phone'
                        ? <PreviewPhone theme={theme} simplifyEffects={simplifyEffects} />
                        : <PreviewDesktop theme={theme} simplifyEffects={simplifyEffects} />}
                </div>
            </div>
        </div>
    );
}

function StepIntro({ step, theme }) {
    return (
        <div
            className="rounded-[1.65rem] border px-4 py-4 md:px-5"
            style={{
                borderColor: withAlpha(theme.border_color, 0.84),
                backgroundColor: withAlpha(theme.bg_color, 0.3)
            }}
        >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                {step.eyebrow}
            </p>
            <h2
                className="mt-2 text-[2rem] leading-none md:text-[2.35rem]"
                style={{ color: theme.text_color, fontFamily: theme.font_family_display }}
            >
                {step.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.94), fontFamily: theme.font_family_body }}>
                {step.description}
            </p>
        </div>
    );
}

export default function ThemeEditorModal({
    isOpen,
    editingTheme,
    themeForm,
    setThemeForm,
    onClose,
    onSubmit,
    haptics
}) {
    useBodyScrollLock(isOpen);

    const isDesktop = useMediaQuery('(min-width: 768px)');
    const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const [activeTab, setActiveTab] = useState('core');
    const [mobileMode, setMobileMode] = useState('dark');
    const [mobileMood, setMobileMood] = useState('calm');

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

    useEffect(() => {
        if (!isOpen) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(editingTheme ? 'review' : 'core');
        const nextMode = inferMode(themeForm);
        setMobileMode(nextMode);
        setMobileMood(inferMood(themeForm, nextMode));
    }, [editingTheme?.id, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const tab = STUDIO_TABS.find((item) => item.id === activeTab) || STUDIO_TABS[0];
    const title = editingTheme ? 'Refine Theme' : isDesktop ? 'Theme Studio' : 'Personalize Riven';
    const activeBase = visuallyMatchesTheme(themeForm, getBaseTheme('dark'))
        ? 'dark'
        : visuallyMatchesTheme(themeForm, getBaseTheme('light'))
            ? 'light'
            : null;

    const starterSummary = useMemo(() => inferStarter(themeForm), [themeForm]);
    const accentSummary = useMemo(() => inferAccent(themeForm), [themeForm]);
    const fontSummary = useMemo(() => inferFont(themeForm), [themeForm]);
    const effectSummary = useMemo(() => getThemeEffectLabel(themeForm), [themeForm]);
    const summaryChips = useMemo(() => ([
        { label: 'Starter', value: starterSummary.label },
        { label: 'Accent', value: accentSummary },
        { label: 'Type', value: fontSummary },
        { label: 'Effects', value: effectSummary },
        { label: 'Colors', value: hasFineTunedPalette(themeForm) ? 'Fine-tuned' : 'Curated' }
    ]), [accentSummary, effectSummary, fontSummary, starterSummary.label, themeForm]);

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
        updateTheme((previous) => ({
            ...getBaseTheme(mode),
            name: previous.name,
            effect_preset: previous.effect_preset,
            effect_intensity: previous.effect_intensity
        }));
    };

    const applyStylePreset = (preset) => {
        pulse('light');
        updateTheme((previous) => ({
            ...preset.theme,
            name: previous.name,
            effect_preset: previous.effect_preset,
            effect_intensity: previous.effect_intensity
        }));
    };

    const applyMobileMode = (mode) => {
        pulse('light');
        setMobileMode(mode);
        updateTheme((previous) => ({
            ...getMoodTheme(mode, mobileMood),
            name: previous.name,
            accent_color: previous.accent_color,
            font_family_display: previous.font_family_display,
            font_family_body: previous.font_family_body,
            effect_preset: previous.effect_preset,
            effect_intensity: previous.effect_intensity
        }));
    };

    const applyMobileMood = (moodId) => {
        pulse('light');
        setMobileMood(moodId);
        updateTheme((previous) => ({
            ...getMoodTheme(mobileMode, moodId),
            name: previous.name,
            accent_color: previous.accent_color,
            font_family_display: previous.font_family_display,
            font_family_body: previous.font_family_body,
            effect_preset: previous.effect_preset,
            effect_intensity: previous.effect_intensity
        }));
    };

    const applyAccent = (accent) => {
        pulse('light');
        updateTheme({ accent_color: accent });
    };

    const applyFontPreset = (preset) => {
        pulse('light');
        updateTheme({
            font_family_display: preset.display,
            font_family_body: preset.body
        });
    };

    const applyEffectPreset = (presetId) => {
        pulse('light');
        updateTheme((previous) => ({
            effect_preset: presetId,
            effect_intensity: previous.effect_intensity || 'soft'
        }));
    };

    const applyEffectIntensity = (intensity) => {
        pulse('light');
        updateTheme({ effect_intensity: intensity });
    };

    const setColorValue = (field, value) => {
        updateTheme({ [field]: value });
    };

    const goToTab = (nextTab) => {
        pulse('light');
        setActiveTab(nextTab);
    };

    const tabOptions = STUDIO_TABS.map((item) => ({ id: item.id, name: item.label }));
    const isReviewTab = activeTab === 'review';
    const backLabel = activeTab === 'core' ? 'Cancel' : activeTab === 'advanced' ? 'Back to Core' : 'Back to Advanced';
    const nextLabel = isReviewTab ? (editingTheme ? 'Save refinements' : 'Create') : activeTab === 'core' ? 'Advanced' : 'Review';

    const handleBackAction = () => {
        if (activeTab === 'core') {
            onClose();
            return;
        }

        goToTab(activeTab === 'review' ? 'advanced' : 'core');
    };

    const handleNextAction = () => {
        if (isReviewTab) return;
        goToTab(activeTab === 'core' ? 'advanced' : 'review');
    };

    const renderThemeNameSection = () => (
        <StudioSection
            eyebrow="Theme name"
            title="Name the atmosphere"
            description="Keep it short and scannable in your gallery. The theme shape stays the same either way."
            theme={themeForm}
        >
            <label className="block">
                <span className="sr-only">Theme name</span>
                <input
                    type="text"
                    value={themeForm.name}
                    onChange={(event) => updateTheme({ name: event.target.value })}
                    placeholder="Night lectures, paper desk, focus mode..."
                    autoFocus={isDesktop && activeTab === 'review'}
                    className="w-full rounded-[1.2rem] border px-4 py-3 text-[1.4rem] outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] md:text-[2rem]"
                    style={{
                        borderColor: withAlpha(themeForm.border_color, 0.9),
                        backgroundColor: withAlpha(themeForm.bg_color, 0.38),
                        color: themeForm.text_color,
                        fontFamily: themeForm.font_family_display
                    }}
                />
            </label>
        </StudioSection>
    );

    const renderCoreContent = () => (
        <div className="space-y-4 md:space-y-5">
            <StepIntro step={tab} theme={themeForm} />
            {!isDesktop ? (
                <PreviewSurface
                    theme={themeForm}
                    viewport="phone"
                    setViewport={() => {}}
                    compact
                    summary={summaryChips.slice(0, 3)}
                    showViewportToggle={false}
                    simplifyEffects={prefersReducedMotion}
                />
            ) : null}
            {!isDesktop ? (
                <StudioSection
                    eyebrow="Mode"
                    title="Choose the lighting"
                    description="Keep the first choice broad, then shape the mood without blowing up the editor."
                    theme={themeForm}
                >
                    <div className="space-y-4">
                        <SegmentedChoices
                            options={[
                                { id: 'dark', name: 'Dark' },
                                { id: 'light', name: 'Light' }
                            ]}
                            value={mobileMode}
                            onChange={applyMobileMode}
                            theme={themeForm}
                            ariaLabel="Theme base mode"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            {MOBILE_MOOD_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyMobileMood(preset.id)}
                                    className="tap-action rounded-[1.2rem] border px-4 py-3 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200"
                                    style={{
                                        borderColor: mobileMood === preset.id ? withAlpha(themeForm.accent_color, 0.46) : withAlpha(themeForm.border_color, 0.82),
                                        backgroundColor: mobileMood === preset.id ? withAlpha(themeForm.accent_color, 0.12) : withAlpha(themeForm.surface_color, 0.84),
                                        boxShadow: mobileMood === preset.id ? `0 16px 30px ${withAlpha(themeForm.accent_color, 0.18)}` : 'none'
                                    }}
                                >
                                    <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                        {mobileMode === 'dark' ? 'Dark' : 'Light'}
                                    </p>
                                    <h4 className="mt-2 text-lg" style={{ color: themeForm.text_color, fontFamily: themeForm.font_family_display }}>
                                        {preset.name}
                                    </h4>
                                </button>
                            ))}
                        </div>
                    </div>
                </StudioSection>
            ) : (
                <StudioSection
                    eyebrow="Base"
                    title="Start from Riven"
                    description="Pick the overall lighting first, then layer in a stronger direction."
                    theme={themeForm}
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <BaseChoiceCard
                            active={activeBase === 'dark'}
                            icon={Moon}
                            label="Dark studio"
                            helper="Best for late sessions and richer contrast."
                            onClick={() => applyBaseTheme('dark')}
                            theme={themeForm}
                        />
                        <BaseChoiceCard
                            active={activeBase === 'light'}
                            icon={Sun}
                            label="Light paper"
                            helper="Cleaner daytime read with warmer surfaces."
                            onClick={() => applyBaseTheme('light')}
                            theme={themeForm}
                        />
                    </div>
                </StudioSection>
            )}

            <StudioSection
                eyebrow="Curated starters"
                title="Pick a direction"
                description="Curated starters give you a strong first draft without pushing you through a long wizard."
                theme={themeForm}
            >
                <div className="grid gap-3 lg:grid-cols-2">
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
            </StudioSection>

            <StudioSection
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
            </StudioSection>

            <StudioSection
                eyebrow="Typography"
                title="Match the voice"
                description="The display face sets the tone. The body face keeps the app readable everywhere else."
                theme={themeForm}
            >
                <div className="grid gap-3 lg:grid-cols-2">
                    {FONT_PRESETS.map((preset) => (
                        <FontCard
                            key={preset.id}
                            preset={preset}
                            active={themeForm.font_family_display === preset.display && themeForm.font_family_body === preset.body}
                            onClick={() => applyFontPreset(preset)}
                            theme={themeForm}
                        />
                    ))}
                </div>
            </StudioSection>

            <StudioSection
                eyebrow="Effects"
                title="Add atmosphere"
                description="Curated effects stay expressive without turning the editor into a particle lab."
                theme={themeForm}
            >
                <div className="grid gap-3 lg:grid-cols-2">
                    {EFFECT_PRESETS.map((effect) => (
                        <EffectCard
                            key={effect.id}
                            effect={effect}
                            active={themeForm.effect_preset === effect.id}
                            onClick={() => applyEffectPreset(effect.id)}
                            theme={themeForm}
                            themePreview={themeForm}
                            simplifyMotion={prefersReducedMotion}
                        />
                    ))}
                </div>
                {themeForm.effect_preset !== 'none' ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94) }}>
                            Intensity
                        </p>
                        <SegmentedChoices
                            options={EFFECT_INTENSITY_OPTIONS}
                            value={themeForm.effect_intensity}
                            onChange={applyEffectIntensity}
                            theme={themeForm}
                            ariaLabel="Effect intensity"
                        />
                    </div>
                ) : null}
            </StudioSection>
        </div>
    );

    const renderAdvancedContent = () => (
        <div className="space-y-4 md:space-y-5">
            <StepIntro step={tab} theme={themeForm} />
            <StudioSection
                eyebrow="Advanced colors"
                title="Precise token overrides"
                description="Use these only when the curated palette needs exact surface-by-surface control."
                theme={themeForm}
            >
                <div className="mb-4 rounded-[1.3rem] border p-4" style={{
                    borderColor: withAlpha(themeForm.border_color, 0.82),
                    backgroundColor: withAlpha(themeForm.bg_color, 0.34)
                }}>
                    <div className="flex items-start gap-3">
                        <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
                            style={{
                                borderColor: withAlpha(themeForm.accent_color, 0.3),
                                backgroundColor: withAlpha(themeForm.accent_color, 0.12),
                                color: themeForm.accent_color
                            }}
                        >
                            <Wand2 className="h-5 w-5" />
                        </div>
                        <p className="text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95), fontFamily: themeForm.font_family_body }}>
                            Token edits override the chosen starter while preserving the same saved theme contract and gallery behavior.
                        </p>
                    </div>
                </div>
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
            </StudioSection>
        </div>
    );

    const renderReviewContent = () => (
        <div className="space-y-4 md:space-y-5">
            <StepIntro step={tab} theme={themeForm} />
            {renderThemeNameSection()}
            <StudioSection
                eyebrow="Summary"
                title="Review the final atmosphere"
                description="The summary keeps the decisions understandable before you save the theme into your gallery."
                theme={themeForm}
            >
                <div className="flex flex-wrap gap-2">
                    {summaryChips.map((item) => (
                        <SummaryChip key={item.label} label={item.label} value={item.value} theme={themeForm} />
                    ))}
                </div>
            </StudioSection>
            {!isDesktop ? (
                <PreviewSurface
                    theme={themeForm}
                    viewport="phone"
                    setViewport={() => {}}
                    compact
                    summary={summaryChips}
                    expanded
                    showViewportToggle={false}
                    simplifyEffects={prefersReducedMotion}
                />
            ) : null}
        </div>
    );

    const renderTabContent = () => {
        if (activeTab === 'advanced') return renderAdvancedContent();
        if (activeTab === 'review') return renderReviewContent();
        return renderCoreContent();
    };


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
                        className="relative flex h-[calc(100dvh-max(env(safe-area-inset-top,0px),0.75rem))] w-full max-w-7xl flex-col overflow-hidden rounded-t-[2rem] border md:h-auto md:max-h-[94vh] md:rounded-[2rem]"
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
                                background: `radial-gradient(circle at top right, ${withAlpha(themeForm.accent_color, 0.16)} 0%, transparent 34%), radial-gradient(circle at bottom left, ${withAlpha(themeForm.text_color, 0.04)} 0%, transparent 42%)`
                            }}
                        />

                        <div className="relative flex justify-center pt-4 md:hidden">
                            <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: withAlpha(themeForm.secondary_text_color, 0.4) }} />
                        </div>
                        {isDesktop ? (
                            <form id="theme-editor-form" onSubmit={onSubmit} className="relative flex min-h-0 flex-1 flex-col">
                                <div
                                    className="relative border-b px-4 pb-4 pt-4 md:px-8 md:pb-5 md:pt-6"
                                    style={{ borderBottomColor: withAlpha(themeForm.border_color, 0.92) }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95) }}>
                                                {editingTheme ? 'Edit Theme' : 'Create Theme'}
                                            </p>
                                            <h1 id="theme-editor-title" className="mt-2 text-[2rem] leading-none md:text-4xl" style={{ fontFamily: themeForm.font_family_display }}>
                                                {title}
                                            </h1>
                                            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: themeForm.font_family_body }}>
                                                Compact controls stay on one side, the preview stays visible, and the deeper palette opens only when you ask for it.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="tap-action flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
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

                                    <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94) }}>
                                                {tab.eyebrow}
                                            </p>
                                            <p className="mt-2 text-base md:text-lg" style={{ color: themeForm.text_color }}>
                                                {tab.title}
                                            </p>
                                        </div>
                                        <SegmentedChoices
                                            options={tabOptions}
                                            value={activeTab}
                                            onChange={goToTab}
                                            theme={themeForm}
                                            ariaLabel="Theme editor sections"
                                            size="compact"
                                        />
                                    </div>
                                </div>

                                <div className="modal-scroll-content grid min-h-0 flex-1 gap-5 overflow-y-auto px-4 pb-28 pt-4 overscroll-contain custom-scrollbar md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 md:px-8 md:pb-8 md:pt-6 xl:grid-cols-[minmax(0,1fr)_400px]">
                                    <div className="min-h-0">
                                        {renderTabContent()}
                                    </div>
                                    <aside className="sticky top-0 self-start">
                                        <PreviewSurface
                                            theme={themeForm}
                                            viewport="desktop"
                                            setViewport={() => {}}
                                            summary={summaryChips}
                                            expanded={isReviewTab}
                                            showViewportToggle={false}
                                            simplifyEffects={prefersReducedMotion}
                                        />
                                    </aside>
                                </div>

                                <div
                                    className="relative border-t px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 md:px-8 md:py-4"
                                    style={{
                                        borderTopColor: withAlpha(themeForm.border_color, 0.92),
                                        backgroundColor: withAlpha(themeForm.bg_color, 0.94)
                                    }}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95) }}>
                                                {isReviewTab ? 'Save' : 'Continue'}
                                            </p>
                                            <p className="mt-1 text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: themeForm.font_family_body }}>
                                                {isReviewTab
                                                    ? 'The saved theme can still be refined later from your gallery.'
                                                    : 'Core stays fast, advanced stays optional, and review is kept short before saving.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <button
                                                type="button"
                                                onClick={handleBackAction}
                                                className="tap-action rounded-full border px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
                                                style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.86),
                                                    backgroundColor: withAlpha(themeForm.surface_color, 0.96),
                                                    color: themeForm.text_color
                                                }}
                                            >
                                                {backLabel}
                                            </button>
                                            {isReviewTab ? (
                                                <button
                                                    type="submit"
                                                    form="theme-editor-form"
                                                    className="tap-action rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
                                                    style={{
                                                        backgroundColor: themeForm.accent_color,
                                                        color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418',
                                                        boxShadow: `0 20px 42px ${withAlpha(themeForm.accent_color, 0.24)}`
                                                    }}
                                                >
                                                    {nextLabel}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleNextAction}
                                                    className="tap-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5"
                                                    style={{
                                                        backgroundColor: themeForm.accent_color,
                                                        color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418',
                                                        boxShadow: `0 20px 42px ${withAlpha(themeForm.accent_color, 0.24)}`
                                                    }}
                                                >
                                                    {nextLabel}
                                                    <ArrowRight className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <form id="theme-editor-form" onSubmit={onSubmit} className="relative flex min-h-0 flex-1 flex-col">
                                <div
                                    className="sticky top-0 z-20 border-b px-4 pb-3 pt-3 backdrop-blur-xl"
                                    style={{
                                        borderBottomColor: withAlpha(themeForm.border_color, 0.9),
                                        backgroundColor: withAlpha(themeForm.bg_color, 0.92)
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="tap-action flex h-10 w-10 items-center justify-center rounded-full border"
                                            style={{
                                                borderColor: withAlpha(themeForm.border_color, 0.82),
                                                backgroundColor: withAlpha(themeForm.surface_color, 0.92),
                                                color: themeForm.text_color
                                            }}
                                            aria-label="Close theme editor"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                        <div className="min-w-0 text-center">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95) }}>
                                                {editingTheme ? 'Edit Theme' : 'Create Theme'}
                                            </p>
                                            <h1 id="theme-editor-title" className="mt-1 text-xl" style={{ fontFamily: themeForm.font_family_display }}>
                                                {title}
                                            </h1>
                                        </div>
                                        <button
                                            type="submit"
                                            form="theme-editor-form"
                                            className="tap-action rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em]"
                                            style={{
                                                backgroundColor: themeForm.accent_color,
                                                color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418'
                                            }}
                                        >
                                            {editingTheme ? 'Save' : 'Create'}
                                        </button>
                                    </div>
                                    <div className="mt-3">
                                        <SegmentedChoices
                                            options={tabOptions}
                                            value={activeTab}
                                            onChange={goToTab}
                                            theme={themeForm}
                                            ariaLabel="Theme editor sections"
                                            size="compact"
                                        />
                                    </div>
                                </div>

                                <div className="modal-scroll-content min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-4 overscroll-contain custom-scrollbar">
                                    <div className="space-y-4">
                                        {renderTabContent()}
                                    </div>
                                </div>

                                <div
                                    className="sticky bottom-0 z-20 border-t px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 backdrop-blur-xl"
                                    style={{
                                        borderTopColor: withAlpha(themeForm.border_color, 0.9),
                                        backgroundColor: withAlpha(themeForm.bg_color, 0.94)
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95) }}>
                                                {isReviewTab ? 'Save' : tab.label}
                                            </p>
                                            <p className="mt-1 text-sm leading-5" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: themeForm.font_family_body }}>
                                                {isReviewTab
                                                    ? 'Save once the summary feels right.'
                                                    : 'Use the tabs to move between the fast path, precise tuning, and final review.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                type="button"
                                                onClick={handleBackAction}
                                                className="tap-action rounded-full border px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                                                style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.86),
                                                    backgroundColor: withAlpha(themeForm.surface_color, 0.96),
                                                    color: themeForm.text_color
                                                }}
                                            >
                                                {backLabel}
                                            </button>
                                            {isReviewTab ? (
                                                <button
                                                    type="submit"
                                                    form="theme-editor-form"
                                                    className="tap-action rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                                                    style={{
                                                        backgroundColor: themeForm.accent_color,
                                                        color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418',
                                                        boxShadow: `0 18px 34px ${withAlpha(themeForm.accent_color, 0.22)}`
                                                    }}
                                                >
                                                    {nextLabel}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleNextAction}
                                                    className="tap-action inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                                                    style={{
                                                        backgroundColor: themeForm.accent_color,
                                                        color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418',
                                                        boxShadow: `0 18px 34px ${withAlpha(themeForm.accent_color, 0.22)}`
                                                    }}
                                                >
                                                    {nextLabel}
                                                    <ArrowRight className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        )}
                    </Motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}
