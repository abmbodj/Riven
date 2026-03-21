import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Check, Loader2, Layers, ClipboardCheck, Trash2, Share2
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import ShareToFriendModal from '../components/ShareToFriendModal';
import {
    buildShareMessageContent,
    buildSharedPreviewText,
    cloneRichTextDoc,
    extractTextFromDoc,
    serializeSharedPayload,
} from '../utils/sharedResources';

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
    const [showShareModal, setShowShareModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [sharingTo, setSharingTo] = useState(null);
    const [generating, setGenerating] = useState(null);

    const toastRef = useRef(toast);
    const saveTimerRef = useRef(null);
    const contentRef = useRef(null);
    const titleRef = useRef('');
    const guideRef = useRef(null);
    const activeSaveRef = useRef(Promise.resolve(null));

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

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
                toastRef.current.error('Failed to load guide');
                navigate('/guides');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate]);

    const saveGuide = useCallback(async () => {
        setSaving(true);
        try {
            const contentSnapshot = cloneRichTextDoc(contentRef.current);
            const updatedGuide = await api.updateStudyGuide(id, {
                title: titleRef.current || 'Untitled Guide',
                content: contentSnapshot,
            });
            guideRef.current = updatedGuide;
            setSaved(true);
            return updatedGuide;
        } catch {
            toast.error('Failed to save');
            throw new Error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [id, toast]);

    const commitSave = useCallback(() => {
        saveTimerRef.current = null;
        const pendingSave = saveGuide();
        activeSaveRef.current = pendingSave;
        return pendingSave;
    }, [saveGuide]);

    const debounceSave = useCallback(() => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            commitSave().catch(() => {});
        }, 800);
    }, [commitSave]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        titleRef.current = e.target.value;
        debounceSave();
    };

    const handleContentUpdate = useCallback((json) => {
        setContent(json);
        contentRef.current = json;
        debounceSave();
    }, [debounceSave]);

    const extractText = useCallback((doc) => extractTextFromDoc(doc).replace(/\s+/g, ' ').trim(), []);

    const flushPendingSave = useCallback(async () => {
        if (saveTimerRef.current) {
            return commitSave();
        }

        if (saving) {
            return activeSaveRef.current;
        }

        if (!saved) {
            return commitSave();
        }

        return guideRef.current;
    }, [commitSave, saved, saving]);

    const handleShareGuide = async () => {
        setShowShareModal(true);
        setLoadingFriends(true);
        try {
            const friendsData = await api.getFriends();
            setFriends(friendsData);
        } catch (err) {
            toast.error(err?.message || 'Failed to load friends');
        } finally {
            setLoadingFriends(false);
        }
    };

    const handleSendGuideToFriend = async (friendId) => {
        if (sharingTo) return;
        setSharingTo(friendId);
        try {
            await flushPendingSave();
            const contentSnapshot = cloneRichTextDoc(contentRef.current);

            await api.sendMessage(
                friendId,
                buildShareMessageContent('guide', titleRef.current || 'Untitled Guide'),
                'guide',
                serializeSharedPayload({
                    kind: 'guide',
                    sourceId: id,
                    title: titleRef.current || 'Untitled Guide',
                    previewText: buildSharedPreviewText(contentSnapshot),
                })
            );

            toast.success('Guide shared successfully!');
            setShowShareModal(false);
        } catch (err) {
            toast.error(err?.message || 'Failed to share guide');
        } finally {
            setSharingTo(null);
        }
    };

    const handleGenerateFlashcards = async () => {
            const text = extractText(contentRef.current);
            if (!text.trim()) { toast.error('Guide is empty'); return; }

        setGenerating('flashcards');
        try {
            const stream = await api.generateAiDeckStream(text, null, `${titleRef.current} - AI`, guideRef.current?.class_id, null);

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
            const stream = await api.generateAiExamStream(text, null, `${titleRef.current} Exam`, 'guide', id, guideRef.current?.class_id, null);

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
        <div className="relative min-h-screen pb-8">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title="Delete this guide?"
                message="This study guide will be permanently deleted."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(false)}
            />
            <ShareToFriendModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                friends={friends}
                loading={loadingFriends}
                sendingTo={sharingTo}
                onSend={handleSendGuideToFriend}
                resourceLabel="Guide"
                resourceTitle={title || 'Untitled Guide'}
            />

            {/* Header */}
            <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-2">
                <div className="flex items-center justify-between max-w-3xl mx-auto mb-2">
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
                        <button onClick={handleShareGuide} className="p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share guide">
                            <Share2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={handleGenerateFlashcards}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>Flashcards</span>
                    </button>

                    <button
                        onClick={handleGenerateExam}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                        <span>Mock Exam</span>
                    </button>
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
        </div>
    );
}
