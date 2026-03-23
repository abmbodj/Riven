import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from './Layout.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { UIContext } from '../context/UIContext.jsx';

const { recordingSessionMock, mobileBudgetMock } = vi.hoisted(() => ({
  recordingSessionMock: {
    state: 'idle',
    activeNoteId: null,
    activeNoteTitle: '',
    duration: 0,
    goToActiveNote: vi.fn(),
  },
  mobileBudgetMock: vi.fn(() => false),
}));

vi.mock('../api', () => ({
  api: {
    getDecks: vi.fn().mockResolvedValue([]),
    getClasses: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getGroups: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./OnboardingArt.jsx', () => ({
  default: () => <div data-testid="onboarding-art" />,
}));

vi.mock('./UserNotificationsRail.jsx', () => ({
  default: () => null,
}));

vi.mock('../hooks/useRecordingSession.js', () => ({
  default: () => recordingSessionMock,
}));

vi.mock('../hooks/useMobileVisualBudget.js', () => ({
  useMobileVisualBudget: () => mobileBudgetMock(),
}));

function renderLayout(pathname = '/dashboard', { isLoggedIn = true } = {}) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuthContext.Provider value={{ isLoggedIn }}>
        <UIContext.Provider value={{ hideBottomNav: false }}>
          <Layout>
            <div>Page Body</div>
          </Layout>
        </UIContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

function getMainContentWidthWrapper() {
  return screen.getByText('Page Body').parentElement?.parentElement;
}

describe('Layout primary navigation', () => {
  beforeEach(() => {
    recordingSessionMock.state = 'idle';
    recordingSessionMock.activeNoteId = null;
    recordingSessionMock.activeNoteTitle = '';
    recordingSessionMock.duration = 0;
    recordingSessionMock.goToActiveNote.mockReset();
    mobileBudgetMock.mockReset();
    mobileBudgetMock.mockReturnValue(false);
  });

  it('shows study groups as a primary navigation destination', () => {
    renderLayout();

    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Study').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Classes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Groups').length).toBeGreaterThan(0);
  });

  it('hides the mobile bottom nav on the edit profile route', () => {
    renderLayout('/edit-profile');

    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });

  it('opens the command palette from the keyboard shortcut', async () => {
    renderLayout();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(await screen.findByPlaceholderText('Search current Riven...')).toBeInTheDocument();
  });

  it('keeps the dashboard main content padded below the native safe area', () => {
    renderLayout('/dashboard');

    expect(screen.getByRole('main')).toHaveClass('safe-area-top');
  });

  it('lets landing screens own their top safe area spacing', () => {
    renderLayout('/', { isLoggedIn: false });

    expect(screen.getByRole('main')).not.toHaveClass('safe-area-top');
  });

  it('lets onboarding screens own their top safe area spacing', () => {
    renderLayout('/onboarding');

    expect(screen.getByRole('main')).not.toHaveClass('safe-area-top');
  });

  it('lets active message threads own their top safe area spacing and hide the mobile nav', () => {
    renderLayout('/messages/21');

    expect(screen.getByRole('main')).not.toHaveClass('safe-area-top');
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });

  it('widens the desktop content shell on the settings route only', () => {
    renderLayout('/settings');

    expect(getMainContentWidthWrapper()).toHaveClass('lg:max-w-5xl');
    expect(getMainContentWidthWrapper()).toHaveClass('xl:max-w-7xl');
  });

  it('keeps the standard desktop content shell on non-settings routes', () => {
    renderLayout('/dashboard');

    expect(getMainContentWidthWrapper()).toHaveClass('lg:max-w-5xl');
    expect(getMainContentWidthWrapper()).not.toHaveClass('xl:max-w-7xl');
  });

  it('shows the floating recording widget away from the active note route', () => {
    recordingSessionMock.state = 'recording';
    recordingSessionMock.activeNoteId = 'note-42';
    recordingSessionMock.activeNoteTitle = 'Chemistry Lecture';
    recordingSessionMock.duration = 85;

    renderLayout('/classes');

    expect(screen.getByTestId('floating-recording-widget')).toBeInTheDocument();
    expect(screen.getByText('Recording note')).toBeInTheDocument();
  });

  it('hides the floating recording widget on the active note route', () => {
    recordingSessionMock.state = 'recording';
    recordingSessionMock.activeNoteId = 'note-42';
    recordingSessionMock.activeNoteTitle = 'Chemistry Lecture';

    renderLayout('/note/note-42');

    expect(screen.queryByTestId('floating-recording-widget')).not.toBeInTheDocument();
  });

  it('offsets the mobile recording widget above the bottom navigation', () => {
    mobileBudgetMock.mockReturnValue(true);
    recordingSessionMock.state = 'recording';
    recordingSessionMock.activeNoteId = 'note-42';
    recordingSessionMock.activeNoteTitle = 'Chemistry Lecture';

    renderLayout('/dashboard');

    expect(screen.getByTestId('floating-recording-widget')).toHaveClass('bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]');
    mobileBudgetMock.mockReturnValue(false);
  });
});
