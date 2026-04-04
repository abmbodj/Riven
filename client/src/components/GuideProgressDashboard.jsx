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
        <div data-testid="guide-progress-dashboard" className="flex flex-col gap-3">
            <div className="guide-hero rounded-[1.6rem] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                            Mastery snapshot
                        </p>
                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                            Where recall is strong, where it&apos;s fading.
                        </p>
                    </div>
                    <span className="guide-status-pill guide-status-pill--neutral shrink-0">
                        <Target className="h-3.5 w-3.5" />
                        {progress.completedCount}/{progress.totalSections}
                    </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="guide-metric rounded-[1.2rem] p-3 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.85)]">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Overall</p>
                        <p className="mt-1.5 font-display text-[1.5rem] font-bold italic leading-none text-claude-accent">{progress.completionPercent}%</p>
                    </div>
                    <div className="guide-metric rounded-[1.2rem] p-3">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Review</p>
                        <p className="mt-1.5 font-display text-[1.5rem] font-bold italic leading-none text-claude-text">{(statusCounts.review_now || 0) + (statusCounts.unstudied || 0)}</p>
                    </div>
                    <div className="guide-metric rounded-[1.2rem] p-3">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Solid</p>
                        <p className="mt-1.5 font-display text-[1.5rem] font-bold italic leading-none text-claude-text">{statusCounts.good || 0}</p>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
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

            {weakSections.length > 0 ? (
                <button
                    type="button"
                    data-testid="review-weak-cta"
                    onClick={onStartWeakSession}
                    className="guide-cta guide-cta--primary guide-focus-ring w-full"
                >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Review {weakSections.length} Weak Section{weakSections.length !== 1 ? 's' : ''}</span>
                </button>
            ) : null}

            <div className="flex flex-col gap-2">
                {sections.map(({ section, sectionState, status }) => {
                    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unstudied;
                    const Icon = config.icon;
                    const reviewedLabel = sectionState?.last_reviewed_at
                        ? new Date(sectionState.last_reviewed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : null;

                    return (
                        <article
                            key={section.id}
                            className={`rounded-[1.3rem] px-3.5 py-3 ${config.panel}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`guide-status-pill ${config.tone}`}>
                                            <Icon className="h-3.5 w-3.5" />
                                            {config.label}
                                        </span>
                                        {reviewedLabel && (
                                            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                                {reviewedLabel}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 text-[0.95rem] font-medium leading-tight text-claude-text">
                                        {section.title}
                                    </p>
                                </div>
                                {onEditSection ? (
                                    <button
                                        type="button"
                                        data-testid={`dashboard-edit-${section.id}`}
                                        onClick={() => onEditSection(section.id)}
                                        className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-2.5"
                                    >
                                        <PenSquare className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
