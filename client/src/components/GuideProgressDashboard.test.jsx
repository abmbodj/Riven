import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GuideProgressDashboard from './GuideProgressDashboard.jsx';

const guideData = {
    overview: 'Review before revealing.',
    sections: [
        { id: 'sec-1', title: 'Cell Structure', recall_prompt: '', answer_points: [], key_terms: [], mini_quiz: [], common_traps: [] },
        { id: 'sec-2', title: 'Mitosis', recall_prompt: '', answer_points: [], key_terms: [], mini_quiz: [], common_traps: [] },
        { id: 'sec-3', title: 'Protein Synthesis', recall_prompt: '', answer_points: [], key_terms: [], mini_quiz: [], common_traps: [] },
    ],
};

const studyState = {
    current_section_id: 'sec-1',
    last_reviewed_at: new Date().toISOString(),
    section_states: {
        'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-2': { revealed: true, confidence: 'need_work', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
    },
};

describe('GuideProgressDashboard', () => {
    it('renders each section title', () => {
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={vi.fn()} />);
        expect(screen.getByTestId('guide-progress-dashboard')).toBeTruthy();
        expect(screen.getByText('Cell Structure')).toBeTruthy();
        expect(screen.getByText('Mitosis')).toBeTruthy();
        expect(screen.getByText('Protein Synthesis')).toBeTruthy();
    });

    it('shows Review Now label and counts unstudied sections into the review-now metric', () => {
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={vi.fn()} />);
        expect(screen.getAllByText(/review now/i).length).toBeGreaterThan(0);
        const reviewNowMetricLabel = screen.getByText(/^review now$/i, { selector: 'p' });
        const reviewNowCard = reviewNowMetricLabel.closest('article');
        expect(reviewNowCard).toBeTruthy();
        expect(within(reviewNowCard).getByText('2')).toBeTruthy();
    });

    it('shows Not Studied label with the danger-pill styling for an unstudied section', () => {
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={vi.fn()} />);
        const notStudiedPills = screen.getAllByText(/not studied/i);
        expect(notStudiedPills.length).toBeGreaterThan(0);
        expect(notStudiedPills[0].className).toContain('guide-status-pill--danger');
    });

    it('returns null when guide data cannot be normalized', () => {
        render(<GuideProgressDashboard guideData={null} studyState={studyState} onStartWeakSession={vi.fn()} />);
        expect(screen.queryByTestId('guide-progress-dashboard')).toBeNull();
    });

    it('calls onStartWeakSession when CTA is clicked', () => {
        const onStartWeakSession = vi.fn();
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={onStartWeakSession} />);
        fireEvent.click(screen.getByTestId('review-weak-cta'));
        expect(onStartWeakSession).toHaveBeenCalledOnce();
    });

    it('calls onEditSection for the matching section card', () => {
        const onEditSection = vi.fn();
        render(
            <GuideProgressDashboard
                guideData={guideData}
                studyState={studyState}
                onStartWeakSession={vi.fn()}
                onEditSection={onEditSection}
            />
        );
        fireEvent.click(screen.getByTestId('dashboard-edit-sec-2'));
        expect(onEditSection).toHaveBeenCalledWith('sec-2');
    });

    it('hides CTA when no weak sections exist', () => {
        const strongState = {
            ...studyState,
            section_states: {
                'sec-1': { confidence: 'know_it', last_reviewed_at: new Date().toISOString(), revealed: true, completed: true, note: '' },
                'sec-2': { confidence: 'know_it', last_reviewed_at: new Date().toISOString(), revealed: true, completed: true, note: '' },
                'sec-3': { confidence: 'know_it', last_reviewed_at: new Date().toISOString(), revealed: true, completed: true, note: '' },
            },
        };
        render(<GuideProgressDashboard guideData={guideData} studyState={strongState} onStartWeakSession={vi.fn()} />);
        expect(screen.queryByTestId('review-weak-cta')).toBeNull();
    });
});
