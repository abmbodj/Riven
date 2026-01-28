import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Folder, Hash, ChevronDown, Check } from 'lucide-react';
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
        <div className="animate-in fade-in duration-500">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-claude-secondary active:text-claude-text mb-6">
                <ArrowLeft className="w-4 h-4" />
                Back
            </Link>

            <div className="mb-8">
                <div className="w-12 h-12 bg-claude-accent text-white rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-display font-bold mb-2">New Deck</h1>
                <p className="text-claude-secondary text-sm">Give your deck a name to get started</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full px-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none transition-colors text-lg"
                        placeholder="e.g., Spanish Basics"
                        required
                        autoFocus
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Description (Optional)</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full px-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none transition-colors min-h-[100px] resize-none"
                        placeholder="What will you learn?"
                    />
                </div>

                {/* Folder Picker */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Folder (Optional)</label>
                    <button
                        type="button"
                        onClick={() => setShowFolderPicker(!showFolderPicker)}
                        className="w-full px-4 py-4 bg-claude-surface border border-claude-border rounded-xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <Folder className="w-5 h-5" style={{ color: selectedFolderData?.color || 'var(--color-secondary)' }} />
                            <span className={selectedFolder ? '' : 'text-claude-secondary'}>
                                {selectedFolderData?.name || 'No folder'}
                            </span>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-claude-secondary transition-transform ${showFolderPicker ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showFolderPicker && (
                        <div className="mt-2 bg-claude-surface border border-claude-border rounded-xl overflow-hidden">
                            <button
                                type="button"
                                onClick={() => { setSelectedFolder(null); setShowFolderPicker(false); }}
                                className={`w-full px-4 py-3 flex items-center gap-3 text-left ${!selectedFolder ? 'bg-claude-accent/10' : ''}`}
                            >
                                <Folder className="w-5 h-5 text-claude-secondary" />
                                <span>No folder</span>
                                {!selectedFolder && <Check className="w-4 h-4 text-claude-accent ml-auto" />}
                            </button>
                            {folders.map(folder => (
                                <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => { setSelectedFolder(folder.id); setShowFolderPicker(false); }}
                                    className={`w-full px-4 py-3 flex items-center gap-3 text-left border-t border-claude-border ${selectedFolder === folder.id ? 'bg-claude-accent/10' : ''}`}
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
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Tags (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={`px-3 py-2 rounded-full flex items-center gap-1.5 text-sm transition-colors ${
                                    selectedTags.includes(tag.id)
                                        ? 'text-white'
                                        : 'bg-claude-surface border border-claude-border'
                                }`}
                                style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                            >
                                <Hash className="w-3.5 h-3.5" style={!selectedTags.includes(tag.id) ? { color: tag.color } : {}} />
                                <span className="font-medium">{tag.name}</span>
                            </button>
                        ))}
                        {tags.length === 0 && (
                            <span className="text-claude-secondary text-sm">No tags available. Create tags from the Library.</span>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !title.trim()}
                    className="w-full claude-button-primary py-4 text-lg disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Deck'}
                </button>
            </form>
        </div>
    );
}
