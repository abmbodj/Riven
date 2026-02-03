import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
    ArrowLeft, Share2, Link2, Copy, Check, Trash2, 
    Download, Search, User, Clock, Layers, X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { api } from '../api';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

export default function SharedDecks() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn, shareDeck, getSharedDeck, unshareDeck, getMySharedDecks } = useAuth();

    const [view, setView] = useState('list'); // 'list', 'share', 'import'
    const [shareCode, setShareCode] = useState(searchParams.get('code') || '');
    const [copied, setCopied] = useState(null);
    const [loading, setLoading] = useState(false);
    const [decks, setDecks] = useState([]);
    const [selectedDeck, setSelectedDeck] = useState(null);
    const [generatedLink, setGeneratedLink] = useState(null);
    const [importedDeck, setImportedDeck] = useState(null);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, shareId: null });
    const [sharedDecks, setSharedDecks] = useState([]);

    // Load user's decks for sharing
    React.useEffect(() => {
        api.getDecks().then(setDecks).catch(() => {});
    }, []);

    // Load user's shared decks
    React.useEffect(() => {
        if (isLoggedIn) {
            getMySharedDecks().then(setSharedDecks).catch(() => setSharedDecks([]));
        }
    }, [isLoggedIn, getMySharedDecks]);

    // Check URL for share code
    React.useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            setShareCode(code);
            setView('import');
        }
    }, [searchParams]);

    const handleShareDeck = async () => {
        if (!isLoggedIn) {
            setAlert({ show: true, title: 'Sign In Required', message: 'Please sign in to share decks', type: 'warning' });
            return;
        }
        if (!selectedDeck) {
            setAlert({ show: true, title: 'Select a Deck', message: 'Please select a deck to share', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const fullDeck = await api.getDeck(selectedDeck.id);
            const shareId = await shareDeck(selectedDeck.id, fullDeck);
            const link = `${window.location.origin}/shared?code=${shareId}`;
            setGeneratedLink(link);
            haptics.success();
            toast.success('Deck shared!');
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Share Failed', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleImportDeck = async () => {
        if (!shareCode.trim()) {
            setAlert({ show: true, title: 'Enter Code', message: 'Please enter a share code or link', type: 'warning' });
            return;
        }

        // Extract share ID from code or link
        let shareId = shareCode.trim();
        if (shareId.includes('code=')) {
            shareId = new URL(shareId).searchParams.get('code');
        }

        setLoading(true);
        try {
            const sharedDeckData = getSharedDeck(shareId);
            if (!sharedDeckData) {
                throw new Error('Shared deck not found');
            }
            setImportedDeck(sharedDeckData);
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Import Failed', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importedDeck) return;

        setLoading(true);
        try {
            const deckData = importedDeck.deckData;
            // Create the deck in local storage
            const newDeck = await api.createDeck(
                `${deckData.title} (Shared)`,
                deckData.description,
                null,
                []
            );

            // Add all cards
            for (const card of deckData.cards || []) {
                await api.addCard(newDeck.id, card.front, card.back);
            }

            haptics.success();
            toast.success('Deck imported!');
            navigate(`/deck/${newDeck.id}`);
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Import Failed', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUnshareDeck = async (shareId) => {
        try {
            await unshareDeck(shareId);
            haptics.medium();
            toast.success('Deck unshared');
            setDeleteConfirm({ show: false, shareId: null });
        } catch (err) {
            haptics.error();
            setAlert({ show: true, title: 'Error', message: err.message, type: 'error' });
        }
    };

    const copyLink = (link) => {
        navigator.clipboard.writeText(link);
        setCopied(link);
        haptics.selection();
        setTimeout(() => setCopied(null), 2000);
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-claude-bg safe-area-top safe-area-bottom flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-3xl bg-purple-500/20 flex items-center justify-center mb-6">
                    <Share2 className="w-10 h-10 text-purple-500" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-2">Share Decks</h2>
                <p className="text-claude-secondary text-center mb-6">Sign in to share decks with friends</p>
                <Link to="/account" className="claude-button-primary px-8">Sign In</Link>
                <Link to="/" className="text-claude-secondary text-sm mt-4 underline">Go Back</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-claude-bg safe-area-top safe-area-bottom pb-24">
            <div className="px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/account" className="p-2 -ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-2xl font-display font-bold">Shared Decks</h1>
                </div>

                {/* Tabs */}
                <div className="flex bg-claude-surface rounded-xl p-1 mb-6 gap-1">
                    <button
                        onClick={() => { setView('list'); setGeneratedLink(null); setImportedDeck(null); }}
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                            view === 'list' ? 'bg-claude-accent text-white' : 'text-claude-secondary'
                        }`}
                    >
                        My Shares
                    </button>
                    <button
                        onClick={() => { setView('share'); setGeneratedLink(null); }}
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                            view === 'share' ? 'bg-claude-accent text-white' : 'text-claude-secondary'
                        }`}
                    >
                        Share
                    </button>
                    <button
                        onClick={() => { setView('import'); setImportedDeck(null); }}
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                            view === 'import' ? 'bg-claude-accent text-white' : 'text-claude-secondary'
                        }`}
                    >
                        Import
                    </button>
                </div>

                {/* List View */}
                {view === 'list' && (
                    <div>
                        {sharedDecks.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 rounded-full bg-claude-surface flex items-center justify-center mx-auto mb-4">
                                    <Share2 className="w-8 h-8 text-claude-secondary" />
                                </div>
                                <p className="text-claude-secondary mb-4">No shared decks yet</p>
                                <button
                                    onClick={() => setView('share')}
                                    className="text-claude-accent font-semibold"
                                >
                                    Share your first deck
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sharedDecks.map(deck => (
                                    <div key={deck.shareId} className="bg-claude-surface border border-claude-border rounded-2xl p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{deck.deckData.title}</h3>
                                                <p className="text-sm text-claude-secondary mt-1">
                                                    {deck.deckData.cards?.length || 0} cards
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setDeleteConfirm({ show: true, shareId: deck.shareId })}
                                                className="p-2 text-red-400"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 bg-claude-bg rounded-xl p-3">
                                            <Link2 className="w-4 h-4 text-claude-secondary shrink-0" />
                                            <span className="text-xs text-claude-secondary truncate flex-1 font-mono">
                                                {window.location.origin}/shared?code={deck.shareId}
                                            </span>
                                            <button
                                                onClick={() => copyLink(`${window.location.origin}/shared?code=${deck.shareId}`)}
                                                className="p-1.5 bg-claude-surface rounded-lg shrink-0"
                                            >
                                                {copied === `${window.location.origin}/shared?code=${deck.shareId}` ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-claude-secondary mt-2">
                                            Shared {new Date(deck.sharedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Share View */}
                {view === 'share' && (
                    <div>
                        {generatedLink ? (
                            <div className="bg-claude-surface border border-green-500/30 rounded-2xl p-6">
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-green-500" />
                                </div>
                                <h3 className="text-xl font-display font-bold text-center mb-2">Deck Shared!</h3>
                                <p className="text-claude-secondary text-center text-sm mb-4">
                                    Share this link with friends
                                </p>
                                <div className="flex items-center gap-2 bg-claude-bg rounded-xl p-3 mb-4">
                                    <span className="text-xs text-claude-secondary truncate flex-1 font-mono">
                                        {generatedLink}
                                    </span>
                                    <button
                                        onClick={() => copyLink(generatedLink)}
                                        className="p-2 bg-claude-surface rounded-lg shrink-0"
                                    >
                                        {copied === generatedLink ? (
                                            <Check className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <Copy className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setGeneratedLink(null); setSelectedDeck(null); }}
                                    className="w-full py-3 text-claude-secondary"
                                >
                                    Share another deck
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-claude-secondary mb-4">Select a deck to share</p>
                                <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
                                    {decks.map(deck => (
                                        <button
                                            key={deck.id}
                                            onClick={() => setSelectedDeck(deck)}
                                            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                                                selectedDeck?.id === deck.id
                                                    ? 'border-claude-accent bg-claude-accent/10'
                                                    : 'border-claude-border bg-claude-surface'
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-claude-bg flex items-center justify-center">
                                                <Layers className="w-5 h-5 text-claude-accent" />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-medium">{deck.title}</p>
                                                <p className="text-sm text-claude-secondary">{deck.cardCount} cards</p>
                                            </div>
                                            {selectedDeck?.id === deck.id && (
                                                <Check className="w-5 h-5 text-claude-accent" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleShareDeck}
                                    disabled={!selectedDeck || loading}
                                    className="w-full py-4 bg-claude-accent text-white rounded-xl font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform"
                                >
                                    {loading ? 'Sharing...' : 'Generate Share Link'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Import View */}
                {view === 'import' && (
                    <div>
                        {importedDeck ? (
                            <div className="bg-claude-surface border border-claude-border rounded-2xl p-6">
                                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Download className="w-8 h-8 text-purple-500" />
                                </div>
                                <h3 className="text-xl font-display font-bold text-center mb-4">
                                    {importedDeck.deckData.title}
                                </h3>
                                <div className="bg-claude-bg rounded-xl p-4 mb-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-claude-secondary">Cards</span>
                                        <span>{importedDeck.deckData.cards?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-claude-secondary">Shared by</span>
                                        <span>{importedDeck.sharedBy.username}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-claude-secondary">Shared on</span>
                                        <span>{new Date(importedDeck.sharedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {importedDeck.deckData.description && (
                                    <p className="text-sm text-claude-secondary mb-4">
                                        {importedDeck.deckData.description}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setImportedDeck(null); setShareCode(''); }}
                                        className="flex-1 py-4 bg-claude-bg rounded-xl font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmImport}
                                        disabled={loading}
                                        className="flex-1 py-4 bg-purple-500 text-white rounded-xl font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform"
                                    >
                                        {loading ? 'Importing...' : 'Import Deck'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-claude-secondary mb-4">Enter a share link or code</p>
                                <div className="relative mb-4">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                                    <input
                                        type="text"
                                        placeholder="Paste link or enter code..."
                                        value={shareCode}
                                        onChange={e => setShareCode(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                                    />
                                    {shareCode && (
                                        <button
                                            onClick={() => setShareCode('')}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-claude-secondary"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleImportDeck}
                                    disabled={!shareCode.trim() || loading}
                                    className="w-full py-4 bg-purple-500 text-white rounded-xl font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform"
                                >
                                    {loading ? 'Looking up...' : 'Find Deck'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Alert Modal */}
            <AlertModal
                isOpen={alert.show}
                onClose={() => setAlert({ ...alert, show: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Unshare Deck?"
                message="This will remove the share link. Anyone with the link will no longer be able to import this deck."
                confirmText="Unshare"
                onConfirm={() => handleUnshareDeck(deleteConfirm.shareId)}
                onCancel={() => setDeleteConfirm({ show: false, shareId: null })}
            />
        </div>
    );
}
