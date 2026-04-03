import React from 'react';
import { getGuideProgress, getSectionStatus, getWeakSections, normalizeGuideData, normalizeGuideStudyState } from '../utils/studyGuides.js';

const STATUS_CONFIG = {
    review_now: { label: 'Review Now', rowClass: 'border-l-red-400 bg-red-50', badgeClass: 'bg-red-100 text-red-700' },
    coming_up: { label: 'Coming Up', rowClass: 'border-l-yellow-400 bg-yellow-50', badgeClass: 'bg-yellow-100 text-yellow-700' },
    review_soon: { label: 'Review Soon', rowClass: 'border-l-yellow-300 bg-yellow-50', badgeClass: 'bg-yellow-100 text-yellow-800' },
    good: { label: 'Good', rowClass: 'border-l-green-400 bg-green-50', badgeClass: 'bg-green-100 text-green-700' },
    unstudied: { label: 'Not Studied', rowClass: 'border-l-red-300 bg-red-50', badgeClass: 'bg-red-100 text-red-600' },
};

export default function GuideProgressDashboard({ guideData, studyState, onStartWeakSession }) {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    const progress = getGuideProgress(normalizedGuideData, normalizedStudyState);
    const weakSections = getWeakSections(normalizedGuideData, normalizedStudyState);

    if (!normalizedGuideData) return null;

    const sections = normalizedGuideData.sections.map((section) => {
        const sectionState = normalizedStudyState.section_states[section.id];
        const rawStatus = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
        const status = !sectionState?.confidence ? 'unstudied' : rawStatus;
        return { section, status };
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-2xl font-bold text-claude-accent">{progress.completionPercent}%</p>
                    <p className="text-xs text-claude-secondary">Overall mastery</p>
                </div>
                <p className="text-sm text-claude-secondary">
                    {progress.completedCount}/{progress.totalSections} sections complete
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {sections.map(({ section, status }) => {
                    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unstudied;
                    return (
                        <div
                            key={section.id}
                            className={`flex items-center gap-3 rounded-xl border-l-4 px-3 py-3 ${config.rowClass}`}
                        >
                            <p className="flex-1 text-sm font-medium text-claude-text">{section.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.badgeClass}`}>
                                {config.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {weakSections.length > 0 && (
                <button
                    type="button"
                    data-testid="review-weak-cta"
                    onClick={onStartWeakSession}
                    className="w-full rounded-2xl bg-red-500 px-4 py-4 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Review Weak Sections Now ({weakSections.length})
                </button>
            )}
        </div>
    );
}
