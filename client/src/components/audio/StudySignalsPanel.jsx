import { Check, EyeOff, Flag, X } from 'lucide-react';

export default function StudySignalsPanel({ signals = [], onUpdate }) {
    const visible = signals.filter((signal) => signal.status !== 'dismissed');
    if (!visible.length) return null;

    return (
        <section aria-label="Study signals" className="mb-4 rounded-2xl border border-claude-accent/20 bg-claude-surface/35 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-claude-accent">
                        <Flag className="h-3.5 w-3.5" /> Study signals
                    </p>
                    <p className="mt-1 text-[11px] text-claude-secondary">Review cues are private by default and excluded when you share notes.</p>
                </div>
                <EyeOff className="h-4 w-4 shrink-0 text-claude-secondary" aria-label="Private" />
            </div>

            <div className="mt-3 space-y-2">
                {visible.map((signal) => (
                    <article key={signal.id} className="rounded-xl border border-claude-border/30 bg-claude-bg/25 p-2.5">
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-semibold text-claude-text">{signal.title}</p>
                                {signal.body && <p className="mt-1 text-[11px] leading-relaxed text-claude-secondary">{signal.body}</p>}
                                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wide text-claude-secondary">
                                    {(signal.evidence_refs || []).length} evidence {(signal.evidence_refs || []).length === 1 ? 'link' : 'links'}
                                    {' · '}{signal.share_visibility === 'included' ? 'Included when shared' : 'Private'}
                                </p>
                            </div>
                            {signal.status === 'confirmed' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-claude-accent"><Check className="h-3.5 w-3.5" /> Confirmed</span>
                            ) : (
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => onUpdate?.(signal.id, { status: 'confirmed' })}
                                        aria-label={`Confirm ${signal.title}`}
                                        className="rounded-lg p-2 text-claude-secondary hover:bg-claude-accent/10 hover:text-claude-accent"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onUpdate?.(signal.id, { status: 'dismissed' })}
                                        aria-label={`Dismiss ${signal.title}`}
                                        className="rounded-lg p-2 text-claude-secondary hover:bg-red-400/10 hover:text-red-300"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
