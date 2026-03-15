#!/usr/bin/env node
/**
 * Backfill supabase_auth_id for all existing users.
 *
 * For each user with supabase_auth_id = NULL:
 *   1. Check if a Supabase Auth user exists for that email
 *   2. If found, link it. If not, create one with email_confirm: true
 *   3. Update users.supabase_auth_id
 *
 * Usage:
 *   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill_supabase_auth.js
 *
 * Safe to re-run (idempotent).
 */

const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Required env vars: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

async function adminFetch(path, { method = 'GET', body, query } = {}) {
    const url = new URL(`${AUTH_URL}${path}`);
    if (query) {
        Object.entries(query).forEach(([k, v]) => {
            if (v != null && v !== '') url.searchParams.set(k, v);
        });
    }

    const res = await fetch(url.toString(), {
        method,
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
}

async function backfill() {
    // Dynamic import for pg (CommonJS compatible)
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        const { rows } = await pool.query(
            'SELECT id, email FROM users WHERE supabase_auth_id IS NULL ORDER BY id'
        );

        console.log(`Found ${rows.length} users without supabase_auth_id`);
        let linked = 0;
        let created = 0;
        let failed = 0;

        for (const user of rows) {
            try {
                let authUserId = null;

                // 1. Check if Supabase Auth user already exists
                const listRes = await adminFetch('/admin/users', {
                    query: { email: user.email },
                });
                const existing = Array.isArray(listRes?.users) && listRes.users[0];

                if (existing?.id) {
                    authUserId = existing.id;
                    // Confirm email if not already
                    if (!existing.email_confirmed_at) {
                        await adminFetch(`/admin/users/${existing.id}`, {
                            method: 'PUT',
                            body: { email_confirm: true },
                        });
                    }
                    linked++;
                } else {
                    // 2. Create new Supabase Auth user with random password
                    const randomPassword = crypto.randomBytes(32).toString('hex');
                    const createRes = await adminFetch('/admin/users', {
                        method: 'POST',
                        body: {
                            email: user.email,
                            password: randomPassword,
                            email_confirm: true,
                        },
                    });
                    authUserId = createRes?.id;
                    created++;
                }

                if (authUserId) {
                    await pool.query(
                        'UPDATE users SET supabase_auth_id = $1 WHERE id = $2',
                        [authUserId, user.id]
                    );
                    console.log(`  ✓ user ${user.id} (${user.email}) → ${authUserId}`);
                } else {
                    console.warn(`  ✗ user ${user.id} (${user.email}): no auth ID returned`);
                    failed++;
                }
            } catch (err) {
                console.error(`  ✗ user ${user.id} (${user.email}): ${err.message}`);
                failed++;
            }
        }

        console.log(`\nDone: ${linked} linked, ${created} created, ${failed} failed`);

        // Verify
        const { rows: remaining } = await pool.query(
            'SELECT COUNT(*) as count FROM users WHERE supabase_auth_id IS NULL'
        );
        console.log(`Remaining users without supabase_auth_id: ${remaining[0].count}`);
    } finally {
        await pool.end();
    }
}

backfill().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
