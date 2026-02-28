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

    // ============ CLASSES ============
    getClasses: () => isLoggedIn() ? serverApi.getClasses() : Promise.resolve([]),
    createClass: (name, color, professor, room, zoom_link) => isLoggedIn()
        ? serverApi.createClass(name, color, professor, room, zoom_link)
        : Promise.reject(new Error('Must be logged in to manage classes')),
    updateClass: (id, name, color, professor, room, zoom_link) => isLoggedIn()
        ? serverApi.updateClass(id, name, color, professor, room, zoom_link)
        : Promise.reject(new Error('Must be logged in to manage classes')),
    deleteClass: (id) => isLoggedIn()
        ? serverApi.deleteClass(id)
        : Promise.reject(new Error('Must be logged in to manage classes')),

    // ============ ASSIGNMENTS ============
    getAssignments: (classId) => isLoggedIn() ? serverApi.getAssignments(classId) : Promise.resolve([]),
    createAssignment: (class_id, title, description, due_date, type) => isLoggedIn()
        ? serverApi.createAssignment(class_id, title, description, due_date, type)
        : Promise.reject(new Error('Must be logged in to manage assignments')),
    updateAssignment: (id, updates) => isLoggedIn()
        ? serverApi.updateAssignment(id, updates)
        : Promise.reject(new Error('Must be logged in to manage assignments')),
    deleteAssignment: (id) => isLoggedIn()
        ? serverApi.deleteAssignment(id)
        : Promise.reject(new Error('Must be logged in to manage assignments')),
    // ============ LMS (Canvas) ============
    connectCanvas: (icalUrl) => isLoggedIn() ? serverApi.connectCanvas(icalUrl) : Promise.reject(new Error('Must be logged in to connect LMS')),
    disconnectCanvas: () => isLoggedIn() ? serverApi.disconnectCanvas() : Promise.reject(new Error('Must be logged in')),
    getCanvasSettings: () => isLoggedIn() ? serverApi.getCanvasSettings() : Promise.resolve({ isConnected: false }),
    syncCanvas: () => isLoggedIn() ? serverApi.syncCanvas() : Promise.reject(new Error('Must be logged in to sync LMS')),

    // AI Generation
    getAILimits: () => isLoggedIn()
        ? serverApi.getAILimits()
        : Promise.resolve({ remaining: 15, max: 15, characterLimit: 15000, flashcardRange: [5, 15] }),
    generateAiDeck: (notes, file, deckName, classId) => isLoggedIn()
        ? serverApi.generateAiDeck(notes, file, deckName, classId)
        : Promise.reject(new Error('Must be logged in to generate AI flashcards')),
    generateAiClass: (notes, file) => isLoggedIn()
        ? serverApi.generateAiClass(notes, file)
        : Promise.reject(new Error('Must be logged in to generate AI class')),

    // ============ SCHEDULE ============
    getSchedule: () => isLoggedIn() ? serverApi.getSchedule() : Promise.resolve([]),
    createScheduleSlot: (class_id, day_of_week, start_time, end_time) => isLoggedIn()
        ? serverApi.createScheduleSlot(class_id, day_of_week, start_time, end_time)
        : Promise.reject(new Error('Must be logged in to manage schedule')),
    deleteScheduleSlot: (id) => isLoggedIn()
        ? serverApi.deleteScheduleSlot(id)
        : Promise.reject(new Error('Must be logged in to manage schedule')),

    // ============ DECKS ============
    getDecks: () => isLoggedIn()
        ? serverApi.getDecks()
        : db.getDecks(),
    getDeck: (id) => isLoggedIn()
        ? serverApi.getDeck(id)
        : db.getDeck(id),
    createDeck: (title, description, folderId, tagIds, classId) => isLoggedIn()
        ? serverApi.createDeck(title, description, folderId, tagIds || [], classId)
        : db.createDeck(title, description, folderId, tagIds || [], classId),
    updateDeck: (id, title, description, folderId, tagIds, classId) => isLoggedIn()
        ? serverApi.updateDeck(id, title, description, folderId, tagIds || [], classId)
        : db.updateDeck(id, title, description, folderId, tagIds || [], classId),
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

    // ============ STUDY GROUPS ============
    getGroups: () => isLoggedIn() ? serverApi.getGroups() : Promise.resolve([]),
    createGroup: (name, classId) => isLoggedIn() ? serverApi.createGroup(name, classId) : Promise.reject(new Error('Must be logged in')),
    getGroup: (id) => isLoggedIn() ? serverApi.getGroup(id) : Promise.reject(new Error('Must be logged in')),
    updateGroup: (id, updates) => isLoggedIn() ? serverApi.updateGroup(id, updates) : Promise.reject(new Error('Must be logged in')),
    deleteGroup: (id) => isLoggedIn() ? serverApi.deleteGroup(id) : Promise.reject(new Error('Must be logged in')),
    joinGroup: (joinCode) => isLoggedIn() ? serverApi.joinGroup(joinCode) : Promise.reject(new Error('Must be logged in')),
    leaveGroup: (id) => isLoggedIn() ? serverApi.leaveGroup(id) : Promise.reject(new Error('Must be logged in')),
    getGroupMembers: (id) => isLoggedIn() ? serverApi.getGroupMembers(id) : Promise.resolve([]),
    removeGroupMember: (id, userId) => isLoggedIn() ? serverApi.removeGroupMember(id, userId) : Promise.reject(new Error('Must be logged in')),
    getGroupDecks: (id) => isLoggedIn() ? serverApi.getGroupDecks(id) : Promise.resolve([]),
    shareDeckToGroup: (id, deckId) => isLoggedIn() ? serverApi.shareDeckToGroup(id, deckId) : Promise.reject(new Error('Must be logged in')),
    removeDeckFromGroup: (id, deckId) => isLoggedIn() ? serverApi.removeDeckFromGroup(id, deckId) : Promise.reject(new Error('Must be logged in')),

    getGroupFolders: (id) => isLoggedIn() ? serverApi.getGroupFolders(id) : Promise.resolve([]),
    createGroupFolder: (id, name) => isLoggedIn() ? serverApi.createGroupFolder(id, name) : Promise.reject(new Error('Must be logged in')),
    renameGroupFolder: (id, folderId, name) => isLoggedIn() ? serverApi.renameGroupFolder(id, folderId, name) : Promise.reject(new Error('Must be logged in')),
    deleteGroupFolder: (id, folderId) => isLoggedIn() ? serverApi.deleteGroupFolder(id, folderId) : Promise.reject(new Error('Must be logged in')),

    getGroupFiles: (id, folderId) => isLoggedIn() ? serverApi.getGroupFiles(id, folderId) : Promise.resolve([]),
    uploadGroupFile: (id, fileData) => isLoggedIn() ? serverApi.uploadGroupFile(id, fileData) : Promise.reject(new Error('Must be logged in')),
    deleteGroupFile: (id, fileId) => isLoggedIn() ? serverApi.deleteGroupFile(id, fileId) : Promise.reject(new Error('Must be logged in')),

    // ============ FRIENDS & MESSAGES ============
    getFriends: () => isLoggedIn() ? serverApi.getFriends() : Promise.resolve([]),
    sendMessage: (toUserId, content, messageType, deckData) => isLoggedIn()
        ? serverApi.sendMessage(toUserId, content, messageType, deckData)
        : Promise.reject(new Error('Must be logged in to send messages')),
};
