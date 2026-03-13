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
        const [classesResponse, assignmentsResponse, scheduleResponse, foldersResponse, tagsResponse] = await Promise.all([
            request(app).get('/api/classes').set('Authorization', authHeader),
            request(app).get('/api/assignments').set('Authorization', authHeader),
            request(app).get('/api/schedule').set('Authorization', authHeader),
            request(app).get('/api/folders').set('Authorization', authHeader),
            request(app).get('/api/tags').set('Authorization', authHeader),
        ]);

        expect(classesResponse.status).toBe(404);
        expect(assignmentsResponse.status).toBe(404);
        expect(scheduleResponse.status).toBe(404);
        expect(foldersResponse.status).toBe(404);
        expect(tagsResponse.status).toBe(404);
    });
});
