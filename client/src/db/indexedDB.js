import { openDB } from 'idb';

const DB_NAME = 'riven-db';
const DB_VERSION = 1;

let dbPromise = null;
let initialized = false;

async function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Folders store
                if (!db.objectStoreNames.contains('folders')) {
                    const folderStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                    folderStore.createIndex('created_at', 'created_at');
                }

                // Tags store
                if (!db.objectStoreNames.contains('tags')) {
                    const tagStore = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                    tagStore.createIndex('name', 'name', { unique: true });
                }

                // Decks store
                if (!db.objectStoreNames.contains('decks')) {
                    const deckStore = db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
                    deckStore.createIndex('folder_id', 'folder_id');
                    deckStore.createIndex('created_at', 'created_at');
                }

                // Cards store
                if (!db.objectStoreNames.contains('cards')) {
                    const cardStore = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                    cardStore.createIndex('deck_id', 'deck_id');
                }

                // Study sessions store
                if (!db.objectStoreNames.contains('study_sessions')) {
                    const sessionStore = db.createObjectStore('study_sessions', { keyPath: 'id', autoIncrement: true });
                    sessionStore.createIndex('deck_id', 'deck_id');
                    sessionStore.createIndex('created_at', 'created_at');
                }

                // Deck-tags junction store
                if (!db.objectStoreNames.contains('deck_tags')) {
                    const deckTagStore = db.createObjectStore('deck_tags', { keyPath: ['deck_id', 'tag_id'] });
                    deckTagStore.createIndex('deck_id', 'deck_id');
                    deckTagStore.createIndex('tag_id', 'tag_id');
                }

                // Themes store
                if (!db.objectStoreNames.contains('themes')) {
                    db.createObjectStore('themes', { keyPath: 'id', autoIncrement: true });
                }
            }
        });
    }

    const db = await dbPromise;

    // Initialize default data only once
    if (!initialized) {
        initialized = true;
        try {
            // Initialize default themes if needed
            const themeCount = await db.count('themes');
            const proThemes = [
                { name: 'Riven', bg_color: '#162a31', surface_color: '#1e3840', text_color: '#e4ddd0', secondary_text_color: '#8fa6a8', border_color: '#233e46', accent_color: '#deb96a', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 1, is_default: 1 },
                { name: 'Arctic Frost', bg_color: '#fafafa', surface_color: '#d4e4f7', text_color: '#4a6fa5', secondary_text_color: '#c0c0c0', border_color: '#d4e4f7', accent_color: '#4a6fa5', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Botanical Garden', bg_color: '#f5f3ed', surface_color: '#e9e6da', text_color: '#4a7c59', secondary_text_color: '#b7472a', border_color: '#4a7c59', accent_color: '#f9a620', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Desert Rose', bg_color: '#e8d5c4', surface_color: '#dfccba', text_color: '#5d2e46', secondary_text_color: '#b87d6d', border_color: '#d4a5a5', accent_color: '#d4a5a5', font_family_display: 'Lora', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Forest Canopy', bg_color: '#faf9f6', surface_color: '#f0ede4', text_color: '#2d4a2b', secondary_text_color: '#7d8471', border_color: '#a4ac86', accent_color: '#2d4a2b', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Golden Hour', bg_color: '#d4b896', surface_color: '#cbb08d', text_color: '#4a403a', secondary_text_color: '#c1666b', border_color: '#f4a900', accent_color: '#f4a900', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Midnight Galaxy', bg_color: '#2b1e3e', surface_color: '#362a4d', text_color: '#e6e6fa', secondary_text_color: '#a490c2', border_color: '#4a4e8f', accent_color: '#a490c2', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Modern Minimal', bg_color: '#ffffff', surface_color: '#f3f4f6', text_color: '#36454f', secondary_text_color: '#708090', border_color: '#d3d3d3', accent_color: '#36454f', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Ocean Depths', bg_color: '#1a2332', surface_color: '#243045', text_color: '#f1faee', secondary_text_color: '#a8dadc', border_color: '#2d8b8b', accent_color: '#2d8b8b', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Sunset Blvd', bg_color: '#264653', surface_color: '#2f5565', text_color: '#fafafa', secondary_text_color: '#f4a261', border_color: '#e76f51', accent_color: '#e76f51', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Tech Innovation', bg_color: '#1e1e1e', surface_color: '#2a2a2a', text_color: '#ffffff', secondary_text_color: '#00ffff', border_color: '#0066ff', accent_color: '#0066ff', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 }
            ];

            if (themeCount === 0) {
                for (const theme of proThemes) {
                    await db.add('themes', theme);
                }
            } else {
                // Migration: update default themes and add missing ones
                const existingThemes = await db.getAll('themes');
                for (const pro of proThemes) {
                    const existing = existingThemes.find(t => t.name === pro.name && t.is_default);
                    if (existing) {
                        // Update existing default theme with new colors/fonts
                        await db.put('themes', { ...existing, ...pro });
                    } else {
                        // Add if missing
                        await db.add('themes', pro);
                    }
                }

                // Ensure all custom themes have font fields
                for (const theme of existingThemes) {
                    if (!theme.font_family_display) {
                        await db.put('themes', {
                            ...theme,
                            font_family_display: theme.font_family_display || 'Cormorant Garamond',
                            font_family_body: theme.font_family_body || 'Lora'
                        });
                    }
                }
            }


            // Initialize default tags if needed
            const tagCount = await db.count('tags');
            if (tagCount === 0) {
                const defaultTags = [
                    { name: 'Important', color: '#ef4444', is_preset: 1, created_at: new Date().toISOString() },
                    { name: 'Review', color: '#f59e0b', is_preset: 1, created_at: new Date().toISOString() },
                    { name: 'Favorite', color: '#ec4899', is_preset: 1, created_at: new Date().toISOString() }
                ];
                for (const tag of defaultTags) {
                    await db.add('tags', tag);
                }
            }
        } catch {
            // Error initializing default data silently
        }
    }

    return db;
}

// ============ FOLDERS ============
export async function getFolders() {
    const db = await getDB();
    const folders = await db.getAll('folders');
    const decks = await db.getAll('decks');
    return folders.map(folder => ({
        ...folder,
        deckCount: decks.filter(d => d.folder_id === folder.id).length
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createFolder(name, color = '#6366f1', icon = 'folder') {
    const db = await getDB();
    const folder = { name, color, icon, created_at: new Date().toISOString() };
    const id = await db.add('folders', folder);
    return { id, ...folder };
}

export async function updateFolder(id, name, color, icon) {
    const db = await getDB();
    const folder = await db.get('folders', id);
    if (!folder) throw new Error('Folder not found');
    const updated = { ...folder, name, color, icon };
    await db.put('folders', updated);
    return updated;
}

export async function deleteFolder(id) {
    const db = await getDB();
    // Set folder_id to null for all decks in this folder
    const decks = await db.getAll('decks');
    for (const deck of decks.filter(d => d.folder_id === id)) {
        await db.put('decks', { ...deck, folder_id: null });
    }
    await db.delete('folders', id);
}

// ============ TAGS ============
export async function getTags() {
    const db = await getDB();
    const tags = await db.getAll('tags');
    return tags.sort((a, b) => {
        if (a.is_preset !== b.is_preset) return b.is_preset - a.is_preset;
        return a.name.localeCompare(b.name);
    });
}

export async function createTag(name, color) {
    const db = await getDB();
    const existingTags = await db.getAll('tags');
    if (existingTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Tag already exists');
    }
    const tag = { name, color, is_preset: 0, created_at: new Date().toISOString() };
    const id = await db.add('tags', tag);
    return { id, ...tag };
}

export async function deleteTag(id) {
    const db = await getDB();
    const tag = await db.get('tags', id);
    if (tag?.is_preset) throw new Error('Cannot delete preset tags');

    // Remove from deck_tags
    const deckTags = await db.getAll('deck_tags');
    for (const dt of deckTags.filter(dt => dt.tag_id === id)) {
        await db.delete('deck_tags', [dt.deck_id, dt.tag_id]);
    }
    await db.delete('tags', id);
}

// ============ DECKS ============
export async function getDecks() {
    const db = await getDB();
    const decks = await db.getAll('decks');
    const cards = await db.getAll('cards');
    const deckTags = await db.getAll('deck_tags');
    const tags = await db.getAll('tags');

    return decks.map(deck => {
        const deckTagIds = deckTags.filter(dt => dt.deck_id === deck.id).map(dt => dt.tag_id);
        return {
            ...deck,
            cardCount: cards.filter(c => c.deck_id === deck.id).length,
            tags: tags.filter(t => deckTagIds.includes(t.id))
        };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getDeck(id) {
    const db = await getDB();
    const deck = await db.get('decks', Number(id));
    if (!deck) throw new Error('Deck not found');

    const cards = await db.getAll('cards');
    const deckCards = cards.filter(c => c.deck_id === Number(id)).sort((a, b) => (a.position || 0) - (b.position || 0));

    const deckTags = await db.getAll('deck_tags');
    const tags = await db.getAll('tags');
    const deckTagIds = deckTags.filter(dt => dt.deck_id === Number(id)).map(dt => dt.tag_id);

    return {
        ...deck,
        cards: deckCards,
        tags: tags.filter(t => deckTagIds.includes(t.id))
    };
}

export async function createDeck(title, description = '', folder_id = null, tagIds = []) {
    const db = await getDB();
    const deck = {
        title,
        description,
        folder_id,
        created_at: new Date().toISOString(),
        last_studied: null
    };
    const id = await db.add('decks', deck);

    // Add tags
    for (const tagId of tagIds) {
        await db.add('deck_tags', { deck_id: id, tag_id: tagId });
    }

    return { id, ...deck, cardCount: 0, tags: [] };
}

export async function updateDeck(id, title, description, folder_id, tagIds = []) {
    const db = await getDB();
    const deck = await db.get('decks', Number(id));
    if (!deck) throw new Error('Deck not found');

    const updated = { ...deck, title, description, folder_id };
    await db.put('decks', updated);

    // Update tags
    const existingDeckTags = await db.getAll('deck_tags');
    for (const dt of existingDeckTags.filter(dt => dt.deck_id === Number(id))) {
        await db.delete('deck_tags', [dt.deck_id, dt.tag_id]);
    }
    for (const tagId of tagIds) {
        await db.add('deck_tags', { deck_id: Number(id), tag_id: tagId });
    }

    return updated;
}

export async function deleteDeck(id) {
    const db = await getDB();

    // Delete cards
    const cards = await db.getAll('cards');
    for (const card of cards.filter(c => c.deck_id === Number(id))) {
        await db.delete('cards', card.id);
    }

    // Delete deck_tags
    const deckTags = await db.getAll('deck_tags');
    for (const dt of deckTags.filter(dt => dt.deck_id === Number(id))) {
        await db.delete('deck_tags', [dt.deck_id, dt.tag_id]);
    }

    // Delete study sessions
    const sessions = await db.getAll('study_sessions');
    for (const session of sessions.filter(s => s.deck_id === Number(id))) {
        await db.delete('study_sessions', session.id);
    }

    await db.delete('decks', Number(id));
}

export async function duplicateDeck(id) {
    const db = await getDB();
    const original = await getDeck(id);
    if (!original) throw new Error('Deck not found');

    // Create new deck
    const newDeck = {
        title: `${original.title} (Copy)`,
        description: original.description,
        folder_id: original.folder_id,
        created_at: new Date().toISOString(),
        last_studied: null
    };
    const newId = await db.add('decks', newDeck);

    // Copy cards
    for (const card of original.cards) {
        await db.add('cards', {
            deck_id: newId,
            front: card.front,
            back: card.back,
            position: card.position || 0,
            difficulty: 0,
            times_reviewed: 0,
            times_correct: 0,
            last_reviewed: null,
            next_review: null,
            created_at: new Date().toISOString()
        });
    }

    // Copy tags
    for (const tag of original.tags) {
        await db.add('deck_tags', { deck_id: newId, tag_id: tag.id });
    }

    return { id: newId, ...newDeck };
}

export async function exportDeck(id, format = 'json') {
    const deck = await getDeck(id);
    if (format === 'csv') {
        let csv = 'front,back\n';
        for (const card of deck.cards) {
            csv += `"${card.front.replace(/"/g, '""')}","${card.back.replace(/"/g, '""')}"\n`;
        }
        return csv;
    }
    return JSON.stringify(deck, null, 2);
}

// ============ CARDS ============
export async function addCard(deck_id, front, back, front_image = null, back_image = null) {
    const db = await getDB();
    const cards = await db.getAll('cards');
    const deckCards = cards.filter(c => c.deck_id === Number(deck_id));
    const maxPosition = deckCards.length > 0 ? Math.max(...deckCards.map(c => c.position || 0)) : -1;

    const card = {
        deck_id: Number(deck_id),
        front,
        back,
        front_image,
        back_image,
        position: maxPosition + 1,
        difficulty: 0,
        times_reviewed: 0,
        times_correct: 0,
        last_reviewed: null,
        next_review: null,
        created_at: new Date().toISOString()
    };
    const id = await db.add('cards', card);
    return { id, ...card };
}

export async function updateCard(id, front, back, front_image, back_image) {
    const db = await getDB();
    const card = await db.get('cards', Number(id));
    if (!card) throw new Error('Card not found');
    const updated = {
        ...card,
        front,
        back,
        front_image: front_image !== undefined ? front_image : card.front_image,
        back_image: back_image !== undefined ? back_image : card.back_image
    };
    await db.put('cards', updated);
    return updated;
}

export async function deleteCard(id) {
    const db = await getDB();
    await db.delete('cards', Number(id));
}

export async function reviewCard(id, correct) {
    const db = await getDB();
    const card = await db.get('cards', Number(id));
    if (!card) throw new Error('Card not found');

    let newDifficulty = card.difficulty || 0;
    if (correct) {
        newDifficulty = Math.min(5, newDifficulty + 1);
    } else {
        newDifficulty = Math.max(0, newDifficulty - 1);
    }

    const intervals = [1, 3, 7, 14, 30, 60];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervals[newDifficulty]);

    const updated = {
        ...card,
        difficulty: newDifficulty,
        times_reviewed: (card.times_reviewed || 0) + 1,
        times_correct: correct ? (card.times_correct || 0) + 1 : card.times_correct || 0,
        last_reviewed: new Date().toISOString(),
        next_review: nextReview.toISOString()
    };
    await db.put('cards', updated);
    return updated;
}

export async function reorderCards(deck_id, cardIds) {
    const db = await getDB();
    for (let i = 0; i < cardIds.length; i++) {
        const card = await db.get('cards', cardIds[i]);
        if (card && card.deck_id === Number(deck_id)) {
            await db.put('cards', { ...card, position: i });
        }
    }
}

// ============ STUDY SESSIONS ============
export async function saveStudySession(deck_id, cards_studied, cards_correct, duration_seconds, session_type = 'study') {
    const db = await getDB();
    const session = {
        deck_id: Number(deck_id),
        cards_studied,
        cards_correct,
        duration_seconds,
        session_type,
        created_at: new Date().toISOString()
    };
    const id = await db.add('study_sessions', session);

    // Update deck last_studied
    const deck = await db.get('decks', Number(deck_id));
    if (deck) {
        await db.put('decks', { ...deck, last_studied: new Date().toISOString() });
    }

    return { id, ...session };
}

export async function getDeckStats(deck_id) {
    const db = await getDB();
    const sessions = await db.getAll('study_sessions');
    const deckSessions = sessions.filter(s => s.deck_id === Number(deck_id));
    const cards = await db.getAll('cards');
    const deckCards = cards.filter(c => c.deck_id === Number(deck_id));

    const totalStudied = deckSessions.reduce((sum, s) => sum + s.cards_studied, 0);
    const totalCorrect = deckSessions.reduce((sum, s) => sum + s.cards_correct, 0);
    const totalTime = deckSessions.reduce((sum, s) => sum + s.duration_seconds, 0);

    return {
        totalSessions: deckSessions.length,
        totalStudied,
        totalCorrect,
        accuracy: totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0,
        totalTime,
        cardsByDifficulty: {
            new: deckCards.filter(c => !c.difficulty || c.difficulty === 0).length,
            learning: deckCards.filter(c => c.difficulty > 0 && c.difficulty < 3).length,
            familiar: deckCards.filter(c => c.difficulty >= 3 && c.difficulty < 5).length,
            mastered: deckCards.filter(c => c.difficulty === 5).length
        },
        recentSessions: deckSessions.slice(-10).reverse()
    };
}

// ============ THEMES ============
export async function getThemes() {
    const db = await getDB();
    return db.getAll('themes');
}

export async function setActiveTheme(id) {
    const db = await getDB();
    const themes = await db.getAll('themes');
    for (const theme of themes) {
        await db.put('themes', { ...theme, is_active: theme.id === Number(id) ? 1 : 0 });
    }
    return db.get('themes', Number(id));
}

export async function createTheme(themeData) {
    const db = await getDB();
    const theme = {
        ...themeData,
        is_active: 0,
        created_at: new Date().toISOString()
    };
    const id = await db.add('themes', theme);
    return { ...theme, id };
}

export async function deleteTheme(id) {
    const db = await getDB();
    await db.delete('themes', Number(id));
}

export async function updateTheme(id, themeData) {
    const db = await getDB();
    const theme = await db.get('themes', Number(id));
    if (!theme) throw new Error('Theme not found');
    const updated = { ...theme, ...themeData };
    await db.put('themes', updated);
    return updated;
}

// ============ EXPORT ALL GUEST DATA ============
export async function exportAllGuestData() {
    const db = await getDB();

    const folders = await db.getAll('folders');
    const tags = await db.getAll('tags');
    const decks = await db.getAll('decks');
    const cards = await db.getAll('cards');
    const studySessions = await db.getAll('study_sessions');
    const deckTags = await db.getAll('deck_tags');
    const themes = await db.getAll('themes');

    return {
        folders,
        tags,
        decks,
        cards,
        studySessions,
        deckTags,
        themes
    };
}

// Check if there's any guest data to migrate
export async function hasGuestData() {
    const db = await getDB();
    const deckCount = await db.count('decks');
    const folderCount = await db.count('folders');
    return deckCount > 0 || folderCount > 0;
}

// Clear all guest data after successful migration
export async function clearAllGuestData() {
    const db = await getDB();

    // Clear all stores except themes (user might want to keep those)
    const tx = db.transaction(['folders', 'tags', 'decks', 'cards', 'study_sessions', 'deck_tags'], 'readwrite');
    await tx.objectStore('folders').clear();
    await tx.objectStore('decks').clear();
    await tx.objectStore('cards').clear();
    await tx.objectStore('study_sessions').clear();
    await tx.objectStore('deck_tags').clear();
    // Keep preset tags, clear custom ones
    const tagsStore = tx.objectStore('tags');
    const tags = await tagsStore.getAll();
    for (const tag of tags.filter(t => !t.is_preset)) {
        await tagsStore.delete(tag.id);
    }
    await tx.done;
}
