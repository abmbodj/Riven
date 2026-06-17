// Onboarding magic-moment API (RIV-025: focused module, not appended to the authApi monolith).
//
// generateDeckPreview() hits the anonymous `generate-deck-preview` edge function — no session
// required, so a brand-new visitor can see a real deck from their typed topic BEFORE signing up.
// savePreviewDeck() runs AFTER the account exists and persists the exact cards the visitor
// already saw as their first real deck (no second generation).

import { supabase } from '../lib/supabaseClient';
import { createDeck } from './authApi';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Generate a short preview deck from a free-text topic, with no auth and no DB write.
 * @returns {Promise<{ topic: string, deckName: string, cards: Array<{front,back,position}> }>}
 */
export async function generateDeckPreview(topic) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-deck-preview`, {
        method: 'POST',
        headers: {
            apikey: ANON_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
    });

    const text = await response.text().catch(() => '');
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        const err = new Error(data.error || 'We couldn’t build your set. Please try again.');
        err.status = response.status;
        throw err;
    }

    return data;
}

/**
 * Persist the already-shown preview cards as the signed-in user's first real deck.
 * Reuses the public createDeck() (RLS-scoped), then bulk-inserts the cards in one round trip.
 * @returns the created deck row.
 */
export async function savePreviewDeck(deckName, cards = []) {
    const title = (deckName && deckName.trim()) || 'My first deck';
    const deck = await createDeck(title, 'Created from your first topic', null, [], null);

    const rows = (cards || [])
        .filter((card) => card && (card.front || card.back))
        .map((card, index) => ({
            deck_id: deck.id,
            front: card.front || '',
            back: card.back || '',
            position: typeof card.position === 'number' ? card.position : index,
        }));

    if (rows.length) {
        const { error } = await supabase.from('cards').insert(rows);
        if (error) throw error;
    }

    return deck;
}
