
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';

const JWT_SECRET = 'test-secret';

describe('Auth Core Endpoints', () => {
    let app;
    let dbMock;
    let token;
    let authHeader;
    const testUser = { id: 1, email: 'test@example.com', role: 'user' };

    beforeAll(async () => {
        vi.resetModules();
        const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn() };

        dbMock = {
            query: async (text, params) => (await pool.query(text, params)).rows,
            queryOne: async (text, params) => (await pool.query(text, params)).rows[0],
            execute: async (text, params) => await pool.query(text, params),
            pool
        };

        global.__TEST_DB_MOCK__ = dbMock;
        dbMock.pool.query.mockResolvedValue({ rows: [] });

        const indexModule = await import('../index');
        app = indexModule.default;

        token = jwt.sign(testUser, JWT_SECRET);
        authHeader = `Bearer ${token}`;
    });

    afterAll(() => {
        delete global.__TEST_DB_MOCK__;
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        dbMock.pool.query.mockResolvedValue({ rows: [] });
    });

    // ============ REGISTER ============

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            // No existing email
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // No existing username
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // INSERT user
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
            // INSERT default theme 1
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // INSERT default theme 2
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // INSERT preset tags (8 tags)
            for (let i = 0; i < 8; i++) {
                dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            }

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'newuser', email: 'new@test.com', password: 'password123' });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.username).toBe('newuser');
            expect(res.body.user.email).toBe('new@test.com');
        });

        it('should reject registration without required fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'user' }); // missing email and password

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('All fields are required');
        });

        it('should reject invalid email format', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'user', email: 'not-an-email', password: 'password123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid email');
        });

        it('should reject short password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'user', email: 'test@test.com', password: '123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('at least 6 characters');
        });

        it('should reject duplicate email', async () => {
            // Existing email found
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'newuser', email: 'existing@test.com', password: 'password123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('already exists');
        });
    });

    // ============ LOGIN ============

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    id: 1, email: 'test@example.com', username: 'testuser',
                    password: hashedPassword, role: 'user', display_name: 'Test',
                    share_code: 'ABC123', avatar: null, bio: '', streak_data: '{}',
                    two_fa_enabled: false, subscription_tier: 'free',
                    simulate_free_tier: false, email_verified: false
                }]
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.email).toBe('test@example.com');
            expect(res.body.require2FA).toBe(false);
        });

        it('should reject login with wrong password', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{ id: 1, email: 'test@example.com', password: hashedPassword }]
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid credentials');
        });

        it('should reject login for nonexistent user', async () => {
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nobody@test.com', password: 'password123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid credentials');
        });

        it('should reject login with missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com' });

            expect(res.status).toBe(400);
        });

        it('should trigger 2FA flow for enabled users', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    id: 1, email: 'test@example.com', password: hashedPassword,
                    two_fa_enabled: true
                }]
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.require2FA).toBe(true);
            expect(res.body).toHaveProperty('tempToken');
        });
    });

    // ============ PASSWORD CHANGE ============

    describe('PUT /api/auth/password', () => {
        it('should change password with correct current password', async () => {
            const hashedPassword = await bcrypt.hash('oldpassword', 10);
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ password: hashedPassword }] });
            dbMock.pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const res = await request(app)
                .put('/api/auth/password')
                .set('Authorization', authHeader)
                .send({ currentPassword: 'oldpassword', newPassword: 'newpassword123' });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('changed successfully');
        });

        it('should reject change with wrong current password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ password: hashedPassword }] });

            const res = await request(app)
                .put('/api/auth/password')
                .set('Authorization', authHeader)
                .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword123' });

            expect(res.status).toBe(400);
        });
    });

    // ============ FORGOT PASSWORD ============

    describe('POST /api/auth/forgot-password', () => {
        it('should return success even for nonexistent email (anti-enumeration)', async () => {
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'nobody@test.com' });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('If an account');
        });

        it('should create reset token for existing user', async () => {
            // queryOne: find user
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@test.com' }] });
            // Delete old tokens
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // Insert new token
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'test@test.com' });

            expect(res.status).toBe(200);
            // Verify token was inserted
            expect(dbMock.pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO password_reset_tokens'),
                expect.any(Array)
            );
        });

        it('should reject without email', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({});

            expect(res.status).toBe(400);
        });
    });

    // ============ RESET PASSWORD ============

    describe('POST /api/auth/reset-password', () => {
        it('should reset password with valid token', async () => {
            // queryOne for token lookup
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, token: 'valid-token' }]
            });
            // Update password
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // Mark token used
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            // Clean up old tokens
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'valid-token', password: 'newpassword123' });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('reset successfully');
        });

        it('should reject with invalid/expired token', async () => {
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'expired-token', password: 'newpassword123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid or expired');
        });

        it('should reject short password', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'some-token', password: '12' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('at least 6 characters');
        });
    });

    // ============ 2FA TESTS (kept from original) ============

    describe('POST /api/auth/2fa/setup', () => {
        it('should generate a secret and QR code', async () => {
            const res = await request(app)
                .post('/api/auth/2fa/setup')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('secret');
            expect(res.body).toHaveProperty('qrCode');
        });
    });

    describe('POST /api/auth/2fa/verify', () => {
        it('should verify valid token and enable 2FA', async () => {
            const secret = speakeasy.generateSecret();
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ two_fa_secret: secret.base32 }] });
            dbMock.pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const totpToken = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

            const res = await request(app)
                .post('/api/auth/2fa/verify')
                .set('Authorization', authHeader)
                .send({ token: totpToken });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('2FA enabled successfully');
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
            const hashedPassword = await bcrypt.hash('password', 10);
            dbMock.pool.query.mockResolvedValueOnce({ rows: [{ password: hashedPassword }] });
            dbMock.pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const res = await request(app)
                .post('/api/auth/2fa/disable')
                .set('Authorization', authHeader)
                .send({ password: 'password' });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('2FA disabled successfully');
        });
    });

    describe('POST /api/auth/2fa/login', () => {
        it('should login with valid 2FA token', async () => {
            const tempToken = jwt.sign({ id: 1, email: testUser.email, type: '2fa_pending' }, JWT_SECRET);
            const secret = speakeasy.generateSecret();
            const totpToken = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    id: 1, email: testUser.email, role: 'user',
                    two_fa_secret: secret.base32, two_fa_enabled: true,
                    streak_data: '{}', subscription_tier: 'free',
                    simulate_free_tier: false, email_verified: false
                }]
            });

            const res = await request(app)
                .post('/api/auth/2fa/login')
                .send({ tempToken, token: totpToken });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.twoFAEnabled).toBe(true);
        });

        it('should fail with invalid 2FA token', async () => {
            const tempToken = jwt.sign({ id: 1, email: testUser.email, type: '2fa_pending' }, JWT_SECRET);
            const secret = speakeasy.generateSecret();

            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    id: 1, email: testUser.email, role: 'user',
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
