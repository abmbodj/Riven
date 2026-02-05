import * as db from './db/indexedDB';
import * as serverApi from './api/authApi';
import { cache } from './utils/cache';

// Check if user is logged in (has valid token)
const isLoggedIn = () => !!serverApi.getToken();

// Wrapper for API calls (can be extended for retry logic or error handling)
const safeCall = async (fn) => fn();

// Cache keys helper
const cacheKey = (resource, id = '') => `${resource}${id ? `:${id}` : ''}`;
const CACHE_TTL = {
    short: 10000,   // 10s - for frequently changing data
    medium: 60000,  // 60s - for semi-static data (tags, folders)
    long: 300000    // 5m - for rarely changing data
};

// Hybrid API - uses server when logged in, IndexedDB otherwise
export const api = {
    // ============ FOLDERS ============
    getFolders: () => cache.wrap(
        cacheKey('folders'),
        () => isLoggedIn() ? serverApi.getFolders() : db.getFolders(),
        CACHE_TTL.medium
    ),
    createFolder: async (name, color, icon) => {
        cache.delete(cacheKey('folders'));
        return isLoggedIn()
            ? safeCall(() => serverApi.createFolder(name, color, icon))
            : safeCall(() => db.createFolder(name, color, icon));
    },
    updateFolder: async (id, name, color, icon) => {
        cache.delete(cacheKey('folders'));
        return isLoggedIn()
            ? safeCall(() => serverApi.updateFolder(id, name, color, icon))
            : safeCall(() => db.updateFolder(id, name, color, icon));
    },
    deleteFolder: async (id) => {
        cache.delete(cacheKey('folders'));
        return isLoggedIn()
            ? safeCall(() => serverApi.deleteFolder(id))
            : safeCall(() => db.deleteFolder(id));
    },

    // ============ TAGS ============
    getTags: () => cache.wrap(
        cacheKey('tags'),
        () => isLoggedIn() ? serverApi.getTags() : db.getTags(),
        CACHE_TTL.medium
    ),
    createTag: async (name, color) => {
        cache.delete(cacheKey('tags'));
        return isLoggedIn()
            ? safeCall(() => serverApi.createTag(name, color))
            : safeCall(() => db.createTag(name, color));
    },
    deleteTag: async (id) => {
        cache.delete(cacheKey('tags'));
        return isLoggedIn()
            ? safeCall(() => serverApi.deleteTag(id))
            : safeCall(() => db.deleteTag(id));
    },

    // ============ DECKS ============
    getDecks: () => isLoggedIn()
        ? safeCall(() => serverApi.getDecks())
        : safeCall(() => db.getDecks()),
    getDeck: (id) => isLoggedIn()
        ? safeCall(() => serverApi.getDeck(id))
        : safeCall(() => db.getDeck(id)),
    createDeck: (title, description, folderId, tagIds) => isLoggedIn()
        ? safeCall(() => serverApi.createDeck(title, description, folderId, tagIds || []))
        : safeCall(() => db.createDeck(title, description, folderId, tagIds || [])),
    updateDeck: (id, title, description, folderId, tagIds) => isLoggedIn()
        ? safeCall(() => serverApi.updateDeck(id, title, description, folderId, tagIds || []))
        : safeCall(() => db.updateDeck(id, title, description, folderId, tagIds || [])),
    deleteDeck: (id) => isLoggedIn()
        ? safeCall(() => serverApi.deleteDeck(id))
        : safeCall(() => db.deleteDeck(id)),
    duplicateDeck: (id) => isLoggedIn()
        ? safeCall(() => serverApi.duplicateDeck(id))
        : safeCall(() => db.duplicateDeck(id)),
    exportDeck: (id, format) => safeCall(() => db.exportDeck(id, format)), // Keep local only
    
    moveDeck: async (id, folderId) => {
        if (isLoggedIn()) {
            const deck = await serverApi.getDeck(id);
            return serverApi.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
        }
        return safeCall(async () => {
            const deck = await db.getDeck(id);
            return db.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
        });
    },

    // ============ CARDS ============
    addCard: (deckId, front, back, front_image, back_image) => isLoggedIn()
        ? safeCall(() => serverApi.addCard(deckId, front, back, front_image, back_image))
        : safeCall(() => db.addCard(deckId, front, back, front_image, back_image)),
    updateCard: (id, front, back, front_image, back_image) => isLoggedIn()
        ? safeCall(() => serverApi.updateCard(id, front, back, front_image, back_image))
        : safeCall(() => db.updateCard(id, front, back, front_image, back_image)),
    deleteCard: (id) => isLoggedIn()
        ? safeCall(() => serverApi.deleteCard(id))
        : safeCall(() => db.deleteCard(id)),

    // ============ SPACED REPETITION ============
    reviewCard: (id, correct) => isLoggedIn()
        ? safeCall(() => serverApi.reviewCard(id, correct))
        : safeCall(() => db.reviewCard(id, correct)),
    reorderCards: (deckId, cardIds) => isLoggedIn()
        ? safeCall(() => serverApi.reorderCards(deckId, cardIds))
        : safeCall(() => db.reorderCards(deckId, cardIds)),

    // ============ STUDY SESSIONS ============
    saveStudySession: (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) => isLoggedIn()
        ? safeCall(() => serverApi.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType))
        : safeCall(() => db.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType)),
    getDeckStats: (deckId) => isLoggedIn()
        ? safeCall(() => serverApi.getDeckStats(deckId))
        : safeCall(() => db.getDeckStats(deckId)),

    // ============ THEMES ============
    getThemes: () => isLoggedIn()
        ? safeCall(() => serverApi.getThemes())
        : safeCall(() => db.getThemes()),
    activateTheme: (id) => isLoggedIn()
        ? safeCall(() => serverApi.activateTheme(id))
        : safeCall(() => db.setActiveTheme(id)),
    createTheme: (themeData) => isLoggedIn()
        ? safeCall(() => serverApi.createTheme(themeData))
        : safeCall(() => db.createTheme(themeData)),
    updateTheme: (id, themeData) => isLoggedIn()
        ? safeCall(() => serverApi.updateTheme(id, themeData))
        : safeCall(() => db.updateTheme(id, themeData)),
    deleteTheme: (id) => isLoggedIn()
        ? safeCall(() => serverApi.deleteTheme(id))
        : safeCall(() => db.deleteTheme(id)),
};

