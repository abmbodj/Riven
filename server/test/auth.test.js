
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';

// Use the default secret from index.js
const JWT_SECRET = 'test-secret';

describe('Auth 2FA Endpoints', () => {
    let app;
    let dbMock;
    let token;
    let userId;
    let authHeader;
    const user = { id: 1, email: 'test@example.com', role: 'user' };

    beforeAll(async () => {
        // Setup Logic
        vi.resetModules();

        // Setup Mock DB
        const pool = {
            query: vi.fn(),
            connect: vi.fn(),
            on: vi.fn(),
        };

        dbMock = {
            query: async (text, params) => {
                const result = await pool.query(text, params);
                return result.rows;
            },
            queryOne: async (text, params) => {
                const result = await pool.query(text, params);
                return result.rows[0];
            },
            execute: async (text, params) => {
                return await pool.query(text, params);
            },
            pool
        };

        // Inject Mock
        global.__TEST_DB_MOCK__ = dbMock;

        // Setup initial mock return values
        dbMock.pool.query.mockResolvedValue({ rows: [] });

        // Import app dynamically AFTER injecting mock
        const indexModule = await import('../index');
        app = indexModule.default;

        // Set up common variables
        userId = user.id;
        token = jwt.sign(user, JWT_SECRET);
        authHeader = `Bearer ${token}`;
    });

    afterAll(() => {
        // Cleanup
        delete global.__TEST_DB_MOCK__;
        vi.restoreAllMocks();
    });



    beforeEach(() => {
        vi.clearAllMocks();
        dbMock.pool.query.mockResolvedValue({ rows: [] });
    });

    describe('POST /api/auth/2fa/setup', () => {
        it('should generate a secret and QR code', async () => {
            const res = await request(app)
                .post('/api/auth/2fa/setup')
                .set('Authorization', authHeader);

            if (res.status === 500) {
                console.error('Setup Error:', res.body);
            }

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('secret');
            expect(res.body).toHaveProperty('qrCode');
            expect(dbMock.pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET two_fa_secret'),
                expect.arrayContaining([expect.any(String), 1])
            );
        });
    });

    describe('POST /api/auth/2fa/verify', () => {
        it('should verify valid token and enable 2FA', async () => {
            const secret = speakeasy.generateSecret();

            // First call: queryOne calls pool.query, needs { rows: [...] }
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ two_fa_secret: secret.base32 }] });

            // Second call: execute calls pool.query
            dbMock.pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const token = speakeasy.totp({
                secret: secret.base32,
                encoding: 'base32'
            });

            const res = await request(app)
                .post('/api/auth/2fa/verify')
                .set('Authorization', authHeader)
                .send({ token });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('2FA enabled successfully');
            expect(dbMock.pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET two_fa_enabled = TRUE'),
                expect.arrayContaining([userId])
            );
        });

        it('should fail with invalid token', async () => {
            const secret = speakeasy.generateSecret();
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ two_fa_secret: secret.base32 }] });

            const res = await request(app)
                .post('/api/auth/2fa/verify')
                .set('Authorization', authHeader)
                .send({ token: '111111' });

            expect(res.status).toBe(400);
        });
    });
    describe('POST /api/auth/2fa/disable', () => {
        it('should disable 2FA with correct password', async () => {
            // Mock user with password (hash of 'password')
            // $2a$10$hashed...
            // We can mock bcrypt.compare if we want, or use a real hash.
            // Let's mock the DB response.
            // We'll mock bcrypt.compare to return true by mocking the module? 
            // Or just rely on real bcrypt and generate a hash.
            // Generating hash is better.
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash('password', 10);

            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ password: hashedPassword }] });
            dbMock.pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // execute update

            const res = await request(app)
                .post('/api/auth/2fa/disable')
                .set('Authorization', authHeader)
                .send({ password: 'password' });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('2FA disabled successfully');
            expect(dbMock.pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET two_fa_enabled = FALSE'),
                expect.arrayContaining([userId])
            );
        });
    });

    describe('POST /api/auth/2fa/login', () => {
        it('should login with valid 2FA token', async () => {
            // Create a temp token
            const tempToken = jwt.sign({ id: userId, email: user.email, type: '2fa_pending' }, JWT_SECRET);
            const secret = speakeasy.generateSecret();
            const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

            // Mock DB to return user with secret
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: user.email,
                    role: 'user',
                    two_fa_secret: secret.base32,
                    two_fa_enabled: true
                }]
            });

            const res = await request(app)
                .post('/api/auth/2fa/login')
                .send({ tempToken, token });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.twoFAEnabled).toBe(true);
        });

        it('should fail with invalid 2FA token', async () => {
            const tempToken = jwt.sign({ id: userId, email: user.email, type: '2fa_pending' }, JWT_SECRET);
            const secret = speakeasy.generateSecret();

            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: user.email,
                    role: 'user',
                    two_fa_secret: secret.base32
                }]
            });

            const res = await request(app)
                .post('/api/auth/2fa/login')
                .send({ tempToken, token: '111111' });

            expect(res.status).toBe(400);
        });
    });
});
