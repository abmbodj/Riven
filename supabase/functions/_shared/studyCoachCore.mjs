import {
  estimateSessionEffortMinutes,
  getGuideMasterySnapshot,
  normalizeGuideData,
} from './studyGuideCore.mjs';

const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isExamAssignment = (assignment) => {
  const title = String(assignment?.title || assignment?.name || '').trim();
  const type = String(assignment?.assignment_type || assignment?.type || '').trim().toLowerCase();
  return EXAM_PATTERN.test(title) || ['exam', 'quiz', 'test', 'midterm', 'final', 'assessment'].includes(type);
};

const formatCountdownLabel = (dueAt, now) => {
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return null;
  const diffDays = Math.round((dueDate.getTime() - now.getTime()) / DAY_IN_MS);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'in 1 day';
  return `in ${diffDays} days`;
};

const normalizeStats = (row) => ({
  xpTotal: toNumber(row?.xp_total, 0),
  level: Math.max(1, toNumber(row?.level, 1)),
  sessionsCompleted: toNumber(row?.sessions_completed, 0),
  topicsMastered: toNumber(row?.topics_mastered, 0),
});

export function buildStudyCoachSnapshot({
  guides = [],
  assignments = [],
  notes = [],
  classes = [],
  statsRow = null,
  achievements = [],
  now = new Date(),
} = {}) {
  const classNameById = new Map(classes.map((row) => [String(row.id), row.name]));
  const futureAssignments = assignments.filter((assignment) => {
    if (['done', 'archived'].includes(String(assignment?.status || '').toLowerCase())) return false;
    if (!assignment?.due_date) return false;
    const dueDate = new Date(assignment.due_date);
    return !Number.isNaN(dueDate.getTime()) && dueDate > now;
  });
  const upcomingExamSource = futureAssignments.find(isExamAssignment) || null;
  const upcomingExam = upcomingExamSource
    ? {
        id: upcomingExamSource.id,
        title: upcomingExamSource.title || upcomingExamSource.name || 'Upcoming exam',
        dueAt: upcomingExamSource.due_date,
        countdownLabel: formatCountdownLabel(upcomingExamSource.due_date, now),
        classId: upcomingExamSource.class_id || null,
      }
    : null;

  const candidates = guides
    .map((guide) => {
      if (Number(guide.format_version) < 4 || !normalizeGuideData(guide.guide_data)) return null;
      const linkedExam = futureAssignments.find((assignment) => (
        assignment.class_id
        && guide.class_id
        && String(assignment.class_id) === String(guide.class_id)
        && isExamAssignment(assignment)
      )) || upcomingExamSource;
      const masterySnapshot = getGuideMasterySnapshot(guide.guide_data, guide.study_state, {
        linkedExamAt: linkedExam?.due_date || null,
        now: now.toISOString(),
      });
      const recommendedSections = masterySnapshot.recommendedSections.slice(0, 3);
      if (!recommendedSections.length) return null;
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
        label,
        priority: (recommendedSections[0]?.priorityScore || 0) + (linkedExamSoon ? 24 : 0),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.priority - left.priority);

  const topCandidate = candidates[0] || null;
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

  return {
    recommendation,
    weakTopics,
    upcomingExam,
    stats: normalizeStats(statsRow),
    suggestedGuide,
    achievements: achievements.map((achievement) => ({
      key: achievement.achievement_key,
      unlockedAt: achievement.unlocked_at,
      metadata: achievement.metadata && typeof achievement.metadata === 'object'
        ? achievement.metadata
        : {},
    })),
  };
}
