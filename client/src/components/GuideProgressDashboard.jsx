import React, { useMemo } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    CircleDashed,
    Clock3,
    PenSquare,
    Sparkles,
    Target,
} from 'lucide-react';
import {
    getGuideProgress,
    getSectionStatus,
    getWeakSections,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides.js';

const STATUS_CONFIG = {
    review_now: {
        label: 'Review Now',
        tone: 'guide-status-pill--danger',
        panel: 'guide-tone-danger',
        icon: AlertTriangle,
    },
    coming_up: {
        label: 'Coming Up',
        tone: 'guide-status-pill--warning',
        panel: 'guide-tone-warning',
        icon: Sparkles,
    },
    review_soon: {
        label: 'Review Soon',
        tone: 'guide-status-pill--warning',
        panel: 'guide-tone-warning',
        icon: Clock3,
    },
    good: {
        label: 'Good',
        tone: 'guide-status-pill--success',
        panel: 'guide-tone-success',
        icon: CheckCircle2,
    },
    unstudied: {
        label: 'Not Studied',
        tone: 'guide-status-pill--danger',
        panel: 'guide-tone-neutral',
        icon: CircleDashed,
    },
};

const STATUS_ORDER = ['review_now', 'unstudied', 'coming_up', 'review_soon', 'good'];

function DashboardMetric({ eyebrow, value, caption, accent = false }) {
    return (
        <article className={`guide-metric rounded-[1.5rem] p-4 ${accent ? 'shadow-[0_24px_60px_-34px_rgba(0,0,0,0.85)]' : ''}`}>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                {eyebrow}
            </p>
            <p className={`mt-3 font-display text-[2rem] font-bold italic leading-none ${accent ? 'text-claude-accent' : 'text-claude-text'}`}>
                {value}
            </p>
            <p className="mt-2 text-sm leading-6 text-claude-secondary">{caption}</p>
        </article>
    );
}

export default function GuideProgressDashboard({ guideData, studyState, onStartWeakSession, onEditSection }) {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = useMemo(
        () => (normalizedGuideData ? normalizeGuideStudyState(normalizedGuideData, studyState) : null),
        [normalizedGuideData, studyState],
    );
    const progress = useMemo(
        () => (normalizedGuideData && normalizedStudyState
            ? getGuideProgress(normalizedGuideData, normalizedStudyState)
            : null),
        [normalizedGuideData, normalizedStudyState],
    );
    const weakSections = useMemo(
        () => (normalizedGuideData && normalizedStudyState
            ? getWeakSections(normalizedGuideData, normalizedStudyState)
            : []),
        [normalizedGuideData, normalizedStudyState],
    );

    const sections = useMemo(() => {
        if (!normalizedGuideData || !normalizedStudyState) return [];

        return normalizedGuideData.sections
            .map((section, index) => {
                const sectionState = normalizedStudyState.section_states[section.id];
                const rawStatus = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
                const status = !sectionState?.confidence ? 'unstudied' : rawStatus;
                return { section, sectionState, status, index };
            })
            .sort((left, right) => {
                const leftOrder = STATUS_ORDER.indexOf(left.status);
                const rightOrder = STATUS_ORDER.indexOf(right.status);
                if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                return left.index - right.index;
            });
    }, [normalizedGuideData, normalizedStudyState]);

    const statusCounts = useMemo(() => (
        sections.reduce((accumulator, item) => {
            accumulator[item.status] = (accumulator[item.status] || 0) + 1;
            return accumulator;
        }, {})
    ), [sections]);

    if (!normalizedGuideData || !normalizedStudyState || !progress) return null;

    return (
        <div data-testid="guide-progress-dashboard" className="flex flex-col gap-5">
            <div className="guide-hero rounded-[1.9rem] p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                            Progress dashboard
                        </p>
                        <h2 className="mt-3 font-display text-[2rem] font-bold italic leading-none text-claude-text">
                            Mastery Snapshot
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-claude-secondary">
                            See where recall is strong, where it&apos;s fading, and what deserves the next quick session.
                        </p>
                    </div>
                    <span className="guide-status-pill guide-status-pill--neutral self-start lg:self-auto">
                        <Target className="h-3.5 w-3.5" />
                        {progress.completedCount}/{progress.totalSections} complete
                    </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <DashboardMetric
                        eyebrow="Overall"
                        value={`${progress.completionPercent}%`}
                        caption="Sections completed or checked off."
                        accent
                    />
                    <DashboardMetric
                        eyebrow="Review now"
                        value={(statusCounts.review_now || 0) + (statusCounts.unstudied || 0)}
                        caption="Weak or untouched checkpoints."
                    />
                    <DashboardMetric
                        eyebrow="Solid"
                        value={statusCounts.good || 0}
                        caption="Recent sections that feel exam-ready."
                    />
                </div>
            </div>

            <div className="guide-shell rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Status legend
                        </p>
                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                            Your next session should usually start with Review Now, then Coming Up.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                            const Icon = config.icon;
                            return (
                                <span key={status} className={`guide-status-pill ${config.tone}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                    {config.label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {weakSections.length > 0 ? (
                <div className="guide-tone-warning rounded-[1.55rem] p-4 sm:p-5">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                        Urgent next
                    </p>
                    <p className="mt-2 text-sm leading-6 text-claude-text">
                        Review {weakSections.slice(0, 2).map((section) => section.title).join(' and ')}
                        {weakSections.length > 2 ? `, plus ${weakSections.length - 2} more checkpoint${weakSections.length - 2 === 1 ? '' : 's'}.` : ' next.'}
                    </p>
                </div>
            ) : null}

            <div className="flex flex-col gap-3">
                {sections.map(({ section, sectionState, status }) => {
                    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unstudied;
                    const Icon = config.icon;
                    const reviewedLabel = sectionState?.last_reviewed_at
                        ? new Date(sectionState.last_reviewed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'Not yet reviewed';

                    return (
                        <article
                            key={section.id}
                            className={`rounded-[1.55rem] p-4 sm:p-5 ${config.panel}`}
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`guide-status-pill ${config.tone}`}>
                                            <Icon className="h-3.5 w-3.5" />
                                            {config.label}
                                        </span>
                                        {(section.mini_quiz?.length ?? 0) > 0 && (
                                            <span className="guide-status-pill guide-status-pill--neutral">
                                                {section.mini_quiz.length} quiz
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-4 font-display text-[1.4rem] font-bold italic leading-none text-claude-text">
                                        {section.title}
                                    </p>
                                    <p className="mt-3 text-sm leading-6 text-claude-secondary">
                                        {section.recall_prompt}
                                    </p>
                                    <p className="mt-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                        Last reviewed: {reviewedLabel}
                                    </p>
                                </div>
                                {onEditSection ? (
                                    <button
                                        type="button"
                                        data-testid={`dashboard-edit-${section.id}`}
                                        onClick={() => onEditSection(section.id)}
                                        className="guide-cta guide-cta--ghost guide-focus-ring sm:w-auto"
                                    >
                                        <PenSquare className="h-4 w-4" />
                                        <span>Edit</span>
                                    </button>
                                ) : null}
                            </div>
                        </article>
                    );
                })}
            </div>

            {weakSections.length > 0 && (
                <button
                    type="button"
                    data-testid="review-weak-cta"
                    onClick={onStartWeakSession}
                    className="guide-cta guide-cta--primary guide-focus-ring w-full"
                >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Review Weak Sections Now ({weakSections.length})</span>
                </button>
            )}
        </div>
    );
}
