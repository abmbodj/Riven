import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Check, Plus, X } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export default function ThemeSettings() {
    const { themes, activeTheme, switchTheme, addTheme } = useTheme();
    const toast = useToast();
    const [showCreator, setShowCreator] = useState(false);
    const [newTheme, setNewTheme] = useState({
        name: '',
        bg_color: '#1a1a18',
        surface_color: '#242422',
        text_color: '#e8e8e3',
        secondary_text_color: '#a1a19a',
        border_color: '#3d3d3a',
        accent_color: '#d97757'
    });

    const handleSwitchTheme = async (themeId) => {
        await switchTheme(themeId);
        toast.success('Theme applied');
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newTheme.name) return;
        await addTheme(newTheme);
        setShowCreator(false);
        toast.success('Theme created!');
        setNewTheme({
            name: '',
            bg_color: '#1a1a18',
            surface_color: '#242422',
            text_color: '#e8e8e3',
            secondary_text_color: '#a1a19a',
            border_color: '#3d3d3a',
            accent_color: '#d97757'
        });
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-6">
                <h1 className="text-2xl font-display font-bold mb-1">Themes</h1>
                <p className="text-claude-secondary text-sm">Personalize your experience</p>
            </div>

            <div className="space-y-3 mb-6">
                {themes.map(theme => (
                    <button
                        key={theme.id}
                        onClick={() => handleSwitchTheme(theme.id)}
                        className={`claude-card p-4 w-full text-left flex items-center gap-4 active:scale-[0.98] transition-transform ${activeTheme?.id === theme.id ? 'ring-2 ring-claude-accent border-transparent' : ''}`}
                    >
                        <div className="flex gap-1.5 shrink-0">
                            <div className="w-6 h-6 rounded-full border border-claude-border" style={{ backgroundColor: theme.bg_color }}></div>
                            <div className="w-6 h-6 rounded-full border border-claude-border" style={{ backgroundColor: theme.accent_color }}></div>
                        </div>
                        <span className="font-semibold flex-1">{theme.name}</span>
                        {activeTheme?.id === theme.id && (
                            <div className="bg-claude-accent text-white p-1 rounded-full shrink-0">
                                <Check className="w-3 h-3" />
                            </div>
                        )}
                    </button>
                ))}

                <button
                    onClick={() => setShowCreator(true)}
                    className="border-2 border-dashed border-claude-border rounded-2xl p-6 w-full flex items-center justify-center gap-2 text-claude-secondary active:bg-claude-surface transition-all active:scale-95 mb-8"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-semibold">Create Custom</span>
                </button>
            </div>

            {showCreator && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end">
                    <form onSubmit={handleCreate} className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-display font-bold">New Theme</h3>
                            <button type="button" onClick={() => setShowCreator(false)} className="p-2">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Name</label>
                                <input
                                    type="text"
                                    value={newTheme.name}
                                    onChange={e => setNewTheme({ ...newTheme, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                                    placeholder="e.g., Ocean Blue"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Background', key: 'bg_color' },
                                    { label: 'Surface', key: 'surface_color' },
                                    { label: 'Text', key: 'text_color' },
                                    { label: 'Secondary', key: 'secondary_text_color' },
                                    { label: 'Border', key: 'border_color' },
                                    { label: 'Accent', key: 'accent_color' }
                                ].map(field => (
                                    <div key={field.key} className="flex items-center gap-3 bg-claude-bg rounded-xl p-3">
                                        <input
                                            type="color"
                                            value={newTheme[field.key]}
                                            onChange={e => setNewTheme({ ...newTheme, [field.key]: e.target.value })}
                                            className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer shrink-0"
                                        />
                                        <span className="text-xs font-medium text-claude-secondary">{field.label}</span>
                                    </div>
                                ))}
                            </div>

                            <button type="submit" className="w-full claude-button-primary py-4 mt-4">Save Theme</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
