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
    getClasses: () => isLoggedIn()
        ? cache.wrap(cacheKey('classes'), () => serverApi.getClasses(), CACHE_TTL.medium)
        : Promise.resolve([]),
    createClass: (name, color, professor, room, zoom_link) => {
        cache.delete(cacheKey('classes'));
        return isLoggedIn()
            ? serverApi.createClass(name, color, professor, room, zoom_link)
            : Promise.reject(new Error('Must be logged in to manage classes'));
    },
    updateClass: (id, name, color, professor, room, zoom_link) => {
        cache.delete(cacheKey('classes'));
        return isLoggedIn()
            ? serverApi.updateClass(id, name, color, professor, room, zoom_link)
            : Promise.reject(new Error('Must be logged in to manage classes'));
    },
    deleteClass: (id) => {
        cache.delete(cacheKey('classes'));
        return isLoggedIn()
            ? serverApi.deleteClass(id)
            : Promise.reject(new Error('Must be logged in to manage classes'));
    },

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
    getCanvasSettings: () => isLoggedIn()
        ? serverApi.getCanvasSettings()
        : Promise.resolve({
            isConnected: false,
            canvasUrl: '',
            autoSyncEnabled: false,
            lastSyncAt: null,
            lastAutoSyncError: '',
        }),
    setCanvasAutoSync: (enabled) => isLoggedIn() ? serverApi.setCanvasAutoSync(enabled) : Promise.reject(new Error('Must be logged in')),
    syncCanvas: (adGranted) => {
        if (!isLoggedIn()) return Promise.reject(new Error('Must be logged in to sync LMS'));
        return serverApi.syncCanvas(adGranted).then(res => {
            cache.delete(cacheKey('classes'));
            return res;
        });
    },

    // AI Generation
    getAILimits: () => isLoggedIn()
        ? serverApi.getAILimits()
        : Promise.resolve({ remaining: 10, max: 10, characterLimit: 15000, flashcardRange: [5, 15] }),
    generateAiDeck: (notes, file, deckName, classId, className) => isLoggedIn()
        ? serverApi.generateAiDeck(notes, file, deckName, classId, className)
        : Promise.reject(new Error('Must be logged in to generate AI flashcards')),
    generateAiClass: (notes, file) => isLoggedIn()
        ? serverApi.generateAiClass(notes, file)
        : Promise.reject(new Error('Must be logged in to generate AI class')),
    generateAiGuide: (notes, file, title, noteId, classId, className, replaceGuideId) => isLoggedIn()
        ? serverApi.generateAiGuide(notes, file, title, noteId, classId, className, replaceGuideId)
        : Promise.reject(new Error('Must be logged in to generate AI study guide')),
    generateAiExam: (notes, file, title, sourceType, sourceId, classId, className, opts) => isLoggedIn()
        ? serverApi.generateAiExam(notes, file, title, sourceType, sourceId, classId, className, opts)
        : Promise.reject(new Error('Must be logged in to generate AI exam')),
    gradeShortAnswer: (question, studentAnswer, correctAnswer, gradingRubric) => isLoggedIn()
        ? serverApi.gradeShortAnswer(question, studentAnswer, correctAnswer, gradingRubric)
        : Promise.reject(new Error('Must be logged in to grade answers')),
    generateFromYoutube: (youtubeUrl, type, options) => isLoggedIn()
        ? serverApi.generateFromYoutube(youtubeUrl, type, options)
        : Promise.reject(new Error('Must be logged in to generate from YouTube')),

    // AI Generation (Streaming)
    generateAiDeckStream: (notes, file, deckName, classId, className) => isLoggedIn()
        ? serverApi.generateAiDeckStream(notes, file, deckName, classId, className)
        : Promise.reject(new Error('Must be logged in to generate AI flashcards')),
    generateAiGuideStream: (notes, file, title, noteId, classId, className, replaceGuideId) => isLoggedIn()
        ? serverApi.generateAiGuideStream(notes, file, title, noteId, classId, className, replaceGuideId)
        : Promise.reject(new Error('Must be logged in to generate AI study guide')),
    generateAiExamStream: (notes, file, title, sourceType, sourceId, classId, className, opts) => isLoggedIn()
        ? serverApi.generateAiExamStream(notes, file, title, sourceType, sourceId, classId, className, opts)
        : Promise.reject(new Error('Must be logged in to generate AI exam')),
    generateFromYoutubeStream: (youtubeUrl, type, options) => isLoggedIn()
        ? serverApi.generateFromYoutubeStream(youtubeUrl, type, options)
        : Promise.reject(new Error('Must be logged in to generate from YouTube')),
    enhanceNoteWithAudioStream: (noteId, audioPath, userNotes, title, className) => isLoggedIn()
        ? serverApi.enhanceNoteWithAudioStream(noteId, audioPath, userNotes, title, className)
        : Promise.reject(new Error('Must be logged in to enhance notes')),
    createAiJob: (kind, payload) => isLoggedIn()
        ? serverApi.createAiJob(kind, payload)
        : Promise.reject(new Error('Must be logged in to create AI jobs')),
    getAiJob: (jobId) => isLoggedIn()
        ? serverApi.getAiJob(jobId)
        : Promise.reject(new Error('Must be logged in to view AI jobs')),
    listAiJobs: (filters) => isLoggedIn()
        ? serverApi.listAiJobs(filters)
        : Promise.reject(new Error('Must be logged in to view AI jobs')),
    subscribeToAiJob: (jobId, handlers) => isLoggedIn()
        ? serverApi.subscribeToAiJob(jobId, handlers)
        : () => {},
    subscribeToAiJobsForUser: (handlers) => isLoggedIn()
        ? serverApi.subscribeToAiJobsForUser(handlers)
        : () => {},
    primeEdgeFunctionAuth: () => isLoggedIn()
        ? serverApi.primeEdgeFunctionAuth()
        : Promise.resolve(null),
    warmupAiFunctions: (...fns) => isLoggedIn() ? serverApi.warmupAiFunctions(...fns) : undefined,

    // ============ NOTES ============
    getNotes: (classId) => isLoggedIn()
        ? serverApi.getNotes(classId)
        : Promise.resolve([]),
    getNote: (id) => isLoggedIn()
        ? serverApi.getNote(id)
        : Promise.reject(new Error('Must be logged in to view notes')),
    createNote: (title, content, classId) => isLoggedIn()
        ? serverApi.createNote(title, content, classId)
        : Promise.reject(new Error('Must be logged in to create notes')),
    updateNote: (id, updates) => isLoggedIn()
        ? serverApi.updateNote(id, updates)
        : Promise.reject(new Error('Must be logged in to update notes')),
    deleteNote: (id) => isLoggedIn()
        ? serverApi.deleteNote(id)
        : Promise.reject(new Error('Must be logged in to delete notes')),
    uploadNoteAudio: (noteId, audioBlob) => isLoggedIn()
        ? serverApi.uploadNoteAudio(noteId, audioBlob)
        : Promise.reject(new Error('Must be logged in to upload audio')),
    deleteNoteAudio: (audioPath) => isLoggedIn()
        ? serverApi.deleteNoteAudio(audioPath)
        : Promise.reject(new Error('Must be logged in to delete note audio')),
    enhanceNoteWithAudio: (noteId, audioPath, userNotes, title, className) => isLoggedIn()
        ? serverApi.enhanceNoteWithAudio(noteId, audioPath, userNotes, title, className)
        : Promise.reject(new Error('Must be logged in to enhance notes')),

    // ============ STUDY GUIDES ============
    getStudyGuides: (classId) => isLoggedIn()
        ? serverApi.getStudyGuides(classId)
        : Promise.resolve([]),
    getStudyGuide: (id) => isLoggedIn()
        ? serverApi.getStudyGuide(id)
        : Promise.reject(new Error('Must be logged in to view study guides')),
    getStudyCoach: () => isLoggedIn()
        ? serverApi.getStudyCoach()
        : Promise.resolve(null),
    updateStudyGuide: (id, updates) => isLoggedIn()
        ? serverApi.updateStudyGuide(id, updates)
        : Promise.reject(new Error('Must be logged in to update study guides')),
    completeStudyCoachSession: (payload) => isLoggedIn()
        ? serverApi.completeStudyCoachSession(payload)
        : Promise.reject(new Error('Must be logged in to save study coach sessions')),
    assistStudyCoach: (payload) => isLoggedIn()
        ? serverApi.assistStudyCoach(payload)
        : Promise.reject(new Error('Must be logged in to use study coach assist')),
    deleteStudyGuide: (id) => isLoggedIn()
        ? serverApi.deleteStudyGuide(id)
        : Promise.reject(new Error('Must be logged in to delete study guides')),

    // ============ MOCK EXAMS ============
    getMockExams: (classId) => isLoggedIn()
        ? serverApi.getMockExams(classId)
        : Promise.resolve([]),
    getMockExam: (id) => isLoggedIn()
        ? serverApi.getMockExam(id)
        : Promise.reject(new Error('Must be logged in to view mock exams')),
    deleteMockExam: (id) => isLoggedIn()
        ? serverApi.deleteMockExam(id)
        : Promise.reject(new Error('Must be logged in to delete mock exams')),

    // ============ EXAM ATTEMPTS ============
    createExamAttempt: (examId, score, total, answers, opts) => isLoggedIn()
        ? serverApi.createExamAttempt(examId, score, total, answers, opts)
        : Promise.reject(new Error('Must be logged in to save exam attempts')),
    getExamAttempts: (examId) => isLoggedIn()
        ? serverApi.getExamAttempts(examId)
        : Promise.resolve([]),
    getAllExamAttempts: (classId) => isLoggedIn()
        ? serverApi.getAllExamAttempts(classId)
        : Promise.resolve([]),

    // ============ TOPIC MASTERY ============
    getTopicMastery: (classId) => isLoggedIn()
        ? serverApi.getTopicMastery(classId)
        : Promise.resolve([]),
    upsertTopicMastery: (classId, topicBreakdown) => isLoggedIn()
        ? serverApi.upsertTopicMastery(classId, topicBreakdown)
        : Promise.reject(new Error('Must be logged in to update topic mastery')),

    // ============ SCHEDULE ============
    getSchedule: () => isLoggedIn() ? serverApi.getSchedule() : Promise.resolve([]),
    createScheduleSlot: (class_id, day_of_week, start_time, end_time) => isLoggedIn()
        ? serverApi.createScheduleSlot(class_id, day_of_week, start_time, end_time)
        : Promise.reject(new Error('Must be logged in to manage schedule')),
    deleteScheduleSlot: (id) => isLoggedIn()
        ? serverApi.deleteScheduleSlot(id)
        : Promise.reject(new Error('Must be logged in to manage schedule')),

    // ============ DECKS ============
    getDecks: () => cache.wrap(
        cacheKey('decks'),
        () => isLoggedIn() ? serverApi.getDecks() : db.getDecks(),
        CACHE_TTL.short
    ),
    getDeck: (id) => isLoggedIn()
        ? serverApi.getDeck(id)
        : db.getDeck(id),
    createDeck: (title, description, folderId, tagIds, classId) => {
        cache.delete(cacheKey('decks'));
        return isLoggedIn()
            ? serverApi.createDeck(title, description, folderId, tagIds || [], classId)
            : db.createDeck(title, description, folderId, tagIds || [], classId);
    },
    updateDeck: (id, title, description, folderId, tagIds, classId) => {
        cache.delete(cacheKey('decks'));
        return isLoggedIn()
            ? serverApi.updateDeck(id, title, description, folderId, tagIds || [], classId)
            : db.updateDeck(id, title, description, folderId, tagIds || [], classId);
    },
    deleteDeck: (id) => {
        cache.delete(cacheKey('decks'));
        return isLoggedIn()
            ? serverApi.deleteDeck(id)
            : db.deleteDeck(id);
    },
    duplicateDeck: (id) => {
        cache.delete(cacheKey('decks'));
        return isLoggedIn()
            ? serverApi.duplicateDeck(id)
            : db.duplicateDeck(id);
    },
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
    reviewCard: (id, rating) => isLoggedIn()
        ? serverApi.reviewCard(id, rating)
        : db.reviewCard(id, rating),
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
    getWeeklySummary: (timeZone) => isLoggedIn()
        ? serverApi.getWeeklySummary(timeZone)
        : Promise.resolve({
            cards_studied: 0,
            accuracy: null,
            total_minutes: 0,
            daily_breakdown: [],
        }),

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
    getGroupInfo: (id) => isLoggedIn() ? serverApi.getGroup(id) : Promise.reject(new Error('Must be logged in')),
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
    // Cram Sessions
    getGroupSessions: (id) => isLoggedIn() ? serverApi.getGroupSessions(id) : Promise.resolve([]),
    startGroupSession: (id, deckId) => isLoggedIn() ? serverApi.startGroupSession(id, deckId) : Promise.reject(new Error('Must be logged in')),
    joinGroupSession: (sessionId) => isLoggedIn() ? serverApi.joinGroupSession(sessionId) : Promise.reject(new Error('Must be logged in')),
    respondToSessionCard: (sessionId, cardId, knewIt) => isLoggedIn() ? serverApi.respondToSessionCard(sessionId, cardId, knewIt) : Promise.reject(new Error('Must be logged in')),
    getSessionResults: (sessionId) => isLoggedIn() ? serverApi.getSessionResults(sessionId) : Promise.reject(new Error('Must be logged in')),
    endGroupSession: (sessionId) => isLoggedIn() ? serverApi.endGroupSession(sessionId) : Promise.reject(new Error('Must be logged in')),

    // ============ FRIENDS & MESSAGES ============
    getFriends: () => isLoggedIn() ? serverApi.getFriends() : Promise.resolve([]),
    acceptSharedResource: (messageId) => isLoggedIn()
        ? serverApi.acceptSharedResource(messageId)
        : Promise.reject(new Error('Must be logged in to accept shared items')),
    sendMessage: (toUserId, content, messageType, sharedData, imageUrl) => isLoggedIn()
        ? serverApi.sendMessage(toUserId, content, messageType, sharedData, imageUrl)
        : Promise.reject(new Error('Must be logged in to send messages')),

    // Hearts API
    getHeartsStatus: () => isLoggedIn() ? serverApi.getHeartsStatus() : Promise.resolve({ hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true }),
    getSessionHearts: (deckId) => isLoggedIn() ? serverApi.getSessionHearts(deckId) : Promise.resolve({ hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true }),
    decrementHeart: () => isLoggedIn() ? serverApi.decrementHeart() : Promise.resolve({ hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true }),
    refillHearts: (amount) => isLoggedIn() ? serverApi.refillHearts(amount) : Promise.resolve({ hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true }),
    practiceRefill: () => isLoggedIn() ? serverApi.practiceRefill() : Promise.resolve({ hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true }),

    // Referrals API
    getReferralInfo: () => isLoggedIn() ? serverApi.getReferralInfo() : Promise.resolve(null),
    applyReferralCode: (code) => isLoggedIn() ? serverApi.applyReferralCode(code) : Promise.reject(new Error('Must be logged in')),
    submitFeedback: (content) => isLoggedIn()
        ? serverApi.submitFeedback(content)
        : Promise.reject(new Error('Must be logged in')),

    // RevenueCat API
    syncRevenueCat: (opts) => isLoggedIn() ? serverApi.syncRevenueCat(opts) : Promise.reject(new Error('Must be logged in')),

    // ============ CALENDAR SOURCES ============
    getCalendarSources: () => isLoggedIn() ? serverApi.getCalendarSources() : Promise.resolve([]),
    addCalendarSource: (data) => isLoggedIn()
        ? serverApi.addCalendarSource(data)
        : Promise.reject(new Error('Must be logged in to add calendar sources')),
    deleteCalendarSource: (id) => isLoggedIn()
        ? serverApi.deleteCalendarSource(id)
        : Promise.reject(new Error('Must be logged in to delete calendar sources')),
    syncCalendarSource: (id) => isLoggedIn()
        ? serverApi.syncCalendarSource(id)
        : Promise.reject(new Error('Must be logged in to sync calendar sources')),
};
