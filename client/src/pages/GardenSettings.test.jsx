import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GardenSettings from './GardenSettings.jsx';
import { GardenContext } from '../context/GardenContext';

const { mockAuthState, mockGalleryMock, mockStreak, mockSetStageOverride } = vi.hoisted(() => ({
  mockAuthState: {
    isLoggedIn: true,
    isOwner: false,
    user: {
      subscription_tier: 'free',
      simulate_free_tier: false,
    },
  },
  mockGalleryMock: vi.fn(),
  mockStreak: {
    status: 'healthy',
    hoursRemaining: 12,
    studiedToday: true,
    currentStreak: 7,
    longestStreak: 12,
    lastStudyDate: '2026-03-14T12:00:00.000Z',
    pastStreaks: [],
  },
  mockSetStageOverride: vi.fn(),
}));

vi.mock('motion/react', () => {
  const stripMotionProps = (props) => {
    const {
      animate: _animate,
      exit: _exit,
      initial: _initial,
      transition: _transition,
      whileTap: _whileTap,
      ...domProps
    } = props;

    return domProps;
  };

  const createMotionComponent = (tag) =>
    React.forwardRef(
      ({ children, ...props }, ref) => React.createElement(tag, { ...stripMotionProps(props), ref }, children)
    );

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_, tag) => createMotionComponent(tag),
      }
    ),
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../hooks/useStreak', () => ({
  useStreak: () => mockStreak,
}));

vi.mock('../components/Garden', () => ({
  default: () => <div>Garden preview</div>,
}));

vi.mock('../components/GardenGallery', () => ({
  default: (props) => {
    mockGalleryMock(props);
    return <div>Garden gallery</div>;
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('GardenSettings simulate-free behavior', () => {
  const renderGardenSettings = () => render(
    <GardenContext.Provider value={{ customization: {}, setStageOverride: mockSetStageOverride }}>
      <GardenSettings />
    </GardenContext.Provider>
  );

  beforeEach(() => {
    mockGalleryMock.mockReset();
  });

  it('removes the owner stage override while simulated free mode is active', () => {
    mockAuthState.isOwner = true;
    mockAuthState.user.subscription_tier = 'free';
    mockAuthState.user.simulate_free_tier = true;

    renderGardenSettings();

    expect(screen.queryByText('Stage Override')).not.toBeInTheDocument();
    expect(screen.getByText('Garden Customization')).toBeInTheDocument();
    expect(screen.getByText(/upgrade to customize your garden stages/i)).toBeInTheDocument();
  });

  it('keeps the owner stage override when simulated free mode is off', () => {
    mockAuthState.isOwner = true;
    mockAuthState.user.subscription_tier = 'lifetime';
    mockAuthState.user.simulate_free_tier = false;

    renderGardenSettings();

    expect(screen.getByText('Stage Override')).toBeInTheDocument();
    expect(screen.getByText(/manually select any garden stage/i)).toBeInTheDocument();
  });

  it('opens Garden Memories for premium users from the garden settings action card', () => {
    mockAuthState.isOwner = false;
    mockAuthState.user.subscription_tier = 'supporter';
    mockAuthState.user.simulate_free_tier = false;

    renderGardenSettings();

    fireEvent.click(screen.getByRole('button', { name: /garden memories/i }));

    expect(screen.getByText('Garden gallery')).toBeInTheDocument();
    expect(mockGalleryMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStreak: 7,
      longestStreak: 12,
      pastStreaks: [],
      onClose: expect.any(Function),
    }));
  });
});
