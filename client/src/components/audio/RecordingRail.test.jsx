import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RecordingRail from './RecordingRail.jsx';

describe('RecordingRail', () => {
  const recorder = {
    state: 'recording',
    duration: 75,
    transcriptState: 'open',
    chunkCount: 4,
    uploadedChunkCount: 3,
    transcriptSegments: [
      { id: '1', speaker: '0', text: 'ATP stores usable chemical energy.', isFinal: true },
      { id: '2', speaker: '1', text: 'Think of it as an energy carrier.', isFinal: false },
    ],
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  };

  it('exposes recording controls and a collapsible live transcript', () => {
    const onMark = vi.fn();
    render(<RecordingRail recorder={recorder} onMark={onMark} />);

    expect(screen.getByText('1:15')).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 chunks safe/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pause recording/i }));
    fireEvent.click(screen.getByRole('button', { name: /mark this moment/i }));
    expect(recorder.pause).toHaveBeenCalled();
    expect(onMark).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /hide live transcript/i }));
    expect(screen.queryByText(/ATP stores/)).not.toBeInTheDocument();
  });

  it('resumes a paused recording and warns at the three-hour threshold', () => {
    render(<RecordingRail recorder={{ ...recorder, state: 'paused', duration: 10801 }} onMark={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /resume recording/i }));
    expect(recorder.resume).toHaveBeenCalled();
    expect(screen.getByText(/over 3 hours/i)).toBeInTheDocument();
  });

  it('uses a distinct confirmation action at the four-hour safety pause', () => {
    const continueRecording = vi.fn();
    render(<RecordingRail recorder={{
      ...recorder,
      state: 'paused',
      duration: 14400,
      requiresContinuation: true,
      continueRecording,
    }} onMark={() => {}} />);

    expect(screen.getByText(/four-hour safety checkpoint/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue recording past four hours/i }));
    expect(continueRecording).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^resume recording$/i })).not.toBeInTheDocument();
  });
});
