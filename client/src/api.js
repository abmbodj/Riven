const API_URL = 'http://localhost:3000/api';

export const api = {
    // ============ FOLDERS ============
    getFolders: async () => {
        const res = await fetch(`${API_URL}/folders`);
        if (!res.ok) throw new Error('Failed to fetch folders');
        return res.json();
    },

    createFolder: async (name, color, icon) => {
        const res = await fetch(`${API_URL}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color, icon }),
        });
        if (!res.ok) throw new Error('Failed to create folder');
        return res.json();
    },

    updateFolder: async (id, name, color, icon) => {
        const res = await fetch(`${API_URL}/folders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color, icon }),
        });
        if (!res.ok) throw new Error('Failed to update folder');
        return res.json();
    },

    deleteFolder: async (id) => {
        const res = await fetch(`${API_URL}/folders/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete folder');
        return res.json();
    },

    // ============ TAGS ============
    getTags: async () => {
        const res = await fetch(`${API_URL}/tags`);
        if (!res.ok) throw new Error('Failed to fetch tags');
        return res.json();
    },

    createTag: async (name, color) => {
        const res = await fetch(`${API_URL}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color }),
        });
        if (!res.ok) throw new Error('Failed to create tag');
        return res.json();
    },

    deleteTag: async (id) => {
        const res = await fetch(`${API_URL}/tags/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete tag');
        return res.json();
    },

    // ============ DECKS ============
    getDecks: async () => {
        const res = await fetch(`${API_URL}/decks`);
        if (!res.ok) throw new Error('Failed to fetch decks');
        return res.json();
    },

    createDeck: async (title, description, folderId, tagIds) => {
        const res = await fetch(`${API_URL}/decks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, folder_id: folderId, tagIds }),
        });
        if (!res.ok) throw new Error('Failed to create deck');
        return res.json();
    },

    getDeck: async (id) => {
        const res = await fetch(`${API_URL}/decks/${id}`);
        if (!res.ok) throw new Error('Failed to fetch deck');
        return res.json();
    },

    deleteDeck: async (id) => {
        const res = await fetch(`${API_URL}/decks/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete deck');
        return res.json();
    },

    updateDeck: async (id, title, description, folderId, tagIds) => {
        const res = await fetch(`${API_URL}/decks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, folder_id: folderId, tagIds }),
        });
        if (!res.ok) throw new Error('Failed to update deck');
        return res.json();
    },

    moveDeck: async (id, folderId) => {
        const res = await fetch(`${API_URL}/decks/${id}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_id: folderId }),
        });
        if (!res.ok) throw new Error('Failed to move deck');
        return res.json();
    },

    addCard: async (deckId, front, back) => {
        const res = await fetch(`${API_URL}/decks/${deckId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ front, back }),
        });
        if (!res.ok) throw new Error('Failed to add card');
        return res.json();
    },

    updateCard: async (id, front, back) => {
        const res = await fetch(`${API_URL}/cards/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ front, back }),
        });
        if (!res.ok) throw new Error('Failed to update card');
        return res.json();
    },

    deleteCard: async (id) => {
        const res = await fetch(`${API_URL}/cards/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete card');
        return res.json();
    },

    // ============ SPACED REPETITION ============
    reviewCard: async (id, correct, difficulty) => {
        const res = await fetch(`${API_URL}/cards/${id}/review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correct, difficulty }),
        });
        if (!res.ok) throw new Error('Failed to update card review');
        return res.json();
    },

    reorderCards: async (deckId, cardIds) => {
        const res = await fetch(`${API_URL}/decks/${deckId}/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardIds }),
        });
        if (!res.ok) throw new Error('Failed to reorder cards');
        return res.json();
    },

    // ============ STUDY SESSIONS ============
    saveStudySession: async (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType = 'study') => {
        const res = await fetch(`${API_URL}/study-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                deck_id: deckId, 
                cards_studied: cardsStudied, 
                cards_correct: cardsCorrect, 
                duration_seconds: durationSeconds,
                session_type: sessionType
            }),
        });
        if (!res.ok) throw new Error('Failed to save study session');
        return res.json();
    },

    getDeckStats: async (deckId) => {
        const res = await fetch(`${API_URL}/decks/${deckId}/stats`);
        if (!res.ok) throw new Error('Failed to fetch deck stats');
        return res.json();
    },

    // ============ DECK OPERATIONS ============
    duplicateDeck: async (id) => {
        const res = await fetch(`${API_URL}/decks/${id}/duplicate`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to duplicate deck');
        return res.json();
    },

    exportDeck: async (id, format = 'json') => {
        const res = await fetch(`${API_URL}/decks/${id}/export?format=${format}`);
        if (!res.ok) throw new Error('Failed to export deck');
        if (format === 'csv') {
            return res.text();
        }
        return res.json();
    },

    // ============ THEMES ============
    getThemes: async () => {
        const res = await fetch(`${API_URL}/themes`);
        if (!res.ok) throw new Error('Failed to fetch themes');
        return res.json();
    },

    createTheme: async (themeData) => {
        const res = await fetch(`${API_URL}/themes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(themeData),
        });
        if (!res.ok) throw new Error('Failed to create theme');
        return res.json();
    },

    activateTheme: async (id) => {
        const res = await fetch(`${API_URL}/themes/${id}/activate`, {
            method: 'PUT',
        });
        if (!res.ok) throw new Error('Failed to activate theme');
        return res.json();
    },
};
