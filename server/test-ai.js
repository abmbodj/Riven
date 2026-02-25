const fs = require('fs');
const fetch = require('node-fetch'); // Let's use fetch if available, or https

async function run() {
    try {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJwdWVydG92aWV0MTJAaWNsb3VkLmNvbSIsInVzZXJuYW1lIjoiYWJpc2Nvb2w2OSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MjA0MTI3NSwiZXhwIjoyMDg3NjE3Mjc1fQ.hlwrWlf_-2VtS4egHjlt8VUcxbLW8JJQBdIPFTxrZng";
        const imgBuffer = fs.readFileSync('/Users/ab/.gemini/antigravity/brain/1ac54878-ca04-4448-bcf5-777c0ebb2f62/test_lecture_notes_1772040385807.png');
        const base64Image = imgBuffer.toString('base64');

        const res = await fetch('http://localhost:3000/api/ai/generate-deck', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                notes: "",
                file: {
                    data: base64Image,
                    mimeType: "image/png"
                },
                deckName: "Image Test Deck"
            })
        });

        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));

        if (data.deck_id) {
            console.log("\nSuccess! Deck ID:", data.deck_id);
            // Fetch cards to verify
            const cardsRes = await fetch(`http://localhost:3000/api/decks/${data.deck_id}/cards`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const cardsData = await cardsRes.json();
            console.log(cardsData.map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n'));
        }
    } catch (e) {
        console.error(e);
    }
}
run();
