import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TranscriptReview from './TranscriptReview.jsx';

describe('TranscriptReview', () => {
  const segments = [
    { id: 's1', startMs: 1000, text: 'The mitochondria matrix stores enzymes.', speaker: '0', revision: 1 },
    { id: 's2', startMs: 5000, text: 'Next we cover glycolysis.', speaker: '1', revision: 1 },
  ];

  it('searches, corrects, and relabels evidence segments', () => {
    const onCorrect = vi.fn();
    render(<TranscriptReview segments={segments} onCorrect={onCorrect} />);

    fireEvent.change(screen.getByRole('searchbox', { name: /search transcript/i }), {
      target: { value: 'mitochondria' },
    });
    expect(screen.getByDisplayValue(/mitochondria matrix/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/glycolysis/)).not.toBeInTheDocument();

    const textarea = screen.getByDisplayValue(/mitochondria matrix/);
    fireEvent.change(textarea, { target: { value: 'The mitochondrial matrix stores enzymes.' } });
    fireEvent.blur(textarea);
    fireEvent.change(screen.getByRole('combobox', { name: /speaker for 0:01/i }), {
      target: { value: 'Instructor' },
    });

    expect(onCorrect).toHaveBeenCalledWith(expect.objectContaining({
      id: 's1',
      correctedText: 'The mitochondrial matrix stores enzymes.',
    }));
    expect(onCorrect).toHaveBeenCalledWith(expect.objectContaining({
      id: 's1', speakerRole: 'Instructor',
    }));
  });
});
