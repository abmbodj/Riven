const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

let studyGuideUtilsPromise = null;
const loadStudyGuideUtils = async () => {
    if (!studyGuideUtilsPromise) {
        studyGuideUtilsPromise = import('../../client/src/utils/studyGuides.js');
    }
    return studyGuideUtilsPromise;
};

const isMissingTableError = (error) => error?.code === '42P01';

const safeQuery = async (db, text, params = [], fallback = []) => {
    try {
        return await db.query(text, params);
    } catch (error) {
        if (isMissingTableError(error)) return fallback;
        throw error;
    }
};

const safeQueryOne = async (db, text, params = [], fallback = null) => {
    try {
        return await db.queryOne(text, params);
    } catch (error) {
        if (isMissingTableError(error)) return fallback;
        throw error;
    }
};

const isExamAssignment = (assignment) => {
    const title = String(assignment?.title || assignment?.name || '').trim();
    const type = String(assignment?.assignment_type || assignment?.type || '').trim().toLowerCase();
    return EXAM_PATTERN.test(title) || ['exam', 'quiz', 'test', 'midterm', 'final', 'assessment'].includes(type);
};

const formatCountdownLabel = (dueAt, now = new Date()) => {
    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) return null;

    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / DAY_IN_MS);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'in 1 day';
    return `in ${diffDays} days`;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const defaultCoachStats = {
    xpTotal: 0,
    level: 1,
    sessionsCompleted: 0,
    topicsMastered: 0,
};

const normalizeCoachStats = (row) => ({
    xpTotal: toNumber(row?.xp_total, 0),
    level: Math.max(1, toNumber(row?.level, 1)),
    sessionsCompleted: toNumber(row?.sessions_completed, 0),
    topicsMastered: toNumber(row?.topics_mastered, 0),
});

const parseJson = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const updateStreakData = (currentValue, nowIso) => {
    const current = parseJson(currentValue, {}) || {};
    const now = new Date(nowIso);
    const lastStudyDate = current.lastStudyDate ? new Date(current.lastStudyDate) : null;

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
}) => {
    const recoveredWeakTopics = Math.max(
        0,
        (beforeSnapshot?.masteryBands?.support?.length || 0) - (afterSnapshot?.masteryBands?.support?.length || 0),
    );
    const masteryGain = Math.max(0, (afterSnapshot?.averageMastery || 0) - (beforeSnapshot?.averageMastery || 0));

    return (
        delta.sectionsReviewed * 20
        + Math.max(0, delta.masteryDeltaPercent) * 2
        + recoveredWeakTopics * 18
        + (mode === 'cram' ? 12 : 0)
        + (afterSnapshot?.weakCount === 0 ? 8 : 0)
        + Math.round(masteryGain / 5)
    );
};

module.exports = function registerStudyRoutes({ app, db, authMiddleware }) {
    app.get('/api/study/coach', authMiddleware, async (req, res) => {
        try {
            const {
                estimateSessionEffortMinutes,
                getGuideMasterySnapshot,
                normalizeGuideData,
            } = await loadStudyGuideUtils();

            const now = new Date();
            const [guides, assignments, notes, classes, statsRow, achievements] = await Promise.all([
                safeQuery(
                    db,
                    `SELECT id, title, class_id, note_id, format_version, guide_data, study_state, updated_at
                     FROM study_guides
                     WHERE user_id = $1
                     ORDER BY updated_at DESC`,
                    [req.user.id],
                    [],
                ),
                safeQuery(
                    db,
                    `SELECT *
                     FROM assignments
                     WHERE user_id = $1
                       AND COALESCE(status, '') NOT IN ('Done', 'Archived')
                     ORDER BY due_date ASC NULLS LAST`,
                    [req.user.id],
                    [],
                ),
                safeQuery(
                    db,
                    `SELECT id, title, class_id, updated_at
                     FROM notes
                     WHERE user_id = $1
                     ORDER BY updated_at DESC`,
                    [req.user.id],
                    [],
                ),
                safeQuery(
                    db,
                    `SELECT id, name
                     FROM classes
                     WHERE user_id = $1`,
                    [req.user.id],
                    [],
                ),
                safeQueryOne(
                    db,
                    `SELECT xp_total, level, sessions_completed, topics_mastered
                     FROM study_user_stats
                     WHERE user_id = $1`,
                    [req.user.id],
                    null,
                ),
                safeQuery(
                    db,
                    `SELECT achievement_key, unlocked_at, metadata
                     FROM study_achievements
                     WHERE user_id = $1
                     ORDER BY unlocked_at DESC`,
                    [req.user.id],
                    [],
                ),
            ]);

            const classNameById = new Map(classes.map((row) => [String(row.id), row.name]));
            const futureAssignments = assignments.filter((assignment) => {
                if (!assignment?.due_date) return false;
                const dueDate = new Date(assignment.due_date);
                return !Number.isNaN(dueDate.getTime()) && dueDate > now;
            });
            const upcomingExamSource = futureAssignments.find((assignment) => isExamAssignment(assignment)) || null;
            const upcomingExam = upcomingExamSource
                ? {
                    id: upcomingExamSource.id,
                    title: upcomingExamSource.title || upcomingExamSource.name || 'Upcoming exam',
                    dueAt: upcomingExamSource.due_date,
                    countdownLabel: formatCountdownLabel(upcomingExamSource.due_date, now),
                    classId: upcomingExamSource.class_id || null,
                }
                : null;

            const recommendationCandidates = guides
                .map((guide) => {
                    if (Number(guide.format_version) < 4) return null;
                    const normalizedGuideData = normalizeGuideData(guide.guide_data);
                    if (!normalizedGuideData) return null;

                    const linkedExam = futureAssignments.find((assignment) => (
                        assignment.class_id
                        && guide.class_id
                        && String(assignment.class_id) === String(guide.class_id)
                        && isExamAssignment(assignment)
                    )) || upcomingExamSource || null;

                    const masterySnapshot = getGuideMasterySnapshot(
                        guide.guide_data,
                        guide.study_state,
                        {
                            linkedExamAt: linkedExam?.due_date || null,
                            now: now.toISOString(),
                        },
                    );

                    const recommendedSections = masterySnapshot.recommendedSections.slice(0, 3);
                    if (recommendedSections.length === 0) return null;

                    const topPriority = recommendedSections[0];
                    const linkedExamSoon = linkedExam?.due_date
                        ? new Date(linkedExam.due_date).getTime() - now.getTime() <= (3 * DAY_IN_MS)
                        : false;

                    const label = linkedExamSoon
                        ? 'Cram Weak Concepts'
                        : masterySnapshot.weakCount > 0
                            ? 'Review Weak Concepts'
                            : 'Continue River Session';

                    return {
                        guide,
                        masterySnapshot,
                        recommendedSections,
                        linkedExam,
                        label,
                        priority: (topPriority?.priorityScore || 0) + (linkedExamSoon ? 24 : 0),
                    };
                })
                .filter(Boolean)
                .sort((left, right) => right.priority - left.priority);

            const topCandidate = recommendationCandidates[0] || null;
            const recommendation = topCandidate
                ? {
                    guideId: topCandidate.guide.id,
                    guideTitle: topCandidate.guide.title,
                    label: topCandidate.label,
                    detail: `${topCandidate.masterySnapshot.weakCount || topCandidate.recommendedSections.length} concepts to review · ~${estimateSessionEffortMinutes(topCandidate.recommendedSections)} min`,
                    to: `/guide/${topCandidate.guide.id}`,
                    mode: topCandidate.label.toLowerCase().includes('cram') ? 'cram' : 'guided',
                }
                : null;

            const weakTopics = topCandidate
                ? topCandidate.masterySnapshot.recommendedSections.slice(0, 4).map((section) => ({
                    id: section.id,
                    title: section.title,
                    guideId: topCandidate.guide.id,
                }))
                : [];

            const suggestedGuide = upcomingExam
                && notes.some((note) => note.class_id && String(note.class_id) === String(upcomingExam.classId))
                && !guides.some((guide) => guide.class_id && String(guide.class_id) === String(upcomingExam.classId))
                ? {
                    className: classNameById.get(String(upcomingExam.classId)) || 'Upcoming class',
                    label: 'Generate tutor session',
                    to: '/guides',
                }
                : null;

            res.json({
                recommendation,
                weakTopics,
                upcomingExam,
                stats: statsRow ? normalizeCoachStats(statsRow) : defaultCoachStats,
                suggestedGuide,
                achievements: achievements.map((achievement) => ({
                    key: achievement.achievement_key,
                    unlockedAt: achievement.unlocked_at,
                    metadata: parseJson(achievement.metadata, {}),
                })),
            });
        } catch (error) {
            console.error('GET /api/study/coach error:', error);
            res.status(500).json({ error: 'Failed to load tutor session recommendations' });
        }
    });

    app.post('/api/study/session-complete', authMiddleware, async (req, res) => {
        const { guideId, guideData, studyStateBefore, studyStateAfter, mode = 'guided', source = 'guide_view', classId = null } = req.body || {};
        if (!guideId) {
            return res.status(400).json({ error: 'guideId is required' });
        }

        try {
            const {
                getGuideMasterySnapshot,
                getSessionDelta,
                normalizeGuideData,
                normalizeGuideStudyState,
            } = await loadStudyGuideUtils();

            const guide = await db.queryOne(
                `SELECT id, title, class_id, guide_data, study_state
                 FROM study_guides
                 WHERE id = $1 AND user_id = $2`,
                [guideId, req.user.id],
            );

            if (!guide) {
                return res.status(404).json({ error: 'Study guide not found' });
            }

            const normalizedGuideData = normalizeGuideData(guideData || guide.guide_data);
            if (!normalizedGuideData) {
                return res.status(400).json({ error: 'Study guide data is invalid' });
            }

            const normalizedBefore = normalizeGuideStudyState(normalizedGuideData, studyStateBefore || guide.study_state);
            const normalizedAfter = normalizeGuideStudyState(normalizedGuideData, studyStateAfter || guide.study_state);
            const beforeSnapshot = getGuideMasterySnapshot(normalizedGuideData, normalizedBefore);
            const afterSnapshot = getGuideMasterySnapshot(normalizedGuideData, normalizedAfter);
            const delta = getSessionDelta(normalizedGuideData, normalizedBefore, normalizedAfter);
            const xpEarned = calculateSessionXp({
                beforeSnapshot,
                afterSnapshot,
                delta,
                mode,
            });

            const nowIso = new Date().toISOString();
            const reviewedSections = afterSnapshot.recommendedSections.map((section) => section.id);
            const studyClient = await db.pool.connect();

            try {
                await studyClient.query('BEGIN');

                await studyClient.query(
                    `UPDATE study_guides
                     SET study_state = $1::jsonb, updated_at = now()
                     WHERE id = $2 AND user_id = $3`,
                    [JSON.stringify(normalizedAfter), guideId, req.user.id],
                );

                await studyClient.query(
                    `INSERT INTO study_sessions
                        (user_id, guide_id, class_id, source, mode, started_at, ended_at, xp_earned, mastery_delta, weak_area_delta, session_type, created_at)
                     VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)`,
                    [
                        req.user.id,
                        guideId,
                        classId || guide.class_id || null,
                        source,
                        mode,
                        normalizedBefore.last_reviewed_at || nowIso,
                        nowIso,
                        xpEarned,
                        delta.masteryDeltaPercent,
                        JSON.stringify({
                            before: delta.weakCountBefore,
                            after: delta.weakCountAfter,
                            reviewedSections,
                        }),
                        mode,
                        nowIso,
                    ],
                );

                const progressRows = afterSnapshot.recommendedSections.map((section) => {
                    const sectionState = normalizedAfter.section_states[section.id] || {};
                    return studyClient.query(
                        `INSERT INTO study_topic_progress
                            (user_id, guide_id, class_id, topic_id, subtopic_id, mastery_score, confidence_bucket, attempts, correct_attempts, current_difficulty, weak_streak, last_reviewed_at, next_review_at)
                         VALUES
                            ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $11, $12)
                         ON CONFLICT (user_id, guide_id, topic_id, subtopic_id)
                         DO UPDATE SET
                            mastery_score = EXCLUDED.mastery_score,
                            confidence_bucket = EXCLUDED.confidence_bucket,
                            attempts = study_topic_progress.attempts + 1,
                            correct_attempts = GREATEST(study_topic_progress.correct_attempts, EXCLUDED.correct_attempts),
                            current_difficulty = EXCLUDED.current_difficulty,
                            weak_streak = CASE
                                WHEN EXCLUDED.mastery_score < 40 THEN study_topic_progress.weak_streak + 1
                                ELSE 0
                            END,
                            last_reviewed_at = EXCLUDED.last_reviewed_at,
                            next_review_at = EXCLUDED.next_review_at`,
                        [
                            req.user.id,
                            guideId,
                            classId || guide.class_id || null,
                            section.topic_id || null,
                            section.id,
                            section.masteryScore,
                            section.status,
                            toNumber(sectionState.quiz_correct, 0),
                            section.masteryBand,
                            section.masteryScore < 40 ? 1 : 0,
                            sectionState.last_reviewed_at || nowIso,
                            section.nextReviewAt || nowIso,
                        ],
                    );
                });
                await Promise.all(progressRows);

                const existingStats = await safeQueryOne(
                    { queryOne: (...args) => studyClient.query(...args).then((result) => result.rows[0]) },
                    `SELECT xp_total, level, sessions_completed, topics_mastered
                     FROM study_user_stats
                     WHERE user_id = $1`,
                    [req.user.id],
                    null,
                );

                const masteredTopicsResult = await studyClient.query(
                    `SELECT COUNT(*)::int AS mastered_count
                     FROM study_topic_progress
                     WHERE user_id = $1 AND mastery_score >= 75`,
                    [req.user.id],
                );
                const topicsMastered = toNumber(masteredTopicsResult.rows[0]?.mastered_count, 0);
                const nextXpTotal = toNumber(existingStats?.xp_total, 0) + xpEarned;
                const nextLevel = Math.max(1, Math.floor(nextXpTotal / 120) + 1);

                await studyClient.query(
                    `INSERT INTO study_user_stats
                        (user_id, xp_total, level, last_study_at, sessions_completed, topics_mastered)
                     VALUES
                        ($1, $2, $3, $4, 1, $5)
                     ON CONFLICT (user_id)
                     DO UPDATE SET
                        xp_total = study_user_stats.xp_total + EXCLUDED.xp_total,
                        level = $3,
                        last_study_at = EXCLUDED.last_study_at,
                        sessions_completed = study_user_stats.sessions_completed + 1,
                        topics_mastered = $5`,
                    [req.user.id, xpEarned, nextLevel, nowIso, topicsMastered],
                );

                const userRow = await studyClient.query(
                    `SELECT streak_data
                     FROM users
                     WHERE id = $1`,
                    [req.user.id],
                );
                const nextStreakData = updateStreakData(userRow.rows[0]?.streak_data || '{}', nowIso);
                await studyClient.query(
                    `UPDATE users
                     SET streak_data = $1
                     WHERE id = $2`,
                    [JSON.stringify(nextStreakData), req.user.id],
                );

                const achievementKeys = [];
                const nextSessionsCompleted = toNumber(existingStats?.sessions_completed, 0) + 1;
                if (nextSessionsCompleted === 1) achievementKeys.push('first_session');
                if (toNumber(nextStreakData.currentStreak, 0) >= 3) achievementKeys.push('three_day_streak');
                if ((beforeSnapshot?.masteryBands?.support?.length || 0) > (afterSnapshot?.masteryBands?.support?.length || 0)) {
                    achievementKeys.push('weak_topic_recovery');
                }
                if (topicsMastered >= 5) achievementKeys.push('five_mastered_topics');
                if (mode === 'cram' && xpEarned > 0) achievementKeys.push('first_cram_win');

                if (achievementKeys.length > 0) {
                    await Promise.all(achievementKeys.map((achievementKey) => studyClient.query(
                        `INSERT INTO study_achievements
                            (user_id, achievement_key, unlocked_at, metadata)
                         VALUES
                            ($1, $2, $3, $4::jsonb)
                         ON CONFLICT (user_id, achievement_key) DO NOTHING`,
                        [
                            req.user.id,
                            achievementKey,
                            nowIso,
                            JSON.stringify({ guideId, xpEarned }),
                        ],
                    )));
                }

                await studyClient.query('COMMIT');

                res.json({
                    xpEarned,
                    masteryDelta: delta.masteryDeltaPercent,
                    reviewedSections,
                    weakTopicsRemaining: afterSnapshot.masteryBands.support.slice(0, 3).map((section) => ({
                        id: section.id,
                        title: section.title,
                    })),
                    nextReviewAt: afterSnapshot.nextReviewAt,
                    stats: {
                        xpTotal: nextXpTotal,
                        level: nextLevel,
                        sessionsCompleted: nextSessionsCompleted,
                        topicsMastered,
                    },
                });
            } catch (transactionError) {
                await studyClient.query('ROLLBACK');
                throw transactionError;
            } finally {
                studyClient.release();
            }
        } catch (error) {
            console.error('POST /api/study/session-complete error:', error);
            res.status(500).json({ error: 'Failed to complete study session' });
        }
    });

    app.post('/api/study/assist', authMiddleware, async (req, res) => {
        const { guideId = null, guideData = null, sectionId = null, question = '' } = req.body || {};
        if (!String(question || '').trim()) {
            return res.status(400).json({ error: 'question is required' });
        }

        try {
            const { normalizeGuideData } = await loadStudyGuideUtils();

            let rawGuideData = guideData;
            if (!rawGuideData && guideId) {
                const guide = await db.queryOne(
                    `SELECT guide_data
                     FROM study_guides
                     WHERE id = $1 AND user_id = $2`,
                    [guideId, req.user.id],
                );
                rawGuideData = guide?.guide_data || null;
            }

            const normalizedGuideData = normalizeGuideData(rawGuideData);
            if (!normalizedGuideData) {
                return res.status(400).json({ error: 'guide data is required' });
            }

            const activeSection = normalizedGuideData.sections.find((section) => section.id === sectionId)
                || normalizedGuideData.sections[0]
                || null;

            const helperParts = [
                activeSection?.summary,
                activeSection?.ai_helpers?.simpler ? `Simpler: ${activeSection.ai_helpers.simpler}` : null,
                activeSection?.ai_helpers?.example ? `Example: ${activeSection.ai_helpers.example}` : null,
                activeSection?.ai_helpers?.mnemonic ? `Mnemonic: ${activeSection.ai_helpers.mnemonic}` : null,
                Array.isArray(activeSection?.answer_points) && activeSection.answer_points.length > 0
                    ? `Key points: ${activeSection.answer_points.slice(0, 3).join(' ')}`
                    : null,
            ].filter(Boolean);

            res.json({
                answer: helperParts.length > 0
                    ? `${activeSection?.title || 'This section'}: ${helperParts.join(' ')}`
                    : normalizedGuideData.overview,
                fallbackUsed: true,
            });
        } catch (error) {
            console.error('POST /api/study/assist error:', error);
            res.status(500).json({ error: 'Failed to generate study assist response' });
        }
    });
};
