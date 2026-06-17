import React from 'react';
import { Mic, FileText, NotebookPen, Bell, Check } from 'lucide-react';

// Peak-end reward shown AFTER the account exists: expands the aspiration now that trust is
// earned. The tiles double as the one surviving personalization question — picking "what you'll
// reach for most" sets the material source that orders the home CREATE actions next session.
// Audio→notes is the hero tile (highest-effort, highest-wow flagship), never a first action.
const CAPABILITIES = [
    {
        id: 'audio',
        icon: Mic,
        title: 'Record a lecture',
        blurb: 'Riven turns the audio into clean notes + cards, automatically.',
        hero: true,
    },
    {
        id: 'files',
        icon: FileText,
        title: 'Drop in slides or a PDF',
        blurb: 'Generate decks, guides, and mock exams from your files.',
    },
    {
        id: 'notes',
        icon: NotebookPen,
        title: 'Type or paste notes',
        blurb: 'Get an AI tutor that quizzes you until it clicks.',
    },
];

export default function CapabilitiesRevealStep({
    material,
    onSelectMaterial,
    remindersOn,
    onToggleReminders,
}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
                {CAPABILITIES.map((cap) => {
                    const Icon = cap.icon;
                    const isSelected = material === cap.id;
                    return (
                        <button
                            key={cap.id}
                            type="button"
                            onClick={() => onSelectMaterial?.(cap.id)}
                            aria-pressed={isSelected}
                            className="group relative flex w-full items-start gap-3.5 overflow-hidden rounded-[1.4rem] border px-4 py-3.5 text-left transition-all duration-300 active:scale-[0.99]"
                            style={{
                                borderColor: isSelected
                                    ? 'color-mix(in srgb, var(--accent-color) 58%, rgba(255,255,255,0.25))'
                                    : cap.hero
                                        ? 'color-mix(in srgb, var(--accent-color) 28%, rgba(255,255,255,0.06))'
                                        : 'rgba(255,255,255,0.07)',
                                background: isSelected
                                    ? 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 100%), linear-gradient(155deg, color-mix(in srgb, var(--surface-color) 88%, transparent) 0%, color-mix(in srgb, var(--bg-color) 76%, transparent) 100%)'
                                    : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)',
                            }}
                        >
                            <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                style={{
                                    background: cap.hero
                                        ? 'color-mix(in srgb, var(--accent-color) 22%, transparent)'
                                        : 'rgba(255,255,255,0.06)',
                                }}
                            >
                                <Icon className={`h-5 w-5 ${cap.hero ? 'text-claude-accent' : 'text-botanical-parchment'}`} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-display text-[1.05rem] leading-tight tracking-[-0.02em] text-botanical-parchment">
                                        {cap.title}
                                    </p>
                                    {cap.hero ? (
                                        <span className="rounded-full bg-claude-accent/20 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-claude-accent">
                                            Popular
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-1 text-[12.5px] leading-[1.15rem] text-claude-secondary">
                                    {cap.blurb}
                                </p>
                            </div>
                            <span
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200"
                                style={{
                                    borderColor: isSelected ? 'transparent' : 'rgba(255,255,255,0.16)',
                                    backgroundColor: isSelected ? 'var(--accent-color)' : 'transparent',
                                }}
                            >
                                {isSelected ? <Check className="h-3 w-3 text-botanical-ink" strokeWidth={3.5} /> : null}
                            </span>
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => onToggleReminders?.(!remindersOn)}
                aria-pressed={remindersOn}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-white/15"
            >
                <Bell className="h-4 w-4 shrink-0 text-claude-secondary" />
                <span className="min-w-0 flex-1 text-[13px] leading-tight text-botanical-parchment">
                    Send me a gentle nudge to keep my streak going
                </span>
                <span
                    className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200"
                    style={{ backgroundColor: remindersOn ? 'var(--accent-color)' : 'rgba(255,255,255,0.14)' }}
                >
                    <span
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: remindersOn ? 'translateX(1.15rem)' : 'translateX(0.125rem)' }}
                    />
                </span>
            </button>
        </div>
    );
}
