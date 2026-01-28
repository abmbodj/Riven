const API_URL = 'http://localhost:3000/api';

export const api = {
    getDecks: async () => {
        const res = await fetch(`${API_URL}/decks`);
        if (!res.ok) throw new Error('Failed to fetch decks');
        return res.json();
    },

    createDeck: async (title, description) => {
        const res = await fetch(`${API_URL}/decks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description }),
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

    updateDeck: async (id, title, description) => {
        const res = await fetch(`${API_URL}/decks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description }),
        });
        if (!res.ok) throw new Error('Failed to update deck');
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
