import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layout, { resolveSidebarDragState } from './Layout.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { UIContext } from '../context/UIContext.jsx';
import { COLLAPSED_NAV_WIDTH, COMPACT_NAV_WIDTH } from '../context/UIContext.jsx';

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
        <UIContext.Provider value={{
          hideBottomNav: false,
          showBottomNav: vi.fn(),
          hideNav: vi.fn(),
          navCollapsed: false,
          navWidth: 220,
          toggleNav: vi.fn(),
          setNavCollapsed: vi.fn(),
          setNavWidth: vi.fn(),
          drawerOpen: false,
          toggleDrawer: vi.fn(),
          closeDrawer: vi.fn(),
          notifPanelOpen: false,
          toggleNotifPanel: vi.fn(),
          closeNotifPanel: vi.fn(),
          studyMode: null,
          setStudyMode: vi.fn(),
          clearStudyMode: vi.fn(),
        }}>
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

function StatefulLayoutHarness({ initialCollapsed = false, initialWidth = 220, pathname = '/classes' }) {
  const [navCollapsed, setNavCollapsed] = useState(initialCollapsed);
  const [navWidth, setNavWidth] = useState(initialWidth);

  return (
    <MemoryRouter initialEntries={[pathname]}>
      <AuthContext.Provider value={{ isLoggedIn: true }}>
        <UIContext.Provider value={{
          hideBottomNav: false,
          showBottomNav: vi.fn(),
          hideNav: vi.fn(),
          navCollapsed,
          navWidth,
          toggleNav: () => setNavCollapsed((previous) => !previous),
          setNavCollapsed,
          setNavWidth,
          drawerOpen: false,
          toggleDrawer: vi.fn(),
          closeDrawer: vi.fn(),
          notifPanelOpen: false,
          toggleNotifPanel: vi.fn(),
          closeNotifPanel: vi.fn(),
          studyMode: null,
          setStudyMode: vi.fn(),
          clearStudyMode: vi.fn(),
        }}>
          <Layout>
            <div>Page Body</div>
          </Layout>
        </UIContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
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

  it('routes the desktop sidebar create note CTA to the note creation flow', () => {
    renderLayout('/account');

    const cta = screen.getByRole('link', { name: /create note/i });
    expect(cta.getAttribute('href')).toBe('/note/new');
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

  it('lets the dashboard top bar own the native safe area spacing', () => {
    renderLayout('/dashboard');

    expect(screen.getByRole('main')).not.toHaveClass('safe-area-top');
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

  it('widens the desktop content shell on settings routes', () => {
    renderLayout('/settings');

    expect(getMainContentWidthWrapper()).toHaveClass('lg:max-w-none');
    expect(getMainContentWidthWrapper()).not.toHaveClass('lg:max-w-5xl');
  });

  it('widens the desktop content shell on guide routes', () => {
    renderLayout('/guide/guide-7');

    expect(getMainContentWidthWrapper()).toHaveClass('lg:max-w-none');
    expect(getMainContentWidthWrapper()).not.toHaveClass('lg:max-w-5xl');
  });

  it('keeps the standard desktop content shell on non-settings routes', () => {
    renderLayout('/dashboard');

    expect(getMainContentWidthWrapper()).toHaveClass('lg:max-w-5xl');
    expect(getMainContentWidthWrapper()).not.toHaveClass('lg:max-w-none');
  });

  it('applies the desktop sidebar width as the main content offset', () => {
    render(
      <MemoryRouter initialEntries={['/classes']}>
        <AuthContext.Provider value={{ isLoggedIn: true }}>
          <UIContext.Provider value={{
            hideBottomNav: false,
            showBottomNav: vi.fn(),
            hideNav: vi.fn(),
            navCollapsed: false,
            navWidth: 280,
            toggleNav: vi.fn(),
            setNavCollapsed: vi.fn(),
            setNavWidth: vi.fn(),
            drawerOpen: false,
            toggleDrawer: vi.fn(),
            closeDrawer: vi.fn(),
            notifPanelOpen: false,
            toggleNotifPanel: vi.fn(),
            closeNotifPanel: vi.fn(),
            studyMode: null,
            setStudyMode: vi.fn(),
            clearStudyMode: vi.fn(),
          }}>
            <Layout>
              <div>Page Body</div>
            </Layout>
          </UIContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole('main').parentElement).toHaveStyle({ marginLeft: '280px' });
  });

  it('uses the compact expanded width as the main content offset', () => {
    render(
      <StatefulLayoutHarness initialWidth={COMPACT_NAV_WIDTH} />
    );

    expect(screen.getByRole('main').parentElement).toHaveStyle({ marginLeft: `${COMPACT_NAV_WIDTH}px` });
  });

  it('uses the collapsed width as the main content offset', () => {
    render(
      <StatefulLayoutHarness initialCollapsed initialWidth={280} />
    );

    expect(screen.getByRole('main').parentElement).toHaveStyle({ marginLeft: `${COLLAPSED_NAV_WIDTH}px` });
  });

  it('restores the remembered expanded width when re-expanding with the button', () => {
    render(
      <StatefulLayoutHarness initialCollapsed initialWidth={286} />
    );

    fireEvent.click(screen.getByLabelText('Expand sidebar'));

    expect(screen.getByRole('main').parentElement).toHaveStyle({ marginLeft: '286px' });
  });

  it('resolves a drag below the collapse threshold to the collapsed state', () => {
    expect(resolveSidebarDragState(120)).toEqual({
      collapsed: true,
      width: COMPACT_NAV_WIDTH,
    });
  });

  it('resolves a drag outward from collapsed to the compact expanded width', () => {
    expect(resolveSidebarDragState(140)).toEqual({
      collapsed: false,
      width: COMPACT_NAV_WIDTH,
    });
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
