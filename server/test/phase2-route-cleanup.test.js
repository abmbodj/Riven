import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';

describe('Phase 2 legacy route cleanup', () => {
    let app;
    let authHeader;
    let dbMock;

    beforeAll(async () => {
        vi.resetModules();

        const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn() };

        dbMock = {
            query: async (text, params) => (await pool.query(text, params)).rows,
            queryOne: async (text, params) => (await pool.query(text, params)).rows[0],
            execute: async (text, params) => await pool.query(text, params),
            ready: vi.fn().mockResolvedValue(),
            pool,
        };

        global.__TEST_DB_MOCK__ = dbMock;
        dbMock.pool.query.mockResolvedValue({ rows: [] });

        const indexModule = await import('../index');
        app = indexModule.default;

        authHeader = `Bearer ${jwt.sign({ id: 1, email: 'test@example.com', role: 'user' }, JWT_SECRET)}`;
    });

    afterAll(() => {
        delete global.__TEST_DB_MOCK__;
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        dbMock.pool.query.mockReset();
        dbMock.ready.mockReset();
        dbMock.pool.query.mockResolvedValue({ rows: [] });
        dbMock.ready.mockResolvedValue();
    });

    it('does not mount the retired Phase 2 CRUD Express endpoints', async () => {
        const [
            classesResponse,
            assignmentsResponse,
            scheduleResponse,
            foldersResponse,
            tagsResponse,
            themesResponse,
            decksResponse,
            deckDetailResponse,
            createDeckResponse,
            updateDeckResponse,
            moveDeckResponse,
            deleteDeckResponse,
            duplicateDeckResponse,
            addCardResponse,
            updateCardResponse,
            deleteCardResponse,
            progressCardResponse,
            reviewCardResponse,
            reorderCardsResponse,
            createStudySessionResponse,
            studySessionsResponse,
            deckStatsResponse,
            conversationsResponse,
            threadResponse,
            createMessageResponse,
            updateMessageResponse,
            deleteMessageResponse,
            unreadCountResponse,
            updateProfileResponse,
            updateStreakResponse,
            getStreakResponse,
            getPetResponse,
            updatePetResponse,
            toggleSimulateFreeResponse,
            searchUsersResponse,
            userProfileResponse,
            friendsResponse,
            friendRequestResponse,
            acceptFriendRequestResponse,
            removeFriendResponse,
            blockedUsersResponse,
            blockUserResponse,
            unblockUserResponse,
            reportContentResponse,
        ] = await Promise.all([
            request(app).get('/api/classes').set('Authorization', authHeader),
            request(app).get('/api/assignments').set('Authorization', authHeader),
            request(app).get('/api/schedule').set('Authorization', authHeader),
            request(app).get('/api/folders').set('Authorization', authHeader),
            request(app).get('/api/tags').set('Authorization', authHeader),
            request(app).get('/api/themes').set('Authorization', authHeader),
            request(app).get('/api/decks').set('Authorization', authHeader),
            request(app).get('/api/decks/1').set('Authorization', authHeader),
            request(app).post('/api/decks').set('Authorization', authHeader).send({ title: 'Deck' }),
            request(app).put('/api/decks/1').set('Authorization', authHeader).send({ title: 'Deck' }),
            request(app).put('/api/decks/1/move').set('Authorization', authHeader).send({ folder_id: 2 }),
            request(app).delete('/api/decks/1').set('Authorization', authHeader),
            request(app).post('/api/decks/1/duplicate').set('Authorization', authHeader),
            request(app).post('/api/decks/1/cards').set('Authorization', authHeader).send({ front: 'Q', back: 'A' }),
            request(app).put('/api/cards/1').set('Authorization', authHeader).send({ front: 'Q', back: 'A' }),
            request(app).delete('/api/cards/1').set('Authorization', authHeader),
            request(app).put('/api/cards/1/progress').set('Authorization', authHeader).send({ difficulty: 3 }),
            request(app).put('/api/cards/1/review').set('Authorization', authHeader).send({ correct: true }),
            request(app).put('/api/decks/1/cards/reorder').set('Authorization', authHeader).send({ cardIds: [1, 2] }),
            request(app).post('/api/study-sessions').set('Authorization', authHeader).send({ deck_id: 1 }),
            request(app).get('/api/study-sessions').set('Authorization', authHeader),
            request(app).get('/api/decks/1/stats').set('Authorization', authHeader),
            request(app).get('/api/messages/conversations').set('Authorization', authHeader),
            request(app).get('/api/messages/2').set('Authorization', authHeader),
            request(app).post('/api/messages').set('Authorization', authHeader).send({ receiverId: 2, content: 'hi' }),
            request(app).put('/api/messages/1').set('Authorization', authHeader).send({ content: 'edited' }),
            request(app).delete('/api/messages/1').set('Authorization', authHeader),
            request(app).get('/api/messages/unread/count').set('Authorization', authHeader),
            request(app).put('/api/auth/profile').set('Authorization', authHeader).send({ bio: 'updated' }),
            request(app).put('/api/auth/streak').set('Authorization', authHeader).send({ streakData: { currentStreak: 2 } }),
            request(app).get('/api/auth/streak').set('Authorization', authHeader),
            request(app).get('/api/auth/pet').set('Authorization', authHeader),
            request(app).put('/api/auth/pet').set('Authorization', authHeader).send({ customization: { gardenTheme: 'cottage' } }),
            request(app).post('/api/auth/simulate-free').set('Authorization', authHeader),
            request(app).get('/api/users/search?q=bi').set('Authorization', authHeader),
            request(app).get('/api/users/2').set('Authorization', authHeader),
            request(app).get('/api/friends').set('Authorization', authHeader),
            request(app).post('/api/friends/request').set('Authorization', authHeader).send({ userId: 2 }),
            request(app).post('/api/friends/accept').set('Authorization', authHeader).send({ userId: 2 }),
            request(app).delete('/api/friends/2').set('Authorization', authHeader),
            request(app).get('/api/blocked-users').set('Authorization', authHeader),
            request(app).post('/api/users/2/block').set('Authorization', authHeader),
            request(app).delete('/api/users/2/block').set('Authorization', authHeader),
            request(app).post('/api/reports').set('Authorization', authHeader).send({ contentType: 'user', reason: 'spam' }),
        ]);

        expect(classesResponse.status).toBe(404);
        expect(assignmentsResponse.status).toBe(404);
        expect(scheduleResponse.status).toBe(404);
        expect(foldersResponse.status).toBe(404);
        expect(tagsResponse.status).toBe(404);
        expect(themesResponse.status).toBe(404);
        expect(decksResponse.status).toBe(404);
        expect(deckDetailResponse.status).toBe(404);
        expect(createDeckResponse.status).toBe(404);
        expect(updateDeckResponse.status).toBe(404);
        expect(moveDeckResponse.status).toBe(404);
        expect(deleteDeckResponse.status).toBe(404);
        expect(duplicateDeckResponse.status).toBe(404);
        expect(addCardResponse.status).toBe(404);
        expect(updateCardResponse.status).toBe(404);
        expect(deleteCardResponse.status).toBe(404);
        expect(progressCardResponse.status).toBe(404);
        expect(reviewCardResponse.status).toBe(404);
        expect(reorderCardsResponse.status).toBe(404);
        expect(createStudySessionResponse.status).toBe(404);
        expect(studySessionsResponse.status).toBe(404);
        expect(deckStatsResponse.status).toBe(404);
        expect(conversationsResponse.status).toBe(404);
        expect(threadResponse.status).toBe(404);
        expect(createMessageResponse.status).toBe(404);
        expect(updateMessageResponse.status).toBe(404);
        expect(deleteMessageResponse.status).toBe(404);
        expect(unreadCountResponse.status).toBe(404);
        expect(updateProfileResponse.status).toBe(404);
        expect(updateStreakResponse.status).toBe(404);
        expect(getStreakResponse.status).toBe(404);
        expect(getPetResponse.status).toBe(404);
        expect(updatePetResponse.status).toBe(404);
        expect(toggleSimulateFreeResponse.status).toBe(404);
        expect(searchUsersResponse.status).toBe(404);
        expect(userProfileResponse.status).toBe(404);
        expect(friendsResponse.status).toBe(404);
        expect(friendRequestResponse.status).toBe(404);
        expect(acceptFriendRequestResponse.status).toBe(404);
        expect(removeFriendResponse.status).toBe(404);
        expect(blockedUsersResponse.status).toBe(404);
        expect(blockUserResponse.status).toBe(404);
        expect(unblockUserResponse.status).toBe(404);
        expect(reportContentResponse.status).toBe(404);
    });
});
