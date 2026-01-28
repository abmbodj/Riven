import * as db from './db/indexedDB';

// Wrapper to handle errors gracefully
const safeCall = async (fn) => {
    try {
        return await fn();
    } catch (error) {
        console.error('Database operation failed:', error);
        throw error;
    }
};

export const api = {
    // ============ FOLDERS ============
    getFolders: () => safeCall(() => db.getFolders()),
    createFolder: (name, color, icon) => safeCall(() => db.createFolder(name, color, icon)),
    updateFolder: (id, name, color, icon) => safeCall(() => db.updateFolder(id, name, color, icon)),
    deleteFolder: (id) => safeCall(() => db.deleteFolder(id)),

    // ============ TAGS ============
    getTags: () => safeCall(() => db.getTags()),
    createTag: (name, color) => safeCall(() => db.createTag(name, color)),
    deleteTag: (id) => safeCall(() => db.deleteTag(id)),

    // ============ DECKS ============
    getDecks: () => safeCall(() => db.getDecks()),
    getDeck: (id) => safeCall(() => db.getDeck(id)),
    createDeck: (title, description, folderId, tagIds) => safeCall(() => db.createDeck(title, description, folderId, tagIds || [])),
    updateDeck: (id, title, description, folderId, tagIds) => safeCall(() => db.updateDeck(id, title, description, folderId, tagIds || [])),
    deleteDeck: (id) => safeCall(() => db.deleteDeck(id)),
    duplicateDeck: (id) => safeCall(() => db.duplicateDeck(id)),
    exportDeck: (id, format) => safeCall(() => db.exportDeck(id, format)),
    
    moveDeck: async (id, folderId) => {
        return safeCall(async () => {
            const deck = await db.getDeck(id);
            return db.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
        });
    },

    // ============ CARDS ============
    addCard: (deckId, front, back) => safeCall(() => db.addCard(deckId, front, back)),
    updateCard: (id, front, back) => safeCall(() => db.updateCard(id, front, back)),
    deleteCard: (id) => safeCall(() => db.deleteCard(id)),

    // ============ SPACED REPETITION ============
    reviewCard: (id, correct) => safeCall(() => db.reviewCard(id, correct)),
    reorderCards: (deckId, cardIds) => safeCall(() => db.reorderCards(deckId, cardIds)),

    // ============ STUDY SESSIONS ============
    saveStudySession: (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) => 
        safeCall(() => db.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType)),
    getDeckStats: (deckId) => safeCall(() => db.getDeckStats(deckId)),

    // ============ THEMES ============
    getThemes: () => safeCall(() => db.getThemes()),
    activateTheme: (id) => safeCall(() => db.setActiveTheme(id)),
    createTheme: async () => {
        console.warn('createTheme not implemented for offline mode');
        return null;
    },
};
