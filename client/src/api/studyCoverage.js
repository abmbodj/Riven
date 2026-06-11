import { getStudyCoverageMap } from './authApi';

/**
 * Coverage map for tutor sessions: how much of a class's (or all) material has been
 * taught and mastered across sessions, plus the next topics to target.
 *
 * Returns { totals: { total, mastered, taught, untaught, masteredPct, coveredPct },
 *           topics: [{ key, title, status, masteryScore, guideId, guideTitle }],
 *           nextTopics: string[] }.
 */
export async function getCoverageMap(classId = null) {
    return getStudyCoverageMap(classId);
}
