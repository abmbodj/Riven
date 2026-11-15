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

    app.post('/api/study/assist', authMiddleware, async (req, res) => {
        const { guideId = null, guideData = null, sectionId = null, cardId = null, question = '' } = req.body || {};
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

            const activeCard = normalizedGuideData.cards.find((card) => card.id === cardId)
                || normalizedGuideData.cards.find((card) => card.concept_id === sectionId)
                || normalizedGuideData.cards[0]
                || null;
            const activeConcept = normalizedGuideData.knowledge_map.concepts.find((concept) => (
                concept.id === sectionId || concept.id === activeCard?.concept_id
            )) || normalizedGuideData.knowledge_map.concepts[0] || null;

            const helperParts = [
                activeConcept?.summary,
                activeCard?.hints?.[0]?.text ? `Hint: ${activeCard.hints[0].text}` : null,
                activeCard?.feedback?.incorrect?.[0] ? `Reset: ${activeCard.feedback.incorrect[0]}` : null,
                Array.isArray(activeCard?.required_idea_tags) && activeCard.required_idea_tags.length > 0
                    ? `Focus on: ${activeCard.required_idea_tags.slice(0, 2).map((tag) => tag.replace(/-/g, ' ')).join(', ')}`
                    : null,
            ].filter(Boolean);

            res.json({
                answer: helperParts.length > 0
                    ? `${activeConcept?.title || 'This concept'}: ${helperParts.join(' ')}`
                    : normalizedGuideData.session_meta.student_goal,
                fallbackUsed: true,
            });
        } catch (error) {
            console.error('POST /api/study/assist error:', error);
            res.status(500).json({ error: 'Failed to generate study assist response' });
        }
    });
};
