import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpFromLine, Check, FileUp, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
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

async function readIcsFile(file) {
    if (!file) return null;
    const text = await file.text();
    return {
        fileName: file.name,
        icsText: text,
    };
}

export default function CalendarSources({ onSyncComplete, toast }) {
    const [sources, setSources] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [importMethod, setImportMethod] = useState('url');
    const [formLabel, setFormLabel] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formColor, setFormColor] = useState(CLASS_COLORS[5]);
    const [formFile, setFormFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [syncingId, setSyncingId] = useState(null);
    const [replacingSourceId, setReplacingSourceId] = useState(null);
    const replaceInputRef = useRef(null);

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

    const resetForm = useCallback(() => {
        setFormLabel('');
        setFormUrl('');
        setFormColor(CLASS_COLORS[5]);
        setFormFile(null);
        setImportMethod('url');
        setShowForm(false);
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formLabel.trim()) return;

        setSaving(true);
        try {
            if (importMethod === 'url') {
                if (!formUrl.trim()) return;
                await api.addCalendarSource({ label: formLabel.trim(), url: formUrl.trim(), color: formColor, type: 'ical' });
                toast?.success('Calendar feed added.');
            } else {
                const parsedFile = await readIcsFile(formFile);
                if (!parsedFile) return;
                const result = await api.importCalendarSourceFile({
                    label: formLabel.trim(),
                    color: formColor,
                    fileName: parsedFile.fileName,
                    icsText: parsedFile.icsText,
                });
                toast?.success(`Imported ${result?.eventsAdded ?? 0} calendar items.`);
            }

            resetForm();
            await loadSources();
            onSyncComplete?.();
        } catch (err) {
            toast?.error(err?.message || 'Failed to add calendar source.');
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async (source) => {
        if (source.import_mode === 'file') return;

        setSyncingId(source.id);
        try {
            const result = await api.syncCalendarSource(source.id);
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

    const beginReplace = (sourceId) => {
        setReplacingSourceId(sourceId);
        replaceInputRef.current?.click();
    };

    const handleReplaceFile = async (event) => {
        const file = event.target.files?.[0];
        const sourceId = replacingSourceId;
        event.target.value = '';

        if (!file || !sourceId) return;

        const source = sources.find((item) => item.id === sourceId);
        if (!source) {
            setReplacingSourceId(null);
            return;
        }

        setSyncingId(sourceId);
        try {
            const parsedFile = await readIcsFile(file);
            if (!parsedFile) return;

            const result = await api.replaceCalendarSourceFile({
                sourceId,
                color: source.color,
                fileName: parsedFile.fileName,
                icsText: parsedFile.icsText,
            });

            toast?.success(`Replaced file and imported ${result?.eventsAdded ?? 0} items.`);
            await loadSources();
            onSyncComplete?.();
        } catch (err) {
            toast?.error(err?.message || 'Failed to replace calendar file.');
        } finally {
            setSyncingId(null);
            setReplacingSourceId(null);
        }
    };

    const sourceHasPendingAction = syncingId !== null;

    return (
        <div className="mt-8 pt-6 border-t border-claude-border/30">
            <input
                ref={replaceInputRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                onChange={handleReplaceFile}
            />

            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-claude-secondary">
                        External Calendars
                    </h2>
                    <p className="font-mono text-[9px] text-claude-secondary/60 mt-0.5">
                        Add feed URLs or upload .ics files from Google, Apple, Outlook, and more.
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

            {showForm && (
                <form onSubmit={handleAdd} className="mb-4 p-4 glass-panel rounded-2xl space-y-3">
                    <div className="relative flex glass-panel rounded-xl p-1">
                        {[
                            { value: 'url', label: 'Feed URL' },
                            { value: 'file', label: 'Upload .ics' },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setImportMethod(option.value)}
                                className="relative flex-1 px-3 py-2 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg z-10 transition-colors tap-action cursor-pointer"
                                style={{ color: importMethod === option.value ? 'var(--text-color)' : 'var(--secondary-text-color)' }}
                            >
                                {importMethod === option.value && (
                                    <span className="absolute inset-0 bg-claude-accent rounded-lg" aria-hidden="true" />
                                )}
                                <span className="relative z-10">{option.label}</span>
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-1">
                            Label
                        </label>
                        <input
                            type="text"
                            value={formLabel}
                            onChange={e => setFormLabel(e.target.value)}
                            placeholder={importMethod === 'url' ? 'e.g. Work Calendar' : 'e.g. Spring Semester Export'}
                            className="w-full bg-transparent border border-claude-border rounded-xl px-3 py-2 font-mono text-sm text-claude-text placeholder:text-claude-secondary/40 focus:outline-none focus:border-claude-accent transition-colors"
                        />
                    </div>

                    {importMethod === 'url' ? (
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
                    ) : (
                        <div>
                            <label className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-1">
                                .ics File
                            </label>
                            <label className="flex items-center justify-between gap-3 border border-dashed border-claude-border rounded-xl px-3 py-3 cursor-pointer hover:border-claude-accent/40 transition-colors">
                                <div className="min-w-0">
                                    <p className="font-mono text-[10px] uppercase tracking-widest font-bold text-claude-secondary">
                                        {formFile ? 'File Selected' : 'Choose Calendar File'}
                                    </p>
                                    <p className="font-mono text-xs text-claude-text truncate mt-1">
                                        {formFile?.name || 'Upload an exported .ics file'}
                                    </p>
                                </div>
                                <Upload className="w-4 h-4 text-claude-accent shrink-0" />
                                <input
                                    type="file"
                                    accept=".ics,text/calendar"
                                    className="hidden"
                                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    )}

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
                        disabled={saving || !formLabel.trim() || (importMethod === 'url' ? !formUrl.trim() : !formFile)}
                        className="w-full py-2.5 bg-claude-accent/20 border border-claude-accent/30 text-claude-accent rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold tap-action hover:bg-claude-accent hover:text-claude-text transition-colors disabled:opacity-40 cursor-pointer"
                    >
                        {saving ? 'Saving...' : importMethod === 'url' ? 'Add Calendar Feed' : 'Import Calendar File'}
                    </button>
                </form>
            )}

            {sources.length === 0 && !showForm && (
                <p className="font-serif italic text-claude-secondary opacity-40 text-sm text-center py-4">
                    No external calendars added yet.
                </p>
            )}

            {sources.length > 0 && (
                <div className="space-y-2">
                    {sources.map(source => {
                        const isFileSource = source.import_mode === 'file';
                        const busy = syncingId === source.id;

                        return (
                            <div
                                key={source.id}
                                className="flex items-center gap-3 p-3 glass-panel rounded-2xl"
                            >
                                <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: source.color || '#6366f1' }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-claude-text truncate">
                                            {source.label}
                                        </p>
                                        <span className="px-2 py-0.5 rounded-full bg-claude-border/20 text-claude-secondary font-mono text-[8px] uppercase tracking-widest shrink-0">
                                            {isFileSource ? 'File' : 'URL'}
                                        </span>
                                    </div>
                                    <p className="font-mono text-[9px] text-claude-secondary/60 mt-0.5 truncate">
                                        {isFileSource ? (source.file_name || 'Uploaded .ics file') : (source.url || 'iCal feed')}
                                    </p>
                                    <p className="font-mono text-[9px] text-claude-secondary/60 mt-0.5">
                                        Synced: {formatSyncedAt(source.last_synced_at)}
                                    </p>
                                </div>

                                {isFileSource ? (
                                    <button
                                        onClick={() => beginReplace(source.id)}
                                        disabled={sourceHasPendingAction}
                                        aria-label={`Replace file for ${source.label}`}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer disabled:opacity-40"
                                    >
                                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSync(source)}
                                        disabled={sourceHasPendingAction}
                                        aria-label={`Sync ${source.label}`}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer disabled:opacity-40"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                                    </button>
                                )}

                                <button
                                    onClick={() => handleDelete(source.id)}
                                    disabled={sourceHasPendingAction}
                                    aria-label={`Remove ${source.label}`}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-red-400 transition-colors tap-action cursor-pointer disabled:opacity-40"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-claude-border/30 bg-claude-surface/50 px-3 py-2">
                <ArrowUpFromLine className="w-4 h-4 text-claude-secondary shrink-0 mt-0.5" />
                <p className="font-mono text-[9px] text-claude-secondary/70 leading-relaxed">
                    URL feeds can be synced anytime. Uploaded files are saved as sources too, but they refresh only when you replace the file with a newer export.
                </p>
            </div>
        </div>
    );
}
