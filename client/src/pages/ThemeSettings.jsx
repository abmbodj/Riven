import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Check, Plus, X, Trash2, Edit3, Sun, Moon, Palette, ChevronRight } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import useHaptics from '../hooks/useHaptics';

// Default theme presets
const DEFAULT_DARK = {
    name: 'Dark',
    bg_color: '#1a1a18',
    surface_color: '#242422',
    text_color: '#e8e8e3',
    secondary_text_color: '#a1a19a',
    border_color: '#3d3d3a',
    accent_color: '#d97757'
};

const DEFAULT_LIGHT = {
    name: 'Light',
    bg_color: '#fafaf9',
    surface_color: '#ffffff',
    text_color: '#1c1c1a',
    secondary_text_color: '#6b6b66',
    border_color: '#e5e5e2',
    accent_color: '#d97757'
};

// Color preset palettes
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
    const [editorMode, setEditorMode] = useState('simple'); // 'simple' or 'advanced'
    
    const [themeForm, setThemeForm] = useState({
        name: '',
        bg_color: '#1a1a18',
        surface_color: '#242422',
        text_color: '#e8e8e3',
        secondary_text_color: '#a1a19a',
        border_color: '#3d3d3a',
        accent_color: '#d97757'
    });

    const handleSwitchTheme = async (themeId) => {
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
            accent_color: theme.accent_color
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
            toast.error(err.message || 'Failed to delete theme');
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
            toast.error(err.message || 'Failed to save theme');
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

    const applyAccentColor = (color) => {
        setThemeForm(prev => ({ ...prev, accent_color: color }));
    };

    // Separate default and custom themes
    const defaultThemes = themes.filter(t => t.is_default);
    const customThemes = themes.filter(t => !t.is_default);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-6">
                <h1 className="text-2xl font-display font-bold mb-1">Themes</h1>
                <p className="text-claude-secondary text-sm">Customize your app's appearance</p>
            </div>

            {/* Default Themes Section */}
            {defaultThemes.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">Default Themes</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {defaultThemes.map(theme => (
                            <ThemeCard
                                key={theme.id}
                                theme={theme}
                                isActive={activeTheme?.id === theme.id}
                                onSelect={() => handleSwitchTheme(theme.id)}
                                icon={theme.name.toLowerCase().includes('light') ? Sun : Moon}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Custom Themes Section */}
            <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">
                    {customThemes.length > 0 ? 'Your Themes' : 'Create Your Theme'}
                </h2>
                
                {customThemes.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {customThemes.map(theme => (
                            <div
                                key={theme.id}
                                onClick={() => handleSwitchTheme(theme.id)}
                                className={`p-4 rounded-2xl bg-claude-surface border transition-all cursor-pointer active:scale-[0.98] ${
                                    activeTheme?.id === theme.id 
                                        ? 'border-claude-accent ring-2 ring-claude-accent/20' 
                                        : 'border-claude-border hover:border-claude-accent/50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Color Preview */}
                                    <div className="flex -space-x-1">
                                        <div 
                                            className="w-7 h-7 rounded-full border-2 border-claude-bg" 
                                            style={{ backgroundColor: theme.bg_color }}
                                        />
                                        <div 
                                            className="w-7 h-7 rounded-full border-2 border-claude-bg" 
                                            style={{ backgroundColor: theme.accent_color }}
                                        />
                                    </div>
                                    
                                    <span className="font-semibold flex-1 truncate">{theme.name}</span>
                                    
                                    {activeTheme?.id === theme.id && (
                                        <div className="w-6 h-6 bg-claude-accent rounded-full flex items-center justify-center shrink-0">
                                            <Check className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={(e) => handleEditTheme(e, theme)}
                                        className="p-2 text-claude-secondary hover:text-claude-accent active:scale-90 transition-all rounded-lg"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    
                                    <button
                                        onClick={(e) => handleDeleteClick(e, theme)}
                                        className="p-2 text-claude-secondary hover:text-red-500 active:scale-90 transition-all rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    onClick={handleCreateNew}
                    className="w-full p-4 border-2 border-dashed border-claude-border rounded-2xl flex items-center justify-center gap-2 text-claude-secondary hover:text-claude-accent hover:border-claude-accent/50 active:scale-[0.98] transition-all"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-semibold">Create Custom Theme</span>
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title={`Delete '${deleteConfirm.theme?.name}'?`}
                message="This theme will be permanently removed."
                confirmText="Delete"
                cancelText="Cancel"
                destructive={true}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ show: false, theme: null })}
            />

            {/* Theme Editor Modal */}
            {showEditor && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowEditor(false);
                    }}
                >
                    <form 
                        onSubmit={handleSaveTheme} 
                        className="bg-claude-surface w-full rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-claude-border shrink-0">
                            <h3 className="text-lg font-display font-bold">
                                {editingTheme ? 'Edit Theme' : 'New Theme'}
                            </h3>
                            <button 
                                type="button" 
                                onClick={() => setShowEditor(false)} 
                                className="p-2 -mr-2 active:bg-claude-bg rounded-full"
                            >
                                <X className="w-5 h-5 text-claude-secondary" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                            {/* Theme Name */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                    Theme Name
                                </label>
                                <input
                                    type="text"
                                    value={themeForm.name}
                                    onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none text-base"
                                    placeholder="My Custom Theme"
                                    required
                                />
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-claude-bg rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setEditorMode('simple')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                        editorMode === 'simple' 
                                            ? 'bg-claude-accent text-white' 
                                            : 'text-claude-secondary'
                                    }`}
                                >
                                    Simple
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditorMode('advanced')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                        editorMode === 'advanced' 
                                            ? 'bg-claude-accent text-white' 
                                            : 'text-claude-secondary'
                                    }`}
                                >
                                    Advanced
                                </button>
                            </div>

                            {editorMode === 'simple' ? (
                                <>
                                    {/* Base Theme Selection */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                            Base Theme
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => applyBaseTheme('dark')}
                                                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                                    themeForm.bg_color === DEFAULT_DARK.bg_color
                                                        ? 'border-claude-accent bg-claude-accent/10'
                                                        : 'border-claude-border hover:border-claude-accent/50'
                                                }`}
                                            >
                                                <div className="w-10 h-10 rounded-full bg-[#1a1a18] border border-[#3d3d3a] flex items-center justify-center">
                                                    <Moon className="w-5 h-5 text-[#e8e8e3]" />
                                                </div>
                                                <span className="font-medium">Dark</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyBaseTheme('light')}
                                                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                                    themeForm.bg_color === DEFAULT_LIGHT.bg_color
                                                        ? 'border-claude-accent bg-claude-accent/10'
                                                        : 'border-claude-border hover:border-claude-accent/50'
                                                }`}
                                            >
                                                <div className="w-10 h-10 rounded-full bg-[#fafaf9] border border-[#e5e5e2] flex items-center justify-center">
                                                    <Sun className="w-5 h-5 text-[#1c1c1a]" />
                                                </div>
                                                <span className="font-medium">Light</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Accent Color Selection */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                            Accent Color
                                        </label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {ACCENT_PRESETS.map(preset => (
                                                <button
                                                    key={preset.color}
                                                    type="button"
                                                    onClick={() => applyAccentColor(preset.color)}
                                                    className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
                                                        themeForm.accent_color === preset.color
                                                            ? 'border-claude-text scale-95'
                                                            : 'border-transparent hover:scale-95'
                                                    }`}
                                                    style={{ backgroundColor: preset.color }}
                                                >
                                                    {themeForm.accent_color === preset.color && (
                                                        <Check className="w-5 h-5 text-white drop-shadow-md" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {/* Custom Color Picker */}
                                        <div className="mt-3 flex items-center gap-3 p-3 bg-claude-bg rounded-xl">
                                            <input
                                                type="color"
                                                value={themeForm.accent_color}
                                                onChange={e => setThemeForm({ ...themeForm, accent_color: e.target.value })}
                                                className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer shrink-0"
                                            />
                                            <div className="flex-1">
                                                <span className="text-sm font-medium">Custom Color</span>
                                                <p className="text-xs text-claude-secondary">{themeForm.accent_color.toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Advanced Mode - All Color Pickers */
                                <div className="space-y-3">
                                    {[
                                        { label: 'Background', key: 'bg_color', desc: 'Main app background' },
                                        { label: 'Surface', key: 'surface_color', desc: 'Cards and elevated elements' },
                                        { label: 'Text', key: 'text_color', desc: 'Primary text color' },
                                        { label: 'Secondary Text', key: 'secondary_text_color', desc: 'Muted text and labels' },
                                        { label: 'Border', key: 'border_color', desc: 'Dividers and outlines' },
                                        { label: 'Accent', key: 'accent_color', desc: 'Buttons and highlights' }
                                    ].map(field => (
                                        <div key={field.key} className="flex items-center gap-3 p-3 bg-claude-bg rounded-xl">
                                            <input
                                                type="color"
                                                value={themeForm[field.key]}
                                                onChange={e => setThemeForm({ ...themeForm, [field.key]: e.target.value })}
                                                className="w-12 h-12 rounded-lg bg-transparent border-none cursor-pointer shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-semibold block">{field.label}</span>
                                                <span className="text-xs text-claude-secondary">{field.desc}</span>
                                            </div>
                                            <span className="text-xs font-mono text-claude-secondary shrink-0">
                                                {themeForm[field.key].toUpperCase()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Live Preview */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                    Preview
                                </label>
                                <div 
                                    className="rounded-2xl border overflow-hidden"
                                    style={{ 
                                        backgroundColor: themeForm.bg_color,
                                        borderColor: themeForm.border_color 
                                    }}
                                >
                                    <div 
                                        className="p-4"
                                        style={{ backgroundColor: themeForm.surface_color }}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div 
                                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: themeForm.accent_color }}
                                            >
                                                <Palette className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: themeForm.text_color }}>
                                                    {themeForm.name || 'Theme Name'}
                                                </p>
                                                <p className="text-xs" style={{ color: themeForm.secondary_text_color }}>
                                                    Preview of your theme
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
                                            style={{ backgroundColor: themeForm.accent_color }}
                                        >
                                            Sample Button
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-claude-border shrink-0 bg-claude-surface">
                            <button 
                                type="submit" 
                                className="w-full claude-button-primary py-3.5 text-base"
                            >
                                {editingTheme ? 'Save Changes' : 'Create Theme'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

// Theme Card Component for Default Themes
function ThemeCard({ theme, isActive, onSelect, icon: Icon }) {
    return (
        <button
            onClick={onSelect}
            className={`p-4 rounded-2xl border-2 transition-all text-left active:scale-[0.97] ${
                isActive 
                    ? 'border-claude-accent bg-claude-accent/5' 
                    : 'border-claude-border bg-claude-surface hover:border-claude-accent/50'
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ 
                        backgroundColor: theme.bg_color,
                        border: `2px solid ${theme.border_color}`
                    }}
                >
                    <Icon className="w-5 h-5" style={{ color: theme.text_color }} />
                </div>
                {isActive && (
                    <div className="w-6 h-6 bg-claude-accent rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                )}
            </div>
            <p className="font-semibold text-sm">{theme.name}</p>
            <div className="flex gap-1 mt-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.bg_color, border: `1px solid ${theme.border_color}` }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.surface_color, border: `1px solid ${theme.border_color}` }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.accent_color }} />
            </div>
        </button>
    );
}
