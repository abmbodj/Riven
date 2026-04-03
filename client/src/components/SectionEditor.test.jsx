import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SectionEditor from './SectionEditor.jsx';

const section = {
    id: 'sec-1',
    title: 'Protein Synthesis',
    recall_prompt: 'How does DNA become a protein?',
    answer_points: ['Transcription: DNA → mRNA', 'Translation: mRNA → protein'],
    common_traps: ['Confusing polymerase with ribosomes'],
    key_terms: ['mRNA', 'ribosome'],
    mini_quiz: [],
};

describe('SectionEditor', () => {
    it('renders section fields pre-filled', () => {
        render(<SectionEditor section={section} onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByDisplayValue('Protein Synthesis')).toBeTruthy();
        expect(screen.getByDisplayValue('How does DNA become a protein?')).toBeTruthy();
        expect(screen.getByDisplayValue('Transcription: DNA → mRNA')).toBeTruthy();
    });

    it('calls onSave with updated title', () => {
        const onSave = vi.fn();
        render(<SectionEditor section={section} onSave={onSave} onCancel={vi.fn()} />);
        const titleInput = screen.getByDisplayValue('Protein Synthesis');
        fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
        fireEvent.click(screen.getByTestId('section-editor-save'));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Title' }));
    });

    it('calls onSave with answer_points after removing one', () => {
        const onSave = vi.fn();
        render(<SectionEditor section={section} onSave={onSave} onCancel={vi.fn()} />);
        fireEvent.click(screen.getAllByTestId('remove-answer-point')[0]);
        fireEvent.click(screen.getByTestId('section-editor-save'));
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ answer_points: ['Translation: mRNA → protein'] })
        );
    });

    it('calls onCancel when Cancel is clicked', () => {
        const onCancel = vi.fn();
        render(<SectionEditor section={section} onSave={vi.fn()} onCancel={onCancel} />);
        fireEvent.click(screen.getByTestId('section-editor-cancel'));
        expect(onCancel).toHaveBeenCalledOnce();
    });
});
