import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('exam XP award hardening migration', () => {
    const migrationPath = path.resolve(
        process.cwd(),
        '..',
        'supabase',
        'migrations',
        '20260612113000_harden_exam_xp_awards.sql'
    );

    const readMigration = () => fs.readFileSync(migrationPath, 'utf8');

    it('removes direct client write paths for server-owned XP state', () => {
        const migrationSql = readMigration();

        expect(migrationSql).toContain('DROP POLICY IF EXISTS exam_attempts_update ON public.exam_attempts;');
        expect(migrationSql).toContain('DROP POLICY IF EXISTS study_user_stats_insert ON public.study_user_stats;');
        expect(migrationSql).toContain('DROP POLICY IF EXISTS study_user_stats_update ON public.study_user_stats;');
        expect(migrationSql).toContain('DROP POLICY IF EXISTS study_user_stats_delete ON public.study_user_stats;');
    });

    it('claims an attempt and stats row inside the service-role RPC', () => {
        const migrationSql = readMigration();

        expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.award_exam_attempt_xp(');
        expect(migrationSql).toContain('SECURITY DEFINER');
        expect(migrationSql).toContain('INSERT INTO public.study_user_stats (user_id)');
        expect(migrationSql).toContain('ON CONFLICT (user_id) DO NOTHING;');
        expect(migrationSql).toContain('FOR UPDATE;');
        expect(migrationSql).toContain('ON CONFLICT (user_id) DO UPDATE');
        expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.award_exam_attempt_xp(uuid, integer) FROM PUBLIC;');
        expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.award_exam_attempt_xp(uuid, integer) TO service_role;');
    });

    it('keeps xp_awarded managed by the server', () => {
        const migrationSql = readMigration();

        expect(migrationSql).toContain('CREATE TRIGGER lock_exam_attempt_award_fields');
        expect(migrationSql).toContain("NEW.xp_awarded := NULL;");
        expect(migrationSql).toContain("RAISE EXCEPTION 'xp_awarded is managed by the server'");
    });
});
