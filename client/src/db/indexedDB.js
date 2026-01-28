import { openDB } from 'idb';

const DB_NAME = 'riven-db';
const DB_VERSION = 1;

let dbPromise = null;

async function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
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
                    const themeStore = db.createObjectStore('themes', { keyPath: 'id', autoIncrement: true });
                }
            }
        });

        // Initialize default themes if needed
        const db = await dbPromise;
        const themeCount = await db.count('themes');
        if (themeCount === 0) {
            const defaultThemes = [
                { name: 'Dark', bg_color: '#0a0a0b', surface_color: '#18181b', text_color: '#fafafa', secondary_text_color: '#a1a1aa', border_color: '#27272a', accent_color: '#6366f1', is_active: 1 },
                { name: 'Light', bg_color: '#fafafa', surface_color: '#ffffff', text_color: '#18181b', secondary_text_color: '#71717a', border_color: '#e4e4e7', accent_color: '#6366f1', is_active: 0 },
                { name: 'Ocean', bg_color: '#0c1929', surface_color: '#132f4c', text_color: '#e3f2fd', secondary_text_color: '#90caf9', border_color: '#1e4976', accent_color: '#42a5f5', is_active: 0 },
                { name: 'Forest', bg_color: '#0d1f0d', surface_color: '#1a3a1a', text_color: '#e8f5e9', secondary_text_color: '#a5d6a7', border_color: '#2e5a2e', accent_color: '#66bb6a', is_active: 0 }
            ];
            for (const theme of defaultThemes) {
                await db.add('themes', theme);
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
    }
    return dbPromise;
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
export async function addCard(deck_id, front, back) {
    const db = await getDB();
    const cards = await db.getAll('cards');
    const deckCards = cards.filter(c => c.deck_id === Number(deck_id));
    const maxPosition = deckCards.length > 0 ? Math.max(...deckCards.map(c => c.position || 0)) : -1;
    
    const card = {
        deck_id: Number(deck_id),
        front,
        back,
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

export async function updateCard(id, front, back) {
    const db = await getDB();
    const card = await db.get('cards', Number(id));
    if (!card) throw new Error('Card not found');
    const updated = { ...card, front, back };
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
