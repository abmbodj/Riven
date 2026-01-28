import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function CreateDeck() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        setLoading(true);
        try {
            const newDeck = await api.createDeck(title, description);
            toast.success('Deck created!');
            navigate(`/deck/${newDeck.id}`);
        } catch (err) {
            toast.error('Failed to create deck');
        } finally {
            setLoading(false);
        }
    };

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
