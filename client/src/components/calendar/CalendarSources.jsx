import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, X, Check } from 'lucide-react';
import { api } from '../../api';

const CLASS_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6',
    '#7a9e72', '#b8a379', '#c47c7c', '#5e7b8f',
];

function formatSyncedAt(dateStr) {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function CalendarSources({ onSyncComplete, toast }) {
    const [sources, setSources] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formLabel, setFormLabel] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formColor, setFormColor] = useState(CLASS_COLORS[5]);
    const [saving, setSaving] = useState(false);
    const [syncingId, setSyncingId] = useState(null);

    const loadSources = useCallback(async () => {
        try {
            const data = await api.getCalendarSources();
            setSources(data || []);
        } catch (err) {
            console.error('Failed to load calendar sources', err);
        }
    }, []);

    useEffect(() => {
        loadSources();
    }, [loadSources]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formLabel.trim() || !formUrl.trim()) return;

        setSaving(true);
        try {
            await api.addCalendarSource({ label: formLabel.trim(), url: formUrl.trim(), color: formColor, type: 'ical' });
            setFormLabel('');
            setFormUrl('');
            setFormColor(CLASS_COLORS[5]);
            setShowForm(false);
            await loadSources();
            toast?.success('Calendar source added.');
        } catch (err) {
            toast?.error(err?.message || 'Failed to add calendar source.');
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async (id) => {
        setSyncingId(id);
        try {
            const result = await api.syncCalendarSource(id);
            toast?.success(`Synced ${result?.eventsAdded ?? 0} new events.`);
            await loadSources();
            onSyncComplete?.();
        } catch (err) {
            toast?.error(err?.message || 'Sync failed. Check the URL and try again.');
        } finally {
            setSyncingId(null);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteCalendarSource(id);
            setSources(prev => prev.filter(s => s.id !== id));
            toast?.success('Calendar source removed.');
            onSyncComplete?.();
        } catch (err) {
            toast?.error(err?.message || 'Failed to remove calendar source.');
        }
    };

    return (
        <div className="mt-8 pt-6 border-t border-claude-border/30">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-claude-secondary">
                        External Calendars
                    </h2>
                    <p className="font-mono text-[9px] text-claude-secondary/60 mt-0.5">
                        Import iCal feeds (Google, Apple, Outlook, etc.)
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass-panel rounded-xl font-mono text-[10px] uppercase font-bold tracking-widest text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                >
                    {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showForm ? 'Cancel' : 'Add'}
                </button>
            </div>

            {/* Add form */}
            {showForm && (
                <form onSubmit={handleAdd} className="mb-4 p-4 glass-panel rounded-2xl space-y-3">
                    <div>
                        <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-1">
                            Label
                        </label>
                        <input
                            type="text"
                            value={formLabel}
                            onChange={e => setFormLabel(e.target.value)}
                            placeholder="e.g. Work Calendar"
                            className="w-full bg-transparent border border-claude-border rounded-xl px-3 py-2 font-mono text-sm text-claude-text placeholder:text-claude-secondary/40 focus:outline-none focus:border-claude-accent transition-colors"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-1">
                            iCal URL
                        </label>
                        <input
                            type="url"
                            value={formUrl}
                            onChange={e => setFormUrl(e.target.value)}
                            placeholder="https://calendar.google.com/calendar/ical/..."
                            className="w-full bg-transparent border border-claude-border rounded-xl px-3 py-2 font-mono text-xs text-claude-text placeholder:text-claude-secondary/40 focus:outline-none focus:border-claude-accent transition-colors"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-2">
                            Color
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {CLASS_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setFormColor(c)}
                                    className="w-6 h-6 rounded-full border-2 transition-transform tap-action cursor-pointer flex items-center justify-center"
                                    style={{
                                        backgroundColor: c,
                                        borderColor: formColor === c ? 'white' : 'transparent',
                                        transform: formColor === c ? 'scale(1.2)' : 'scale(1)',
                                    }}
                                >
                                    {formColor === c && <Check className="w-3 h-3 text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving || !formLabel.trim() || !formUrl.trim()}
                        className="w-full py-2.5 bg-claude-accent/20 border border-claude-accent/30 text-claude-accent rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold tap-action hover:bg-claude-accent hover:text-claude-text transition-colors disabled:opacity-40 cursor-pointer"
                    >
                        {saving ? 'Adding...' : 'Add Calendar'}
                    </button>
                </form>
            )}

            {/* Sources list */}
            {sources.length === 0 && !showForm && (
                <p className="font-serif italic text-claude-secondary opacity-40 text-sm text-center py-4">
                    No external calendars added yet.
                </p>
            )}

            {sources.length > 0 && (
                <div className="space-y-2">
                    {sources.map(source => (
                        <div
                            key={source.id}
                            className="flex items-center gap-3 p-3 glass-panel rounded-2xl"
                        >
                            <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: source.color || '#6366f1' }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-claude-text truncate">
                                    {source.label}
                                </p>
                                <p className="font-mono text-[9px] text-claude-secondary/60 mt-0.5">
                                    Synced: {formatSyncedAt(source.last_synced_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => handleSync(source.id)}
                                disabled={syncingId === source.id}
                                aria-label={`Sync ${source.label}`}
                                className="w-8 h-8 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer disabled:opacity-40"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncingId === source.id ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => handleDelete(source.id)}
                                aria-label={`Remove ${source.label}`}
                                className="w-8 h-8 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-red-400 transition-colors tap-action cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
