import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CanvasIcalGuide from './CanvasIcalGuide.jsx';

vi.mock('motion/react', () => {
  const createMotionComponent = (tag) =>
    React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children));

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: new Proxy({}, {
      get: (_, tag) => createMotionComponent(tag),
    }),
  };
});

describe('CanvasIcalGuide', () => {
  it('starts collapsed and expands to show all walkthrough steps', () => {
    render(<CanvasIcalGuide />);

    expect(screen.getByTestId('canvas-ical-guide-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas-ical-guide-content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /need help finding it/i }));

    expect(screen.getByTestId('canvas-ical-guide-content')).toBeInTheDocument();
    expect(screen.getByText('Open Canvas Calendar')).toBeInTheDocument();
    expect(screen.getByText('Open Calendar Feed')).toBeInTheDocument();
    expect(screen.getByText('Copy the Link')).toBeInTheDocument();
    expect(screen.getByText(/on mobile, you may need to scroll down or switch to desktop view/i)).toBeInTheDocument();
  });

  it('renders the compact guide and validation hint when provided', () => {
    render(
      <CanvasIcalGuide
        compact
        validationHint="This looks like a Canvas page URL, not the Calendar Feed link. Check Step 2 above."
      />
    );

    expect(screen.getByTestId('canvas-ical-guide-compact')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-ical-validation-hint')).toHaveTextContent('Check Step 2 above.');
  });
});
