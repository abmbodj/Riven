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
const adaptiveSection = {
    ...sectionNoQuiz,
    summary: 'DNA is transcribed into RNA, which is translated into protein.',
    key_terms: [{ term: 'mRNA', definition: 'Messenger RNA' }],
    flashcards: [{ front: 'Transcription', back: 'DNA to mRNA' }],
    visual: {
        type: 'sequence',
        title: 'Protein flow',
        steps: ['DNA', 'RNA', 'Protein'],
    },
    ai_helpers: {
        simpler: 'DNA becomes RNA, and RNA helps build protein.',
        example: 'Insulin is made after a gene is transcribed and translated.',
        mnemonic: 'DNA -> RNA -> Protein: copy, carry, build.',
    },
};

const defaultProps = {
    section,
    sectionState: { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
    onReveal: vi.fn(),
    onConfidenceSelect: vi.fn(),
    onComplete: vi.fn(),
};

describe('StudySection', () => {
    it('starts on recall step and shows the recall prompt', () => {
        render(<StudySection {...defaultProps} />);
        expect(screen.getByTestId('study-section-recall')).toBeTruthy();
        expect(screen.getByTestId('study-step-track')).toBeTruthy();
        expect(screen.getByTestId('study-step-recall').className).toContain('guide-step-pill--active');
        expect(screen.getByText('How does DNA become a protein?')).toBeTruthy();
        expect(screen.getByText('Show Answer')).toBeTruthy();
        expect(screen.queryByTestId('study-draft-answer')).toBeNull();
    });

    it('keeps the draft answer scratchpad collapsed until requested', () => {
        render(<StudySection {...defaultProps} />);
        fireEvent.click(screen.getByTestId('study-write-toggle'));
        expect(screen.getByTestId('study-draft-answer')).toBeTruthy();
    });

    it('starts on answer step when the section was already revealed', () => {
        render(
            <StudySection
                {...defaultProps}
                sectionState={{ revealed: true, confidence: 'okay', completed: false, note: '', last_reviewed_at: null }}
            />
        );
        expect(screen.getByTestId('study-section-answer')).toBeTruthy();
        expect(screen.queryByTestId('study-section-recall')).toBeNull();
    });

    it('advances to answer step when Show Answer is tapped', () => {
        const onReveal = vi.fn();
        render(<StudySection {...defaultProps} onReveal={onReveal} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(onReveal).toHaveBeenCalledOnce();
        expect(screen.getByTestId('study-section-answer')).toBeTruthy();
        expect(screen.getByTestId('study-step-reveal').className).toContain('guide-step-pill--active');
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

    it('shows inline helper actions, summary context, and an Ask action for adaptive sections', () => {
        const onAsk = vi.fn();
        render(<StudySection {...defaultProps} section={adaptiveSection} onAsk={onAsk} />);

        fireEvent.click(screen.getByText('Show Answer'));

        expect(screen.getByText(adaptiveSection.summary)).toBeTruthy();
        expect(screen.getByText('Protein flow')).toBeTruthy();
        expect(screen.getByText('mRNA: Messenger RNA')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /explain simpler/i }));
        expect(screen.getByText(adaptiveSection.ai_helpers.simpler)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));
        expect(onAsk).toHaveBeenCalledOnce();
    });

    it('turns flashcards into a drill loop before completing the section', () => {
        const onComplete = vi.fn();
        render(<StudySection {...defaultProps} section={adaptiveSection} onComplete={onComplete} />);

        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-okay'));

        expect(screen.getByTestId('study-section-quiz')).toBeTruthy();
        expect(screen.getByText('Transcription')).toBeTruthy();

        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-thumbs-up'));

        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
            quizCorrect: 1,
            quizTotal: 1,
        }));
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

    it('wires navigation and edit controls when provided', () => {
        const onPrevious = vi.fn();
        const onNext = vi.fn();
        const onEdit = vi.fn();

        render(
            <StudySection
                {...defaultProps}
                sectionState={{ revealed: true, confidence: 'okay', completed: false, note: '', last_reviewed_at: null }}
                canGoPrevious
                canGoNext
                onPrevious={onPrevious}
                onNext={onNext}
                onEdit={onEdit}
            />
        );

        fireEvent.click(screen.getByTestId('study-edit'));
        fireEvent.click(screen.getByTestId('study-previous'));
        fireEvent.click(screen.getByTestId('study-next'));

        expect(onEdit).toHaveBeenCalledOnce();
        expect(onPrevious).toHaveBeenCalledOnce();
        expect(onNext).toHaveBeenCalledOnce();
    });
});
