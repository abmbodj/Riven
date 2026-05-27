import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronDown, Copy, ExternalLink, Link2 } from 'lucide-react';

const STEPS = [
    {
        title: 'Open Canvas Calendar',
        description: "Log into your school's Canvas and click 'Calendar' in the left sidebar.",
        detail: 'Start from the main Canvas navigation so you land on the calendar page first.',
        icon: CalendarDays,
        accent: 'text-blue-400 border-blue-400/20 bg-blue-400/10',
    },
    {
        title: 'Open Calendar Feed',
        description: "Click the 'Calendar Feed' link at the bottom-right of the Calendar page.",
        detail: 'On mobile, you may need to scroll down or switch to desktop view.',
        icon: ExternalLink,
        accent: 'text-emerald-300 border-emerald-300/20 bg-emerald-300/10',
    },
    {
        title: 'Copy the Link',
        description: 'Copy the URL that appears. It should end in .ics.',
        detail: null,
        icon: Link2,
        accent: 'text-amber-300 border-amber-300/20 bg-amber-300/10',
    },
];

export default function CanvasIcalGuide({ compact = false, validationHint = null }) {
    const [expanded, setExpanded] = useState(false);
    const hintId = useId();

    const cardPadding = compact ? 'p-3.5' : 'p-4';
    const titleClass = compact ? 'text-xs' : 'text-sm';
    const bodyClass = compact ? 'text-[11px]' : 'text-xs';
    const mockFieldClass = compact ? 'px-3 py-2 text-[10px]' : 'px-3.5 py-2.5 text-[11px]';

    return (
        <div className="space-y-3" data-testid={compact ? 'canvas-ical-guide-compact' : 'canvas-ical-guide'}>
            {validationHint ? (
                <div
                    id="canvas-ical-validation-hint"
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
                    data-testid="canvas-ical-validation-hint"
                >
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-amber-300">Quick check</p>
                    <p className="mt-1 text-[11px] font-mono leading-relaxed text-claude-secondary/90">
                        {validationHint}
                    </p>
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                aria-controls={hintId}
                className="flex w-full items-center justify-between rounded-2xl border border-claude-border/60 bg-claude-bg/30 px-4 py-3 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:border-blue-400/30 hover:bg-blue-400/5 active:scale-[0.99]"
                data-testid="canvas-ical-guide-toggle"
            >
                <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-blue-300/80">Need help finding it?</p>
                    <p className="mt-1 text-[11px] font-mono text-claude-secondary/75">
                        Open a quick 3-step walkthrough for the Canvas Calendar Feed.
                    </p>
                </div>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-claude-secondary transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence initial={false}>
                {expanded ? (
                    <motion.div
                        key="guide"
                        id={hintId}
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                        data-testid="canvas-ical-guide-content"
                    >
                        <div className={`rounded-[1.6rem] border border-blue-400/15 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(15,23,42,0.03))] ${compact ? 'p-3.5' : 'p-4'} shadow-[0_18px_40px_rgba(15,23,42,0.08)]`}>
                            <div className="space-y-3">
                                {STEPS.map((step, index) => {
                                    const Icon = step.icon;
                                    return (
                                        <div
                                            key={step.title}
                                            className={`rounded-[1.35rem] border border-claude-border/60 bg-claude-bg/65 ${cardPadding}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex flex-col items-center gap-2 pt-0.5">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-400/25 bg-blue-400/10 text-[10px] font-mono font-bold text-blue-300">
                                                        {index + 1}
                                                    </div>
                                                    {index < STEPS.length - 1 ? (
                                                        <div className="h-8 w-px bg-gradient-to-b from-blue-400/30 to-transparent" />
                                                    ) : null}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${step.accent}`}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <p className={`font-serif font-bold italic text-claude-text ${titleClass}`}>
                                                            {step.title}
                                                        </p>
                                                    </div>
                                                    <p className={`mt-3 font-mono leading-relaxed text-claude-secondary ${bodyClass}`}>
                                                        {step.description}
                                                    </p>
                                                    {step.detail ? (
                                                        <p className={`mt-2 rounded-xl border border-claude-border/50 bg-claude-bg/50 px-3 py-2 font-mono leading-relaxed text-claude-secondary/80 ${bodyClass}`}>
                                                            {step.detail}
                                                        </p>
                                                    ) : (
                                                        <div className={`mt-3 flex items-center justify-between rounded-xl border border-claude-border/60 bg-claude-bg/50 ${mockFieldClass}`}>
                                                            <span className="truncate font-mono text-claude-secondary/80">
                                                                https://canvas.school.edu/feeds/calendars/user.ics
                                                            </span>
                                                            <Copy className="ml-3 h-4 w-4 shrink-0 text-claude-secondary/70" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
