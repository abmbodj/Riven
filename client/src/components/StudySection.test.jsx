import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudySection from './StudySection.jsx';

const section = {
    id: 'sec-1',
    title: 'Protein Synthesis',
    recall_prompt: 'How does DNA become a protein?',
    answer_points: ['Transcription: DNA → mRNA', 'Translation: mRNA → protein'],
    common_traps: ['Confusing polymerase with ribosomes'],
    mini_quiz: [{ prompt: 'Where does translation occur?', answer: 'Ribosomes' }],
    key_terms: [],
};

const sectionNoQuiz = { ...section, mini_quiz: [] };

const defaultProps = {
    section,
    sectionState: { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
    onReveal: vi.fn(),
    onConfidenceSelect: vi.fn(),
    onComplete: vi.fn(),
};

describe('StudySection', () => {
    it('starts on recall step — shows recall prompt and Show Answer button', () => {
        render(<StudySection {...defaultProps} />);
        expect(screen.getByTestId('study-section-recall')).toBeTruthy();
        expect(screen.getByText('How does DNA become a protein?')).toBeTruthy();
        expect(screen.getByText('Show Answer')).toBeTruthy();
    });

    it('advances to answer step when Show Answer is tapped', () => {
        const onReveal = vi.fn();
        render(<StudySection {...defaultProps} onReveal={onReveal} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(onReveal).toHaveBeenCalledOnce();
        expect(screen.getByTestId('study-section-answer')).toBeTruthy();
        expect(screen.getByText('Transcription: DNA → mRNA')).toBeTruthy();
    });

    it('shows common_traps on answer step', () => {
        render(<StudySection {...defaultProps} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(screen.getByText('Confusing polymerase with ribosomes')).toBeTruthy();
    });

    it('calls onConfidenceSelect and advances to quiz step when section has quiz', () => {
        const onConfidenceSelect = vi.fn();
        render(<StudySection {...defaultProps} onConfidenceSelect={onConfidenceSelect} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-know_it'));
        expect(onConfidenceSelect).toHaveBeenCalledWith('know_it');
        expect(screen.getByTestId('study-section-quiz')).toBeTruthy();
    });

    it('calls onComplete directly after confidence when section has no quiz', () => {
        const onComplete = vi.fn();
        render(<StudySection {...defaultProps} section={sectionNoQuiz} onComplete={onComplete} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-okay'));
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('calls onComplete after thumbs up/down in quiz step', () => {
        const onComplete = vi.fn();
        render(<StudySection {...defaultProps} onComplete={onComplete} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-know_it'));
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-thumbs-up'));
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('resets to recall step when section.id changes', () => {
        const { rerender } = render(<StudySection {...defaultProps} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(screen.getByTestId('study-section-answer')).toBeTruthy();
        rerender(<StudySection {...defaultProps} section={{ ...section, id: 'sec-2' }} />);
        expect(screen.getByTestId('study-section-recall')).toBeTruthy();
    });
});
