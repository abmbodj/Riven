import React, { useState, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Check, Plus, X, Trash2, Edit3, Sun, Moon, Palette, ChevronRight, Sparkles, Type, Info } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import useHaptics from '../hooks/useHaptics';
// eslint-disable-next-line no-unused-vars
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
    { name: 'Elegant Serif', display: 'Cormorant Garamond', body: 'Lora' },
    { name: 'Modern Sans', display: 'Inter', body: 'Inter' },
    { name: 'Monospace Tech', display: 'JetBrains Mono', body: 'JetBrains Mono' }
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
            toast.success(`"${deleteConfirm.theme.name}" deleted`);
            setDeleteConfirm({ show: false, theme: null });
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to delete theme');
        }
    };

    const handleSaveTheme = async (e) => {
        e.preventDefault();
        if (!themeForm.name.trim()) {
            toast.error('Please enter a theme name');
            return;
        }

        try {
            if (editingTheme) {
                await updateTheme(editingTheme.id, themeForm);
                haptics.success();
                toast.success('Theme updated');
            } else {
                await addTheme(themeForm);
                haptics.success();
                toast.success('Theme created');
            }
            setShowEditor(false);
            setEditingTheme(null);
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to save theme');
        }
    };

    const applyBaseTheme = (base) => {
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
        <div className="max-w-4xl mx-auto pb-20">
            {/* Header */}
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex items-center gap-2 text-claude-accent mb-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Atmosphere</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight">Themes</h1>
                    <p className="text-claude-secondary mt-2 max-w-sm">Elevate your focus with curated professional environments and custom palettes.</p>
                </motion.div>

                <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-6 py-3 bg-claude-accent text-white rounded-full font-bold shadow-lg shadow-claude-accent/20 transition-all hover:shadow-xl hover:shadow-claude-accent/30"
                >
                    <Plus className="w-5 h-5" />
                    <span>Design Yours</span>
                </motion.button>
            </header>

            {/* Sections */}
            <div className="space-y-12">
                {/* Official Themes */}
                <ThemeSection
                    title="Foundation"
                    subtitle="Core Riven experiences"
                    themes={categories.official}
                    activeThemeId={activeTheme?.id}
                    onSelect={handleSwitchTheme}
                    isPro={false}
                />

                {/* Professional Collection */}
                <ThemeSection
                    title="Professional Collection"
                    subtitle="Masterfully crafted environments for deep work"
                    themes={categories.professional}
                    activeThemeId={activeTheme?.id}
                    onSelect={handleSwitchTheme}
                    isPro={true}
                />

                {/* Custom Themes */}
                <ThemeSection
                    title="Your Creation"
                    subtitle="Themes handcrafted by you"
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
                title={`Delete '${deleteConfirm.theme?.name}'?`}
                message="This theme will be permanently removed from your collection."
                confirmText="Delete Theme"
                destructive={true}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ show: false, theme: null })}
            />

            {/* Theme Editor - Slide Over Panel */}
            <AnimatePresence>
                {showEditor && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditor(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-md bg-claude-surface border-l border-claude-border h-full shadow-2xl flex flex-col"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-claude-border">
                                <div>
                                    <h2 className="text-xl font-display font-bold">{editingTheme ? 'Refine Theme' : 'New Creation'}</h2>
                                    <p className="text-xs text-claude-secondary uppercase tracking-widest mt-1">Design System</p>
                                </div>
                                <button
                                    onClick={() => setShowEditor(false)}
                                    className="p-2 hover:bg-claude-bg rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveTheme} className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold uppercase tracking-widest text-claude-secondary block">Identity</label>
                                    <input
                                        type="text"
                                        value={themeForm.name}
                                        onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
                                        className="w-full bg-claude-bg border-b-2 border-claude-border focus:border-claude-accent px-0 py-2 outline-none text-xl font-display transition-all"
                                        placeholder="Theme Name..."
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-widest text-claude-secondary block">Palette</label>
                                        <div className="flex bg-claude-bg p-1 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => setEditorMode('simple')}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${editorMode === 'simple' ? 'bg-claude-accent text-white' : 'text-claude-secondary'}`}
                                            >Simple</button>
                                            <button
                                                type="button"
                                                onClick={() => setEditorMode('advanced')}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${editorMode === 'advanced' ? 'bg-claude-accent text-white' : 'text-claude-secondary'}`}
                                            >Advanced</button>
                                        </div>
                                    </div>

                                    {editorMode === 'simple' ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <button type="button" onClick={() => applyBaseTheme('dark')} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${themeForm.bg_color === DEFAULT_DARK.bg_color ? 'border-claude-accent bg-claude-accent/5' : 'border-claude-border bg-claude-bg'}`}>
                                                    <Moon className="w-5 h-5" />
                                                    <span className="font-bold">Deep</span>
                                                </button>
                                                <button type="button" onClick={() => applyBaseTheme('light')} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${themeForm.bg_color === DEFAULT_LIGHT.bg_color ? 'border-claude-accent bg-claude-accent/5' : 'border-claude-border bg-claude-bg'}`}>
                                                    <Sun className="w-5 h-5" />
                                                    <span className="font-bold">Bright</span>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3">
                                                {ACCENT_PRESETS.map(p => (
                                                    <button key={p.color} type="button" onClick={() => setThemeForm({ ...themeForm, accent_color: p.color })} className={`aspect-square rounded-full border-2 transition-all ${themeForm.accent_color === p.color ? 'scale-110 border-white ring-4 ring-claude-accent/20' : 'border-transparent scale-100'}`} style={{ backgroundColor: p.color }} />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            {['bg_color', 'surface_color', 'text_color', 'secondary_text_color', 'border_color', 'accent_color'].map(key => (
                                                <div key={key} className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase text-claude-secondary">{key.replace('_', ' ')}</span>
                                                        <span className="text-[10px] font-mono text-claude-secondary opacity-50">{themeForm[key]}</span>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="color"
                                                            value={themeForm[key]}
                                                            onChange={e => setThemeForm({ ...themeForm, [key]: e.target.value })}
                                                            className="w-full h-10 rounded-xl bg-transparent border-none cursor-pointer outline-none"
                                                        />
                                                        <div className="absolute inset-x-0 bottom-0 top-0 rounded-xl pointer-events-none border border-white/10" style={{ backgroundColor: themeForm[key] }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-bold uppercase tracking-widest text-claude-secondary block">Typography</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {FONT_PRESETS.map(f => (
                                            <button
                                                key={f.name}
                                                type="button"
                                                onClick={() => setThemeForm({ ...themeForm, font_family_display: f.display, font_family_body: f.body })}
                                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${themeForm.font_family_display === f.display ? 'border-claude-accent bg-claude-accent/5' : 'border-claude-border bg-claude-bg'}`}
                                            >
                                                <div className="text-left">
                                                    <span className="text-sm font-bold block" style={{ fontFamily: f.display }}>{f.name}</span>
                                                    <span className="text-xs opacity-50" style={{ fontFamily: f.body }}>Preview text for body</span>
                                                </div>
                                                {themeForm.font_family_display === f.display && <Check className="w-4 h-4 text-claude-accent" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Preview Card */}
                                <div className="pt-4">
                                    <label className="text-xs font-bold uppercase tracking-widest text-claude-secondary block mb-4">Quick Look</label>
                                    <div className="p-6 rounded-3xl shadow-xl transition-all duration-500 overflow-hidden relative" style={{ backgroundColor: themeForm.bg_color, border: `1px solid ${themeForm.border_color}` }}>
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20" style={{ backgroundColor: themeForm.accent_color }} />
                                        <h4 className="text-xl font-bold mb-1" style={{ color: themeForm.text_color, fontFamily: themeForm.font_family_display }}>Sample Layout</h4>
                                        <p className="text-xs opacity-70 mb-4" style={{ color: themeForm.secondary_text_color, fontFamily: themeForm.font_family_body }}>This is how your new theme will feel in action.</p>
                                        <div className="flex gap-2">
                                            <div className="px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg" style={{ backgroundColor: themeForm.accent_color }}>Action</div>
                                            <div className="px-4 py-2 rounded-full text-xs font-bold" style={{ backgroundColor: themeForm.surface_color, color: themeForm.text_color, border: `1px solid ${themeForm.border_color}` }}>Cancel</div>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="p-6 border-t border-claude-border bg-claude-surface">
                                <button
                                    type="submit"
                                    onClick={handleSaveTheme}
                                    className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg active:scale-95 transition-all"
                                >
                                    {editingTheme ? 'Update Collection' : 'Add to Collection'}
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
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 20 } }
    };

    return (
        <section>
            <div className="mb-6">
                <h2 className="text-xl font-display font-bold flex items-center gap-2">
                    {title}
                    {isPro && <span className="text-[10px] bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Pro</span>}
                </h2>
                <p className="text-sm text-claude-secondary">{subtitle}</p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {themes.map(theme => (
                    <motion.div key={theme.id} variants={item}>
                        <ThemeCard
                            theme={theme}
                            isActive={activeThemeId === theme.id}
                            onSelect={() => onSelect(theme.id)}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isCustom={isCustom}
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
            className={`group relative overflow-hidden rounded-[2rem] border-2 p-6 transition-all duration-300 cursor-pointer h-full flex flex-col ${isActive
                ? 'border-claude-accent ring-8 ring-claude-accent/5'
                : 'border-claude-border hover:border-claude-accent/40 bg-claude-surface'
                }`}
        >
            {/* Visual Preview Area */}
            <div className="relative mb-6 aspect-[4/3] rounded-2xl overflow-hidden shadow-inner flex flex-col justify-end p-4 border" style={{ backgroundColor: theme.bg_color, borderColor: theme.border_color }}>
                {/* Simulated UI elements */}
                <div className="absolute top-3 left-3 w-12 h-1.5 rounded-full opacity-20" style={{ backgroundColor: theme.text_color }} />
                <div className="absolute top-6 left-3 w-8 h-1.5 rounded-full opacity-10" style={{ backgroundColor: theme.text_color }} />

                <div
                    className="w-full h-2/3 rounded-xl p-3 shadow-lg transform rotate-[-2deg] transition-transform group-hover:rotate-0"
                    style={{ backgroundColor: theme.surface_color, border: `1px solid ${theme.border_color}` }}
                >
                    <div className="w-1/2 h-2 rounded-full mb-2" style={{ backgroundColor: theme.accent_color }} />
                    <div className="w-3/4 h-1.5 rounded-full opacity-30" style={{ backgroundColor: theme.text_color }} />
                    <div className="w-2/3 h-1.5 rounded-full opacity-20 mt-1" style={{ backgroundColor: theme.text_color }} />
                </div>

                {/* Fonts indicator */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-lg border border-white/20">
                        <Type className="w-3 h-3 text-white" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display font-bold text-lg truncate group-hover:text-claude-accent transition-colors">{theme.name}</h3>
                    {isActive && (
                        <div className="bg-claude-accent text-white p-1 rounded-full shadow-lg shadow-claude-accent/30">
                            <Check className="w-3 h-3" />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-claude-secondary uppercase tracking-widest mt-auto">
                    <div className="flex -space-x-1.5">
                        {[theme.bg_color, theme.surface_color, theme.accent_color].map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border-2 border-claude-surface shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                    </div>
                    <span className="opacity-60">{theme.font_family_display.split(' ')[0]}</span>
                </div>
            </div>

            {/* Quick Actions for Custom Themes */}
            {isCustom && (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-[-10px] group-hover:translate-y-0">
                    <button
                        onClick={(e) => onEdit(e, theme)}
                        className="bg-white/90 backdrop-blur p-2 rounded-full text-claude-bg shadow-lg hover:scale-110 active:scale-95 transition-all border border-black/5"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => onDelete(e, theme)}
                        className="bg-white/90 backdrop-blur p-2 rounded-full text-red-500 shadow-lg hover:scale-110 active:scale-95 transition-all border border-black/5"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
