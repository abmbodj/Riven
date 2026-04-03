import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizMeMode from './QuizMeMode.jsx';

const questions = [
    { prompt: 'Where does translation occur?', answer: 'Ribosomes', sectionId: 'sec-1', sectionTitle: 'Protein Synthesis' },
    { prompt: 'What is the net ATP yield of glycolysis?', answer: '2 ATP', sectionId: 'sec-2', sectionTitle: 'Cellular Respiration' },
];

describe('QuizMeMode', () => {
    it('shows first question prompt', () => {
        render(<QuizMeMode questions={questions} onComplete={vi.fn()} />);
        expect(screen.getByText('Where does translation occur?')).toBeTruthy();
    });

    it('hides answer until Show Answer is tapped', () => {
        render(<QuizMeMode questions={questions} onComplete={vi.fn()} />);
        expect(screen.queryByText('Ribosomes')).toBeNull();
        fireEvent.click(screen.getByText('Show Answer'));
        expect(screen.getByText('Ribosomes')).toBeTruthy();
    });

    it('advances to next question after thumbs up', () => {
        render(<QuizMeMode questions={questions} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-correct'));
        expect(screen.getByText('What is the net ATP yield of glycolysis?')).toBeTruthy();
    });

    it('calls onComplete with score and weakSectionIds after all questions', () => {
        const onComplete = vi.fn();
        render(<QuizMeMode questions={questions} onComplete={onComplete} />);
        // Q1: wrong
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-incorrect'));
        // Q2: correct
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-correct'));
        expect(onComplete).toHaveBeenCalledWith({ score: 1, total: 2, weakSectionIds: ['sec-1'] });
    });

    it('shows empty state when no questions', () => {
        render(<QuizMeMode questions={[]} onComplete={vi.fn()} />);
        expect(screen.getByTestId('quiz-empty')).toBeTruthy();
    });
});
