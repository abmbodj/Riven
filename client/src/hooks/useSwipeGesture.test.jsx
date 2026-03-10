import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useSwipeGesture from './useSwipeGesture';

function SwipeHarness({
  onSwipeLeft = vi.fn(),
  onSwipeRight = vi.fn(),
  onSwipeUp = vi.fn(),
  onSwipeDown = vi.fn(),
}) {
  const handlers = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold: 50,
  });

  return <div data-testid="swipe-area" {...handlers} />;
}

describe('useSwipeGesture', () => {
  it('does not treat a tap as a swipe when touchmove never fires', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeUp = vi.fn();
    const onSwipeDown = vi.fn();

    const { getByTestId } = render(
      <SwipeHarness
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
        onSwipeUp={onSwipeUp}
        onSwipeDown={onSwipeDown}
      />
    );

    const swipeArea = getByTestId('swipe-area');

    fireEvent.touchStart(swipeArea, {
      touches: [{ clientX: 140, clientY: 220 }],
    });
    fireEvent.touchEnd(swipeArea, {
      changedTouches: [{ clientX: 140, clientY: 220 }],
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeUp).not.toHaveBeenCalled();
    expect(onSwipeDown).not.toHaveBeenCalled();
  });
});
