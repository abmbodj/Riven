import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Folder, Hash, ChevronDown, Check, X } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';

export default function CreateDeck() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [folders, setFolders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        Promise.all([api.getFolders(), api.getTags()])
            .then(([foldersData, tagsData]) => {
                setFolders(foldersData);
                setTags(tagsData);
            });
    }, []);

    const toggleTag = (tagId) => {
        setSelectedTags(prev => 
            prev.includes(tagId) 
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        setLoading(true);
        try {
            const newDeck = await api.createDeck(title, description, selectedFolder, selectedTags);
            toast.success('Deck created!');
            navigate(`/deck/${newDeck.id}`);
        } catch {
            toast.error('Failed to create deck');
        } finally {
            setLoading(false);
        }
    };

    const selectedFolderData = folders.find(f => f.id === selectedFolder);

    return (
        <div className="min-h-full flex flex-col safe-area-top">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-claude-bg/95 backdrop-blur-md py-3 border-b border-claude-border/50">
                <div className="flex items-center justify-between">
                    <Link to="/" className="touch-target text-claude-secondary active:text-claude-text -ml-2">
                        <X className="w-6 h-6" />
                    </Link>
                    <h1 className="font-display font-bold text-lg">New Deck</h1>
                    <div className="w-10" />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col py-6">
                <div className="flex-1 space-y-5">
                    {/* Title - Most important, larger */}
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
                            className="w-full px-4 py-3 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none transition-colors min-h-[80px] resize-none text-sm"
                            placeholder="Add a description (optional)"
                        />
                    </div>

                    {/* Folder Picker */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Folder</label>
                        <button
                            type="button"
                            onClick={() => setShowFolderPicker(!showFolderPicker)}
                            className="w-full px-4 py-3.5 bg-claude-surface border border-claude-border rounded-xl flex items-center justify-between active:bg-claude-bg transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Folder className="w-5 h-5" style={{ color: selectedFolderData?.color || 'var(--secondary-text-color)' }} />
                                <span className={selectedFolder ? '' : 'text-claude-secondary'}>
                                    {selectedFolderData?.name || 'None'}
                                </span>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-claude-secondary transition-transform ${showFolderPicker ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showFolderPicker && (
                            <div className="mt-2 bg-claude-surface border border-claude-border rounded-xl overflow-hidden">
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
                            </div>
                        )}
                    </div>

                    {/* Tags Picker */}
                    {tags.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Tags</label>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-all active:scale-95 ${
                                            selectedTags.includes(tag.id)
                                                ? 'text-white shadow-md'
                                                : 'bg-claude-surface border border-claude-border'
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
                </div>

                {/* Sticky footer button */}
                <div className="sticky bottom-0 pt-4 mt-6 pb-4 bg-gradient-to-t from-claude-bg via-claude-bg">
                    <button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="w-full claude-button-primary text-lg disabled:opacity-50 disabled:active:scale-100"
                    >
                        {loading ? 'Creating...' : 'Create Deck'}
                    </button>
                </div>
            </form>
        </div>
    );
}
