const HISTORY_KIND_CONFIG = {
    deck_generation: { label: 'Flashcard deck', visible: true },
    class_generation: { label: 'Class setup', visible: true },
    guide_generation: { label: 'Tutor session', visible: true },
    exam_generation: { label: 'Mock exam', visible: true },
    note_enhancement: { label: 'Audio note enhancement', visible: true },
    youtube_deck: { label: 'YouTube flashcard deck', visible: true },
    youtube_guide: { label: 'YouTube tutor session', visible: true },
    youtube_exam: { label: 'YouTube mock exam', visible: true },
    youtube_notes: { label: 'YouTube notes', visible: true },
    youtube_source: { label: 'YouTube source', visible: false },
};

const STATUS_TONE = {
    completed: 'success',
    queued: 'progress',
    running: 'progress',
    streaming: 'progress',
    saving: 'progress',
    failed: 'error',
    cancelled: 'error',
};

const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Just now';

    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (Math.abs(diffMinutes) < 1) return 'Just now';
    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');

    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');

    return date.toLocaleDateString();
};

const pickTitle = (input = {}, result = {}) => (
    result.title
    || input.title_snapshot
    || result.class_name
    || input.class_name
    || null
);

const buildSubtitle = (job) => {
    const input = job.input_payload || {};
    const result = job.result_payload || {};
    const pieces = [];
    const title = pickTitle(input, result);

    if (title) pieces.push(title);
    if (input.class_name && input.class_name !== title) pieces.push(input.class_name);
    if (!pieces.length && input.source_type) pieces.push(`Source: ${input.source_type}`);

    return pieces.join(' • ') || null;
};

const buildSummary = (job) => {
    const result = job.result_payload || {};
    const error = job.error_payload || {};

    if (job.status === 'completed') {
        if (typeof result.card_count === 'number') {
            return `${result.card_count} cards created`;
        }
        if (typeof result.question_count === 'number') {
            return `${result.question_count} questions created`;
        }
        if (typeof result.assignment_count === 'number') {
            return `${result.assignment_count} assignments detected`;
        }
        if (result.deck_id) return 'Deck created';
        if (result.guide_id) return 'Tutor session created';
        if (result.exam_id) return 'Exam created';
        if (result.note_id) return 'Notes updated';
        return job.progress_message || 'Completed';
    }

    if (job.status === 'failed' || job.status === 'cancelled') {
        return error.message || job.progress_message || 'Generation failed';
    }

    return job.progress_message || 'In progress';
};

export const shouldShowAiHistoryJob = (job) => Boolean(HISTORY_KIND_CONFIG[job?.kind]?.visible);

export const formatAiHistoryItem = (job) => {
    const config = HISTORY_KIND_CONFIG[job?.kind];
    if (!config?.visible) return null;

    return {
        id: job.id,
        label: config.label,
        subtitle: buildSubtitle(job),
        summary: buildSummary(job),
        status: job.status,
        tone: STATUS_TONE[job.status] || 'progress',
        statusLabel: job.status === 'completed'
            ? 'Completed'
            : job.status === 'failed'
                ? 'Failed'
                : job.status === 'cancelled'
                    ? 'Cancelled'
                    : 'In progress',
        timestampLabel: formatRelativeTime(job.completed_at || job.updated_at || job.created_at),
        createdAt: job.created_at,
    };
};
