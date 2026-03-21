import React from 'react';
import { motion } from 'motion/react';
import Inbox from 'lucide-react/dist/esm/icons/inbox';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Send from 'lucide-react/dist/esm/icons/send';
import Star from 'lucide-react/dist/esm/icons/star';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';

const formatSubmittedAt = (value) => {
    if (!value) return 'Unknown date';
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export default function FeedbackTab({ feedback = [], onToggleFavorite, onDelete, onThank, haptics }) {
    if (feedback.length === 0) {
        return (
            <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-claude-border/60 px-6 py-16 text-center">
                <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                <div className="relative z-10">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-claude-border bg-claude-surface/50">
                        <Inbox className="h-7 w-7 text-claude-secondary/60" />
                    </div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary/80">
                        No feedback yet
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {feedback.map((entry, index) => {
                const isThanked = Boolean(entry.consideringNotifiedAt);

                return (
                    <motion.article
                        key={entry.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="relative overflow-hidden rounded-[2rem] border border-claude-border/70 bg-claude-surface/90 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                    >
                        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:10px_10px]" />

                        <div className="relative z-10 p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-2 rounded-full border border-claude-border/70 bg-claude-bg/60 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/85">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            {entry.username}
                                        </span>
                                        {entry.isFavorited && (
                                            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-amber-400">
                                                Favorited
                                            </span>
                                        )}
                                        {isThanked && (
                                            <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">
                                                Considering
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.16em] text-claude-secondary/70">
                                        Submitted {formatSubmittedAt(entry.createdAt)}
                                    </p>
                                    <p className="mt-4 text-sm leading-relaxed text-claude-text sm:text-[15px]">
                                        {entry.content}
                                    </p>

                                    {isThanked && (
                                        <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary/70">
                                            Thank-you sent {formatSubmittedAt(entry.consideringNotifiedAt)}
                                            {entry.consideringByName ? ` by ${entry.consideringByName}` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptics.light();
                                        onToggleFavorite(entry.id, !entry.isFavorited);
                                    }}
                                    className={`tap-action inline-flex items-center justify-center gap-2 rounded-[1rem] border px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${
                                        entry.isFavorited
                                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                                            : 'border-claude-border/70 bg-claude-bg/55 text-claude-secondary hover:text-claude-text'
                                    }`}
                                >
                                    <Star className="h-4 w-4" />
                                    {entry.isFavorited ? 'Unfavorite' : 'Favorite'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        haptics.light();
                                        onThank(entry.id);
                                    }}
                                    disabled={isThanked}
                                    className="tap-action inline-flex items-center justify-center gap-2 rounded-[1rem] border border-claude-accent/20 bg-claude-accent/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    <Send className="h-4 w-4" />
                                    {isThanked ? 'Thanked' : 'Thank user'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        haptics.medium();
                                        onDelete(entry.id);
                                    }}
                                    className="tap-action inline-flex items-center justify-center gap-2 rounded-[1rem] border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-red-400 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </motion.article>
                );
            })}
        </div>
    );
}
