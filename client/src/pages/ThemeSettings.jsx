import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { Check, Plus, Palette, Trash2 } from 'lucide-react';

export default function ThemeSettings() {
    const { themes, activeTheme, switchTheme, addTheme } = useTheme();
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

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newTheme.name) return;
        await addTheme(newTheme);
        setShowCreator(false);
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
        <div className="max-w-2xl mx-auto animate-in fade-in duration-700">
            <div className="mb-10">
                <h1 className="text-4xl font-display font-bold mb-3">Themes</h1>
                <p className="text-claude-secondary text-lg">Personalize your Riven experience.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-12">
                {themes.map(theme => (
                    <button
                        key={theme.id}
                        onClick={() => switchTheme(theme.id)}
                        className={`claude-card p-5 text-left transition-all relative group ${activeTheme?.id === theme.id ? 'ring-2 ring-claude-accent border-transparent' : 'hover:border-claude-text/20'}`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className="font-display font-bold text-lg">{theme.name}</span>
                            {activeTheme?.id === theme.id && (
                                <div className="bg-claude-accent text-white p-1 rounded-full">
                                    <Check className="w-3 h-3" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-6 h-6 rounded-full border border-claude-border" style={{ backgroundColor: theme.bg_color }}></div>
                            <div className="w-6 h-6 rounded-full border border-claude-border" style={{ backgroundColor: theme.surface_color }}></div>
                            <div className="w-6 h-6 rounded-full border border-claude-border" style={{ backgroundColor: theme.text_color }}></div>
                            <div className="w-6 h-6 rounded-full border border-claude-border" style={{ backgroundColor: theme.accent_color }}></div>
                        </div>
                    </button>
                ))}

                <button
                    onClick={() => setShowCreator(true)}
                    className="border-2 border-dashed border-claude-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-claude-secondary hover:bg-claude-surface transition-all group"
                >
                    <Plus className="w-6 h-6 text-claude-secondary group-hover:text-claude-text" />
                    <span className="font-medium text-claude-secondary group-hover:text-claude-text">Create Custom Theme</span>
                </button>
            </div>

            {showCreator && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <form onSubmit={handleCreate} className="bg-claude-surface w-full max-w-lg p-8 rounded-3xl shadow-2xl border border-claude-border animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-display font-bold">New Theme</h3>
                            <button type="button" onClick={() => setShowCreator(false)} className="p-2 hover:bg-claude-bg rounded-full transition-colors">
                                <Check className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Theme Name</label>
                                <input
                                    type="text"
                                    value={newTheme.name}
                                    onChange={e => setNewTheme({ ...newTheme, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none transition-all"
                                    placeholder="e.g., Midnight Neon"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Background', key: 'bg_color' },
                                    { label: 'Surface', key: 'surface_color' },
                                    { label: 'Text', key: 'text_color' },
                                    { label: 'Secondary Text', key: 'secondary_text_color' },
                                    { label: 'Border', key: 'border_color' },
                                    { label: 'Accent', key: 'accent_color' }
                                ].map(field => (
                                    <div key={field.key}>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-1.5">{field.label}</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={newTheme[field.key]}
                                                onChange={e => setNewTheme({ ...newTheme, [field.key]: e.target.value })}
                                                className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={newTheme[field.key]}
                                                onChange={e => setNewTheme({ ...newTheme, [field.key]: e.target.value })}
                                                className="flex-1 px-2 py-1.5 bg-claude-bg border border-claude-border rounded text-xs font-mono outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button type="submit" className="claude-button-primary w-full py-3 text-lg mt-4">Save & Apply Theme</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
