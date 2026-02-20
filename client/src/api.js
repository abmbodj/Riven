import * as db from './db/indexedDB';
import * as serverApi from './api/authApi';
import { cache } from './utils/cache';

// Check if user is logged in (has valid token)
const isLoggedIn = () => !!serverApi.getToken();

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
            ? serverApi.createFolder(name, color, icon)
            : db.createFolder(name, color, icon);
    },
    updateFolder: async (id, name, color, icon) => {
        cache.delete(cacheKey('folders'));
        return isLoggedIn()
            ? serverApi.updateFolder(id, name, color, icon)
            : db.updateFolder(id, name, color, icon);
    },
    deleteFolder: async (id) => {
        cache.delete(cacheKey('folders'));
        return isLoggedIn()
            ? serverApi.deleteFolder(id)
            : db.deleteFolder(id);
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
            ? serverApi.createTag(name, color)
            : db.createTag(name, color);
    },
    deleteTag: async (id) => {
        cache.delete(cacheKey('tags'));
        return isLoggedIn()
            ? serverApi.deleteTag(id)
            : db.deleteTag(id);
    },

    // ============ DECKS ============
    getDecks: () => isLoggedIn()
        ? serverApi.getDecks()
        : db.getDecks(),
    getDeck: (id) => isLoggedIn()
        ? serverApi.getDeck(id)
        : db.getDeck(id),
    createDeck: (title, description, folderId, tagIds) => isLoggedIn()
        ? serverApi.createDeck(title, description, folderId, tagIds || [])
        : db.createDeck(title, description, folderId, tagIds || []),
    updateDeck: (id, title, description, folderId, tagIds) => isLoggedIn()
        ? serverApi.updateDeck(id, title, description, folderId, tagIds || [])
        : db.updateDeck(id, title, description, folderId, tagIds || []),
    deleteDeck: (id) => isLoggedIn()
        ? serverApi.deleteDeck(id)
        : db.deleteDeck(id),
    duplicateDeck: (id) => isLoggedIn()
        ? serverApi.duplicateDeck(id)
        : db.duplicateDeck(id),
    exportDeck: (id, format) => isLoggedIn()
        ? serverApi.getDeck(id).then(deck => deck)
        : db.exportDeck(id, format),

    moveDeck: async (id, folderId) => {
        if (isLoggedIn()) {
            const deck = await serverApi.getDeck(id);
            return serverApi.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
        }
        const deck = await db.getDeck(id);
        return db.updateDeck(id, deck.title, deck.description, folderId, deck.tags?.map(t => t.id) || []);
    },

    // ============ CARDS ============
    addCard: (deckId, front, back, front_image, back_image) => isLoggedIn()
        ? serverApi.addCard(deckId, front, back, front_image, back_image)
        : db.addCard(deckId, front, back, front_image, back_image),
    updateCard: (id, front, back, front_image, back_image) => isLoggedIn()
        ? serverApi.updateCard(id, front, back, front_image, back_image)
        : db.updateCard(id, front, back, front_image, back_image),
    deleteCard: (id) => isLoggedIn()
        ? serverApi.deleteCard(id)
        : db.deleteCard(id),

    // ============ SPACED REPETITION ============
    reviewCard: (id, correct) => isLoggedIn()
        ? serverApi.reviewCard(id, correct)
        : db.reviewCard(id, correct),
    reorderCards: (deckId, cardIds) => isLoggedIn()
        ? serverApi.reorderCards(deckId, cardIds)
        : db.reorderCards(deckId, cardIds),

    // ============ STUDY SESSIONS ============
    saveStudySession: (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) => isLoggedIn()
        ? serverApi.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType)
        : db.saveStudySession(deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType),
    getDeckStats: (deckId) => isLoggedIn()
        ? serverApi.getDeckStats(deckId)
        : db.getDeckStats(deckId),

    // ============ THEMES ============
    getThemes: () => isLoggedIn()
        ? serverApi.getThemes()
        : db.getThemes(),
    activateTheme: (id) => isLoggedIn()
        ? serverApi.activateTheme(id)
        : db.setActiveTheme(id),
    createTheme: (themeData) => isLoggedIn()
        ? serverApi.createTheme(themeData)
        : db.createTheme(themeData),
    updateTheme: (id, themeData) => isLoggedIn()
        ? serverApi.updateTheme(id, themeData)
        : db.updateTheme(id, themeData),
    deleteTheme: (id) => isLoggedIn()
        ? serverApi.deleteTheme(id)
        : db.deleteTheme(id),

    // ============ FRIENDS & MESSAGES ============
    getFriends: () => isLoggedIn() ? serverApi.getFriends() : Promise.resolve([]),
    sendMessage: (toUserId, content, messageType, deckData) => isLoggedIn()
        ? serverApi.sendMessage(toUserId, content, messageType, deckData)
        : Promise.reject(new Error('Must be logged in to send messages')),
};
