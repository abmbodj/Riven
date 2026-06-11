import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  getGuideMasterySnapshot,
  getSessionDelta,
  normalizeGuideData,
  normalizeGuideStudyState,
} from '../_shared/studyGuideCore.mjs';
import { levelFromXp } from '../_shared/leveling.mjs';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTopicKey = (topicId: string | null, subtopicId: string) => `${topicId ?? '__null__'}::${subtopicId}`;

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const updateStreakData = (currentValue: unknown, nowIso: string) => {
  const current = parseJson<Record<string, unknown>>(currentValue, {}) || {};
  const now = new Date(nowIso);
  const lastStudyDateRaw = typeof current.lastStudyDate === 'string' ? current.lastStudyDate : null;
  const lastStudyDate = lastStudyDateRaw ? new Date(lastStudyDateRaw) : null;

  if (lastStudyDate && !Number.isNaN(lastStudyDate.getTime()) && lastStudyDate.toDateString() === now.toDateString()) {
    return {
      ...current,
      lastStudyDate: nowIso,
    };
  }

  const statusDeadline = lastStudyDate && !Number.isNaN(lastStudyDate.getTime())
    ? lastStudyDate.getTime() + (2 * DAY_IN_MS)
    : 0;
  const streakBroken = !lastStudyDate || Number.isNaN(lastStudyDate.getTime()) || statusDeadline <= now.getTime();

  if (streakBroken) {
    return {
      ...current,
      currentStreak: 1,
      longestStreak: Math.max(toNumber(current.longestStreak, 0), 1),
      lastStudyDate: nowIso,
      streakStartDate: nowIso,
      pastStreaks: Array.isArray(current.pastStreaks) ? current.pastStreaks : [],
    };
  }

  const nextStreak = toNumber(current.currentStreak, 0) + 1;
  return {
    ...current,
    currentStreak: nextStreak,
    longestStreak: Math.max(toNumber(current.longestStreak, 0), nextStreak),
    lastStudyDate: nowIso,
  };
};

const calculateSessionXp = ({
  beforeSnapshot,
  afterSnapshot,
  delta,
  mode,
  sessionOutcome = 'complete',
}: {
  beforeSnapshot: any;
  afterSnapshot: any;
  delta: any;
  mode: string;
  sessionOutcome?: string;
}) => {
  const recoveredWeakTopics = Math.max(
    0,
    (beforeSnapshot?.masteryBands?.support?.length || 0) - (afterSnapshot?.masteryBands?.support?.length || 0),
  );
  const masteryGain = Math.max(0, (afterSnapshot?.averageMastery || 0) - (beforeSnapshot?.averageMastery || 0));
  const evidenceOfLearning = delta.reviewedSections > 0
    || delta.masteryDeltaPercent > 0
    || recoveredWeakTopics > 0;

  if (!evidenceOfLearning) {
    return 0;
  }

  const baseXp = (
    delta.reviewedSections * 20
    + Math.max(0, delta.masteryDeltaPercent) * 2
    + recoveredWeakTopics * 18
    + (mode === 'cram' ? 12 : 0)
    + (afterSnapshot?.weakCount === 0 ? 8 : 0)
    + Math.round(masteryGain / 5)
  );

  if (sessionOutcome === 'stopped_early') {
    return Math.max(0, Math.round(baseXp * 0.6));
  }

  return baseXp;
};

const hasCardInteractionChange = (beforeCard: any = {}, afterCard: any = {}) => (
  toNumber(afterCard?.attempts, 0) !== toNumber(beforeCard?.attempts, 0)
  || toNumber(afterCard?.hints_used ?? afterCard?.hintsUsed, 0) !== toNumber(beforeCard?.hints_used ?? beforeCard?.hintsUsed, 0)
  || toNumber(afterCard?.assist_count ?? afterCard?.assistCount, 0) !== toNumber(beforeCard?.assist_count ?? beforeCard?.assistCount, 0)
  || String(afterCard?.status || '') !== String(beforeCard?.status || '')
  || String(afterCard?.last_outcome ?? afterCard?.lastOutcome ?? '') !== String(beforeCard?.last_outcome ?? beforeCard?.lastOutcome ?? '')
  || Boolean(afterCard?.completed) !== Boolean(beforeCard?.completed)
  || Boolean(afterCard?.revealed_answer ?? afterCard?.revealedAnswer) !== Boolean(beforeCard?.revealed_answer ?? beforeCard?.revealedAnswer)
  || Boolean(afterCard?.skipped) !== Boolean(beforeCard?.skipped)
);

const getTouchedConceptIds = (guideData: any, beforeState: any, afterState: any) => {
  const concepts = guideData?.knowledge_map?.concepts || [];
  const cards = guideData?.cards || [];

  return concepts
    .filter((concept: any) => {
      const beforeConcept = beforeState?.concept_mastery?.[concept.id] || {};
      const afterConcept = afterState?.concept_mastery?.[concept.id] || {};
      const conceptChanged = toNumber(afterConcept?.score, 0) !== toNumber(beforeConcept?.score, 0)
        || toNumber(afterConcept?.attempts, 0) !== toNumber(beforeConcept?.attempts, 0)
        || toNumber(afterConcept?.correct_attempts ?? afterConcept?.correctAttempts, 0) !== toNumber(beforeConcept?.correct_attempts ?? beforeConcept?.correctAttempts, 0)
        || String(afterConcept?.status || '') !== String(beforeConcept?.status || '')
        || String(afterConcept?.last_outcome ?? afterConcept?.lastOutcome ?? '') !== String(beforeConcept?.last_outcome ?? beforeConcept?.lastOutcome ?? '');

      if (conceptChanged) return true;

      return cards
        .filter((card: any) => card.concept_id === concept.id)
        .some((card: any) => hasCardInteractionChange(
          beforeState?.card_states?.[card.id],
          afterState?.card_states?.[card.id],
        ));
    })
    .map((concept: any) => concept.id);
};

const getReviewedConceptIds = (guideData: any, beforeState: any, afterState: any) => {
  const concepts = guideData?.knowledge_map?.concepts || [];

  return concepts
    .filter((concept: any) => {
      const beforeConcept = beforeState?.concept_mastery?.[concept.id] || {};
      const afterConcept = afterState?.concept_mastery?.[concept.id] || {};

      return toNumber(afterConcept?.score, 0) > toNumber(beforeConcept?.score, 0)
        || toNumber(afterConcept?.correct_attempts ?? afterConcept?.correctAttempts, 0) > toNumber(beforeConcept?.correct_attempts ?? beforeConcept?.correctAttempts, 0)
        || (
          String(beforeConcept?.last_outcome ?? beforeConcept?.lastOutcome ?? '') !== 'correct'
          && String(afterConcept?.last_outcome ?? afterConcept?.lastOutcome ?? '') === 'correct'
        );
    })
    .map((concept: any) => concept.id);
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.headers.get('x-warmup') === '1') {
    return new Response('ok', { status: 200, headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const guideId = typeof body.guideId === 'string' ? body.guideId.trim() : String(body.guideId ?? '').trim();
    const mode = typeof body.mode === 'string' ? body.mode : 'guided';
    const source = typeof body.source === 'string' ? body.source : 'guide_view';
    const classId = typeof body.classId === 'string' ? body.classId : null;
    const sessionOutcome = typeof body.sessionOutcome === 'string' ? body.sessionOutcome : 'complete';
    const exitReason = typeof body.exitReason === 'string' ? body.exitReason : 'finished';

    if (!guideId) {
      return jsonResponse({ error: 'guideId is required' }, { status: 400 }, request);
    }

    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    const { data: guide, error: guideError } = await admin
      .from('study_guides')
      .select('id, title, class_id, guide_data, study_state')
      .eq('id', guideId)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (guideError) throw guideError;
    if (!guide) {
      return jsonResponse({ error: 'Study guide not found' }, { status: 404 }, request);
    }

    // RIV-020: trust the stored guide data; only fall back to the client copy if the DB
    // has none (e.g. a guide that predates server-side persistence).
    const normalizedGuideData = normalizeGuideData(guide.guide_data || body.guideData);
    if (!normalizedGuideData) {
      return jsonResponse({ error: 'Study guide data is invalid' }, { status: 400 }, request);
    }

    // RIV-020: the authoritative "before" state is what is persisted in the DB — never the
    // client-supplied studyStateBefore. This makes replays/duplicate submits yield a zero
    // delta (and therefore zero XP) instead of letting a client inflate progress.
    const normalizedBefore = normalizeGuideStudyState(
      normalizedGuideData,
      guide.study_state,
    );
    const normalizedAfter = normalizeGuideStudyState(
      normalizedGuideData,
      body.studyStateAfter || guide.study_state,
    );

    const beforeSnapshot = getGuideMasterySnapshot(normalizedGuideData, normalizedBefore);
    const afterSnapshot = getGuideMasterySnapshot(normalizedGuideData, normalizedAfter);
    const delta = getSessionDelta(normalizedGuideData, normalizedBefore, normalizedAfter);
    const touchedConceptIds = getTouchedConceptIds(normalizedGuideData, normalizedBefore, normalizedAfter);
    const reviewedConceptIds = getReviewedConceptIds(normalizedGuideData, normalizedBefore, normalizedAfter);
    // RIV-020: bound single-submission XP so a fabricated "after" state can't mint unlimited XP.
    const MAX_SESSION_XP = 600;
    const xpEarned = Math.min(MAX_SESSION_XP, calculateSessionXp({
      beforeSnapshot,
      afterSnapshot,
      delta,
      mode,
      sessionOutcome,
    }));

    const nowIso = new Date().toISOString();
    const reviewedSections = touchedConceptIds;

    const { error: guideUpdateError } = await admin
      .from('study_guides')
      .update({
        study_state: normalizedAfter,
        updated_at: nowIso,
      })
      .eq('id', guideId)
      .eq('user_id', authUser.id);
    if (guideUpdateError) throw guideUpdateError;

    const { error: sessionInsertError } = await admin
      .from('study_sessions')
      .insert({
        user_id: authUser.id,
        guide_id: guideId,
        class_id: classId || guide.class_id || null,
        source,
        mode,
        started_at: normalizedBefore.last_reviewed_at || nowIso,
        ended_at: nowIso,
        xp_earned: toNumber(xpEarned, 0),
        mastery_delta: delta.masteryDeltaPercent,
        weak_area_delta: {
          before: delta.weakCountBefore,
          after: delta.weakCountAfter,
          reviewedSections,
          creditedSections: reviewedConceptIds,
          sessionOutcome,
          exitReason,
        },
        session_type: mode,
        created_at: nowIso,
      });
    if (sessionInsertError) throw sessionInsertError;

    const reviewedSectionEntries = afterSnapshot.recommendedSections.filter((item: any) => reviewedSections.includes(item.id));
    if (reviewedSectionEntries.length > 0) {
      const reviewedSectionIds = reviewedSectionEntries.map((item: any) => item.id);
      const reviewedTopicIds = Array.from(new Set(
        reviewedSectionEntries
          .map((item: any) => item.topic_id)
          .filter((value: any): value is string => typeof value === 'string' && value.length > 0),
      ));

      let existingRowsQuery = admin
        .from('study_topic_progress')
        .select('topic_id, subtopic_id, attempts, correct_attempts, weak_streak')
        .eq('user_id', authUser.id)
        .eq('guide_id', guideId)
        .in('subtopic_id', reviewedSectionIds);

      if (reviewedTopicIds.length > 0) {
        existingRowsQuery = existingRowsQuery.in('topic_id', reviewedTopicIds);
      }

      const { data: existingRows, error: existingRowsError } = await existingRowsQuery;
      if (existingRowsError) throw existingRowsError;

      const existingByKey = new Map<string, {
        attempts: number;
        correct_attempts: number;
        weak_streak: number;
      }>();

      for (const row of existingRows || []) {
        const topicId = typeof row.topic_id === 'string' ? row.topic_id : null;
        const subtopicId = String(row.subtopic_id || '');
        if (!subtopicId) continue;
        existingByKey.set(toTopicKey(topicId, subtopicId), {
          attempts: toNumber(row.attempts, 0),
          correct_attempts: toNumber(row.correct_attempts, 0),
          weak_streak: toNumber(row.weak_streak, 0),
        });
      }

      const progressUpserts = reviewedSectionEntries.map((section: any) => {
        const sectionTopicId = typeof section.topic_id === 'string' ? section.topic_id : null;
        const sectionState = normalizedAfter.concept_mastery?.[section.id] || {};
        const incomingCorrectAttempts = toNumber(sectionState.correct_attempts ?? sectionState.correctAttempts, 0);
        const existing = existingByKey.get(toTopicKey(sectionTopicId, section.id));

        return {
          user_id: authUser.id,
          guide_id: guideId,
          class_id: classId || guide.class_id || null,
          topic_id: sectionTopicId,
          subtopic_id: section.id,
          mastery_score: section.masteryScore,
          confidence_bucket: section.status,
          attempts: existing ? existing.attempts + 1 : 1,
          correct_attempts: existing
            ? Math.max(existing.correct_attempts, incomingCorrectAttempts)
            : incomingCorrectAttempts,
          current_difficulty: section.masteryBand,
          weak_streak: section.masteryScore < 40
            ? (existing ? existing.weak_streak + 1 : 1)
            : 0,
          last_reviewed_at: normalizedAfter.last_reviewed_at || nowIso,
          next_review_at: section.nextReviewAt || nowIso,
          updated_at: nowIso,
        };
      });

      const { error: topicUpsertError } = await admin
        .from('study_topic_progress')
        .upsert(progressUpserts, { onConflict: 'user_id,guide_id,topic_id,subtopic_id' });
      if (topicUpsertError) throw topicUpsertError;
    }

    const { data: existingStats, error: existingStatsError } = await admin
      .from('study_user_stats')
      .select('xp_total, level, sessions_completed, topics_mastered')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (existingStatsError) throw existingStatsError;

    const { count: masteredCount, error: masteredCountError } = await admin
      .from('study_topic_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .gte('mastery_score', 75);
    if (masteredCountError) throw masteredCountError;

    const topicsMastered = toNumber(masteredCount ?? 0, 0);
    const prevLevel = levelFromXp(toNumber(existingStats?.xp_total, 0));
    const nextXpTotal = toNumber(existingStats?.xp_total, 0) + xpEarned;
    const nextLevel = levelFromXp(nextXpTotal);
    const nextSessionsCompleted = toNumber(existingStats?.sessions_completed, 0) + 1;

    const { error: statsUpsertError } = await admin
      .from('study_user_stats')
      .upsert({
        user_id: authUser.id,
        xp_total: nextXpTotal,
        level: nextLevel,
        last_study_at: nowIso,
        sessions_completed: nextSessionsCompleted,
        topics_mastered: topicsMastered,
      }, { onConflict: 'user_id' });
    if (statsUpsertError) throw statsUpsertError;

    const { data: userRow, error: userRowError } = await admin
      .from('users')
      .select('streak_data')
      .eq('id', authUser.id)
      .maybeSingle();
    if (userRowError) throw userRowError;

    const nextStreakData = updateStreakData(userRow?.streak_data || '{}', nowIso);
    const { error: userUpdateError } = await admin
      .from('users')
      .update({ streak_data: nextStreakData })
      .eq('id', authUser.id);
    if (userUpdateError) throw userUpdateError;

    const achievementKeys: string[] = [];
    if (nextSessionsCompleted === 1) achievementKeys.push('first_session');
    if (toNumber((nextStreakData as any).currentStreak, 0) >= 3) achievementKeys.push('three_day_streak');
    if ((beforeSnapshot?.masteryBands?.support?.length || 0) > (afterSnapshot?.masteryBands?.support?.length || 0)) {
      achievementKeys.push('weak_topic_recovery');
    }
    if (topicsMastered >= 5) achievementKeys.push('five_mastered_topics');
    if (mode === 'cram' && xpEarned > 0) achievementKeys.push('first_cram_win');

    if (achievementKeys.length > 0) {
      const { data: existingAchievements, error: existingAchievementsError } = await admin
        .from('study_achievements')
        .select('achievement_key')
        .eq('user_id', authUser.id)
        .in('achievement_key', achievementKeys);
      if (existingAchievementsError) throw existingAchievementsError;

      const existingAchievementSet = new Set((existingAchievements || []).map((item: any) => item.achievement_key));
      const newAchievements = achievementKeys
        .filter((key) => !existingAchievementSet.has(key))
        .map((achievementKey) => ({
          user_id: authUser.id,
          achievement_key: achievementKey,
          unlocked_at: nowIso,
          metadata: { guideId, xpEarned },
        }));

      if (newAchievements.length > 0) {
        const { error: achievementsInsertError } = await admin
          .from('study_achievements')
          .insert(newAchievements);
        if (achievementsInsertError) throw achievementsInsertError;
      }
    }

    return jsonResponse({
      xpEarned,
      masteryDelta: delta.masteryDeltaPercent,
      reviewedSections,
      sessionOutcome,
      exitReason,
      weakTopicsRemaining: (afterSnapshot.masteryBands.support || []).slice(0, 3).map((section: any) => ({
        id: section.id,
        title: section.title,
      })),
      nextReviewAt: afterSnapshot.nextReviewAt,
      stats: {
        xpTotal: nextXpTotal,
        level: nextLevel,
        previousLevel: prevLevel,
        leveledUp: nextLevel > prevLevel,
        sessionsCompleted: nextSessionsCompleted,
        topicsMastered,
      },
    }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[study-session-complete edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse({ error: requestError.message || 'Failed to complete study session' }, { status }, request);
  }
});
