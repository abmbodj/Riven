import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    Layers, FileText, BookOpen, ClipboardCheck, ChevronRight, Sparkles
} from 'lucide-react';
import { api } from '../api';
import GlobalMessages from '../components/GlobalMessages';

const MODULES = [
    {
        title: 'Flashcards',
        description: 'Review & master with spaced repetition',
        icon: Layers,
        to: '/decks/library',
        color: '#6366f1',
    },
    {
        title: 'Notes',
        description: 'Write, organize & link to classes',
        icon: FileText,
        to: '/notes',
        color: '#22c55e',
    },
    {
        title: 'Tutor Sessions',
        description: 'River-led active recall from notes, files, or setup answers',
        icon: BookOpen,
        to: '/guides',
        color: '#f59e0b',
    },
    {
        title: 'Mock Exams',
        description: 'Test your knowledge with practice quizzes',
        icon: ClipboardCheck,
        to: '/exams',
        color: '#ec4899',
    },
    {
        title: 'YouTube Import',
        description: 'Generate study materials from any video',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        ),
        to: '/youtube',
        color: '#ef4444',
    },
];

function ModuleCard({ mod, index, className = '' }) {
    const Icon = mod.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 24, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.4 : 0.4 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3, ease: [0.33, 1, 0.68, 0.9] } }}
            transition={{ delay: index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={`relative tap-action ${className}`}
        >
            {/* Specimen Tape */}
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 pointer-events-none" />
            <div className="absolute -top-1 right-1/4 w-4 h-4 bg-claude-border/40 rotate-[15deg] rounded-full z-10 shadow-sm flex items-center justify-center pointer-events-none">
                <div className="w-1 h-1 bg-claude-secondary/40 rounded-full" />
            </div>

            <Link
                to={mod.to}
                className="group relative block bg-claude-surface border border-claude-border p-6 sm:p-8 pt-8 sm:pt-10 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] touch-target"
            >
                {/* Paper grain texture */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-claude-text/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    {/* Specimen ID line */}
                    <div className="flex items-center gap-3 mb-5 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary">
                            Module {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="h-px flex-1 bg-claude-border/40" />
                    </div>

                    <div className="flex items-start gap-4 sm:gap-5">
                        <div
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shrink-0 border border-current/10 shadow-inner"
                            style={{
                                backgroundColor: mod.color + '0d',
                                color: mod.color,
                            }}
                        >
                            <Icon className="w-6 h-6 sm:w-7 sm:h-7 opacity-70" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-serif text-xl sm:text-2xl font-bold text-claude-text leading-[1.1] group-hover:text-claude-accent transition-colors duration-300 italic mb-2 tracking-tight">
                                {mod.title}
                            </h3>
                            <p className="font-body text-sm text-claude-secondary leading-relaxed">
                                {mod.description}
                            </p>
                        </div>

                        <ChevronRight className="w-5 h-5 text-claude-secondary/40 group-hover:text-claude-accent group-hover:translate-x-1 transition-all duration-300 shrink-0 mt-1" />
                    </div>
                </div>

                {/* Archival stamp background */}
                <div className="absolute -bottom-4 -right-4 opacity-[0.03] sm:opacity-[0.04] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] transform origin-center scale-[1.2] sm:scale-150">
                    <Icon className="w-24 h-24 sm:w-32 sm:h-32" />
                </div>
            </Link>
        </motion.div>
    );
}

export default function StudyDashboard() {
    const [stats, setStats] = useState({ decks: 0, notes: 0, guides: 0, exams: 0 });
    const [loading, setLoading] = useState(true);

    const loadStats = useCallback(async () => {
        try {
            const [decks, notes, guides, exams] = await Promise.all([
                api.getDecks().catch(() => []),
                api.getNotes().catch(() => []),
                api.getStudyGuides().catch(() => []),
                api.getMockExams().catch(() => []),
            ]);
            setStats({
                decks: decks.length,
                notes: notes.length,
                guides: guides.length,
                exams: exams.length,
            });
        } catch {
            // Stats are non-critical, fail silently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    return (
        <div className="relative min-h-screen pb-24">
            <GlobalMessages />

            {/* Header */}
            <div className="mb-8 pt-4 px-1">
                <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                    <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">
                        Study
                    </span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none mb-4">
                    Study Dashboard
                </h1>

                {/* Quick Stats */}
                {!loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="flex items-center gap-4 flex-wrap"
                    >
                        {[
                            { label: 'Decks', count: stats.decks },
                            { label: 'Notes', count: stats.notes },
                            { label: 'Coaches', count: stats.guides },
                            { label: 'Exams', count: stats.exams },
                        ].map(({ label, count }) => (
                            <div key={label} className="flex items-center gap-1.5">
                                <span className="font-mono text-sm font-bold text-claude-accent">{count}</span>
                                <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary">{label}</span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Module Cards Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6 px-1">
                {MODULES.map((mod, index) => (
                    <ModuleCard
                        key={mod.title}
                        mod={mod}
                        index={index}
                        className={index === MODULES.length - 1 ? 'xl:col-span-2 xl:w-1/2 xl:mx-auto' : ''}
                    />
                ))}
            </div>
        </div>
    );
}
