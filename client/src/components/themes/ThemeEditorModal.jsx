import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'motion/react';
import {
    Check,
    ChevronDown,
    Monitor,
    Plus,
    Sparkles,
    Trash2,
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
    GRADIENT_INTENSITY_OPTIONS,
    GRADIENT_STARTERS,
    MAX_GRADIENT_STOPS,
    MIN_GRADIENT_STOPS,
    applyGradientStarter,
    buildGradientCss,
    deriveThemeFromGradientRecipe,
    getBaseTheme,
    normalizeGradientColors,
    normalizeGradientRecipe
} from './themeEditorConfig';
import { getThemeEffectLabel, ThemeEffectOverlay } from './themeEffects.jsx';

function hexToRgb(hex) {
    const normalized = String(hex || '#000000').replace('#', '').trim();
    const value = Number.parseInt(normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized, 16);

    if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 };

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
    return ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) < 0.58;
}

function inferMode(theme) {
    return isDarkTheme(theme.bg_color) ? 'dark' : 'light';
}

function applyRecipeUpdate(theme, patch) {
    return deriveThemeFromGradientRecipe({
        ...theme,
        background_style: 'gradient',
        ...patch
    });
}

function getEditableGradientColors(theme) {
    const recipe = normalizeGradientRecipe(theme);
    return recipe.background_style === 'gradient'
        ? recipe.gradient_colors
        : normalizeGradientColors([theme.bg_color, theme.accent_color]);
}

function MixerSection({ eyebrow, title, description, theme, children }) {
    return (
        <section
            className="rounded-[1.45rem] border p-4"
            style={{
                borderColor: withAlpha(theme.border_color, 0.86),
                backgroundColor: withAlpha(theme.surface_color, 0.9)
            }}
        >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                {eyebrow}
            </p>
            <h3 className="mt-2 text-2xl leading-tight" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                {title}
            </h3>
            {description ? (
                <p className="mt-2 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.94), fontFamily: theme.font_family_body }}>
                    {description}
                </p>
            ) : null}
            <div className="mt-4">
                {children}
            </div>
        </section>
    );
}

function ChoicePill({ active, children, onClick, theme, ariaLabel }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            aria-pressed={active}
            className="tap-action rounded-full border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5"
            style={{
                borderColor: active ? withAlpha(theme.accent_color, 0.55) : withAlpha(theme.border_color, 0.8),
                backgroundColor: active ? withAlpha(theme.accent_color, 0.16) : withAlpha(theme.bg_color, 0.34),
                color: active ? theme.accent_color : theme.text_color
            }}
        >
            {children}
        </button>
    );
}

function StarterCard({ starter, active, onClick, theme }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="tap-action overflow-hidden rounded-[1.25rem] border text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5"
            style={{
                borderColor: active ? starter.accent : withAlpha(theme.border_color, 0.78),
                backgroundColor: withAlpha(theme.bg_color, 0.36),
                boxShadow: active ? `0 18px 34px ${withAlpha(starter.accent, 0.18)}` : 'none'
            }}
        >
            <div
                className="h-20 border-b"
                style={{
                    background: buildGradientCss({
                        background_style: 'gradient',
                        gradient_colors: starter.colors,
                        gradient_angle: starter.angle,
                        gradient_intensity: starter.intensity,
                        bg_color: starter.colors[0],
                        surface_color: starter.colors[1],
                        accent_color: starter.accent
                    }),
                    borderBottomColor: withAlpha(theme.border_color, 0.74)
                }}
            />
            <div className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(theme.secondary_text_color, 0.9) }}>
                            {starter.mode} / {starter.intensity}
                        </p>
                        <h4 className="mt-1 text-lg leading-tight" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                            {starter.name}
                        </h4>
                    </div>
                    {active ? <Check className="h-4 w-4 shrink-0" style={{ color: starter.accent }} /> : null}
                </div>
                <p className="mt-2 text-xs leading-5" style={{ color: withAlpha(theme.secondary_text_color, 0.94), fontFamily: theme.font_family_body }}>
                    {starter.description}
                </p>
            </div>
        </button>
    );
}

function ThemeMixerPreview({ theme }) {
    return (
        <div
            className="sticky top-0 overflow-hidden rounded-[1.75rem] border"
            style={{
                borderColor: withAlpha(theme.border_color, 0.9),
                backgroundColor: theme.bg_color,
                color: theme.text_color,
                boxShadow: `0 36px 100px ${withAlpha(theme.bg_color, 0.35)}`
            }}
        >
            <div className="absolute inset-0" style={{ background: buildGradientCss(theme, 0.9), opacity: theme.background_style === 'gradient' ? 0.36 : 0.16 }} />
            <ThemeEffectOverlay theme={theme} simplifyMotion={false} />
            <div className="relative z-10 p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent_color }} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.95) }}>
                            Live preview
                        </p>
                    </div>
                    <Monitor className="h-4 w-4" style={{ color: theme.accent_color }} />
                </div>

                <div className="rounded-[1.35rem] border p-4" style={{ borderColor: withAlpha(theme.border_color, 0.85), backgroundColor: withAlpha(theme.surface_color, 0.94) }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: withAlpha(theme.secondary_text_color, 0.94) }}>
                        Today
                    </p>
                    <h4 className="mt-2 text-4xl leading-none" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                        Study Flow
                    </h4>
                    <p className="mt-3 text-sm leading-6" style={{ color: withAlpha(theme.secondary_text_color, 0.95), fontFamily: theme.font_family_body }}>
                        Gradient atmosphere outside, readable Riven surfaces inside.
                    </p>
                    <button
                        type="button"
                        className="mt-4 rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                        style={{
                            backgroundColor: theme.accent_color,
                            color: isDarkTheme(theme.accent_color) ? '#f8fbfd' : '#0b1418'
                        }}
                    >
                        Start review
                    </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                    {['Due', 'Focus', 'Group'].map((label, index) => (
                        <div
                            key={label}
                            className="rounded-2xl border px-3 py-3"
                            style={{
                                borderColor: withAlpha(theme.border_color, 0.78),
                                backgroundColor: index === 1 ? withAlpha(theme.accent_color, 0.13) : withAlpha(theme.surface_color, 0.82)
                            }}
                        >
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: withAlpha(theme.secondary_text_color, 0.92) }}>
                                {label}
                            </p>
                            <p className="mt-2 text-xl leading-none" style={{ color: index === 1 ? theme.accent_color : theme.text_color, fontFamily: theme.font_family_display }}>
                                {index === 0 ? '12' : index === 1 ? '42' : '3'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
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
    const [expertOpen, setExpertOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return undefined;
        setExpertOpen(false);
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const recipe = useMemo(() => normalizeGradientRecipe(themeForm), [themeForm]);
    const gradientColors = useMemo(() => getEditableGradientColors(themeForm), [themeForm]);
    const mode = inferMode(themeForm);
    const matchingStarter = GRADIENT_STARTERS.find((starter) => (
        recipe.background_style === 'gradient'
        && starter.colors.length === recipe.gradient_colors.length
        && starter.colors.every((color, index) => color.toLowerCase() === recipe.gradient_colors[index]?.toLowerCase())
    ));

    if (!isOpen) return null;

    const updateTheme = (next) => {
        setThemeForm((previous) => ({
            ...previous,
            ...(typeof next === 'function' ? next(previous) : next)
        }));
    };

    const pulse = (type = 'light') => haptics?.[type]?.();

    const applyStarter = (starter) => {
        pulse('light');
        updateTheme((previous) => applyGradientStarter(previous, starter));
    };

    const applyMode = (nextMode) => {
        pulse('light');
        updateTheme((previous) => applyRecipeUpdate({
            ...previous,
            ...getBaseTheme(nextMode),
            name: previous.name,
            gradient_colors: getEditableGradientColors(previous),
            accent_color: previous.accent_color,
            font_family_display: previous.font_family_display,
            font_family_body: previous.font_family_body,
            effect_preset: previous.effect_preset,
            effect_intensity: previous.effect_intensity
        }, {}));
    };

    const updateGradientColors = (nextColors) => {
        updateTheme((previous) => applyRecipeUpdate(previous, {
            gradient_colors: normalizeGradientColors(nextColors, getEditableGradientColors(previous))
        }));
    };

    const updateStop = (index, color) => {
        const nextColors = [...gradientColors];
        nextColors[index] = color;
        updateGradientColors(nextColors);
    };

    const addStop = () => {
        if (gradientColors.length >= MAX_GRADIENT_STOPS) return;
        pulse('light');
        updateGradientColors([...gradientColors, themeForm.accent_color]);
    };

    const removeStop = (index) => {
        if (gradientColors.length <= MIN_GRADIENT_STOPS) return;
        pulse('light');
        updateGradientColors(gradientColors.filter((_, itemIndex) => itemIndex !== index));
    };

    const updateRecipe = (patch) => {
        pulse('light');
        updateTheme((previous) => applyRecipeUpdate(previous, patch));
    };

    const updateAccent = (color) => {
        pulse('light');
        updateTheme((previous) => deriveThemeFromGradientRecipe({
            ...previous,
            background_style: 'gradient',
            gradient_colors: getEditableGradientColors(previous),
            accent_color: color
        }));
    };

    const updateFont = (preset) => {
        pulse('light');
        updateTheme({
            font_family_display: preset.display,
            font_family_body: preset.body
        });
    };

    const updateEffect = (effectId) => {
        pulse('light');
        updateTheme((previous) => ({
            effect_preset: effectId,
            effect_intensity: previous.effect_intensity || 'soft'
        }));
    };

    const updateToken = (field, value) => {
        updateTheme({
            [field]: value,
            background_style: field === 'accent_color' ? themeForm.background_style : 'solid',
            gradient_colors: field === 'accent_color' ? themeForm.gradient_colors : []
        });
    };

    const title = editingTheme ? 'Refine Theme Mixer' : 'Theme Mixer';
    const saveLabel = editingTheme ? 'Save refinements' : 'Create';

    return (
        <AnimatePresence>
            <Motion.div
                className="fixed inset-0 z-[100] flex items-end justify-center bg-black/58 p-0 backdrop-blur-sm md:items-center md:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <Motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="theme-mixer-title"
                    className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] border md:rounded-[2.4rem]"
                    style={{
                        borderColor: withAlpha(themeForm.border_color, 0.9),
                        background: `linear-gradient(145deg, ${withAlpha(themeForm.bg_color, 0.98)} 0%, ${withAlpha(themeForm.surface_color, 0.98)} 100%)`,
                        color: themeForm.text_color,
                        boxShadow: `0 42px 130px ${withAlpha(themeForm.bg_color, 0.54)}`
                    }}
                    initial={{ opacity: 0, y: 30, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <form id="theme-editor-form" onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
                        <div
                            className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-4 md:px-7 md:py-6"
                            style={{ borderBottomColor: withAlpha(themeForm.border_color, 0.9) }}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: themeForm.accent_color }}>
                                    <Sparkles className="h-4 w-4" />
                                    Gradient theme creation
                                </div>
                                <h1 id="theme-mixer-title" className="mt-2 text-3xl leading-none md:text-5xl" style={{ fontFamily: themeForm.font_family_display }}>
                                    {title}
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.95), fontFamily: themeForm.font_family_body }}>
                                    Start with an Arc-like gradient, then let Riven derive the readable surfaces underneath.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="tap-action flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
                                style={{
                                    borderColor: withAlpha(themeForm.border_color, 0.84),
                                    backgroundColor: withAlpha(themeForm.surface_color, 0.92),
                                    color: themeForm.text_color
                                }}
                                aria-label="Close theme editor"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="modal-scroll-content grid min-h-0 flex-1 gap-5 overflow-y-auto px-4 py-5 custom-scrollbar md:grid-cols-[minmax(0,1fr)_390px] md:px-7">
                            <div className="space-y-4">
                                <MixerSection
                                    eyebrow="Start from a vibe"
                                    title="Pick a gradient direction"
                                    description="These are not final themes. They are fast starting points you can bend immediately."
                                    theme={themeForm}
                                >
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {GRADIENT_STARTERS.map((starter) => (
                                            <StarterCard
                                                key={starter.id}
                                                starter={starter}
                                                active={matchingStarter?.id === starter.id}
                                                onClick={() => applyStarter(starter)}
                                                theme={themeForm}
                                            />
                                        ))}
                                    </div>
                                </MixerSection>

                                <MixerSection
                                    eyebrow="Gradient"
                                    title="Shape the atmosphere"
                                    description="Use two to five stops. Riven keeps the actual UI tokens readable as the gradient changes."
                                    theme={themeForm}
                                >
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {['dark', 'light'].map((option) => (
                                            <ChoicePill
                                                key={option}
                                                active={mode === option}
                                                onClick={() => applyMode(option)}
                                                theme={themeForm}
                                            >
                                                {option}
                                            </ChoicePill>
                                        ))}
                                    </div>

                                    <div className="space-y-3">
                                        {gradientColors.map((color, index) => (
                                            <div key={`${index}-${color}`} className="flex items-center gap-3 rounded-[1.1rem] border p-3" style={{
                                                borderColor: withAlpha(themeForm.border_color, 0.78),
                                                backgroundColor: withAlpha(themeForm.bg_color, 0.32)
                                            }}>
                                                <label className="flex min-w-0 flex-1 items-center gap-3">
                                                    <span
                                                        className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border"
                                                        style={{ borderColor: withAlpha(themeForm.border_color, 0.88), backgroundColor: color }}
                                                    >
                                                        <input
                                                            type="color"
                                                            value={color}
                                                            onChange={(event) => updateStop(index, event.target.value)}
                                                            aria-label={`Gradient color ${index + 1}`}
                                                            className="h-full w-full cursor-pointer opacity-0"
                                                        />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                                            Stop {index + 1}
                                                        </span>
                                                        <span className="block text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: themeForm.text_color }}>
                                                            {color}
                                                        </span>
                                                    </span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => removeStop(index)}
                                                    disabled={gradientColors.length <= MIN_GRADIENT_STOPS}
                                                    aria-label={`Remove gradient color ${index + 1}`}
                                                    className="tap-action flex h-9 w-9 shrink-0 items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-35"
                                                    style={{ borderColor: withAlpha(themeForm.border_color, 0.74), color: themeForm.secondary_text_color }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addStop}
                                        disabled={gradientColors.length >= MAX_GRADIENT_STOPS}
                                        className="tap-action mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45"
                                        style={{ borderColor: withAlpha(themeForm.accent_color, 0.5), color: themeForm.accent_color }}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add color
                                    </button>

                                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                        <label className="block">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                                Angle {recipe.gradient_angle}deg
                                            </span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={recipe.gradient_angle}
                                                onChange={(event) => updateRecipe({ gradient_angle: Number(event.target.value), gradient_colors: gradientColors })}
                                                className="mt-3 w-full accent-current"
                                                style={{ color: themeForm.accent_color }}
                                            />
                                        </label>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                                Intensity
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {GRADIENT_INTENSITY_OPTIONS.map((option) => (
                                                    <ChoicePill
                                                        key={option.id}
                                                        active={recipe.gradient_intensity === option.id}
                                                        onClick={() => updateRecipe({ gradient_intensity: option.id, gradient_colors: gradientColors })}
                                                        theme={themeForm}
                                                    >
                                                        {option.name}
                                                    </ChoicePill>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </MixerSection>

                                <MixerSection
                                    eyebrow="Signal"
                                    title="Accent, type, and motion"
                                    description="These are the high-impact controls users actually notice day to day."
                                    theme={themeForm}
                                >
                                    <div className="grid gap-5 xl:grid-cols-2">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                                Accent stop
                                            </p>
                                            <div className="mt-3 grid grid-cols-4 gap-2">
                                                {ACCENT_PRESETS.map((swatch) => (
                                                    <button
                                                        key={swatch.color}
                                                        type="button"
                                                        onClick={() => updateAccent(swatch.color)}
                                                        aria-label={`${swatch.name} accent`}
                                                        className="tap-action flex flex-col items-center gap-2 rounded-[1rem] border px-2 py-3 text-[10px] font-bold uppercase tracking-[0.12em]"
                                                        style={{
                                                            borderColor: themeForm.accent_color === swatch.color ? swatch.color : withAlpha(themeForm.border_color, 0.76),
                                                            backgroundColor: themeForm.accent_color === swatch.color ? withAlpha(swatch.color, 0.14) : withAlpha(themeForm.bg_color, 0.3),
                                                            color: themeForm.text_color
                                                        }}
                                                    >
                                                        <span className="h-7 w-7 rounded-full" style={{ backgroundColor: swatch.color }} />
                                                        {swatch.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                                Typography
                                            </p>
                                            <div className="mt-3 grid gap-2">
                                                {FONT_PRESETS.map((preset) => {
                                                    const active = themeForm.font_family_display === preset.display && themeForm.font_family_body === preset.body;
                                                    return (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => updateFont(preset)}
                                                            className="tap-action rounded-[1rem] border px-3 py-3 text-left"
                                                            style={{
                                                                borderColor: active ? withAlpha(themeForm.accent_color, 0.5) : withAlpha(themeForm.border_color, 0.78),
                                                                backgroundColor: active ? withAlpha(themeForm.accent_color, 0.1) : withAlpha(themeForm.bg_color, 0.3)
                                                            }}
                                                        >
                                                            <span className="block text-lg leading-none" style={{ color: themeForm.text_color, fontFamily: preset.display }}>
                                                                {preset.name}
                                                            </span>
                                                            <span className="mt-1 block text-xs leading-5" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: preset.body }}>
                                                                {preset.description}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                            Atmosphere effect
                                        </p>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                            {EFFECT_PRESETS.map((effect) => (
                                                <button
                                                    key={effect.id}
                                                    type="button"
                                                    onClick={() => updateEffect(effect.id)}
                                                    className="tap-action rounded-[1rem] border px-3 py-3 text-left"
                                                    style={{
                                                        borderColor: themeForm.effect_preset === effect.id ? withAlpha(themeForm.accent_color, 0.5) : withAlpha(themeForm.border_color, 0.78),
                                                        backgroundColor: themeForm.effect_preset === effect.id ? withAlpha(themeForm.accent_color, 0.1) : withAlpha(themeForm.bg_color, 0.3)
                                                    }}
                                                >
                                                    <span className="block text-sm font-bold uppercase tracking-[0.15em]" style={{ color: themeForm.text_color }}>
                                                        {effect.name}
                                                    </span>
                                                    <span className="mt-1 block text-xs leading-5" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94) }}>
                                                        {effect.description}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {themeForm.effect_preset !== 'none' ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {EFFECT_INTENSITY_OPTIONS.map((option) => (
                                                    <ChoicePill
                                                        key={option.id}
                                                        active={themeForm.effect_intensity === option.id}
                                                        onClick={() => updateTheme({ effect_intensity: option.id })}
                                                        theme={themeForm}
                                                    >
                                                        {option.name}
                                                    </ChoicePill>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </MixerSection>

                                <MixerSection
                                    eyebrow="Expert"
                                    title="Exact token overrides"
                                    description="Open this only when you want raw hex control. Any surface token edit switches the recipe back to solid."
                                    theme={themeForm}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpertOpen((open) => !open)}
                                        aria-expanded={expertOpen}
                                        className="tap-action flex w-full items-center justify-between rounded-[1.1rem] border px-4 py-3 text-left"
                                        style={{
                                            borderColor: withAlpha(themeForm.border_color, 0.82),
                                            backgroundColor: withAlpha(themeForm.bg_color, 0.32),
                                            color: themeForm.text_color
                                        }}
                                    >
                                        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]">
                                            <Wand2 className="h-4 w-4" />
                                            Expert tokens
                                        </span>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${expertOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expertOpen ? (
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                            {COLOR_FIELDS.map((field) => (
                                                <label key={field} className="rounded-[1rem] border p-3" style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.78),
                                                    backgroundColor: withAlpha(themeForm.bg_color, 0.3)
                                                }}>
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                                        {COLOR_FIELD_LABELS[field]}
                                                    </span>
                                                    <div className="mt-3 flex items-center gap-3">
                                                        <span className="h-10 w-10 overflow-hidden rounded-2xl border" style={{ borderColor: withAlpha(themeForm.border_color, 0.82), backgroundColor: themeForm[field] }}>
                                                            <input
                                                                type="color"
                                                                value={themeForm[field]}
                                                                onChange={(event) => updateToken(field, event.target.value)}
                                                                aria-label={`${COLOR_FIELD_LABELS[field]} color`}
                                                                className="h-full w-full cursor-pointer opacity-0"
                                                            />
                                                        </span>
                                                        <span className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: themeForm.text_color }}>
                                                            {themeForm[field]}
                                                        </span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ) : null}
                                </MixerSection>
                            </div>

                            <aside className="space-y-4">
                                <ThemeMixerPreview theme={themeForm} />
                                <section className="rounded-[1.45rem] border p-4" style={{
                                    borderColor: withAlpha(themeForm.border_color, 0.86),
                                    backgroundColor: withAlpha(themeForm.surface_color, 0.9)
                                }}>
                                    <label className="block">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: withAlpha(themeForm.secondary_text_color, 0.92) }}>
                                            Theme name
                                        </span>
                                        <input
                                            value={themeForm.name}
                                            onChange={(event) => updateTheme({ name: event.target.value })}
                                            placeholder="Night lectures"
                                            autoFocus={Boolean(editingTheme)}
                                            className="mt-3 w-full rounded-2xl border bg-transparent px-4 py-3 text-lg outline-none transition-colors"
                                            style={{
                                                borderColor: withAlpha(themeForm.border_color, 0.82),
                                                color: themeForm.text_color,
                                                fontFamily: themeForm.font_family_display
                                            }}
                                        />
                                    </label>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {[
                                            `Gradient ${recipe.background_style === 'gradient' ? recipe.gradient_colors.length : 0}`,
                                            `${recipe.gradient_angle}deg`,
                                            recipe.gradient_intensity,
                                            getThemeEffectLabel(themeForm)
                                        ].map((label) => (
                                            <span
                                                key={label}
                                                className="rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                                                style={{
                                                    borderColor: withAlpha(themeForm.border_color, 0.76),
                                                    backgroundColor: withAlpha(themeForm.bg_color, 0.28),
                                                    color: withAlpha(themeForm.secondary_text_color, 0.96)
                                                }}
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            </aside>
                        </div>

                        <div
                            className="flex shrink-0 flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between md:px-7"
                            style={{ borderTopColor: withAlpha(themeForm.border_color, 0.9), backgroundColor: withAlpha(themeForm.bg_color, 0.94) }}
                        >
                            <p className="text-sm leading-6" style={{ color: withAlpha(themeForm.secondary_text_color, 0.94), fontFamily: themeForm.font_family_body }}>
                                Gradient recipes save with the theme. You can reopen and refine every stop later.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="tap-action rounded-full border px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                                    style={{
                                        borderColor: withAlpha(themeForm.border_color, 0.86),
                                        backgroundColor: withAlpha(themeForm.surface_color, 0.9),
                                        color: themeForm.text_color
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="theme-editor-form"
                                    className="tap-action rounded-full px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                                    style={{
                                        backgroundColor: themeForm.accent_color,
                                        color: isDarkTheme(themeForm.accent_color) ? '#f8fbfd' : '#0b1418',
                                        boxShadow: `0 18px 36px ${withAlpha(themeForm.accent_color, 0.25)}`
                                    }}
                                >
                                    {saveLabel}
                                </button>
                            </div>
                        </div>
                    </form>
                </Motion.div>
            </Motion.div>
        </AnimatePresence>
    );
}
