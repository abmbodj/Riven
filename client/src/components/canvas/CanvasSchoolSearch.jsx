import { Search, School, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * School name search input + results list for the Canvas connect flow.
 * Purely presentational — state lives in useCanvasConnect.
 */
export default function CanvasSchoolSearch({
    searchQuery,
    onSearchChange,
    results,
    loading,
    emailDomainHint,
    onSelectSchool,
    onManualEntry,
}) {
    return (
        <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-claude-secondary/50" />
                <input
                    autoFocus
                    type="text"
                    placeholder={emailDomainHint ? `e.g. ${emailDomainHint}…` : 'Search your school or university…'}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full rounded-xl border border-claude-secondary/20 bg-claude-bg py-3 pl-10 pr-4 font-mono text-sm text-claude-text placeholder-claude-secondary/40 shadow-inner focus:border-blue-400/50 focus:outline-none transition-colors"
                />
            </div>

            {/* Results */}
            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="space-y-2 py-1"
                    >
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 animate-pulse rounded-xl border border-claude-border bg-claude-bg/20" />
                        ))}
                    </motion.div>
                ) : results.length > 0 ? (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="max-h-56 space-y-1.5 overflow-y-auto"
                    >
                        {results.map((school) => (
                            <button
                                key={school.domain}
                                type="button"
                                onClick={() => onSelectSchool(school)}
                                className="tap-action flex w-full items-center justify-between gap-3 rounded-xl border border-claude-border/60 bg-claude-bg/30 px-4 py-3 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:border-blue-400/30 hover:bg-blue-400/5 active:scale-[0.98]"
                            >
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <School className="h-4 w-4 shrink-0 text-blue-400/70" />
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-mono font-semibold text-claude-text">{school.name}</p>
                                        <p className="truncate text-[10px] font-mono text-claude-secondary/70">{school.domain}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-claude-secondary/40" />
                            </button>
                        ))}
                    </motion.div>
                ) : searchQuery.trim().length > 1 && !loading ? (
                    <motion.p
                        key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="py-2 text-center font-mono text-xs text-claude-secondary/70"
                    >
                        No schools found for &ldquo;{searchQuery}&rdquo;
                    </motion.p>
                ) : null}
            </AnimatePresence>

            {/* Manual entry fallback */}
            <button
                type="button"
                onClick={onManualEntry}
                className="flex w-full items-center justify-center gap-1.5 py-2 font-mono text-[11px] text-claude-secondary/60 underline-offset-2 hover:text-claude-secondary transition-colors"
            >
                <ArrowLeft className="h-3 w-3" />
                My school isn&rsquo;t listed — enter manually
            </button>
        </div>
    );
}
