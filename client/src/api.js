import * as db from './db/indexedDB';

export const api = {
    // ============ FOLDERS ============
    getFolders: () => db.getFolders(),
    createFolder: (name, color, icon) => db.createFolder(name, color, icon),
    updateFolder: (id, name, color, icon) => db.updateFolder(id, name, color, icon),
    deleteFolder: (id) => db.deleteFolder(id),

    // ============ TAGS ============
    getTags: () => db.getTags(),
    createTag: (name, color) => db.createTag(name, color),
    deleteTag: (id) => db.deleteTag(id),

    // ============ DECKS ============
    getDecks: () => db.getDecks(),
    getDeck: (id) => db.getDeck(id),
    createDeck: (title, description, folderId, tagIds) => db.createDeck(title, description, folderId, tagIds || []),
    updateDeck: (id, title, description, folderId, tagIds) => db.updateDeck(id, title, description, folderId, tagIds || []),
    deleteDeck: (id) => db.deleteDeck(id),
    duplicateDeck: (id) => db.duplicateDeck(id),
    exportDeck: (id, format) => db.exportDeck(id, format),
    
    moveDeck: async (id, folderId) => {
        const deck = await db.getDeck(id);
        return db.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
    },

    // ============ CARDS ============
    addCard: (deckId, front, back) => db.addCard(deckId, front, back),
    updateCard: (id, front, back) => db.updateCard(id, front, back),
    deleteCard: (id) => db.deleteCard(id),

    // ============ SPACED REPETITION ============
    reviewCard: (id, correct) => db.reviewCard(id, correct),
    reorderCards: (deckId, cardIds) => db.reorderCards(deckId, cardIds),

    // ============ STUDY SESSIONS ============
    saveStudySession: (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) => 
        db.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType),
    getDeckStats: (deckId) => db.getDeckStats(deckId),

    // ============ THEMES ============
    getThemes: () => db.getThemes(),
    activateTheme: (id) => db.setActiveTheme(id),
    createTheme: async (themeData) => {
        // For IndexedDB we'd need to implement this, but themes are pre-set
        console.warn('createTheme not implemented for offline mode');
        return null;
    },
};
