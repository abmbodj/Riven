import React, { useState, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Check, Plus, X, Trash2, Edit3, Sun, Moon, Sparkles, Type } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import useHaptics from '../hooks/useHaptics';
import { motion, AnimatePresence } from 'motion/react';

// Default theme presets for the editor
const DEFAULT_DARK = {
    name: 'Custom Dark',
    bg_color: '#1a1a18',
    surface_color: '#242422',
    text_color: '#e8e8e3',
    secondary_text_color: '#a1a19a',
    border_color: '#3d3d3a',
    accent_color: '#d97757',
    font_family_display: 'Inter',
    font_family_body: 'Inter'
};

const DEFAULT_LIGHT = {
    name: 'Custom Light',
    bg_color: '#fafaf9',
    surface_color: '#ffffff',
    text_color: '#1c1c1a',
    secondary_text_color: '#6b6b66',
    border_color: '#e5e5e2',
    accent_color: '#d97757',
    font_family_display: 'Cormorant Garamond',
    font_family_body: 'Lora'
};

// Typography presets
const FONT_PRESETS = [
    { name: 'Editorial Serif', display: 'Cormorant Garamond', body: 'Lora' },
    { name: 'Refined Sans', display: 'Inter', body: 'Inter' },
    { name: 'Industrial Mono', display: 'JetBrains Mono', body: 'JetBrains Mono' }
];

// Color preset palettes for simple mode
const ACCENT_PRESETS = [
    { name: 'Coral', color: '#d97757' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Purple', color: '#8b5cf6' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Red', color: '#ef4444' },
];

export default function ThemeSettings() {
    const { themes, activeTheme, switchTheme, addTheme, updateTheme, deleteTheme } = useTheme();
    const toast = useToast();
    const haptics = useHaptics();

    const [showEditor, setShowEditor] = useState(false);
    const [editingTheme, setEditingTheme] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, theme: null });
    const [editorMode, setEditorMode] = useState('simple');

    const [themeForm, setThemeForm] = useState({ ...DEFAULT_DARK, name: '' });

    const handleSwitchTheme = async (themeId) => {
        if (activeTheme?.id === themeId) return;
        haptics.light();
        await switchTheme(themeId);
        toast.success('Theme applied');
    };

    const handleCreateNew = () => {
        haptics.medium();
        setEditingTheme(null);
        setThemeForm({ ...DEFAULT_DARK, name: '' });
        setEditorMode('simple');
        setShowEditor(true);
    };

    const handleEditTheme = (e, theme) => {
        e.stopPropagation();
        haptics.light();
        setEditingTheme(theme);
        setThemeForm({
            name: theme.name,
            bg_color: theme.bg_color,
            surface_color: theme.surface_color,
            text_color: theme.text_color,
            secondary_text_color: theme.secondary_text_color,
            border_color: theme.border_color,
            accent_color: theme.accent_color,
            font_family_display: theme.font_family_display || 'Inter',
            font_family_body: theme.font_family_body || 'Inter'
        });
        setEditorMode('simple');
        setShowEditor(true);
    };

    const handleDeleteClick = (e, theme) => {
        e.stopPropagation();
        haptics.medium();
        setDeleteConfirm({ show: true, theme });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.theme) return;
        try {
            await deleteTheme(deleteConfirm.theme.id);
            haptics.success();
            toast.success(`"${deleteConfirm.theme.name}" expunged`);
            setDeleteConfirm({ show: false, theme: null });
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to delete theme');
        }
    };

    const handleSaveTheme = async (e) => {
        e.preventDefault();
        if (!themeForm.name.trim()) {
            haptics.error();
            toast.error('Identity required');
            return;
        }

        try {
            if (editingTheme) {
                await updateTheme(editingTheme.id, themeForm);
                haptics.success();
                toast.success('Atmosphere refined');
            } else {
                await addTheme(themeForm);
                haptics.success();
                toast.success('New atmosphere materialized');
            }
            setShowEditor(false);
            setEditingTheme(null);
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to save theme');
        }
    };

    const applyBaseTheme = (base) => {
        haptics.light();
        const preset = base === 'light' ? DEFAULT_LIGHT : DEFAULT_DARK;
        setThemeForm(prev => ({
            ...prev,
            bg_color: preset.bg_color,
            surface_color: preset.surface_color,
            text_color: preset.text_color,
            secondary_text_color: preset.secondary_text_color,
            border_color: preset.border_color
        }));
    };

    // Filter themes into categories
    const categories = useMemo(() => {
        return {
            official: themes.filter(t => t.is_default && (t.name === 'Riven' || t.name === 'Arctic Frost' || t.name === 'Modern Minimal' || t.name === 'Tech Innovation')),
            professional: themes.filter(t => t.is_default && !(t.name === 'Riven' || t.name === 'Arctic Frost' || t.name === 'Modern Minimal' || t.name === 'Tech Innovation')),
            custom: themes.filter(t => !t.is_default)
        };
    }, [themes]);

    return (
        <div className="max-w-4xl mx-auto pb-24 md:px-0 relative mb-safe min-h-screen">
            {/* Soft background noise for the whole page to feel physical */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.15] z-0 mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            {/* Header */}
            <header className="mb-14 pt-8 px-4 md:px-0 flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="flex items-center gap-2 text-claude-accent mb-4">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-90">Atmosphere</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-display font-light tracking-tight leading-[1.1]">
                        Look &<br /><span className="font-bold italic pr-2">Feel.</span>
                    </h1>
                </motion.div>

                <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-claude-text text-claude-bg rounded-full font-bold shadow-2xl transition-all active:shadow-md border border-claude-text/10"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Custom</span>
                </motion.button>
            </header>

            {/* Sections */}
            <div className="space-y-16 relative z-10">
                <ThemeSection
                    title="Foundation"
                    subtitle="Core aesthetic experiences"
                    themes={categories.official}
                    activeThemeId={activeTheme?.id}
                    onSelect={handleSwitchTheme}
                    isPro={false}
                />

                <ThemeSection
                    title="Professional"
                    subtitle="Masterfully crafted environments"
                    themes={categories.professional}
                    activeThemeId={activeTheme?.id}
                    onSelect={handleSwitchTheme}
                    isPro={true}
                />

                <ThemeSection
                    title="Your Gallery"
                    subtitle="Handcrafted by you"
                    themes={categories.custom}
                    activeThemeId={activeTheme?.id}
                    onSelect={handleSwitchTheme}
                    isCustom={true}
                    onEdit={handleEditTheme}
                    onDelete={handleDeleteClick}
                />
            </div>

            <ConfirmModal
                isOpen={deleteConfirm.show}
                title={`Expunge '${deleteConfirm.theme?.name}'?`}
                message="This atmosphere will be permanently destroyed."
                confirmText="Destroy"
                destructive={true}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ show: false, theme: null })}
            />

            {/* Theme Editor - Bottom Sheet for Mobile First */}
            <AnimatePresence>
                {showEditor && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditor(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 200 }}
                            className="relative w-full md:max-w-2xl md:mx-auto md:mb-6 bg-claude-surface border-t md:border border-claude-border shadow-2xl flex flex-col rounded-t-[2.5rem] md:rounded-[2.5rem] max-h-[92vh] md:max-h-[85vh] overflow-hidden"
                            style={{
                                backgroundColor: themeForm.bg_color,
                                color: themeForm.text_color
                            }}
                        >
                            {/* Dragger handle for mobile */}
                            <div className="w-full flex justify-center pt-4 pb-2 md:hidden absolute top-0 z-20">
                                <div className="w-12 h-1.5 rounded-full bg-claude-text/20" />
                            </div>

                            <div className="flex items-center justify-between p-6 pt-8 md:pt-6 px-8 border-b z-10 shrink-0 backdrop-blur-xl" style={{ borderBottomColor: themeForm.border_color, backgroundColor: `${themeForm.bg_color}E6` }}>
                                <div>
                                    <h2 className="text-2xl font-display font-light tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>
                                        {editingTheme ? 'Refine' : 'New'} <span className="font-bold italic">Atmosphere</span>
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setShowEditor(false)}
                                    className="p-2.5 rounded-full transition-colors hover:opacity-70 active:scale-95 bg-black/5"
                                    style={{ color: themeForm.text_color }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveTheme} className="flex-1 overflow-y-auto px-6 md:px-10 py-8 space-y-12 custom-scrollbar">
                                <div className="space-y-4 relative">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Identity</label>
                                    <input
                                        type="text"
                                        value={themeForm.name}
                                        onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
                                        className="w-full bg-transparent border-b-2 px-0 py-3 outline-none text-4xl md:text-5xl font-display transition-all placeholder:opacity-20"
                                        style={{
                                            borderColor: themeForm.border_color,
                                            color: themeForm.text_color,
                                            fontFamily: themeForm.font_family_display
                                        }}
                                        placeholder="Name it..."
                                        autoFocus
                                    />
                                    <div className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-300" style={{ backgroundColor: themeForm.accent_color, width: themeForm.name ? '100%' : '0%' }} />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Pigments</label>
                                        <div className="flex p-1 rounded-xl" style={{ backgroundColor: themeForm.surface_color, border: `1px solid ${themeForm.border_color}` }}>
                                            <button
                                                type="button"
                                                onClick={() => setEditorMode('simple')}
                                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${editorMode === 'simple' ? 'shadow-md opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                                style={{
                                                    backgroundColor: editorMode === 'simple' ? themeForm.text_color : 'transparent',
                                                    color: editorMode === 'simple' ? themeForm.bg_color : themeForm.text_color
                                                }}
                                            >Simple</button>
                                            <button
                                                type="button"
                                                onClick={() => setEditorMode('advanced')}
                                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${editorMode === 'advanced' ? 'shadow-md opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                                style={{
                                                    backgroundColor: editorMode === 'advanced' ? themeForm.text_color : 'transparent',
                                                    color: editorMode === 'advanced' ? themeForm.bg_color : themeForm.text_color
                                                }}
                                            >Advanced</button>
                                        </div>
                                    </div>

                                    {editorMode === 'simple' ? (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="grid grid-cols-2 gap-4">
                                                <button type="button" onClick={() => applyBaseTheme('dark')} className={`flex flex-col gap-4 p-6 rounded-3xl border-2 transition-all duration-300 ${themeForm.bg_color === DEFAULT_DARK.bg_color ? 'scale-[1.02] shadow-xl' : 'scale-100 hover:scale-[1.01]'}`} style={{ borderColor: themeForm.bg_color === DEFAULT_DARK.bg_color ? themeForm.accent_color : themeForm.border_color, backgroundColor: themeForm.surface_color }}>
                                                    <div className="p-3 rounded-full bg-[#1a1a18] text-[#e8e8e3] w-fit shadow-inner">
                                                        <Moon className="w-6 h-6" />
                                                    </div>
                                                    <span className="font-display font-bold text-xl text-left tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>Obsidian</span>
                                                </button>
                                                <button type="button" onClick={() => applyBaseTheme('light')} className={`flex flex-col gap-4 p-6 rounded-3xl border-2 transition-all duration-300 ${themeForm.bg_color === DEFAULT_LIGHT.bg_color ? 'scale-[1.02] shadow-xl' : 'scale-100 hover:scale-[1.01]'}`} style={{ borderColor: themeForm.bg_color === DEFAULT_LIGHT.bg_color ? themeForm.accent_color : themeForm.border_color, backgroundColor: themeForm.surface_color }}>
                                                    <div className="p-3 rounded-full bg-[#fafaf9] text-[#1c1c1a] border border-black/10 w-fit shadow-sm">
                                                        <Sun className="w-6 h-6" />
                                                    </div>
                                                    <span className="font-display font-bold text-xl text-left tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>Alabaster</span>
                                                </button>
                                            </div>
                                            <div className="space-y-5">
                                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Vocal Accent</label>
                                                <div className="flex overflow-x-auto gap-4 pb-4 pt-2 snap-x -mx-6 px-6 md:-mx-10 md:px-10 [&::-webkit-scrollbar]:hidden">
                                                    {ACCENT_PRESETS.map(p => (
                                                        <button
                                                            key={p.color}
                                                            type="button"
                                                            onClick={e => {
                                                                e.preventDefault();
                                                                haptics.light();
                                                                setThemeForm({ ...themeForm, accent_color: p.color });
                                                            }}
                                                            className={`shrink-0 w-16 h-16 rounded-full border-4 transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] snap-center outline-none ${themeForm.accent_color === p.color ? 'scale-[1.15] shadow-xl' : 'scale-100 opacity-80 hover:scale-105'}`}
                                                            style={{
                                                                backgroundColor: p.color,
                                                                borderColor: themeForm.accent_color === p.color ? themeForm.bg_color : 'transparent',
                                                                boxShadow: themeForm.accent_color === p.color ? `0 0 0 2px ${p.color}, 0 10px 20px -5px ${p.color}80` : 'none'
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-x-5 gap-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {['bg_color', 'surface_color', 'text_color', 'secondary_text_color', 'border_color', 'accent_color'].map(key => (
                                                <div key={key} className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60" style={{ fontFamily: themeForm.font_family_body }}>{key.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="relative group overflow-hidden rounded-2xl shadow-sm border" style={{ borderColor: themeForm.border_color }}>
                                                        <input
                                                            type="color"
                                                            value={themeForm[key]}
                                                            onChange={e => setThemeForm({ ...themeForm, [key]: e.target.value })}
                                                            className="w-full h-16 opacity-0 absolute inset-0 cursor-pointer"
                                                        />
                                                        <div className="w-full h-16 pointer-events-none transition-transform group-active:scale-95" style={{ backgroundColor: themeForm[key] }} />
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-mono font-medium opacity-0 group-hover:opacity-100 mix-blend-difference text-white transition-opacity bg-black/20 backdrop-blur-sm tracking-wider uppercase">{themeForm[key]}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-5">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Typography</label>
                                    <div className="grid grid-cols-1 gap-4">
                                        {FONT_PRESETS.map(f => (
                                            <button
                                                key={f.name}
                                                type="button"
                                                onClick={() => {
                                                    haptics.light();
                                                    setThemeForm({ ...themeForm, font_family_display: f.display, font_family_body: f.body })
                                                }}
                                                className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all duration-300 ${themeForm.font_family_display === f.display ? 'scale-[1.01] shadow-lg' : 'border-transparent hover:scale-[1.01]'}`}
                                                style={{
                                                    backgroundColor: themeForm.surface_color,
                                                    borderColor: themeForm.font_family_display === f.display ? themeForm.accent_color : themeForm.border_color
                                                }}
                                            >
                                                <div className="text-left">
                                                    <span className="text-2xl block mb-2 font-bold tracking-tight" style={{ fontFamily: f.display }}>{f.name}</span>
                                                    <span className="text-sm opacity-60 leading-relaxed max-w-[80%]" style={{ fontFamily: f.body }}>The quick brown fox jumps over the lazy dog. Design is intelligence made visible.</span>
                                                </div>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${themeForm.font_family_display === f.display ? 'opacity-100' : 'opacity-10 border'}`}
                                                    style={{
                                                        backgroundColor: themeForm.font_family_display === f.display ? themeForm.accent_color : 'transparent',
                                                        color: themeForm.font_family_display === f.display ? themeForm.bg_color : themeForm.text_color,
                                                        borderColor: themeForm.border_color
                                                    }}>
                                                    <Check className="w-4 h-4" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </form>

                            <div className="p-6 md:px-10 pb-8 md:pb-6 border-t z-10 shrink-0 backdrop-blur-xl" style={{ borderTopColor: themeForm.border_color, backgroundColor: `${themeForm.bg_color}E6` }}>
                                <button
                                    type="submit"
                                    onClick={handleSaveTheme}
                                    className="w-full py-5 rounded-full font-bold text-lg transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 border border-black/10"
                                    style={{
                                        backgroundColor: themeForm.text_color,
                                        color: themeForm.bg_color,
                                        fontFamily: themeForm.font_family_display,
                                        boxShadow: `0 20px 25px -5px ${themeForm.text_color}30, 0 8px 10px -6px ${themeForm.text_color}30`
                                    }}
                                >
                                    {editingTheme ? 'Commit Refinements' : 'Materialize Theme'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ThemeSection({ title, subtitle, themes, activeThemeId, onSelect, isCustom, onEdit, onDelete, isPro }) {
    if (themes.length === 0 && !isCustom) return null;

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, scale: 0.95, x: 20 },
        show: { opacity: 1, scale: 1, x: 0, transition: { type: 'spring', damping: 25, stiffness: 180 } }
    };

    return (
        <section className="relative w-full">
            <div className="mb-2 px-4 md:px-0">
                <h2 className="text-xs font-bold uppercase tracking-[0.25em] flex items-center gap-3 text-claude-text opacity-70">
                    {title}
                    {isPro && <span className="text-[9px] bg-claude-accent/10 text-claude-accent border border-claude-accent/20 px-2 py-0.5 rounded-sm tracking-widest font-bold">PRO</span>}
                </h2>
                <p className="text-sm text-claude-secondary mt-2 max-w-sm">{subtitle}</p>
            </div>

            {/* Horizontal Snap Scroll Container - Mobile First Pattern */}
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex overflow-x-auto snap-x snap-mandatory gap-6 pt-6 pb-20 px-4 md:px-0 -mx-4 md:mx-0 [&::-webkit-scrollbar]:hidden"
            >
                {themes.map((theme, index) => (
                    <motion.div
                        key={theme.id}
                        variants={item}
                        className="snap-center md:snap-start shrink-0 w-[85vw] md:w-[24rem]"
                    >
                        <ThemeCard
                            theme={theme}
                            isActive={activeThemeId === theme.id}
                            onSelect={() => onSelect(theme.id)}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isCustom={isCustom}
                            index={index}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
}

function ThemeCard({ theme, isActive, onSelect, onEdit, onDelete, isCustom }) {
    return (
        <div
            onClick={onSelect}
            className={`group relative overflow-hidden rounded-[2.5rem] p-8 transition-all duration-700 cursor-pointer h-[30rem] flex flex-col justify-between select-none ${isActive
                ? 'scale-[1.02]'
                : 'hover:scale-[1.01] active:scale-[0.98]'
                }`}
            style={{
                backgroundColor: theme.bg_color,
                border: isActive ? `2px solid ${theme.text_color}` : `1px solid ${theme.border_color}`,
                boxShadow: isActive ? `0 30px 60px -15px ${theme.accent_color}40, inset 0 0 0 1px ${theme.border_color}40` : `0 10px 30px -15px rgba(0,0,0,0.1)`,
            }}
        >
            {/* Texture Noise Overlay for Physicality */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.25] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            {/* Top Section: Typography Showcase */}
            <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                        {isActive && (
                            <motion.div
                                layoutId="activeThemeBadge"
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: theme.accent_color, boxShadow: `0 0 15px ${theme.accent_color}` }}
                            />
                        )}
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-50" style={{ color: theme.text_color, fontFamily: theme.font_family_body }}>
                            {theme.font_family_display.split(' ')[0]}
                        </span>
                    </div>

                    <h3 className="text-4xl tracking-tight leading-[1.1] max-w-[80%] font-light" style={{ color: theme.text_color, fontFamily: theme.font_family_display }}>
                        {theme.name}
                    </h3>
                </div>

                {/* Massive decorative Aa based on the display font behind everything */}
                <div
                    className="text-[9rem] opacity-[0.03] absolute -right-6 -top-10 pointer-events-none select-none font-bold leading-none"
                    style={{ color: theme.text_color, fontFamily: theme.font_family_display }}
                >
                    Aa
                </div>
            </div>

            {/* Middle Section: Abstract Interface Representation */}
            <div className="relative flex-1 flex flex-col justify-center my-8 z-10">
                <div
                    className="w-full h-40 rounded-[2rem] shadow-2xl transform -rotate-2 transition-transform duration-700 group-hover:rotate-0 flex flex-col p-6 relative overflow-hidden backdrop-blur-xl"
                    style={{ backgroundColor: `${theme.surface_color}E6`, border: `1px solid ${theme.border_color}` }}
                >
                    <div className="w-24 h-24 rounded-full blur-3xl absolute -top-8 -right-8 opacity-40 mix-blend-screen" style={{ backgroundColor: theme.accent_color }} />
                    <div className="w-12 h-3 rounded-full mb-5" style={{ backgroundColor: theme.accent_color }} />
                    <div className="w-5/6 h-2.5 rounded-full opacity-30 object-cover mb-2" style={{ backgroundColor: theme.text_color }} />
                    <div className="w-2/3 h-2.5 rounded-full opacity-20" style={{ backgroundColor: theme.text_color }} />

                    <div className="mt-auto flex gap-3">
                        <div className="w-8 h-8 rounded-full border border-current opacity-20" style={{ color: theme.secondary_text_color }} />
                        <div className="w-8 h-8 rounded-full border border-current opacity-20" style={{ color: theme.secondary_text_color }} />
                    </div>
                </div>
            </div>

            {/* Bottom Section: Palette Display & Actions */}
            <div className="relative z-10 flex items-end justify-between">
                <div className="flex bg-black/5 p-1.5 rounded-full backdrop-blur-md border border-black/5 shadow-inner">
                    {[theme.bg_color, theme.surface_color, theme.border_color, theme.accent_color, theme.text_color].map((c, i) => (
                        <div
                            key={i}
                            className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                            style={{ backgroundColor: c, marginLeft: i > 0 ? '-8px' : '0' }}
                        />
                    ))}
                </div>

                {/* Custom Actions */}
                {isCustom && (
                    <div className="flex gap-2 opacity-100 md:opacity-0 md:translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                        <button
                            onClick={(e) => onEdit(e, theme)}
                            className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border hover:scale-110 active:scale-95 transition-all shadow-xl"
                            style={{ color: theme.text_color, backgroundColor: `${theme.surface_color}E6`, borderColor: theme.border_color }}
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => onDelete(e, theme)}
                            className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border hover:scale-110 active:scale-95 transition-all text-red-500 shadow-xl"
                            style={{ backgroundColor: `${theme.surface_color}E6`, borderColor: theme.border_color }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Inner Glow Border */}
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none" />
        </div>
    );
}


