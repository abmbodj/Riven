import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    BookOpen, Layers, Target, ChevronRight, Loader2, Sparkles
} from 'lucide-react';
import { api } from '../api';

export default function StudyPath({ classId, weakTopics, percentage }) {
    const navigate = useNavigate();
    const [relatedNotes, setRelatedNotes] = useState([]);
    const [relatedDecks, setRelatedDecks] = useState([]);
    const [relatedGuides, setRelatedGuides] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!classId) {
            setLoading(false);
            return;
        }
        const load = async () => {
            try {
                const [notes, allDecks, guides] = await Promise.all([
                    api.getNotes(classId).catch(() => []),
                    api.getDecks().catch(() => []),
                    api.getStudyGuides(classId).catch(() => []),
                ]);
                const decks = classId ? allDecks.filter(d => d.class_id === classId) : allDecks;
                setRelatedNotes(notes.slice(0, 3));
                setRelatedDecks(decks.slice(0, 3));
                setRelatedGuides(guides.slice(0, 3));
            } catch {
                // Non-critical
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [classId]);

    const getMessage = () => {
        if (percentage < 50) return "Let's build your foundation on these topics.";
        if (percentage < 70) return "Good effort! Let's strengthen these weak areas.";
        return "Almost there! A quick review will push you to mastery.";
    };

    const hasContent = relatedNotes.length > 0 || relatedDecks.length > 0 || relatedGuides.length > 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-claude-accent animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-2"
        >
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-claude-accent" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-claude-accent font-bold">Your Study Path</span>
            </div>

            <div className="glass-panel rounded-2xl border border-claude-accent/20 p-4">
                <p className="text-sm font-body text-claude-text mb-1">{getMessage()}</p>
                {weakTopics.length > 0 && (
                    <p className="text-[11px] font-mono text-claude-secondary mb-4">
                        Focus areas: {weakTopics.join(', ')}
                    </p>
                )}

                {/* 3-Step Path */}
                <div className="space-y-3">
                    {/* Step 1: Review */}
                    {(relatedNotes.length > 0 || relatedGuides.length > 0) && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                                <BookOpen className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold mb-1">Step 1 — Review</p>
                                <div className="space-y-1.5">
                                    {relatedGuides.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => navigate(`/guide/${g.id}`)}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl glass-panel border border-claude-border hover:border-blue-400/30 transition-colors tap-action text-left"
                                        >
                                            <span className="text-xs font-body text-claude-text truncate">{g.title}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-claude-secondary shrink-0" />
                                        </button>
                                    ))}
                                    {relatedNotes.map(n => (
                                        <button
                                            key={n.id}
                                            onClick={() => navigate(`/note/${n.id}`)}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl glass-panel border border-claude-border hover:border-blue-400/30 transition-colors tap-action text-left"
                                        >
                                            <span className="text-xs font-body text-claude-text truncate">{n.title}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-claude-secondary shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Practice */}
                    {relatedDecks.length > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                                <Layers className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-purple-400 font-bold mb-1">Step 2 — Practice</p>
                                <div className="space-y-1.5">
                                    {relatedDecks.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => navigate(`/deck/${d.id}`)}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl glass-panel border border-claude-border hover:border-purple-400/30 transition-colors tap-action text-left"
                                        >
                                            <span className="text-xs font-body text-claude-text truncate">{d.title}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-claude-secondary shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Retest */}
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-claude-accent/15 flex items-center justify-center shrink-0">
                            <Target className="w-4 h-4 text-claude-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-claude-accent font-bold mb-1">
                                {hasContent ? 'Step 3 — Retest' : 'Retest'}
                            </p>
                            <p className="text-[11px] font-body text-claude-secondary mb-2">
                                Take a focused exam targeting only your weak topics.
                            </p>
                        </div>
                    </div>
                </div>

                {!hasContent && !classId && (
                    <p className="text-[11px] font-body text-claude-secondary mt-2">
                        Tip: Link your exams to a class to get personalized study recommendations.
                    </p>
                )}
            </div>
        </motion.div>
    );
}
