import * as localDb from './db/indexedDB';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Cache server availability
let isServerAvailable = null;

const checkServer = async () => {
    if (isServerAvailable !== null) return isServerAvailable;
    try {
        const response = await fetch(`${API_BASE_URL}/folders`, { method: 'HEAD' });
        isServerAvailable = response.ok;
    } catch {
        isServerAvailable = false;
    }
    return isServerAvailable;
};

// Wrapper to handle errors and fallback to local DB
const hybridCall = async (serverPath, localFn, method = 'GET', body = null) => {
    const serverActive = await checkServer();

    if (serverActive) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) options.body = JSON.stringify(body);

            const response = await fetch(`${API_BASE_URL}${serverPath}`, options);
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.warn(`Server call failed, falling back to local DB: ${error.message}`);
        }
    }

    // Fallback to local IndexedDB
    try {
        return await localFn();
    } catch (error) {
        console.error('Local database operation failed:', error);
        throw error;
    }
};

export const api = {
    // ============ FOLDERS ============
    getFolders: () => hybridCall('/folders', () => localDb.getFolders()),
    createFolder: (name, color, icon) =>
        hybridCall('/folders', () => localDb.createFolder(name, color, icon), 'POST', { name, color, icon }),
    updateFolder: (id, name, color, icon) =>
        hybridCall(`/folders/${id}`, () => localDb.updateFolder(id, name, color, icon), 'PUT', { name, color, icon }),
    deleteFolder: (id) =>
        hybridCall(`/folders/${id}`, () => localDb.deleteFolder(id), 'DELETE'),

    // ============ TAGS ============
    getTags: () => hybridCall('/tags', () => localDb.getTags()),
    createTag: (name, color) =>
        hybridCall('/tags', () => localDb.createTag(name, color), 'POST', { name, color }),
    deleteTag: (id) =>
        hybridCall(`/tags/${id}`, () => localDb.deleteTag(id), 'DELETE'),

    // ============ DECKS ============
    getDecks: () => hybridCall('/decks', () => localDb.getDecks()),
    getDeck: (id) => hybridCall(`/decks/${id}`, () => localDb.getDeck(id)),
    createDeck: (title, description, folderId, tagIds) =>
        hybridCall('/decks', () => localDb.createDeck(title, description, folderId, tagIds || []), 'POST', { title, description, folder_id: folderId, tagIds }),
    updateDeck: (id, title, description, folderId, tagIds) =>
        hybridCall(`/decks/${id}`, () => localDb.updateDeck(id, title, description, folderId, tagIds || []), 'PUT', { title, description, folder_id: folderId, tagIds }),
    deleteDeck: (id) =>
        hybridCall(`/decks/${id}`, () => localDb.deleteDeck(id), 'DELETE'),
    duplicateDeck: (id) =>
        hybridCall(`/decks/${id}/duplicate`, () => localDb.duplicateDeck(id), 'POST'),
    exportDeck: (id, format) =>
        hybridCall(`/decks/${id}/export?format=${format}`, () => localDb.exportDeck(id, format)),

    moveDeck: async (id, folderId) => {
        return hybridCall(`/decks/${id}/move`, async () => {
            const deck = await localDb.getDeck(id);
            return localDb.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
        }, 'PUT', { folder_id: folderId });
    },

    // ============ CARDS ============
    addCard: (deckId, front, back) =>
        hybridCall(`/decks/${deckId}/cards`, () => localDb.addCard(deckId, front, back), 'POST', { front, back }),
    updateCard: (id, front, back) =>
        hybridCall(`/cards/${id}`, () => localDb.updateCard(id, front, back), 'PUT', { front, back }),
    deleteCard: (id) =>
        hybridCall(`/cards/${id}`, () => localDb.deleteCard(id), 'DELETE'),

    // ============ SPACED REPETITION ============
    reviewCard: (id, correct) =>
        hybridCall(`/cards/${id}/review`, () => localDb.reviewCard(id, correct), 'PUT', { correct }),
    reorderCards: (deckId, cardIds) =>
        hybridCall(`/decks/${deckId}/reorder`, () => localDb.reorderCards(deckId, cardIds), 'PUT', { cardIds }),

    // ============ STUDY SESSIONS ============
    saveStudySession: (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) =>
        hybridCall('/study-sessions', () => localDb.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType), 'POST', { deck_id: deckId, cards_studied: cardsStudied, cards_correct: cardsCorrect, duration_seconds: durationSeconds, session_type: sessionType }),
    getDeckStats: (deckId) => hybridCall(`/decks/${deckId}/stats`, () => localDb.getDeckStats(deckId)),

    // ============ THEMES ============
    getThemes: () => hybridCall('/themes', () => localDb.getThemes()),
    activateTheme: (id) =>
        hybridCall(`/themes/${id}/activate`, () => localDb.setActiveTheme(id), 'PUT')
};
