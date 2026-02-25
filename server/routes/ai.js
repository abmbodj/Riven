const express = require('express');
const { GoogleGenAI } = require('@google/genai');

module.exports = function ({ app, db, authMiddleware, rateLimit }) {

    // AI Rate Limiter: 15 requests per 15 minutes to stay well within free tier
    const aiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 15,
        message: { error: 'AI generation limit reached. Please try again later.' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    // Generate Flashcards Deck from Notes
    app.post('/api/ai/generate-deck', authMiddleware, aiLimiter, async (req, res) => {
        try {
            const { notes, deckName, classId } = req.body;

            if (!notes || notes.trim() === '') {
                return res.status(400).json({ error: 'Notes are required to generate flashcards.' });
            }

            // Cap notes at 15,000 characters to prevent abuse and ensure fast generation
            if (notes.length > 15000) {
                return res.status(400).json({ error: 'Notes are too long. Please limit to ~3000 words.' });
            }

            if (!process.env.GEMINI_API_KEY) {
                return res.status(500).json({ error: 'AI integration is not configured on the server.' });
            }

            // Initialize Gemini SDK
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const prompt = `
You are an expert tutor creating highly effective spaced-repetition flashcards.
Extract the most important facts, concepts, and definitions from the provided lecture notes and output them as a precise JSON array of flashcards.

Rules:
1. Output ONLY a valid JSON array, with absolutely no markdown formatting, backticks, or conversational text outside the array.
2. Each flashcard should have exactly two keys: "front" and "back".
3. The "front" should be a clear, concise question or term.
4. The "back" should be the direct answer or definition.
5. Generate between 5 and 15 flashcards depending on the length and density of the notes.
6. Make the cards atomic (one concept per card).

Example JSON format:
[
  {
    "front": "What is the powerhouse of the cell?",
    "back": "Mitochondria"
  }
]

Lecture Notes:
${notes}
`;

            // Call Gemini 1.5 Flash
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt,
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
