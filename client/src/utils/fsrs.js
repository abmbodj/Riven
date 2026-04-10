/**
 * FSRS (Free Spaced Repetition Scheduler) integration layer.
 * Wraps ts-fsrs to work with our card data model.
 */
import {
    createEmptyCard,
    fsrs,
    generatorParameters,
    Rating,
    State,
} from 'ts-fsrs';

// Our 3-button rating mapping
export const UserRating = {
    Forgot: Rating.Again,  // 1
    Hard: Rating.Hard,     // 2
    Easy: Rating.Easy,     // 4
};

// Card state labels for UI
const CardState = {
    New: State.New,           // 0
    Learning: State.Learning, // 1
    Review: State.Review,     // 2
    Relearning: State.Relearning, // 3
};

const STATE_LABEL = {
    [State.New]: 'new',
    [State.Learning]: 'learning',
    [State.Review]: 'review',
    [State.Relearning]: 'relearning',
};

// Create scheduler with our defaults
const params = generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
    enable_short_term: true,
});

const scheduler = fsrs(params);

/**
 * Convert our DB card fields into a ts-fsrs Card object.
 */
function dbCardToFsrs(card) {
    if (!card.last_reviewed || card.card_state === 'new') {
        return createEmptyCard(card.created_at ? new Date(card.created_at) : new Date());
    }

    const lastReview = new Date(card.last_reviewed);
    const now = new Date();
    const elapsedDays = Math.max(0, (now - lastReview) / (1000 * 60 * 60 * 24));

    return {
        due: card.next_review ? new Date(card.next_review) : now,
        stability: card.stability || 0,
        difficulty: card.fsrs_difficulty || 0,
        elapsed_days: elapsedDays,
        scheduled_days: card.scheduled_days || 0,
        learning_steps: card.learning_steps || 0,
        reps: card.reps || 0,
        lapses: card.lapses || 0,
        state: stateFromString(card.card_state),
        last_review: lastReview,
    };
}

/**
 * Schedule a card review and return the updated DB fields.
 * @param {object} card - DB card record
 * @param {number} rating - UserRating value (1=Forgot, 2=Hard, 4=Easy)
 * @param {Date} [now] - Current time (defaults to new Date())
 * @returns {object} Updated fields to merge into the card record
 */
export function scheduleCard(card, rating, now = new Date()) {
    const fsrsCard = dbCardToFsrs(card);
    const result = scheduler.next(fsrsCard, now, rating);
    const updated = result.card;

    return {
        stability: updated.stability,
        fsrs_difficulty: updated.difficulty,
        card_state: STATE_LABEL[updated.state] || 'new',
        reps: updated.reps,
        lapses: updated.lapses,
        scheduled_days: updated.scheduled_days,
        learning_steps: updated.learning_steps,
        last_reviewed: now.toISOString(),
        next_review: updated.due.toISOString(),
        times_reviewed: (card.times_reviewed || 0) + 1,
        times_correct: rating !== Rating.Again
            ? (card.times_correct || 0) + 1
            : (card.times_correct || 0),
    };
}


/**
 * Check if a card is due for review.
 */
export function isDue(card, now = new Date()) {
    if (!card.next_review || card.card_state === 'new') return true;
    return new Date(card.next_review) <= now;
}

/**
 * Sort cards for study session: due cards first (oldest due), then new cards.
 */
export function sortForStudy(cards, now = new Date()) {
    return [...cards].sort((a, b) => {
        const aDue = isDue(a, now);
        const bDue = isDue(b, now);

        // Due cards before non-due
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;

        // Among due cards, oldest next_review first
        if (aDue && bDue) {
            const aNew = a.card_state === 'new';
            const bNew = b.card_state === 'new';
            // Reviewed due cards before new cards
            if (!aNew && bNew) return -1;
            if (aNew && !bNew) return 1;
            if (aNew && bNew) return 0;
            return new Date(a.next_review) - new Date(b.next_review);
        }

        return 0;
    });
}


function stateFromString(str) {
    switch (str) {
        case 'learning': return State.Learning;
        case 'review': return State.Review;
        case 'relearning': return State.Relearning;
        default: return State.New;
    }
}
