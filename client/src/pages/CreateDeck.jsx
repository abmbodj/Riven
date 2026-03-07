import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Sparkles, Folder, Calendar, Hash, ChevronDown, Check,
    Upload, FileText, Loader2, Layers, Wand2
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import useRewardedAd from '../hooks/useRewardedAd';
import AdRewardModal from '../components/ui/AdRewardModal';
import PricingModal from '../components/ui/PricingModal';

const MODES = [
    { id: 'manual', label: 'Manual', icon: Layers },
    { id: 'ai', label: 'AI Generate', icon: Sparkles },
];

export default function CreateDeck() {
    const [mode, setMode] = useState('manual');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [folders, setFolders] = useState([]);
    const [classes, setClasses] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [showClassPicker, setShowClassPicker] = useState(false);

    // AI state
    const [aiNotes, setAiNotes] = useState('');
    const [aiFile, setAiFile] = useState(null);
    const [aiFilePreview, setAiFilePreview] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showAiAdModal, setShowAiAdModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [aiLimits, setAiLimits] = useState(null);
    const fileInputRef = useRef(null);

    const navigate = useNavigate();
    const toast = useToast();
    const { watchAd, loading: adLoading } = useRewardedAd();

    useEffect(() => {
        Promise.all([api.getFolders(), api.getClasses(), api.getTags(), api.getAILimits()])
            .then(([foldersData, classesData, tagsData, limitsData]) => {
                setFolders(foldersData);
                setClasses(classesData);
                setTags(tagsData);
                setAiLimits(limitsData);
            });
    }, []);

    const toggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File must be under 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAiFile({
                data: reader.result.split(',')[1],
                mimeType: file.type
            });
            setAiFilePreview(file.name);
        };
        reader.readAsDataURL(file);
    };

    const removeFile = () => {
        setAiFile(null);
        setAiFilePreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        setLoading(true);
        try {
            const newDeck = await api.createDeck(title, description, selectedFolder, selectedTags, selectedClass);
            toast.success('Deck created!');
            navigate(`/deck/${newDeck.id}`);
        } catch {
            toast.error('Failed to create deck');
        } finally {
            setLoading(false);
        }
    };

    const handleAIGenerate = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Give your deck a name first');
            return;
        }
        if (!aiFile && !aiNotes.trim()) {
            toast.error('Upload a file or paste your notes');
            return;
        }

        setIsGeneratingAI(true);
        try {
            const result = await api.generateAiDeck(
                aiNotes,
                aiFile,
                title,
                selectedClass
            );
            toast.success(`Generated ${result.card_count} flashcards!`);
            navigate(`/deck/${result.deck_id}`);
        } catch (err) {
            if (err.status === 429 && err.message?.includes('Watch an ad')) {
                setShowAiAdModal(true);
            } else {
                toast.error(err.message || 'Failed to generate flashcards');
            }
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const selectedFolderData = folders.find(f => f.id === selectedFolder);

    return (
        <div className="min-h-full flex flex-col safe-area-top">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-claude-bg/95 backdrop-blur-md border-b border-claude-border/50">
                <div className="flex items-center justify-between py-3">
                    <Link to="/" className="touch-target text-claude-secondary active:text-claude-text -ml-2">
                        <X className="w-6 h-6" />
                    </Link>
                    <h1 className="font-display font-bold text-lg">New Deck</h1>
                    <div className="w-10" />
                </div>

                {/* Mode Toggle — Segmented Control */}
                <div className="pb-3">
                    <div className="relative flex glass-panel rounded-xl p-1 gap-1">
                        {MODES.map(m => {
                            const Icon = m.icon;
                            const isActive = mode === m.id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMode(m.id)}
                                    className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 tap-action z-10
                                        ${isActive ? 'text-[#162a31]' : 'text-claude-secondary'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="font-mono text-[11px] uppercase tracking-widest font-bold">{m.label}</span>
                                </button>
                            );
                        })}
                        {/* Sliding indicator */}
                        <motion.div
                            layout
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="absolute top-1 bottom-1 rounded-lg"
                            style={{
                                left: mode === 'manual' ? '4px' : '50%',
                                width: 'calc(50% - 6px)',
                                background: 'var(--accent-color)',
                                boxShadow: '0 2px 12px rgba(222,185,106,0.25)',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Form */}
            <form
                onSubmit={mode === 'manual' ? handleManualSubmit : handleAIGenerate}
                className="flex-1 flex flex-col py-6"
            >
                <AnimatePresence mode="wait">
                    {mode === 'manual' ? (
                        <motion.div
                            key="manual"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 space-y-5"
                        >
                            {/* Title */}
                            <div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-claude-border focus:border-claude-accent outline-none transition-colors text-2xl font-display font-bold placeholder:text-claude-secondary/50"
                                    placeholder="Deck name"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-4 py-3 glass-panel rounded-xl focus:border-claude-accent outline-none transition-colors min-h-[80px] resize-none text-sm"
                                    placeholder="Add a description (optional)"
                                />
                            </div>

                            {/* Folder Picker */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Folder</label>
                                <button
                                    type="button"
                                    onClick={() => { setShowFolderPicker(!showFolderPicker); setShowClassPicker(false); }}
                                    className="w-full px-4 py-3.5 glass-panel rounded-xl flex items-center justify-between active:bg-claude-bg transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Folder className="w-5 h-5" style={{ color: selectedFolderData?.color || 'var(--secondary-text-color)' }} />
                                        <span className={selectedFolder ? '' : 'text-claude-secondary'}>
                                            {selectedFolderData?.name || 'None'}
                                        </span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 text-claude-secondary transition-transform ${showFolderPicker ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showFolderPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-2 glass-panel rounded-xl overflow-hidden"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedFolder(null); setShowFolderPicker(false); }}
                                                className={`w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-claude-bg ${!selectedFolder ? 'bg-claude-accent/10' : ''}`}
                                            >
                                                <Folder className="w-5 h-5 text-claude-secondary" />
                                                <span>None</span>
                                                {!selectedFolder && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                                            </button>
                                            {folders.map(folder => (
                                                <button
                                                    key={folder.id}
                                                    type="button"
                                                    onClick={() => { setSelectedFolder(folder.id); setShowFolderPicker(false); }}
                                                    className={`w-full px-4 py-3.5 flex items-center gap-3 text-left border-t border-claude-border active:bg-claude-bg ${selectedFolder === folder.id ? 'bg-claude-accent/10' : ''}`}
                                                >
                                                    <Folder className="w-5 h-5" style={{ color: folder.color }} />
                                                    <span>{folder.name}</span>
                                                    {selectedFolder === folder.id && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Class Picker */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Class (Optional)</label>
                                <button
                                    type="button"
                                    onClick={() => { setShowClassPicker(!showClassPicker); setShowFolderPicker(false); }}
                                    className="w-full px-4 py-3.5 glass-panel rounded-xl flex items-center justify-between active:bg-claude-bg transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-claude-secondary" style={{ color: classes.find(c => c.id === selectedClass)?.color || 'var(--secondary-text-color)' }} />
                                        <span className={selectedClass ? '' : 'text-claude-secondary'}>
                                            {classes.find(c => c.id === selectedClass)?.name || 'None'}
                                        </span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 text-claude-secondary transition-transform ${showClassPicker ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showClassPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-2 glass-panel rounded-xl overflow-hidden shadow-sm z-20 relative"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedClass(null); setShowClassPicker(false); }}
                                                className={`w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-claude-bg ${!selectedClass ? 'bg-claude-accent/10' : ''}`}
                                            >
                                                <Calendar className="w-5 h-5 text-claude-secondary" />
                                                <span>None</span>
                                                {!selectedClass && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                                            </button>
                                            {classes.map(cls => (
                                                <button
                                                    key={cls.id}
                                                    type="button"
                                                    onClick={() => { setSelectedClass(cls.id); setShowClassPicker(false); }}
                                                    className={`w-full px-4 py-3.5 flex items-center gap-3 text-left border-t border-claude-border active:bg-claude-bg ${selectedClass === cls.id ? 'bg-claude-accent/10' : ''}`}
                                                >
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color || '#7a9e72' }} />
                                                    <span>{cls.name}</span>
                                                    {selectedClass === cls.id && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Tags */}
                            {tags.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-all active:scale-95 ${selectedTags.includes(tag.id)
                                                    ? 'text-white shadow-md'
                                                    : 'glass-panel'
                                                    }`}
                                                style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                                            >
                                                <Hash className="w-3.5 h-3.5" style={!selectedTags.includes(tag.id) ? { color: tag.color } : {}} />
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ai"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 space-y-5"
                        >
                            {/* AI Limits Badge */}
                            {aiLimits && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest font-bold"
                                        style={{
                                            background: aiLimits.remaining > 0
                                                ? 'rgba(122,158,114,0.15)'
                                                : 'rgba(239,68,68,0.15)',
                                            color: aiLimits.remaining > 0
                                                ? '#7a9e72'
                                                : '#ef4444',
                                            border: `1px solid ${aiLimits.remaining > 0 ? 'rgba(122,158,114,0.3)' : 'rgba(239,68,68,0.3)'}`
                                        }}
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        {aiLimits.remaining}/{aiLimits.max} generations
                                    </div>
                                </div>
                            )}

                            {/* Deck Name */}
                            <div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-claude-border focus:border-claude-accent outline-none transition-colors text-2xl font-display font-bold placeholder:text-claude-secondary/50"
                                    placeholder="Deck name"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Notes / Source Material */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                    Notes or Source Material
                                </label>
                                <textarea
                                    value={aiNotes}
                                    onChange={e => setAiNotes(e.target.value)}
                                    className="w-full px-4 py-3 glass-panel rounded-xl focus:border-claude-accent outline-none transition-colors min-h-[120px] resize-none text-sm"
                                    placeholder="Paste your notes, lecture content, or key concepts here..."
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                    Or Upload a File
                                </label>
                                {aiFilePreview ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center justify-between glass-panel rounded-xl p-3.5"
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                                                style={{ background: 'rgba(222,185,106,0.12)', border: '1px solid rgba(222,185,106,0.2)' }}
                                            >
                                                <FileText className="w-5 h-5 text-claude-accent" />
                                            </div>
                                            <div className="truncate">
                                                <span className="font-mono text-xs text-botanical-parchment truncate block">{aiFilePreview}</span>
                                                <span className="font-mono text-[10px] text-claude-secondary uppercase tracking-widest">Ready for analysis</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={removeFile} className="p-2 text-red-400 hover:text-red-300 shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ) : (
                                    <label className="flex items-center justify-center w-full py-8 glass-panel border border-dashed border-claude-border/60 rounded-xl cursor-pointer hover:border-claude-accent/40 transition-all group">
                                        <div className="flex flex-col items-center gap-2 text-claude-secondary group-hover:text-claude-accent transition-colors">
                                            <Upload className="w-6 h-6" />
                                            <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
                                                PDF, Doc, Image — up to 5MB
                                            </span>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Class Picker (AI mode) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Class (Optional)</label>
                                <button
                                    type="button"
                                    onClick={() => setShowClassPicker(!showClassPicker)}
                                    className="w-full px-4 py-3.5 glass-panel rounded-xl flex items-center justify-between active:bg-claude-bg transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-claude-secondary" style={{ color: classes.find(c => c.id === selectedClass)?.color || 'var(--secondary-text-color)' }} />
                                        <span className={selectedClass ? '' : 'text-claude-secondary'}>
                                            {classes.find(c => c.id === selectedClass)?.name || 'None'}
                                        </span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 text-claude-secondary transition-transform ${showClassPicker ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showClassPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-2 glass-panel rounded-xl overflow-hidden shadow-sm z-20 relative"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedClass(null); setShowClassPicker(false); }}
                                                className={`w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-claude-bg ${!selectedClass ? 'bg-claude-accent/10' : ''}`}
                                            >
                                                <Calendar className="w-5 h-5 text-claude-secondary" />
                                                <span>None</span>
                                                {!selectedClass && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                                            </button>
                                            {classes.map(cls => (
                                                <button
                                                    key={cls.id}
                                                    type="button"
                                                    onClick={() => { setSelectedClass(cls.id); setShowClassPicker(false); }}
                                                    className={`w-full px-4 py-3.5 flex items-center gap-3 text-left border-t border-claude-border active:bg-claude-bg ${selectedClass === cls.id ? 'bg-claude-accent/10' : ''}`}
                                                >
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color || '#7a9e72' }} />
                                                    <span>{cls.name}</span>
                                                    {selectedClass === cls.id && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Button */}
                <div className="sticky bottom-0 pt-4 mt-6 pb-4 bg-gradient-to-t from-claude-bg via-claude-bg">
                    {mode === 'manual' ? (
                        <button
                            type="submit"
                            disabled={loading || !title.trim()}
                            className="w-full claude-button-primary text-lg disabled:opacity-50 disabled:active:scale-100"
                        >
                            {loading ? 'Creating...' : 'Create Deck'}
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={isGeneratingAI || !title.trim() || (!aiFile && !aiNotes.trim())}
                            className="w-full claude-button-primary text-lg disabled:opacity-50 disabled:active:scale-100 gap-2"
                        >
                            {isGeneratingAI ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Generate Flashcards
                                </>
                            )}
                        </button>
                    )}
                </div>
            </form>

            {/* AI Limit Modals */}
            <AdRewardModal
                isOpen={showAiAdModal}
                onClose={() => setShowAiAdModal(false)}
                title="AI Limit Reached"
                description="You've used all your AI generations. Watch a short ad to get 1 more, or upgrade for 50 per session."
                adLabel="Watch Ad for +1 Generation"
                loading={adLoading}
                onWatchAd={async () => {
                    try {
                        await watchAd('ai_generation');
                        setShowAiAdModal(false);
                        toast.success('You earned 1 extra AI generation!');
                        // Refresh limits
                        const limits = await api.getAILimits();
                        setAiLimits(limits);
                    } catch {
                        // Error handled by hook
                    }
                }}
                onUpgrade={() => {
                    setShowAiAdModal(false);
                    setShowPricingModal(true);
                }}
            />
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
        </div>
    );
}
