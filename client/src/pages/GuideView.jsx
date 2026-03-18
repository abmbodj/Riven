import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    ChevronLeft, Check, Loader2, Layers, ClipboardCheck, Trash2
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';

export default function GuideView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [generating, setGenerating] = useState(null);

    const saveTimerRef = useRef(null);
    const contentRef = useRef(null);
    const titleRef = useRef('');
    const guideRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            try {
                const guide = await api.getStudyGuide(id);
                setTitle(guide.title || '');
                setContent(guide.content || {});
                titleRef.current = guide.title || '';
                contentRef.current = guide.content || {};
                guideRef.current = guide;
            } catch {
                toast.error('Failed to load guide');
                navigate('/guides');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate, toast]);

    const saveGuide = useCallback(async () => {
        setSaving(true);
        try {
            await api.updateStudyGuide(id, {
                title: titleRef.current || 'Untitled Guide',
                content: contentRef.current,
            });
            setSaved(true);
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [id, toast]);

    const debounceSave = useCallback(() => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(saveGuide, 800);
    }, [saveGuide]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        titleRef.current = e.target.value;
        debounceSave();
    };

    const handleContentUpdate = useCallback((json) => {
        contentRef.current = json;
        debounceSave();
    }, [debounceSave]);

    const extractText = (doc) => {
        if (!doc?.content) return '';
        const texts = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.text) texts.push(node.text);
                if (node.content) walk(node.content);
            }
        };
        walk(doc.content);
        return texts.join('\n');
    };

    const handleGenerateFlashcards = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Guide is empty'); return; }

        setGenerating('flashcards');
        try {
            const stream = await api.generateAiDeckStream(text, null, `${titleRef.current} - AI`, guideRef.current?.class_id);

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    toast.success(`Generated ${event.data.card_count} flashcards!`);
                    navigate(`/deck/${event.data.deck_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate flashcards');
        } finally {
            setGenerating(null);
        }
    };

    const handleGenerateExam = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Guide is empty'); return; }

        setGenerating('exam');
        try {
            const stream = await api.generateAiExamStream(text, null, `${titleRef.current} Exam`, 'guide', id, guideRef.current?.class_id);

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    toast.success(`Generated ${event.data.question_count} questions!`);
                    navigate(`/exam/${event.data.exam_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate exam');
        } finally {
            setGenerating(null);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteStudyGuide(id);
            toast.success('Guide deleted');
            navigate('/guides');
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
        </div>
    );

    return (
        <div className="relative min-h-screen pb-32">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title="Delete this guide?"
                message="This study guide will be permanently deleted."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(false)}
            />

            {/* Header */}
            <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 py-3">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                    <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            {saving ? (
                                <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                            ) : saved ? (
                                <Check className="w-3.5 h-3.5 text-claude-accent" />
                            ) : null}
                            <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary">
                                {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                            </span>
                        </div>
                        <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Editor */}
            <div className="max-w-3xl mx-auto px-4 pt-6">
                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Untitled Guide"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-2 tracking-tight leading-tight"
                />

                <TiptapEditor
                    content={content}
                    onUpdate={handleContentUpdate}
                    editable={true}
                    placeholder="Your study guide content..."
                />
            </div>

            {/* AI Actions */}
            <div className="fixed bottom-24 lg:bottom-0 left-0 right-0 z-20 bg-claude-bg/90 backdrop-blur-md border-t border-claude-border/20 lg:pb-safe">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-claude-secondary/50 shrink-0 mr-1">AI</span>

                    <button
                        onClick={handleGenerateFlashcards}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        Flashcards
                    </button>

                    <button
                        onClick={handleGenerateExam}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                        Mock Exam
                    </button>
                </div>
            </div>
        </div>
    );
}
