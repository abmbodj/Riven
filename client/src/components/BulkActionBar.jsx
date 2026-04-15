import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, CheckSquare, X } from 'lucide-react';

/**
 * BulkActionBar — fixed bottom action bar for bulk-select mode.
 * Sits above MobileBottomNav (z-40) at z-50, below all drawers/modals.
 */
export default function BulkActionBar({ isVisible, selectedCount, isAllSelected, onSelectAll, onDelete, onExit }) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 z-50"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
                >
                    <div className="mx-3">
                        <div className="bg-claude-surface border border-claude-border rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.3)] px-4 py-3 flex items-center gap-3">

                            {/* Left: exit + count */}
                            <button
                                onClick={onExit}
                                className="p-2 -ml-1 text-claude-secondary hover:text-claude-text transition-colors tap-action"
                                aria-label="Exit selection mode"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-claude-text whitespace-nowrap">
                                {selectedCount} selected
                            </span>

                            {/* Center: select all toggle */}
                            <button
                                onClick={onSelectAll}
                                className="flex-1 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-claude-accent hover:text-claude-text transition-colors tap-action"
                            >
                                <CheckSquare className="w-4 h-4" />
                                {isAllSelected ? 'Deselect All' : 'Select All'}
                            </button>

                            {/* Right: delete */}
                            <button
                                onClick={onDelete}
                                disabled={selectedCount === 0}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/50 transition-all tap-action disabled:opacity-40 disabled:pointer-events-none"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
