import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Phase 2 RLS migration', () => {
    const migrationPath = path.resolve(
        process.cwd(),
        '..',
        'supabase',
        'migrations',
        'phase2_rls_policies.sql'
    );

    it('drops each policy before recreating it', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        const createPolicyPattern = /CREATE POLICY ([a-z0-9_]+) ON (public\.[a-z0-9_]+)/gi;
        const createStatements = [...migrationSql.matchAll(createPolicyPattern)];

        expect(createStatements.length).toBeGreaterThan(0);

        for (const statement of createStatements) {
            const [createSql, policyName, tableName] = statement;
            const createIndex = migrationSql.indexOf(createSql);
            const dropSql = `DROP POLICY IF EXISTS ${policyName} ON ${tableName};`;
            const dropIndex = migrationSql.indexOf(dropSql);

            expect(dropIndex, `${dropSql} is missing`).toBeGreaterThanOrEqual(0);
            expect(dropIndex, `${dropSql} must appear before ${createSql}`).toBeLessThan(createIndex);
        }
    });

    it('uses a boolean-safe banned-user check in dm_partner_allowed', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).toContain('COALESCE(u.is_banned, FALSE) = FALSE');
        expect(migrationSql).not.toContain('COALESCE(u.is_banned, 0) = 0');
    });

    it('configures messages for Supabase Realtime publication', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).toContain('ALTER TABLE public.messages REPLICA IDENTITY FULL;');
        expect(migrationSql).toContain("WHERE pubname = 'supabase_realtime'");
        expect(migrationSql).toContain("AND tablename = 'messages'");
        expect(migrationSql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;');
    });

    it('includes the social RPC functions and table RLS for friend features', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).toContain('ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;');
        expect(migrationSql).toContain('ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;');
        expect(migrationSql).toContain('ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;');
        expect(migrationSql).toContain('CREATE POLICY users_update_self ON public.users');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.search_public_users(search_query text)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_public_user_profile(target_user_id integer)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.list_friends()');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id integer)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.accept_friend_request(requester_user_id integer)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.remove_friendship(target_user_id integer)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.list_blocked_users()');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.block_user(target_user_id integer)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id integer)');
        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.submit_report(');
    });

    it('avoids reserved current_user identifiers in social SQL functions', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).not.toContain('WITH current_user AS');
        expect(migrationSql).not.toContain('CROSS JOIN current_user');
        expect(migrationSql).not.toContain('JOIN current_user ');
        expect(migrationSql).not.toContain('SELECT id FROM current_user');
    });
});
