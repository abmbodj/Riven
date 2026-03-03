const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const mammoth = require('mammoth');

module.exports = function ({ app, db, authMiddleware, rateLimit, ipKeyGenerator }) {

    // Helper function to check and consume AI quota
    const checkAndConsumeAILimit = async (req, res, next) => {
        try {
            const userRes = await db.query('SELECT subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier FROM users WHERE id = $1', [req.user.id]);
            if (!userRes.length) return res.status(401).json({ error: 'User not found' });

            const user = userRes[0];
            const isPrivileged = (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier;
            const isPremium = isPrivileged || user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';

            const FREE_LIMIT = 10;
            const PREMIUM_LIMIT = 50;
            const MAX_LIMIT = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
            const RESET_MS = 2 * 60 * 60 * 1000; // 2 hours
            const now = new Date();

            let count = user.ai_generations_count || 0;
            let lastReset = user.last_ai_generation_reset ? new Date(user.last_ai_generation_reset) : null;

            // Reset if 2 hours have passed
            if (!lastReset || (now - lastReset > RESET_MS)) {
                count = 0;
                lastReset = now;
            }

            if (count >= MAX_LIMIT) {
                const errorMsg = isPremium
                    ? 'AI generation limit reached. Please try again later.'
                    : 'AI generation limit reached. Please try again later or upgrade to Premium.';
                return res.status(429).json({ error: errorMsg });
            }

            // Consume 1 quota immediately
            count += 1;
            await db.execute('UPDATE users SET ai_generations_count = $1, last_ai_generation_reset = $2 WHERE id = $3', [count, lastReset, req.user.id]);

            req.aiLimitsContext = isPremium
                ? { isPremium: true, characterLimit: 50000, flashcardRange: [5, 40] }
                : { isPremium: false, characterLimit: 15000, flashcardRange: [5, 15] };
            next();
        } catch (err) {
            console.error('AI Limiter Error:', err);
            res.status(500).json({ error: 'Failed to verify AI limits' });
        }
    };

    // Get current AI limits and usage for the authenticated user
    app.get('/api/ai/limits', authMiddleware, async (req, res) => {
        try {
            const userRes = await db.query('SELECT subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier FROM users WHERE id = $1', [req.user.id]);
            if (!userRes.length) return res.status(401).json({ error: 'User not found' });

            const user = userRes[0];
            const isPrivileged = (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier;
            const isPremium = isPrivileged || user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';

            const FREE_LIMIT = 10;
            const PREMIUM_LIMIT = 50;
            const MAX_LIMIT = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
            const RESET_MS = 2 * 60 * 60 * 1000;
            const now = new Date();

            let count = user.ai_generations_count || 0;
            let lastReset = user.last_ai_generation_reset ? new Date(user.last_ai_generation_reset) : null;

            if (!lastReset || (now - lastReset > RESET_MS)) {
                count = 0;
            }

            const remaining = Math.max(0, MAX_LIMIT - count);

            res.json({
                remaining,
                max: MAX_LIMIT,
                characterLimit: isPremium ? 50000 : 15000,
                flashcardRange: isPremium ? [5, 40] : [5, 15]
            });
        } catch (error) {
            console.error('Error fetching AI limits:', error);
            res.status(500).json({ error: 'Failed to fetch AI limits' });
        }
    });

    // Generate Flashcards Deck from Notes or File
    app.post('/api/ai/generate-deck', authMiddleware, checkAndConsumeAILimit, async (req, res) => {
        try {
            const { notes, file, deckName, classId } = req.body;

            const hasNotes = notes && notes.trim() !== '';
            const hasFile = file && file.data && file.mimeType;

            let processedNotes = notes || '';
            let keepFile = hasFile;

            // If the file is docx/txt, process it into text here because inlineData only natively supports pdfs/images
            if (hasFile && file.data && file.mimeType) {
                try {
                    const fileBuffer = Buffer.from(file.data, 'base64');

                    if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimeType === 'application/msword') {
                        const result = await mammoth.extractRawText({ buffer: fileBuffer });
                        processedNotes += '\n\n' + result.value;
                        keepFile = false;
                    } else if (file.mimeType === 'text/plain') {
                        processedNotes += '\n\n' + fileBuffer.toString('utf8');
                        keepFile = false;
                    }
                } catch (parseErr) {
                    console.error("Failed to parse document text:", parseErr);
                }
            }

            const hasProcessedNotes = processedNotes.trim() !== '';

            if (!hasProcessedNotes && !keepFile) {
                return res.status(400).json({ error: 'Notes or a file are required to generate flashcards.' });
            }

            // Cap notes to prevent abuse and ensure fast generation
            const characterLimit = req.aiLimitsContext?.characterLimit || 15000;
            if (hasProcessedNotes && processedNotes.length > characterLimit) {
                return res.status(400).json({ error: `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.` });
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

            if (hasProcessedNotes) {
                contentsParts.push({ text: `\n\nLecture Notes/Text Content:\n${processedNotes}` });
            }
            if (keepFile) {
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

    // Generate Class from Syllabus
    app.post('/api/ai/generate-class', authMiddleware, checkAndConsumeAILimit, async (req, res) => {
        try {
            const { file, notes } = req.body;

            const hasFile = file && file.data && file.mimeType;

            let processedNotes = notes || '';
            let keepFile = hasFile;

            // If the file is docx/txt, process it into text here because inlineData only natively supports pdfs/images
            if (hasFile && file.data && file.mimeType) {
                try {
                    const fileBuffer = Buffer.from(file.data, 'base64');

                    if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimeType === 'application/msword') {
                        const result = await mammoth.extractRawText({ buffer: fileBuffer });
                        processedNotes += '\n\n' + result.value;
                        keepFile = false;
                    } else if (file.mimeType === 'text/plain') {
                        processedNotes += '\n\n' + fileBuffer.toString('utf8');
                        keepFile = false;
                    }
                } catch (parseErr) {
                    console.error("Failed to parse document text:", parseErr);
                }
            }

            const hasProcessedNotes = processedNotes.trim() !== '';

            if (!hasProcessedNotes && !keepFile) {
                return res.status(400).json({ error: 'A syllabus file or text notes are required.' });
            }

            if (!process.env.GEMINI_API_KEY) {
                return res.status(500).json({ error: 'AI integration is not configured on the server.' });
            }

            // Initialize Gemini SDK
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const promptInstruction = `
You are an expert academic assistant designed to extract class information from a syllabus.
Extract the class details and a list of assignments from the provided syllabus document, image, or text notes.
Output ONLY a valid JSON object, with absolutely no markdown formatting, backticks, or conversational text outside the object.

The JSON object must have the following structure:
{
  "name": "Class Name (e.g. CS 101 or Computer Science 101)",
  "professor": "Professor Name (e.g. Dr. Jane Smith)",
  "room": "Room or Location (e.g. Building A, Room 102, or Online)",
  "times": [
     { "day": 1, "start_time": "09:00", "end_time": "10:30" } 
     // day mapping: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
     // start_time and end_time MUST be in HH:MM format (24-hour time)
  ],
  "assignments": [
     {
       "title": "Assignment Title",
       "description": "Any relevant details or description",
       "due_date": "ISO 8601 Timestamp (e.g., 2023-10-15T23:59:00.000Z) or null if no exact date is specified",
       "type": "homework" // MUST be one of: homework, reading, project, test, exam, other
     }
  ]
}

Rules:
1. ONLY return the JSON object.
2. If you cannot find a piece of information, you can leave it empty, null, or omit it (except for the structure keys).
3. Guess the closest matching types for assignments.
4. Give reasonable estimates for times if they are slightly ambiguous, but strictly adhere to format.
5. Due dates must be valid ISO 8601 timestamps if a date parsing is possible. Try to determine the year based on context, otherwise use the current year.
`;

            const contentsParts = [{ text: promptInstruction }];

            if (hasProcessedNotes) {
                contentsParts.push({ text: `\n\nSyllabus Text Content:\n${processedNotes}` });
            }
            if (keepFile) {
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

            let classData;
            try {
                classData = JSON.parse(rawResponse);
            } catch (jsonErr) {
                console.error("Failed to parse AI class response:", rawResponse);
                return res.status(500).json({ error: 'AI generated invalid class format. Please try again.' });
            }

            // Return the raw extracted JSON data so the frontend can preview it before saving
            res.json({ classData });

        } catch (error) {
            console.error('AI Class Generation Error:', error);
            res.status(500).json({ error: `An error occurred: ${error.message || 'Unknown server error'}` });
        }
    });

};
