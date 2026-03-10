import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Layout from './Layout.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { UIContext } from '../context/UIContext.jsx';

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
  it('uses the shared Today/Study/Plan/Social job-based navigation model', () => {
    renderLayout();

    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Study').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Plan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Social').length).toBeGreaterThan(0);
  });
});
