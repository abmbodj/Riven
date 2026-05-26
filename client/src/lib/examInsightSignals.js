/** Tunable thresholds for pace temperament classification */
export const P_FAST = 75;
export const P_SLOW = 120;
export const R_RUSH = 0.35;
export const MIN_ATTEMPTS_HIGH_CONFIDENCE = 3;
/** Minimum completed mock attempts before the Insights Hub shows full persona/trend analytics */
export const MIN_HUB_INSIGHT_ATTEMPTS = 3;
export const MIN_TIMING_COVERAGE = 0.8;
export const IDLE_PAUSE_RATIO = 1.4;
export const RETAKE_PACE_GAIN_WITHOUT_SCORE = 15;

const normalizeDifficulty = (value) => String(value || 'medium').toLowerCase();

const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
};

const average = (values) => {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getAnswerList = (attempt) => {
    const answers = attempt?.answers;
    return Array.isArray(answers) ? answers : [];
};

export const computeRushIndex = (answers) => {
    const timedAnswers = answers.filter((answer) => Number(answer?.time_ms) > 0);
    if (timedAnswers.length < 2) return null;

    const correctTimes = timedAnswers
        .filter((answer) => answer?.isCorrect)
        .map((answer) => Number(answer.time_ms));
    if (correctTimes.length === 0) return null;

    const medianCorrectMs = median(correctTimes);
    const incorrectAnswers = timedAnswers.filter((answer) => !answer?.isCorrect);
    if (incorrectAnswers.length === 0) return 0;

    const fastWrongCount = incorrectAnswers.filter((answer) => {
        const timeMs = Number(answer.time_ms);
        const isHard = normalizeDifficulty(answer?.difficulty) === 'hard';
        const fastThreshold = medianCorrectMs * (isHard ? 1.15 : 1);
        return timeMs <= fastThreshold;
    }).length;

    return fastWrongCount / incorrectAnswers.length;
};

export const computeHardAccuracy = (answers) => {
    const hardAnswers = answers.filter((answer) => normalizeDifficulty(answer?.difficulty) === 'hard');
    if (hardAnswers.length === 0) return null;
    const correct = hardAnswers.filter((answer) => answer?.isCorrect).length;
    return correct / hardAnswers.length;
};

export const buildAttemptTimingProfile = (attempt) => {
    const answers = getAnswerList(attempt);
    const total = Number(attempt?.total || 0);
    const durationSeconds = Number(attempt?.duration_seconds || 0);
    const timedAnswers = answers.filter((answer) => Number(answer?.time_ms) > 0);
    const timingCoverage = total > 0 ? timedAnswers.length / total : 0;

    const activePaceSeconds = timedAnswers.length > 0
        ? timedAnswers.reduce((sum, answer) => sum + Number(answer.time_ms), 0) / (timedAnswers.length * 1000)
        : null;

    const wallPaceSeconds = durationSeconds > 0 && total > 0
        ? durationSeconds / total
        : null;

    const activeDurationSeconds = activePaceSeconds != null && total > 0
        ? activePaceSeconds * total
        : null;

    const hadLongPauses = (
        durationSeconds > 0
        && activeDurationSeconds != null
        && durationSeconds > activeDurationSeconds * IDLE_PAUSE_RATIO
    );

    let effectivePaceSeconds = null;
    if (hadLongPauses && activePaceSeconds != null) {
        effectivePaceSeconds = activePaceSeconds;
    } else if (wallPaceSeconds != null && activePaceSeconds != null) {
        effectivePaceSeconds = Math.min(wallPaceSeconds, activePaceSeconds);
    } else {
        effectivePaceSeconds = wallPaceSeconds ?? activePaceSeconds;
    }

    const scorePercent = total > 0
        ? Math.round((Number(attempt?.score || 0) / total) * 100)
        : null;

    return {
        attemptId: attempt?.id || null,
        examId: attempt?.exam_id || null,
        completedAt: attempt?.completed_at || null,
        total,
        scorePercent,
        timingCoverage,
        hasTimingData: timingCoverage >= MIN_TIMING_COVERAGE && timedAnswers.length >= 2,
        activePaceSeconds,
        wallPaceSeconds,
        effectivePaceSeconds,
        hadLongPauses,
        rushIndex: computeRushIndex(answers),
        hardAccuracy: computeHardAccuracy(answers),
        paceVariance: (() => {
            if (timedAnswers.length < 2) return null;
            const times = timedAnswers.map((answer) => Number(answer.time_ms) / 1000);
            const mean = average(times);
            if (mean == null || mean <= 0) return null;
            const variance = average(times.map((time) => (time - mean) ** 2));
            return variance != null ? Math.sqrt(variance) / mean : null;
        })(),
    };
};

export const buildRetakePaceAnalysis = (attempts) => {
    const byExam = new Map();
    attempts.forEach((attempt) => {
        const examId = attempt?.exam_id;
        if (!examId) return;
        const list = byExam.get(examId) || [];
        list.push(attempt);
        byExam.set(examId, list);
    });

    let memorizationRetakeCount = 0;
    let retakePairCount = 0;

    byExam.forEach((examAttempts) => {
        const chronological = [...examAttempts].sort(
            (left, right) => new Date(left.completed_at) - new Date(right.completed_at),
        );
        if (chronological.length < 2) return;

        const first = buildAttemptTimingProfile(chronological[0]);
        const second = buildAttemptTimingProfile(chronological[1]);
        if (first.effectivePaceSeconds == null || second.effectivePaceSeconds == null) return;

        retakePairCount += 1;
        const paceDelta = second.effectivePaceSeconds - first.effectivePaceSeconds;
        const scoreDelta = (second.scorePercent ?? 0) - (first.scorePercent ?? 0);
        const fasterWithoutMastery = paceDelta <= -10 && scoreDelta < RETAKE_PACE_GAIN_WITHOUT_SCORE;
        if (fasterWithoutMastery) memorizationRetakeCount += 1;
    });

    return {
        retakePairCount,
        memorizationRetakeCount,
        hasMemorizationRetakes: memorizationRetakeCount > 0,
    };
};

const buildTemperamentEvidence = ({
    key,
    averagePaceSeconds,
    averageScore,
    hardAccuracyPercent,
    rushIndexPercent,
    hasMemorizationRetakes,
}) => {
    const evidence = [];
    if (averagePaceSeconds != null) {
        evidence.push(`${Math.round(averagePaceSeconds)}s per question`);
    }
    if (averageScore != null) {
        evidence.push(`${Math.round(averageScore)}% average score`);
    }
    if (hardAccuracyPercent != null) {
        evidence.push(`${Math.round(hardAccuracyPercent)}% on hard questions`);
    }
    if (rushIndexPercent != null && key === 'rushing') {
        evidence.push(`${Math.round(rushIndexPercent)}% of misses were fast`);
    }
    if (hasMemorizationRetakes) {
        evidence.push('Retake speed-ups without matching score gains');
    }
    return evidence;
};

const TEMPERAMENT_LABELS = {
    'natural-fast': {
        label: 'Natural fast pace',
        description: 'You answer quickly while keeping accuracy up on harder questions.',
    },
    rushing: {
        label: 'Rushing',
        description: 'You move quickly, but misses often come on harder questions or fast wrong answers.',
    },
    deliberate: {
        label: 'Deliberate pace',
        description: 'You take more time per question and your accuracy stays controlled.',
    },
    slow: {
        label: 'Slow under pressure',
        description: 'Longer pacing pairs with weaker scores, so more review time may help before speed.',
    },
    unknown: {
        label: 'Pace pattern forming',
        description: 'Complete another timed attempt so pacing signals become reliable.',
    },
};

export const buildAggregatePaceTemperament = (attempts, averageScore) => {
    const profiles = attempts
        .map((attempt) => buildAttemptTimingProfile(attempt))
        .filter((profile) => profile.hasTimingData || profile.effectivePaceSeconds != null);

    const timedProfiles = profiles.filter((profile) => profile.effectivePaceSeconds != null);
    const retakeAnalysis = buildRetakePaceAnalysis(attempts);

    if (timedProfiles.length === 0) {
        return {
            key: 'unknown',
            confidence: 'low',
            label: TEMPERAMENT_LABELS.unknown.label,
            description: TEMPERAMENT_LABELS.unknown.description,
            evidence: ['Need per-question timing from timed attempts'],
            metrics: {
                averagePaceSeconds: null,
                hardAccuracy: null,
                rushIndex: null,
                timedAttemptCount: 0,
                hasMemorizationRetakes: retakeAnalysis.hasMemorizationRetakes,
            },
        };
    }

    const weightedPace = average(
        timedProfiles.map((profile) => profile.effectivePaceSeconds),
    );

    const hardAccuracyValues = timedProfiles
        .map((profile) => profile.hardAccuracy)
        .filter((value) => value != null);
    const hardAccuracy = average(hardAccuracyValues);

    const rushIndexValues = timedProfiles
        .map((profile) => profile.rushIndex)
        .filter((value) => value != null);
    const rushIndex = average(rushIndexValues);

    const timingCoverageAvg = average(
        timedProfiles.map((profile) => profile.timingCoverage),
    );

    let confidence = 'low';
    if (timedProfiles.length >= MIN_ATTEMPTS_HIGH_CONFIDENCE && (timingCoverageAvg ?? 0) >= MIN_TIMING_COVERAGE) {
        confidence = 'high';
    } else if (timedProfiles.length >= 2) {
        confidence = 'medium';
    }

  const hardAccuracyPercent = hardAccuracy != null ? hardAccuracy * 100 : null;
    const isFast = weightedPace != null && weightedPace <= P_FAST;
    const isSlow = weightedPace != null && weightedPace > P_SLOW;
    const score = averageScore ?? average(
        timedProfiles.map((profile) => profile.scorePercent).filter((value) => value != null),
    );

    let key = 'unknown';
    if (retakeAnalysis.hasMemorizationRetakes && isFast && (score ?? 0) < 85) {
        key = 'rushing';
        confidence = confidence === 'high' ? 'medium' : confidence;
    } else if (isFast) {
        const rushingByAccuracy = score != null && score < 75;
        const rushingByHard = hardAccuracy != null && hardAccuracy < 0.55;
        const rushingByIndex = rushIndex != null && rushIndex >= R_RUSH;
        if (rushingByAccuracy || rushingByHard || rushingByIndex) {
            key = 'rushing';
        } else if (score != null && score >= 80 && (hardAccuracy == null || hardAccuracy >= 0.7)) {
            key = 'natural-fast';
        } else {
            key = 'rushing';
        }
    } else if (isSlow && score != null && score < 65) {
        key = 'slow';
    } else if (!isFast && score != null && score >= 70) {
        key = 'deliberate';
    } else if (timedProfiles.length < 2) {
        key = 'unknown';
        confidence = 'low';
    } else {
        key = 'deliberate';
    }

    const temperamentMeta = TEMPERAMENT_LABELS[key] || TEMPERAMENT_LABELS.unknown;
    const evidence = buildTemperamentEvidence({
        key,
        averagePaceSeconds: weightedPace,
        averageScore: score,
        hardAccuracyPercent,
        rushIndexPercent: rushIndex != null ? rushIndex * 100 : null,
        hasMemorizationRetakes: retakeAnalysis.hasMemorizationRetakes,
    });

    return {
        key,
        confidence,
        label: temperamentMeta.label,
        description: temperamentMeta.description,
        evidence,
        metrics: {
            averagePaceSeconds: weightedPace,
            hardAccuracy,
            rushIndex,
            timedAttemptCount: timedProfiles.length,
            hasMemorizationRetakes: retakeAnalysis.hasMemorizationRetakes,
        },
    };
};

const CRAMMING_PERSONA_KEYS = new Set(['cramming-loop', 'cramming-loop-rushing']);

const hasMediumOrHighConfidence = (confidence) => confidence === 'medium' || confidence === 'high';

export const buildStrengthInsights = ({
    totalAttempts,
    averageScore,
    bestScore,
    trendDelta,
    personaKey,
    paceTemperament,
    latestAttempt,
    personaStrengths = [],
}) => {
    const temperament = paceTemperament || {};
    const tempoKey = temperament.key;
    const tempoConfidence = temperament.confidence;
    const hasReliableTemperament = hasMediumOrHighConfidence(tempoConfidence);
    const isRushing = tempoKey === 'rushing' && hasReliableTemperament;
    const isNaturalFast = tempoKey === 'natural-fast' && hasReliableTemperament;
    const isDeliberate = tempoKey === 'deliberate' && hasReliableTemperament;

    const latestProfile = latestAttempt ? buildAttemptTimingProfile(latestAttempt) : null;
    const latestRushIndex = latestProfile?.rushIndex;
    const hardAccuracy = temperament?.metrics?.hardAccuracy ?? latestProfile?.hardAccuracy;
    const hardAccuracyPercent = hardAccuracy != null ? Math.round(hardAccuracy * 100) : null;

    const strengths = [];
    const addStrength = (text) => {
        if (!text || strengths.includes(text)) return;
        strengths.push(text);
    };

    if (totalAttempts < MIN_HUB_INSIGHT_ATTEMPTS || personaKey === 'getting-started') {
        return {
            level: 'forming',
            affirmation: 'Complete more mocks to unlock a fuller performance read.',
            strengths: [],
        };
    }

    if (averageScore != null) {
        addStrength(`${Math.round(averageScore)}% average across ${totalAttempts} attempts`);
    }
    if (trendDelta != null && trendDelta >= 3) {
        addStrength(`+${Math.round(trendDelta)} pt improvement on recent mocks`);
    }
    if (bestScore != null && bestScore >= 85) {
        addStrength(`${Math.round(bestScore)}% best run on record`);
    }
    if (hardAccuracyPercent != null && hardAccuracyPercent >= 70) {
        addStrength(`Strong on harder questions (${hardAccuracyPercent}% on hard items)`);
    }
    if (isNaturalFast) {
        addStrength('Pace and accuracy align — quick without a high rush signal');
    } else if (isDeliberate && averageScore != null && averageScore >= 75) {
        addStrength('Controlled pacing with solid scores');
    }
    (personaStrengths || []).forEach(addStrength);

    if (CRAMMING_PERSONA_KEYS.has(personaKey)) {
        return {
            level: 'forming',
            affirmation: 'Focus on accuracy and review before your next timed run.',
            strengths: [],
        };
    }

    const isStrongPersona = personaKey === 'fast-and-accurate';
    const isSteadyStrong = personaKey === 'steady-climber' && trendDelta != null && trendDelta >= 5;
    const isHighControlledPace = averageScore != null
        && averageScore >= 80
        && (isNaturalFast || isDeliberate)
        && !isRushing;
    const isHighLowRush = averageScore != null
        && averageScore >= 85
        && latestRushIndex != null
        && latestRushIndex < 0.25;

    if (isStrongPersona || isSteadyStrong || isHighControlledPace || isHighLowRush) {
        let affirmation = "You're performing strongly as an exam taker.";
        if (isStrongPersona) {
            affirmation = "You're exam-ready under time pressure.";
        } else if (isSteadyStrong) {
            affirmation = 'Your recent mocks show real momentum.';
        } else if (isHighControlledPace) {
            affirmation = "You're a strong, careful exam taker.";
        }

        return {
            level: 'strong',
            affirmation,
            strengths: strengths.slice(0, 4),
        };
    }

    const isSolid = averageScore != null
        && averageScore >= 70
        && ((trendDelta != null && trendDelta >= 3) || (bestScore != null && bestScore >= 85));

    if (isSolid) {
        const affirmation = trendDelta != null && trendDelta >= 3
            ? "You're on track with improving results."
            : `Solid performance — your best run hit ${Math.round(bestScore)}%.`;

        return {
            level: 'solid',
            affirmation,
            strengths: strengths.slice(0, 4),
        };
    }

    return {
        level: 'forming',
        affirmation: 'Complete another timed mock for a clearer strength read.',
        strengths: strengths.slice(0, 2),
    };
};
