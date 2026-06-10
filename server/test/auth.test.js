
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';

const JWT_SECRET = 'test-secret';
const SUPABASE_JWT_SECRET = 'supabase-test-secret';
const SUPABASE_URL = 'https://supabase.test';
const SUPABASE_ANON_KEY = 'supabase-anon-key';
const SUPABASE_SERVICE_ROLE_KEY = 'supabase-service-role-key';
const SUPABASE_AUTH_ID = '11111111-1111-1111-1111-111111111111';

const mockJsonResponse = (body, { ok = true, status = ok ? 200 : 400 } = {}) => ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe('Auth Core Endpoints', () => {
    let app;
    let dbMock;
    let token;
    let authHeader;
    let supabaseToken;
    let supabaseAuthHeader;
    const testUser = { id: 1, email: 'test@example.com', role: 'user' };

    beforeAll(async () => {
        vi.resetModules();
        process.env.SUPABASE_JWT_SECRET = SUPABASE_JWT_SECRET;
        process.env.SUPABASE_URL = SUPABASE_URL;
        process.env.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
        process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;
        const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn() };

        dbMock = {
            query: async (text, params) => (await pool.query(text, params)).rows,
            queryOne: async (text, params) => (await pool.query(text, params)).rows[0],
            execute: async (text, params) => await pool.query(text, params),
            ready: vi.fn().mockResolvedValue(),
            pool
        };

        global.__TEST_DB_MOCK__ = dbMock;
        dbMock.pool.query.mockResolvedValue({ rows: [] });

        const indexModule = await import('../index');
        app = indexModule.default;

        token = jwt.sign(testUser, JWT_SECRET);
        authHeader = `Bearer ${token}`;
        supabaseToken = jwt.sign({
            aud: 'authenticated',
            sub: SUPABASE_AUTH_ID,
            email: testUser.email,
            role: 'authenticated',
        }, SUPABASE_JWT_SECRET, { algorithm: 'HS256' });
        supabaseAuthHeader = `Bearer ${supabaseToken}`;
    });

    afterAll(() => {
        delete global.__TEST_DB_MOCK__;
        delete process.env.SUPABASE_JWT_SECRET;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        dbMock.pool.query.mockReset();
        dbMock.ready.mockReset();
        dbMock.pool.query.mockResolvedValue({ rows: [] });
        dbMock.ready.mockResolvedValue();
        global.fetch = vi.fn();
    });

    // ============ REGISTER ============

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            // Combined email/username existence check (single query)
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
            expect(res.body.error).toBe('Email is required');
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
            expect(res.body.error).toContain('at least 8 characters');
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

    describe('GET /api/auth/me', () => {
        it('accepts a Supabase token via auth API fallback when local JWT verification fails', async () => {
            const originalSupabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
            process.env.SUPABASE_JWT_SECRET = 'wrong-secret';

            dbMock.pool.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, email: 'test@example.com', role: 'user', is_admin: 0 }],
                })
                .mockResolvedValueOnce({
                    rows: [{
                        id: 1,
                        username: 'testuser',
                        display_name: 'Test User',
                        email: 'test@example.com',
                        share_code: 'ABC12345',
                        avatar: null,
                        banner: null,
                        bio: '',
                        streak_data: '{}',
                        pet_customization: '{}',
                        role: 'user',
                        is_admin: 0,
                        is_banned: false,
                        created_at: '2026-03-14T00:00:00.000Z',
                        two_fa_enabled: false,
                        subscription_tier: 'free',
                        simulate_free_tier: false,
                        email_verified: true,
                    }],
                });

            global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({
                id: SUPABASE_AUTH_ID,
                email: 'test@example.com',
            }));

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', supabaseAuthHeader);

            process.env.SUPABASE_JWT_SECRET = originalSupabaseJwtSecret;

            expect(res.status).toBe(200);
            expect(res.body.email).toBe('test@example.com');
            expect(global.fetch).toHaveBeenCalledWith(
                `${SUPABASE_URL}/auth/v1/user`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: supabaseAuthHeader,
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
        });
    });

    describe('POST /api/auth/simulate-free', () => {
        it('toggles simulate-free mode for owner accounts', async () => {
            dbMock.pool.query
                .mockResolvedValueOnce({
                    rows: [{
                        role: 'owner',
                        is_admin: 1,
                        simulate_free_tier: false,
                    }],
                })
                .mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const res = await request(app)
                .post('/api/auth/simulate-free')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                simulate_free_tier: true,
                subscription_tier: 'free',
            });
        });

        it('rejects non-owner, non-admin accounts', async () => {
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{
                    role: 'user',
                    is_admin: 0,
                    simulate_free_tier: false,
                }],
            });

            const res = await request(app)
                .post('/api/auth/simulate-free')
                .set('Authorization', authHeader);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Owner or Admin only');
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

        it('uses Supabase auth when the caller presents a Supabase session token', async () => {
            dbMock.pool.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, email: testUser.email, role: 'user', is_admin: 0 }],
                });

            global.fetch.mockResolvedValueOnce(
                mockJsonResponse({ user: { id: SUPABASE_AUTH_ID, email: testUser.email } })
            );

            const res = await request(app)
                .put('/api/auth/password')
                .set('Authorization', supabaseAuthHeader)
                .send({ currentPassword: 'ignored', newPassword: 'newpassword123' });

            expect(res.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledWith(
                `${SUPABASE_URL}/auth/v1/user`,
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${supabaseToken}`,
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
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

        it('uses Supabase recovery for linked users instead of legacy reset tokens', async () => {
            dbMock.pool.query.mockResolvedValueOnce({
                rows: [{ id: 1, email: 'test@test.com', supabase_auth_id: SUPABASE_AUTH_ID }],
            });
            global.fetch.mockResolvedValueOnce(mockJsonResponse({}));

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'test@test.com' });

            expect(res.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${SUPABASE_URL}/auth/v1/recover?`),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
            expect(dbMock.pool.query).not.toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO password_reset_tokens'),
                expect.any(Array)
            );
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
            expect(res.body.error).toContain('at least 8 characters');
        });

        it('uses Supabase token-hash verification when the token is not legacy', async () => {
            dbMock.pool.query.mockResolvedValueOnce({ rows: [] });
            global.fetch
                .mockResolvedValueOnce(
                    mockJsonResponse({
                        access_token: 'recovery-access-token',
                        refresh_token: 'refresh-token',
                        user: { id: SUPABASE_AUTH_ID, email: testUser.email },
                    })
                )
                .mockResolvedValueOnce(
                    mockJsonResponse({ user: { id: SUPABASE_AUTH_ID, email: testUser.email } })
                );

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'supabase-token-hash', password: 'newpassword123' });

            expect(res.status).toBe(200);
            expect(global.fetch).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(`${SUPABASE_URL}/auth/v1/verify?`),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
            expect(global.fetch).toHaveBeenNthCalledWith(
                2,
                `${SUPABASE_URL}/auth/v1/user`,
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer recovery-access-token',
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
        });
    });

    describe('Supabase email verification bridge', () => {
        it('uses Supabase resend for linked users', async () => {
            dbMock.pool.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, email: testUser.email, role: 'user', is_admin: 0 }],
                })
                .mockResolvedValueOnce({
                    rows: [{
                        id: 1,
                        email: testUser.email,
                        email_verified: false,
                        supabase_auth_id: SUPABASE_AUTH_ID,
                    }],
                });
            global.fetch.mockResolvedValueOnce(mockJsonResponse({}));

            const res = await request(app)
                .post('/api/auth/send-verification')
                .set('Authorization', supabaseAuthHeader);

            expect(res.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${SUPABASE_URL}/auth/v1/resend?`),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
        });

        it('verifies Supabase token hashes and syncs email_verified locally', async () => {
            dbMock.pool.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });
            global.fetch.mockResolvedValueOnce(
                mockJsonResponse({
                    user: { id: SUPABASE_AUTH_ID, email: testUser.email },
                    access_token: null,
                    refresh_token: null,
                })
            );

            const res = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: 'supabase-signup-token-hash' });

            expect(res.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${SUPABASE_URL}/auth/v1/verify?`),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        apikey: SUPABASE_ANON_KEY,
                    }),
                })
            );
            expect(dbMock.pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET email_verified = TRUE'),
                [SUPABASE_AUTH_ID]
            );
        });
    });

    describe('DELETE /api/auth/account', () => {
        it('deletes Supabase auth users with the service role bridge before removing the local row', async () => {
            dbMock.pool.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, email: testUser.email, role: 'user', is_admin: 0 }],
                })
                .mockResolvedValueOnce({
                    rows: [{ id: 1, supabase_auth_id: SUPABASE_AUTH_ID, password: null }],
                })
                .mockResolvedValueOnce({ rows: [] });
            global.fetch.mockResolvedValueOnce(
                mockJsonResponse({ user: { id: SUPABASE_AUTH_ID, email: testUser.email } })
            );

            const res = await request(app)
                .delete('/api/auth/account')
                .set('Authorization', supabaseAuthHeader)
                .send({ password: 'ignored' });

            expect(res.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledWith(
                `${SUPABASE_URL}/auth/v1/admin/users/${SUPABASE_AUTH_ID}`,
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        apikey: SUPABASE_SERVICE_ROLE_KEY,
                    }),
                })
            );
            expect(dbMock.pool.query).toHaveBeenCalledWith(
                'DELETE FROM users WHERE id = $1',
                [1]
            );
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
