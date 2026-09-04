import { useState } from 'react';
import { Bookmark, ChevronDown, ChevronUp, Pause, Play, Square } from 'lucide-react';
import { formatRecordingDuration } from '../../utils/audioRecording.js';

export default function RecordingRail({ recorder, onMark }) {
    const [transcriptOpen, setTranscriptOpen] = useState(true);
    const segments = recorder.transcriptSegments || [];
    const isPaused = recorder.state === 'paused';
    const safeChunks = Math.min(recorder.uploadedChunkCount || 0, recorder.chunkCount || 0);

    return (
        <section
            aria-label="Active class recording"
            className="mb-4 overflow-hidden rounded-2xl border border-claude-accent/25 bg-claude-surface/55 shadow-[0_14px_40px_rgba(0,0,0,0.14)]"
        >
            <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                <div className="mr-auto min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${isPaused ? 'bg-amber-400' : 'animate-pulse bg-red-400'}`} />
                        <span className="font-mono text-[11px] font-bold tabular-nums text-claude-text">
                            {formatRecordingDuration(recorder.duration || 0)}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-claude-secondary">
                            {isPaused ? 'Paused' : recorder.transcriptState === 'open' ? 'Live transcript' : 'Recording locally'}
                        </span>
                    </div>
                    <p className="mt-1 font-mono text-[9px] text-claude-secondary">
                        {safeChunks} of {recorder.chunkCount || 0} chunks safe
                    </p>
                </div>

                {recorder.requiresContinuation ? (
                    <button
                        type="button"
                        onClick={recorder.continueRecording}
                        aria-label="Continue recording past four hours"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-300 px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-200"
                    >
                        <Play className="h-3.5 w-3.5" />
                        Continue
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={isPaused ? recorder.resume : recorder.pause}
                        aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-claude-border px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-claude-text hover:border-claude-accent/40"
                    >
                        {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onMark}
                    aria-label="Mark this moment"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-claude-border px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-claude-text hover:border-claude-accent/40"
                >
                    <Bookmark className="h-3.5 w-3.5" />
                    Mark
                </button>
                <button
                    type="button"
                    onClick={recorder.stop}
                    aria-label="Stop recording"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-red-400/12 px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-red-300 hover:bg-red-400/20"
                >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop
                </button>
            </div>

            {recorder.requiresContinuation ? (
                <p className="border-t border-amber-300/20 bg-amber-300/8 px-3 py-2 text-[11px] text-amber-200">
                    Four-hour safety checkpoint. Confirm Continue to keep recording, or stop now to finish this class note safely.
                </p>
            ) : recorder.duration >= 10_800 && (
                <p className="border-t border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[11px] text-amber-200">
                    This recording is over 3 hours. Keep Riven powered and check that storage and connectivity remain available.
                </p>
            )}

            <button
                type="button"
                onClick={() => setTranscriptOpen((current) => !current)}
                aria-label={transcriptOpen ? 'Hide live transcript' : 'Show live transcript'}
                className="flex w-full items-center justify-between border-t border-claude-border/30 px-3 py-2 text-left font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-claude-secondary hover:text-claude-text"
            >
                <span>Live transcript · {segments.length} segments</span>
                {transcriptOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {transcriptOpen && (
                <div aria-live="polite" className="max-h-48 space-y-2 overflow-y-auto border-t border-claude-border/20 px-3 py-3">
                    {segments.length === 0 ? (
                        <p className="text-[12px] text-claude-secondary">Listening… transcript appears as your class speaks.</p>
                    ) : segments.slice(-12).map((segment) => (
                        <p key={segment.id} className={`text-[12px] leading-relaxed ${segment.isFinal ? 'text-claude-text' : 'text-claude-secondary'}`}>
                            {segment.speaker != null && (
                                <span className="mr-1.5 font-mono text-[9px] uppercase tracking-wide text-claude-accent">
                                    Speaker {segment.speaker}
                                </span>
                            )}
                            {segment.text}
                        </p>
                    ))}
                </div>
            )}
        </section>
    );
}
