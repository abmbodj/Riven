import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Layout from './Layout.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { UIContext } from '../context/UIContext.jsx';

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

function renderLayout(pathname = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuthContext.Provider value={{ isLoggedIn: true }}>
        <UIContext.Provider value={{ hideBottomNav: false }}>
          <Layout>
            <div>Page Body</div>
          </Layout>
        </UIContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Layout primary navigation', () => {
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
});
