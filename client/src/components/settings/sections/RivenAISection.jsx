import React from 'react';
import { History, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import { AI_CAPABILITIES } from '../settingsConstants';

const statusToneClasses = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    progress: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    error: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function RivenAISection({ aiLimits, history }) {
    const aiCharacterLimit = Number(aiLimits.characterLimit ?? 15000);
    const [minDeckSize = 5, maxDeckSize = 15] = Array.isArray(aiLimits.flashcardRange) ? aiLimits.flashcardRange : [5, 15];
    const aiUsagePercent = Math.max(0, Math.min(100, (aiLimits.remaining / Math.max(aiLimits.max || 1, 1)) * 100));
    const aiRefreshWindow = aiLimits.loading
        ? 'Checking'
        : aiLimits.isPremium
            ? 'Every 12 hours'
            : 'Monthly';
    const aiInputSizeLabel = aiLimits.loading
        ? 'Checking'
        : `~${Math.round(aiCharacterLimit / 5).toLocaleString()} words`;
    const aiInputSizeMeta = aiLimits.loading
        ? 'Fetching request cap'
        : `${aiCharacterLimit.toLocaleString()} chars max`;
    const aiDeckSizeLabel = aiLimits.loading
        ? 'Checking'
        : `${minDeckSize}-${maxDeckSize} cards`;
    const aiDeckSizeMeta = aiLimits.loading
        ? 'Fetching deck range'
        : 'Per flashcard request';
    const historyItems = Array.isArray(history?.items) ? history.items : [];

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow="Workspace"
                title="Study Tools"
                description="Track your allowance and the features it powers."
                tone="warning"
            />
            <SectionCard tone="warning" className="flex flex-col space-y-4 p-5 sm:p-6 xl:p-5">
                <div className="flex items-start gap-4 sm:items-center">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
                        <Sparkles className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="flex flex-col items-start gap-2 font-display text-lg font-semibold tracking-wide text-claude-text sm:flex-row sm:items-center sm:justify-between">
                            Current allowance
                            {!aiLimits.loading && (
                                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${aiLimits.remaining > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                    {`${aiLimits.remaining} / ${aiLimits.max} Left`}
                                </span>
                            )}
                        </h3>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            Available across decks, guides, exams, classes, and notes.
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="bg-claude-bg/50 border border-claude-secondary/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                        <p className="text-[10px] uppercase font-mono tracking-widest text-claude-secondary/70 mb-1">Refresh</p>
                        <p className="text-sm font-medium text-claude-text">{aiRefreshWindow}</p>
                        <p className="text-[9px] text-claude-secondary mt-0.5">Allowance reset window</p>
                    </div>
                    <div className="bg-claude-bg/50 border border-claude-secondary/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                        <p className="text-[10px] uppercase font-mono tracking-widest text-claude-secondary/70 mb-1">Input Size</p>
                        <p className="text-sm font-medium text-claude-text">{aiInputSizeLabel}</p>
                        <p className="text-[9px] text-claude-secondary mt-0.5">{aiInputSizeMeta}</p>
                    </div>
                    <div className="bg-claude-bg/50 border border-claude-secondary/10 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                        <p className="text-[10px] uppercase font-mono tracking-widest text-claude-secondary/70 mb-1">Deck Size</p>
                        <p className="text-sm font-medium text-claude-text">{aiDeckSizeLabel}</p>
                        <p className="text-[9px] text-claude-secondary mt-0.5">{aiDeckSizeMeta}</p>
                    </div>
                </div>

                <div className="rounded-[1.15rem] border border-claude-secondary/10 bg-claude-bg/45 p-3.5">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/70">
                        Available for
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {AI_CAPABILITIES.map((capability) => (
                            <div
                                key={capability}
                                className="rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary"
                            >
                                {capability}
                            </div>
                        ))}
                    </div>
                </div>

                {!aiLimits.loading && (
                    <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden mt-2 border border-claude-secondary/5 shadow-inner">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${aiUsagePercent}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full ${aiLimits.remaining > 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-red-500'} rounded-full`}
                        />
                    </div>
                )}
            </SectionCard>

            <SectionCard tone="warning" className="flex flex-col space-y-4 p-5 sm:p-6 xl:p-5">
                <div className="flex items-start gap-4 sm:items-center">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
                        <History className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display text-lg font-semibold tracking-wide text-claude-text">
                            Recent usage
                        </h3>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            Allowance-consuming generations appear here automatically.
                        </p>
                    </div>
                </div>

                {history?.error && (
                    <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3 text-[11px] font-mono uppercase tracking-[0.12em] text-red-600">
                        Couldn&apos;t load usage history right now.
                    </div>
                )}

                {history?.loading ? (
                    <div className="rounded-[1.15rem] border border-claude-secondary/10 bg-claude-bg/45 p-4 text-[11px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                        Loading recent usage
                    </div>
                ) : historyItems.length === 0 ? (
                    <div className="rounded-[1.15rem] border border-claude-secondary/10 bg-claude-bg/45 p-4">
                        <p className="text-sm font-medium text-claude-text">No study tool activity yet</p>
                        <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-claude-secondary">
                            Generate a deck, guide, exam, or import to start your history.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {historyItems.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-[1.15rem] border border-claude-secondary/10 bg-claude-bg/45 px-4 py-3"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-medium text-claude-text">{item.label}</p>
                                            <span className={`text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-1 rounded-full border ${statusToneClasses[item.tone] || statusToneClasses.progress}`}>
                                                {item.statusLabel}
                                            </span>
                                        </div>
                                        {item.subtitle && (
                                            <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-claude-secondary">
                                                {item.subtitle}
                                            </p>
                                        )}
                                        <p className="mt-2 text-sm text-claude-text/90">{item.summary}</p>
                                    </div>
                                    <p className="shrink-0 text-[10px] font-mono uppercase tracking-[0.12em] text-claude-secondary/80">
                                        {item.timestampLabel}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
