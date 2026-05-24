import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('group schedule calendar migration', () => {
    const migrationPath = path.resolve(
        process.cwd(),
        '..',
        'supabase',
        'migrations',
        '20260413120000_group_scheduling_hub.sql'
    );

    it('filters archived classes from the group schedule RPC', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_group_schedule_calendar(');
        expect(migrationSql).toContain('COALESCE(c.is_archived, FALSE) = FALSE');
        expect(migrationSql).not.toContain('COALESCE(c.is_archived, FALSE) <> TRUE');
    });

    it('includes archived-class metadata in the schedule slot payload', () => {
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        expect(migrationSql).toContain("'class_is_archived', COALESCE(c.is_archived, FALSE)");
    });
});
