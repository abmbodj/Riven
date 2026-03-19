import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

const CONFIG = {
    exam: { title: 'Generating Exam...', subtitle: 'Creating a mock exam from your content...' },
    flashcards: { title: 'Generating Deck...', subtitle: 'Creating flashcards from your content...' },
    guide: { title: 'Generating Guide...', subtitle: 'Creating a study guide from your content...' },
};

export default function GeneratingOverlay({ type }) {
    const config = type ? CONFIG[type] : null;

    return (
        <AnimatePresence>
            {config && (
                <motion.div
                    key="generating-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="glass-panel border border-claude-border rounded-3xl px-12 py-16 text-center flex flex-col items-center max-w-sm mx-4"
                    >
                        <div className="relative w-20 h-20 mb-8">
                            <div className="absolute inset-0 bg-claude-accent/20 rounded-full blur-xl animate-pulse" />
                            <div className="absolute inset-0 border-4 border-claude-accent/30 border-t-claude-accent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2 text-claude-text">{config.title}</h3>
                        <p className="text-sm font-medium text-claude-secondary">{config.subtitle}</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
