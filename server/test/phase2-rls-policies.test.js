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
});
