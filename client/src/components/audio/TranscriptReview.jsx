import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

const formatTimestamp = (milliseconds = 0) => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function TranscriptReview({ segments = [], onCorrect }) {
    const [query, setQuery] = useState('');
    const [drafts, setDrafts] = useState({});
    const normalizedQuery = query.trim().toLowerCase();
    const visibleSegments = useMemo(() => segments.filter((segment) => {
        const text = drafts[segment.id] ?? segment.correctedText ?? segment.text ?? segment.original_text ?? '';
        return !normalizedQuery || text.toLowerCase().includes(normalizedQuery);
    }), [drafts, normalizedQuery, segments]);

    const valueFor = (segment) => drafts[segment.id]
        ?? segment.correctedText
        ?? segment.corrected_text
        ?? segment.text
        ?? segment.original_text
        ?? '';

    return (
        <section aria-label="Transcript review" className="mb-4 rounded-2xl border border-claude-border/35 bg-claude-surface/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-claude-accent">Transcript</p>
                    <p className="mt-1 text-[11px] text-claude-secondary">Corrections improve this class’s vocabulary memory.</p>
                </div>
                <label className="flex min-h-10 items-center gap-2 rounded-xl border border-claude-border/50 px-3">
                    <Search className="h-3.5 w-3.5 text-claude-secondary" />
                    <span className="sr-only">Search transcript</span>
                    <input
                        type="search"
                        aria-label="Search transcript"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search transcript"
                        className="w-40 bg-transparent text-[12px] text-claude-text outline-none placeholder:text-claude-secondary/60"
                    />
                </label>
            </div>

            <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
                {visibleSegments.map((segment) => {
                    const timestamp = formatTimestamp(segment.startMs ?? segment.started_at_ms ?? 0);
                    const text = valueFor(segment);
                    const originalText = segment.original_text || segment.text || '';
                    return (
                        <article key={segment.id || segment.provider_segment_id} className="rounded-xl border border-claude-border/25 bg-claude-bg/25 p-2.5">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="font-mono text-[9px] tabular-nums text-claude-accent">{timestamp}</span>
                                <label className="ml-auto">
                                    <span className="sr-only">Speaker for {timestamp}</span>
                                    <select
                                        aria-label={`Speaker for ${timestamp}`}
                                        value={segment.speakerRole || segment.speaker_role || ''}
                                        onChange={(event) => onCorrect?.({
                                            ...segment,
                                            id: segment.id || segment.provider_segment_id,
                                            originalText,
                                            correctedText: text,
                                            speakerRole: event.target.value || null,
                                        })}
                                        className="rounded-lg border border-claude-border/40 bg-claude-surface px-2 py-1 text-[10px] text-claude-text outline-none"
                                    >
                                        <option value="">Speaker {segment.speaker ?? segment.speaker_key ?? '?'}</option>
                                        <option value="Instructor">Instructor</option>
                                        <option value="Student">Student</option>
                                        <option value="Guest">Guest</option>
                                    </select>
                                </label>
                            </div>
                            <textarea
                                value={text}
                                onChange={(event) => setDrafts((current) => ({ ...current, [segment.id]: event.target.value }))}
                                onBlur={() => {
                                    if (text.trim() === originalText.trim() && !segment.correctedText && !segment.corrected_text) return;
                                    onCorrect?.({
                                        ...segment,
                                        id: segment.id || segment.provider_segment_id,
                                        originalText,
                                        correctedText: text.trim(),
                                        speakerRole: segment.speakerRole || segment.speaker_role || null,
                                    });
                                }}
                                aria-label={`Transcript at ${timestamp}`}
                                rows={2}
                                className="w-full resize-y bg-transparent text-[12px] leading-relaxed text-claude-text outline-none"
                            />
                        </article>
                    );
                })}
                {visibleSegments.length === 0 && (
                    <p className="py-6 text-center text-[12px] text-claude-secondary">No transcript matches that search.</p>
                )}
            </div>
        </section>
    );
}
