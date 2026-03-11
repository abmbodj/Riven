import { useState, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Check, Plus, X, Trash2, Edit3, Sun, Moon, Sparkles } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import useHaptics from '../hooks/useHaptics';
import { useAuth } from '../hooks/useAuth';
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

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function ThemeSettings() {
    const { themes, activeTheme, switchTheme, addTheme, updateTheme, deleteTheme } = useTheme();
    const { user } = useAuth();
    const toast = useToast();
    const haptics = useHaptics();

    const [showEditor, setShowEditor] = useState(false);
    const [editingTheme, setEditingTheme] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, theme: null });
    const [editorMode, setEditorMode] = useState('simple');
    const [pricingOpen, setPricingOpen] = useState(false);
    const [carouselIndices, setCarouselIndices] = useState({ official: 0, professional: 0, custom: 0 });

    const [themeForm, setThemeForm] = useState({ ...DEFAULT_DARK, name: '' });

    const handleSwitchTheme = async (themeId, isPro) => {
        if (activeTheme?.id === themeId) return;

        if (isPro) {
            const tier = user?.subscription_tier || 'free';
            if (tier === 'free') {
                haptics.error();
                setPricingOpen(true);
                return;
            }
        }

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
        <div className="max-w-4xl md:max-w-7xl mx-auto pb-32 md:px-12 lg:px-24 relative mb-safe min-h-screen">
            {/* Soft background noise */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.15] z-0 md:mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} />

            {/* Header */}
            <header className="mb-8 pt-8 px-4 md:px-0 flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
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
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-claude-text text-claude-bg rounded-full font-bold shadow-md md:shadow-2xl transition-[transform,opacity,color,background-color,border-color,box-shadow] active:shadow-md border border-claude-text/10"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Custom</span>
                </motion.button>
            </header>

            {/* Active Theme Hero */}
            {activeTheme && (
                <div className="px-4 md:px-0 relative z-10 mb-14">
                    <ActiveThemeHero theme={activeTheme} />
                </div>
            )}

            {/* Sections */}
            <div className="space-y-16 relative z-10">
                <ThemeSection
                    title="Foundation"
                    subtitle="Core aesthetic experiences"
                    themes={categories.official}
                    activeThemeId={activeTheme?.id}
                    onSelect={(id) => handleSwitchTheme(id, false)}
                    isPro={false}
                    sectionKey="official"
                    carouselIndex={carouselIndices.official}
                    onCarouselScroll={(i) => setCarouselIndices(p => ({ ...p, official: i }))}
                />

                <ThemeSection
                    title="Professional"
                    subtitle="Masterfully crafted environments"
                    themes={categories.professional}
                    activeThemeId={activeTheme?.id}
                    onSelect={(id) => handleSwitchTheme(id, true)}
                    isPro={true}
                    sectionKey="professional"
                    carouselIndex={carouselIndices.professional}
                    onCarouselScroll={(i) => setCarouselIndices(p => ({ ...p, professional: i }))}
                />

                <ThemeSection
                    title="Your Gallery"
                    subtitle="Handcrafted by you"
                    themes={categories.custom}
                    activeThemeId={activeTheme?.id}
                    onSelect={(id) => handleSwitchTheme(id, false)}
                    isCustom={true}
                    onEdit={handleEditTheme}
                    onDelete={handleDeleteClick}
                    onCreateNew={handleCreateNew}
                    sectionKey="custom"
                    carouselIndex={carouselIndices.custom}
                    onCarouselScroll={(i) => setCarouselIndices(p => ({ ...p, custom: i }))}
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

            <PricingModal
                isOpen={pricingOpen}
                onClose={() => setPricingOpen(false)}
                currentTier={user?.subscription_tier || 'free'}
            />

            {/* Theme Editor — Bottom Sheet */}
            <AnimatePresence>
                {showEditor && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditor(false)}
                            className="absolute inset-0 bg-black/40 md:backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 200 }}
                            className="relative w-full md:max-w-2xl md:mx-auto md:mb-6 glass-panel border-t md:border border-claude-border shadow-md md:shadow-2xl flex flex-col rounded-t-[2.5rem] md:rounded-[2.5rem] max-h-[92vh] md:max-h-[85vh] overflow-hidden"
                            style={{
                                backgroundColor: themeForm.bg_color,
                                color: themeForm.text_color
                            }}
                        >
                            {/* Drag handle — mobile */}
                            <div className="w-full flex justify-center pt-4 pb-2 md:hidden absolute top-0 z-20">
                                <div className="w-12 h-1.5 rounded-full bg-claude-text/20" />
                            </div>

                            {/* Editor header */}
                            <div className="flex items-center justify-between p-6 pt-8 md:pt-6 px-8 border-b z-10 shrink-0 md:backdrop-blur-xl" style={{ borderBottomColor: themeForm.border_color, backgroundColor: `${themeForm.bg_color}E6` }}>
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

                            <form onSubmit={handleSaveTheme} className="flex-1 overflow-y-auto px-6 md:px-10 py-8 space-y-10 custom-scrollbar">

                                {/* Live Preview Block */}
                                <div className="rounded-2xl overflow-hidden border relative" style={{ borderColor: themeForm.border_color, height: '72px', backgroundColor: themeForm.surface_color }}>
                                    {/* Mini header */}
                                    <div className="flex items-center gap-2 px-3 h-7" style={{ backgroundColor: themeForm.bg_color, borderBottom: `1px solid ${themeForm.border_color}` }}>
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeForm.accent_color, opacity: 0.8 }} />
                                        <div className="h-1.5 flex-1 rounded-full opacity-20" style={{ backgroundColor: themeForm.text_color, maxWidth: '50%' }} />
                                        <div className="h-4 w-10 rounded opacity-30" style={{ backgroundColor: themeForm.accent_color }} />
                                    </div>
                                    {/* Content */}
                                    <div className="px-3 pt-2 space-y-1.5">
                                        <div className="h-2.5 rounded-full w-3/4 opacity-40" style={{ backgroundColor: themeForm.text_color }} />
                                        <div className="h-1.5 rounded-full w-full opacity-15" style={{ backgroundColor: themeForm.text_color }} />
                                    </div>
                                    {/* Accent pill */}
                                    <div className="absolute right-3 bottom-2.5 h-4 w-12 rounded-full opacity-90" style={{ backgroundColor: themeForm.accent_color }} />
                                    {/* Label */}
                                    <div className="absolute top-1.5 right-3">
                                        <span className="text-[8px] font-mono uppercase tracking-widest opacity-30" style={{ color: themeForm.text_color }}>Preview</span>
                                    </div>
                                </div>

                                {/* Identity / Name */}
                                <div className="space-y-4 relative">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Identity</label>
                                    <input
                                        type="text"
                                        value={themeForm.name}
                                        onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
                                        className="w-full bg-transparent border-b-2 px-0 py-3 outline-none text-4xl md:text-5xl font-display transition-[transform,opacity,color,background-color,border-color,box-shadow] placeholder:opacity-20"
                                        style={{
                                            borderColor: themeForm.border_color,
                                            color: themeForm.text_color,
                                            fontFamily: themeForm.font_family_display
                                        }}
                                        placeholder="Name it..."
                                        autoFocus
                                    />
                                    <div className="absolute bottom-0 left-0 h-[2px] transition-[width] duration-300" style={{ backgroundColor: themeForm.accent_color, width: themeForm.name ? '100%' : '0%' }} />
                                </div>

                                {/* Pigments */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Pigments</label>
                                        <div className="flex p-1 rounded-xl" style={{ backgroundColor: themeForm.surface_color, border: `1px solid ${themeForm.border_color}` }}>
                                            <button
                                                type="button"
                                                onClick={() => setEditorMode('simple')}
                                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-[transform,opacity,color,background-color,border-color,box-shadow] ${editorMode === 'simple' ? 'shadow-md opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                                style={{
                                                    backgroundColor: editorMode === 'simple' ? themeForm.text_color : 'transparent',
                                                    color: editorMode === 'simple' ? themeForm.bg_color : themeForm.text_color
                                                }}
                                            >Simple</button>
                                            <button
                                                type="button"
                                                onClick={() => setEditorMode('advanced')}
                                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-[transform,opacity,color,background-color,border-color,box-shadow] ${editorMode === 'advanced' ? 'shadow-md opacity-100' : 'opacity-40 hover:opacity-70'}`}
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
                                                <button type="button" onClick={() => applyBaseTheme('dark')} className={`flex flex-col gap-4 p-6 rounded-3xl border-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${themeForm.bg_color === DEFAULT_DARK.bg_color ? 'scale-[1.02] shadow-sm md:shadow-xl' : 'scale-100 hover:scale-[1.01]'}`} style={{ borderColor: themeForm.bg_color === DEFAULT_DARK.bg_color ? themeForm.accent_color : themeForm.border_color, backgroundColor: themeForm.surface_color }}>
                                                    <div className="p-3 rounded-full bg-[#1a1a18] text-[#e8e8e3] w-fit shadow-inner">
                                                        <Moon className="w-6 h-6" />
                                                    </div>
                                                    <span className="font-display font-bold text-xl text-left tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>Obsidian</span>
                                                </button>
                                                <button type="button" onClick={() => applyBaseTheme('light')} className={`flex flex-col gap-4 p-6 rounded-3xl border-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${themeForm.bg_color === DEFAULT_LIGHT.bg_color ? 'scale-[1.02] shadow-sm md:shadow-xl' : 'scale-100 hover:scale-[1.01]'}`} style={{ borderColor: themeForm.bg_color === DEFAULT_LIGHT.bg_color ? themeForm.accent_color : themeForm.border_color, backgroundColor: themeForm.surface_color }}>
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
                                                            className={`shrink-0 w-16 h-16 rounded-full border-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] snap-center outline-none ${themeForm.accent_color === p.color ? 'scale-[1.15] shadow-sm md:shadow-xl' : 'scale-100 opacity-80 hover:scale-105'}`}
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
                                                <div key={key} className="space-y-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 block" style={{ fontFamily: themeForm.font_family_body }}>
                                                        {key.replace(/_/g, ' ')}
                                                    </span>
                                                    <div className="relative group overflow-hidden rounded-2xl border" style={{ borderColor: themeForm.border_color }}>
                                                        <input
                                                            type="color"
                                                            value={themeForm[key]}
                                                            onChange={e => setThemeForm({ ...themeForm, [key]: e.target.value })}
                                                            className="w-full h-14 opacity-0 absolute inset-0 cursor-pointer"
                                                        />
                                                        <div className="w-full h-14 pointer-events-none" style={{ backgroundColor: themeForm[key] }} />
                                                    </div>
                                                    <p className="text-[10px] font-mono tracking-widest text-center opacity-50" style={{ color: themeForm.text_color }}>
                                                        {themeForm[key].toUpperCase()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Typography */}
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
                                                className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${themeForm.font_family_display === f.display ? 'scale-[1.01] shadow-sm md:shadow-lg' : 'border-transparent hover:scale-[1.01]'}`}
                                                style={{
                                                    backgroundColor: themeForm.surface_color,
                                                    borderColor: themeForm.font_family_display === f.display ? themeForm.accent_color : themeForm.border_color
                                                }}
                                            >
                                                <div className="text-left">
                                                    <span className="text-2xl block mb-2 font-bold tracking-tight" style={{ fontFamily: f.display }}>{f.name}</span>
                                                    <span className="text-sm opacity-60 leading-relaxed max-w-[80%]" style={{ fontFamily: f.body }}>The quick brown fox jumps over the lazy dog.</span>
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

                            <div className="p-6 md:px-10 pb-8 md:pb-6 border-t z-10 shrink-0 md:backdrop-blur-xl" style={{ borderTopColor: themeForm.border_color, backgroundColor: `${themeForm.bg_color}E6` }}>
                                <button
                                    type="submit"
                                    onClick={handleSaveTheme}
                                    className="w-full py-5 rounded-full font-bold text-lg transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-sm md:shadow-xl active:scale-95 flex items-center justify-center gap-2 border border-black/10"
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

// ─── Active Theme Hero ────────────────────────────────────────────────────────

function ActiveThemeHero({ theme }) {
    return (
        <motion.div
            key={theme.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full overflow-hidden rounded-[2.5rem]"
            style={{
                backgroundColor: theme.bg_color,
                border: `1px solid ${theme.border_color}`,
                boxShadow: `0 30px 60px -15px ${theme.accent_color}40`,
            }}
        >
            {/* Noise texture */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.2] rounded-[2.5rem]" style={{ backgroundImage: NOISE_SVG }} />

            {/* Accent radial bloom */}
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ backgroundColor: theme.accent_color }} />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 md:p-12">
                {/* Left — identity */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-5">
                        <motion.span
                            animate={{ opacity: [1, 0.35, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: theme.accent_color, boxShadow: `0 0 8px ${theme.accent_color}` }}
                        />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.35em] opacity-60" style={{ color: theme.accent_color }}>
                            Active Specimen
                        </span>
                    </div>

                    <h2
                        className="text-5xl md:text-6xl font-light tracking-tight leading-[1.0] mb-3 truncate"
                        style={{ color: theme.text_color, fontFamily: `${theme.font_family_display}, serif` }}
                    >
                        {theme.name}
                    </h2>

                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] opacity-40 mt-2" style={{ color: theme.text_color }}>
                        {theme.font_family_display} · {theme.font_family_body}
                    </p>
                </div>

                {/* Right — landscape mini-UI preview */}
                <div
                    className="shrink-0 w-full md:w-72 rounded-2xl overflow-hidden relative"
                    style={{
                        height: '8rem',
                        backgroundColor: theme.surface_color,
                        border: `1px solid ${theme.border_color}`,
                    }}
                >
                    {/* Mini header bar */}
                    <div
                        className="absolute top-0 left-0 right-0 h-8 flex items-center gap-2 px-3"
                        style={{ backgroundColor: theme.bg_color, borderBottom: `1px solid ${theme.border_color}` }}
                    >
                        <div className="w-2 h-2 rounded-full opacity-60" style={{ backgroundColor: theme.accent_color }} />
                        <div className="flex-1 h-1.5 rounded-full opacity-20" style={{ backgroundColor: theme.text_color, maxWidth: '60%' }} />
                        <div className="w-10 h-4 rounded opacity-30" style={{ backgroundColor: theme.accent_color }} />
                    </div>
                    {/* Content rows */}
                    <div className="absolute top-10 left-3 right-3 space-y-2">
                        <div className="h-3 rounded-full w-3/4 opacity-35" style={{ backgroundColor: theme.text_color }} />
                        <div className="h-2 rounded-full w-full opacity-15" style={{ backgroundColor: theme.text_color }} />
                        <div className="h-2 rounded-full w-5/6 opacity-12" style={{ backgroundColor: theme.text_color }} />
                    </div>
                    {/* Accent pill */}
                    <div className="absolute bottom-3 left-3 h-5 w-14 rounded-full opacity-85" style={{ backgroundColor: theme.accent_color }} />
                    {/* Inner glow */}
                    <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: `inset 0 0 20px ${theme.accent_color}15` }} />
                </div>
            </div>

            {/* Inner rim */}
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none" />
        </motion.div>
    );
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({ title, subtitle, isPro }) {
    return (
        <div className="mb-8 md:mb-10">
            {/* Botanical ornamental rule */}
            <div className="flex items-center gap-4 mb-6">
                <div
                    className="h-px flex-1"
                    style={{ background: 'linear-gradient(to right, transparent, var(--border-color) 40%, var(--border-color) 60%, transparent)' }}
                />
                <span className="text-claude-accent text-xs opacity-40 select-none" aria-hidden="true">✦</span>
                <div
                    className="h-px flex-1"
                    style={{ background: 'linear-gradient(to left, transparent, var(--border-color) 40%, var(--border-color) 60%, transparent)' }}
                />
            </div>

            {/* Title row */}
            <div className="flex items-baseline gap-3 px-4 md:px-0">
                <h2
                    className="text-3xl md:text-4xl font-light italic tracking-tight text-claude-text"
                    style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", serif' }}
                >
                    {title}
                </h2>
                {isPro && (
                    <span className="text-[9px] font-mono bg-claude-accent/10 text-claude-accent border border-claude-accent/20 px-2 py-0.5 rounded-sm tracking-widest font-bold uppercase">
                        Pro
                    </span>
                )}
            </div>

            <p className="text-[11px] font-mono text-claude-secondary mt-2 tracking-wide px-4 md:px-0">
                {subtitle}
            </p>
        </div>
    );
}

// ─── Theme Section ────────────────────────────────────────────────────────────

function ThemeSection({ title, subtitle, themes, activeThemeId, onSelect, isCustom, onEdit, onDelete, isPro, onCreateNew, carouselIndex, onCarouselScroll }) {
    if (themes.length === 0 && !isCustom) return null;

    if (themes.length === 0 && isCustom) {
        return (
            <section className="relative w-full px-4 md:px-0">
                <SectionDivider title={title} subtitle={subtitle} isPro={isPro} />
                <EmptyGallery onCreateNew={onCreateNew} />
            </section>
        );
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };

    const item = {
        hidden: { opacity: 0, scale: 0.95, x: 20 },
        show: { opacity: 1, scale: 1, x: 0, transition: { type: 'spring', damping: 25, stiffness: 180 } }
    };

    const handleScroll = (e) => {
        if (!onCarouselScroll) return;
        const el = e.currentTarget;
        const cardWidth = el.scrollWidth / themes.length;
        const index = Math.round(el.scrollLeft / cardWidth);
        onCarouselScroll(Math.min(index, themes.length - 1));
    };

    return (
        <section className="relative w-full">
            <SectionDivider title={title} subtitle={subtitle} isPro={isPro} />

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                onScroll={handleScroll}
                className="flex md:grid md:grid-cols-2 lg:grid-cols-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none gap-6 lg:gap-10 xl:gap-14 pt-6 md:pt-12 pb-6 px-4 md:px-0 -mx-4 md:mx-0 [&::-webkit-scrollbar]:hidden"
            >
                {themes.map((theme) => (
                    <motion.div
                        key={theme.id}
                        variants={item}
                        className="snap-center md:snap-align-none shrink-0 w-[80vw] md:w-auto md:shrink md:[&:nth-child(even)]:mt-16 lg:[&:nth-child(even)]:mt-0 lg:[&:nth-child(3n+2)]:mt-24 lg:[&:nth-child(3n+3)]:mt-12"
                    >
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

            {/* Pagination dots — mobile only */}
            {themes.length > 1 && (
                <div className="flex md:hidden items-center justify-center gap-2 pb-8 pt-2">
                    {themes.map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                width: i === carouselIndex ? 20 : 6,
                                opacity: i === carouselIndex ? 1 : 0.3
                            }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="h-1.5 rounded-full bg-claude-accent"
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ theme, isActive, onSelect, onEdit, onDelete, isCustom }) {
    return (
        <motion.div
            onClick={onSelect}
            whileHover={!isActive ? { y: -12, scale: 1.02 } : {}}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="group relative overflow-hidden rounded-[2.5rem] p-7 cursor-pointer h-[30rem] md:h-[34rem] flex flex-col justify-between select-none"
            style={{
                backgroundColor: theme.bg_color,
                border: isActive ? `2px solid ${theme.accent_color}` : `1px solid ${theme.border_color}`,
                boxShadow: isActive
                    ? `0 30px 60px -15px ${theme.accent_color}50, inset 0 0 0 1px ${theme.border_color}40`
                    : `0 10px 40px -20px ${theme.text_color}10`,
                zIndex: isActive ? 20 : 10
            }}
        >
            {/* Noise texture overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.22] rounded-[2.5rem]" style={{ backgroundImage: NOISE_SVG }} />

            {/* Active accent bloom */}
            {isActive && (
                <div
                    className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-30"
                    style={{ backgroundColor: theme.accent_color }}
                />
            )}

            {/* ── TOP ── */}
            <div className="relative z-10">
                {/* Font label + active badge */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] opacity-40" style={{ color: theme.text_color }}>
                        {theme.font_family_display.split(' ')[0]}
                    </span>
                    {isActive && (
                        <motion.div
                            layoutId="activeThemeBadge"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: `${theme.accent_color}20`, border: `1px solid ${theme.accent_color}40` }}
                        >
                            <motion.span
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: theme.accent_color, boxShadow: `0 0 6px ${theme.accent_color}` }}
                            />
                            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.3em]" style={{ color: theme.accent_color }}>
                                On Display
                            </span>
                        </motion.div>
                    )}
                </div>

                {/* Theme name */}
                <h3
                    className="text-4xl tracking-tight leading-[1.05] font-light"
                    style={{ color: theme.text_color, fontFamily: `${theme.font_family_display}, serif` }}
                >
                    {theme.name}
                </h3>

                {/* Watermark glyph */}
                <div
                    className="text-[8rem] opacity-[0.03] absolute -right-4 -top-8 pointer-events-none select-none font-bold leading-none"
                    style={{ color: theme.text_color, fontFamily: `${theme.font_family_display}, serif` }}
                    aria-hidden="true"
                >
                    Aa
                </div>
            </div>

            {/* ── MIDDLE MOCKUP ── */}
            <div className="relative flex-1 flex flex-col justify-center my-6 z-10">
                <div
                    className="w-full rounded-[1.5rem] overflow-hidden relative"
                    style={{
                        backgroundColor: theme.surface_color,
                        border: `1px solid ${theme.border_color}`,
                        boxShadow: isActive
                            ? `0 8px 32px -8px ${theme.accent_color}30`
                            : `0 4px 16px -4px ${theme.text_color}10`,
                        height: '9.5rem'
                    }}
                >
                    {/* Inner glow on active */}
                    {isActive && (
                        <div
                            className="absolute inset-0 rounded-[1.5rem] pointer-events-none"
                            style={{ boxShadow: `inset 0 0 24px ${theme.accent_color}18` }}
                        />
                    )}

                    {/* Mini header bar */}
                    <div
                        className="flex items-center gap-2 px-4 py-2.5"
                        style={{ backgroundColor: `${theme.bg_color}CC`, borderBottom: `1px solid ${theme.border_color}` }}
                    >
                        <div className="w-4 h-4 rounded-full opacity-60" style={{ backgroundColor: theme.secondary_text_color }} />
                        <div className="h-2 rounded-full flex-1 opacity-20" style={{ backgroundColor: theme.text_color, maxWidth: '60%' }} />
                        <div className="h-3.5 w-10 rounded opacity-50" style={{ backgroundColor: theme.accent_color }} />
                    </div>

                    {/* Content area */}
                    <div className="px-4 pt-3 space-y-2.5">
                        <div className="h-3 rounded-full w-4/5 opacity-40" style={{ backgroundColor: theme.text_color }} />
                        <div className="h-2 rounded-full w-full opacity-15" style={{ backgroundColor: theme.text_color }} />
                        <div className="h-2 rounded-full w-3/4 opacity-12" style={{ backgroundColor: theme.text_color }} />
                    </div>

                    {/* Accent pill */}
                    <div className="absolute bottom-3 left-4">
                        <div className="h-5 w-16 rounded-full opacity-90" style={{ backgroundColor: theme.accent_color }} />
                    </div>
                </div>
            </div>

            {/* ── BOTTOM ── */}
            <div className="relative z-10 flex items-end justify-between">
                {/* Palette dots */}
                <div className="flex items-center gap-2">
                    {[theme.bg_color, theme.surface_color, theme.border_color, theme.accent_color, theme.text_color].map((c, i) => (
                        <div
                            key={i}
                            className="w-5 h-5 rounded-full border-2 shadow-sm"
                            style={{
                                backgroundColor: c,
                                borderColor: `${theme.bg_color}80`,
                                boxShadow: `0 2px 6px ${c}40`
                            }}
                        />
                    ))}
                </div>

                {/* Custom actions */}
                {isCustom && (
                    <div className="flex gap-2 opacity-100 md:opacity-0 md:translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-[transform,opacity] duration-500">
                        <button
                            onClick={(e) => onEdit(e, theme)}
                            className="w-11 h-11 rounded-full flex items-center justify-center border hover:scale-110 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-sm"
                            style={{ color: theme.text_color, backgroundColor: `${theme.surface_color}E6`, borderColor: theme.border_color }}
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => onDelete(e, theme)}
                            className="w-11 h-11 rounded-full flex items-center justify-center border hover:scale-110 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] text-red-400 shadow-sm"
                            style={{ backgroundColor: `${theme.surface_color}E6`, borderColor: theme.border_color }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Inner rim */}
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none" />
        </motion.div>
    );
}

// ─── Empty Gallery ────────────────────────────────────────────────────────────

function EmptyGallery({ onCreateNew }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
            className="relative flex flex-col items-center justify-center py-20 px-8 text-center rounded-[2.5rem]"
            style={{
                border: '1.5px dashed var(--border-color)',
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--surface-color) 60%, transparent), transparent)'
            }}
        >
            <div
                className="text-6xl font-light italic opacity-10 mb-6 select-none"
                aria-hidden="true"
                style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", serif', color: 'var(--accent-color)' }}
            >
                ✦
            </div>

            <h3
                className="text-3xl font-light italic tracking-tight text-claude-text mb-3"
                style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", serif' }}
            >
                Your gallery awaits.
            </h3>

            <p className="text-[11px] font-mono text-claude-secondary tracking-wide mb-8 max-w-xs">
                Craft a theme that is unmistakably yours.
            </p>

            <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onCreateNew}
                className="flex items-center gap-3 px-8 py-4 rounded-full font-bold text-sm border"
                style={{
                    color: 'var(--accent-color)',
                    borderColor: 'var(--accent-color)',
                    backgroundColor: 'color-mix(in srgb, var(--accent-color) 8%, transparent)'
                }}
            >
                <Plus className="w-4 h-4" />
                Begin Creating
            </motion.button>
        </motion.div>
    );
}
