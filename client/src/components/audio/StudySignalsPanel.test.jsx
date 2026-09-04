import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import StudySignalsPanel from './StudySignalsPanel.jsx';

describe('StudySignalsPanel', () => {
  it('keeps signals private and lets students confirm or dismiss them', () => {
    const onUpdate = vi.fn();
    render(<StudySignalsPanel signals={[{
      id: 'signal-1', title: 'Explicit exam cue', body: 'The chain rule is on the exam.',
      status: 'open', share_visibility: 'private', severity: 'review', evidence_refs: ['seg-1'],
    }]} onUpdate={onUpdate} />);

    expect(screen.getByText(/private by default/i)).toBeInTheDocument();
    expect(screen.getByText(/1 evidence link/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm explicit exam cue/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss explicit exam cue/i }));
    expect(onUpdate).toHaveBeenNthCalledWith(1, 'signal-1', { status: 'confirmed' });
    expect(onUpdate).toHaveBeenNthCalledWith(2, 'signal-1', { status: 'dismissed' });
  });
});
