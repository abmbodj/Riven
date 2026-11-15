// Default world for verify-riven journeys. Journeys may clone and edit it.
// Tables mirror Supabase table names; rows use the columns the client reads.
const DAY = 24 * 60 * 60 * 1000;
// Must match the `sub` of the fake session JWT (harness.mjs fakeSession).
export const AUTH_USER_ID = '00000000-0000-4000-8000-000000000007';

export function defaultSeed(now = Date.now()) {
    const iso = (offsetDays) => new Date(now + offsetDays * DAY).toISOString();
    const user = {
        id: 7,
        username: 'atlas',
        displayName: 'Atlas',
        email: 'atlas@example.test',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
        subscription_tier: 'free',
        streakData: { currentStreak: 4, longestStreak: 9, lastStudyDate: iso(-1).slice(0, 10) },
    };
    const classes = [
        { id: 21, user_id: 7, name: 'Biology', color: '#7a9e72', professor: 'Dr. Reyes', room: 'B12', created_at: iso(-3), archived_at: null },
        { id: 22, user_id: 7, name: 'Calculus', color: '#deb96a', professor: null, room: null, created_at: iso(-2), archived_at: null },
    ];
    const decks = [
        { id: 31, user_id: 7, class_id: 21, folder_id: null, title: 'Cell Biology', description: 'Organelles and membranes', created_at: iso(-2), updated_at: iso(-1), last_studied: null, is_public: false },
    ];
    const cards = [
        ['What is the powerhouse of the cell?', 'The mitochondrion'],
        ['What does the ribosome make?', 'Proteins'],
        ['What surrounds the cell?', 'The plasma membrane'],
    ].map(([front, back], i) => ({
        id: 501 + i, deck_id: 31, front, back, front_image: null, back_image: null, position: i,
        next_review: null, card_state: 'new', stability: null, fsrs_difficulty: null, reps: 0, lapses: 0, last_reviewed: null, times_reviewed: 0, times_correct: 0, created_at: iso(-2),
    }));
    const themes = [{
        id: 1, name: 'Sage Temple', is_default: 1, is_active: 1,
        bg_color: '#162a31', surface_color: '#233e46', text_color: '#f5f1e8', secondary_text_color: '#b7c5c5',
        border_color: '#36525a', accent_color: '#deb96a', effect_preset: 'auto',
    }];
    const dashboard = {
        version: 1,
        generatedAt: iso(0),
        assignments: [
            { id: 11, class_id: 21, title: 'Read chapter four', status: 'Pending', due_date: iso(1), type: 'Reading' },
        ],
        classes: classes.map(({ id, name, color, created_at }) => ({ id, name, color, created_at })),
        counts: { decks: decks.length, notes: 0, guides: 0, exams: 0 },
        archivedClassCount: 0,
        recentDecks: decks.map((d) => ({ id: d.id, title: d.title, class_id: d.class_id, created_at: d.created_at, cardCount: cards.length, tags: [] })),
        recentStudyItems: [{ id: 31, title: 'Cell Biology', class_id: 21, type: 'flashcard', activityAt: iso(-1), cardCount: cards.length }],
        weeklySummary: {
            cards_studied: 42, accuracy: 0.86, total_minutes: 55,
            daily_breakdown: Array.from({ length: 7 }, (_, i) => ({
                date: new Date(now - (6 - i) * DAY).toISOString().slice(0, 10),
                day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
                cards: i > 3 ? (i - 3) * 7 : 0, minutes: i > 3 ? (i - 3) * 5 : 0, studied: i > 3, is_today: i === 6,
            })),
        },
        streakSummary: user.streakData,
    };

    return {
        user,
        // window.__RIVEN_E2E_FIXTURES__ (read by client/src/testing/e2eFixtures.js)
        fixtures: {
            user,
            dashboard,
            dashboardDelayMs: 0,
            studyCoach: { recommendation: null, weakTopics: [], stats: { xpTotal: 820, level: 4, sessionsCompleted: 12, topicsMastered: 7 }, achievements: [] },
            hearts: { hearts: 5, max: 5, isUnlimited: false, nextRefill: null },
            aiLimits: { remaining: 7, max: 10, isPremium: false },
            themes,
        },
        // Fake PostgREST tables (https://example.supabase.co/rest/v1/<table>)
        tables: {
            users: [{ id: user.id, supabase_auth_id: AUTH_USER_ID, username: user.username, display_name: user.displayName, email: user.email, subscription_tier: 'free', streak_data: user.streakData, onboarding_completed_at: user.onboardingCompletedAt }],
            classes, decks, cards, themes,
            tags: [], deck_tags: [], folders: [], notes: [], study_guides: [], mock_exams: [], assignments: [],
            schedule_slots: [], user_notifications: [], study_sessions: [],
        },
        // POST /rest/v1/rpc/<name>
        rpc: {
            get_dashboard_bootstrap: () => dashboard,
            list_joined_group_meetups: () => [],
            list_user_groups: () => [],
        },
        // /functions/v1/<name>; body is the parsed JSON body (or null)
        edge: {
            hearts: (body, state) => {
                state.hearts ??= { hearts: 5, max: 5, isUnlimited: false, nextRefill: null };
                if (body?.action === 'decrement') state.hearts.hearts = Math.max(0, state.hearts.hearts - 1);
                return state.hearts;
            },
        },
    };
}
