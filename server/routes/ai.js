const express = require('express');
const { GoogleGenAI } = require('@google/genai');

module.exports = function ({ app, db, authMiddleware, rateLimit }) {

    // AI Rate Limiter: 15 requests per 15 minutes to stay well within free tier
    // Uses req.user.id so the limit is strictly per-account, not per-IP
    const aiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 15,
        keyGenerator: (req) => {
            // Default to IP if user isn't populated for some reason, but they should be via authMiddleware
            return req.user ? req.user.id : req.ip;
        },
        message: { error: 'AI generation limit reached. Please try again later.' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    // Get current AI limits and usage for the authenticated user
    app.get('/api/ai/limits', authMiddleware, async (req, res) => {
        try {
            // Get the store instance from the rate limiter
            const store = aiLimiter.store;
            const key = req.user.id;

            // The express-rate-limit store has a decrement or get/increment, but standard stores 
            // usually have a way to fetch the current hits. 
            // In express-rate-limit v6+, we can use `get` or manually decrement if we incremented to check.
            // Since `get` wasn't added to all stores until late versions, `increment` with 0 isn't always supported.
            // But standard `store.get` or `store.increment` without actually consuming a hit is tricky. 
            // Usually, standard `store.decrement` exists but isn't what we want.
            // If the store is the MemoryStore, it has a `hits` property on the internal map. 
            // express-rate-limit v7 allows `await store.get(key)`. Let's try `store.get`.

            let totalHits = 0;
            if (typeof store.get === 'function') {
                const result = await store.get(key);
                totalHits = result ? result.totalHits || result : 0;
                if (typeof totalHits === 'object' && totalHits.totalHits !== undefined) {
                    totalHits = totalHits.totalHits;
                }
            } else if (store.hits) {
                // memory store fallback
                totalHits = store.hits[key] || 0;
            }

            const maxRequests = aiLimiter.max;
            const remaining = Math.max(0, maxRequests - totalHits);

            res.json({
                remaining,
                max: maxRequests,
                characterLimit: 15000,
                flashcardRange: [5, 15]
            });
        } catch (error) {
            console.error('Error fetching AI limits:', error);
            // Default safe response if store inspection fails
            res.json({
                remaining: 15, // Fallback
                max: 15,
                characterLimit: 15000,
                flashcardRange: [5, 15]
            });
        }
    });

    // Generate Flashcards Deck from Notes or File
    app.post('/api/ai/generate-deck', authMiddleware, aiLimiter, async (req, res) => {
        try {
            const { notes, file, deckName, classId } = req.body;

            const hasNotes = notes && notes.trim() !== '';
            const hasFile = file && file.data && file.mimeType;

            if (!hasNotes && !hasFile) {
                return res.status(400).json({ error: 'Notes or a file are required to generate flashcards.' });
            }

            // Cap notes at 15,000 characters to prevent abuse and ensure fast generation
            if (hasNotes && notes.length > 15000) {
                return res.status(400).json({ error: 'Notes are too long. Please limit to ~3000 words.' });
            }

            if (!process.env.GEMINI_API_KEY) {
                return res.status(500).json({ error: 'AI integration is not configured on the server.' });
            }

            // Initialize Gemini SDK
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const promptInstruction = `
You are an expert tutor creating highly effective spaced-repetition flashcards.
Extract the most important facts, concepts, and definitions from the provided lecture notes, document, or image, and output them as a precise JSON array of flashcards.

Rules:
1. Output ONLY a valid JSON array, with absolutely no markdown formatting, backticks, or conversational text outside the array.
2. Each flashcard should have exactly two keys: "front" and "back".
3. The "front" should be a clear, concise question or term.
4. The "back" should be the direct answer or definition.
5. Generate between 5 and 15 flashcards depending on the length and density of the source material.
6. Make the cards atomic (one concept per card).
7. Ensure definitions are accurate based on the provided material.

Example JSON format:
[
  {
    "front": "What is the powerhouse of the cell?",
    "back": "Mitochondria"
  }
]
`;

            const contentsParts = [{ text: promptInstruction }];

            if (hasNotes) {
                contentsParts.push({ text: `\n\nLecture Notes/Text Content:\n${notes}` });
            }
            if (hasFile) {
                contentsParts.push({
                    inlineData: {
                        data: file.data,
                        mimeType: file.mimeType
                    }
                });
            }

            // Call Gemini Flash
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contentsParts,
            });

            let rawResponse = response.text;

            // Clean up the response if it accidentally includes markdown code block markers
            if (rawResponse.startsWith('\`\`\`json')) {
                rawResponse = rawResponse.replace(/^\`\`\`json/m, '');
                rawResponse = rawResponse.replace(/\`\`\`$/m, '');
            } else if (rawResponse.startsWith('\`\`\`')) {
                rawResponse = rawResponse.replace(/^\`\`\`/m, '');
                rawResponse = rawResponse.replace(/\`\`\`$/m, '');
            }

            rawResponse = rawResponse.trim();

            let flashcards;
            try {
                flashcards = JSON.parse(rawResponse);
            } catch (jsonErr) {
                console.error("Failed to parse AI response:", rawResponse);
                return res.status(500).json({ error: 'AI generated invalid flashcard format. Please try again.' });
            }

            if (!Array.isArray(flashcards) || flashcards.length === 0) {
                return res.status(500).json({ error: 'AI failed to generate any usable flashcards.' });
            }

            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Create the Deck
                const finalDeckName = deckName || 'AI Generated Deck';
                const deckRes = await client.query(
                    'INSERT INTO decks (user_id, title, description, class_id) VALUES ($1, $2, $3, $4) RETURNING *',
                    [req.user.id, finalDeckName, 'Auto-generated via Gemini AI', classId || null]
                );
                const newDeck = deckRes.rows[0];

                // 2. Insert the Cards
                for (let i = 0; i < flashcards.length; i++) {
                    const card = flashcards[i];
                    await client.query(
                        'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4)',
                        [newDeck.id, card.front, card.back, i] // position sorting 0, 1, 2...
                    );
                }

                await client.query('COMMIT');

                res.status(201).json({
                    message: 'Deck generated successfully',
                    deck_id: newDeck.id,
                    card_count: flashcards.length
                });

            } catch (dbErr) {
                await client.query('ROLLBACK');
                throw dbErr;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('AI Generation Error:', error);
            res.status(500).json({ error: 'An unexpected error occurred during AI generation.' });
        }
    });
};
