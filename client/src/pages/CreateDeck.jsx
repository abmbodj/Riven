import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { api } from '../api';

export default function CreateDeck() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        setLoading(true);
        try {
            const newDeck = await api.createDeck(title, description);
            navigate(`/deck/${newDeck.id}`);
        } catch (err) {
            alert('Failed to create deck');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-claude-secondary hover:text-claude-text mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Library
            </Link>

            <div className="mb-10">
                <div className="w-12 h-12 bg-claude-text text-white rounded-2xl flex items-center justify-center mb-6">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h1 className="text-4xl font-display font-bold mb-3">Create New Deck</h1>
                <p className="text-claude-secondary text-lg leading-relaxed">Give your deck a name and description to get started. You'll add cards on the next screen.</p>
            </div>

            <form onSubmit={handleSubmit} className="claude-card p-8 space-y-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">Deck Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-5 py-4 bg-claude-bg border border-claude-border rounded-2xl focus:ring-2 focus:ring-claude-text/5 focus:border-claude-text outline-none transition-all text-lg font-medium"
                            placeholder="e.g., Advanced Organic Chemistry"
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-5 py-4 bg-claude-bg border border-claude-border rounded-2xl focus:ring-2 focus:ring-claude-text/5 focus:border-claude-text outline-none transition-all min-h-[120px] resize-none leading-relaxed"
                            placeholder="What will you master in this deck?"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="w-full claude-button-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? 'Creating Deck...' : 'Create Deck'}
                    </button>
                    <p className="text-center text-[10px] text-claude-secondary mt-4 font-medium uppercase tracking-widest">
                        You can add cards immediately after creating
                    </p>
                </div>
            </form>
        </div>
    );
}
