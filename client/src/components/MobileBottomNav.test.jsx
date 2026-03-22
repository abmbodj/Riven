import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MobileBottomNav from './MobileBottomNav.jsx';

function DummyIcon(props) {
  return <svg aria-hidden="true" {...props} />;
}

const primaryNavItems = [
  { to: '/dashboard', icon: DummyIcon, label: 'Today', matchers: ['/dashboard'] },
  { to: '/decks', icon: DummyIcon, label: 'Study', matchers: ['/decks'] },
  { id: 'fab', isFab: true },
  { to: '/classes', icon: DummyIcon, label: 'Classes', matchers: ['/classes'] },
  { to: '/groups', icon: DummyIcon, label: 'Groups', matchers: ['/groups'] },
];

function renderMobileBottomNav(pathname = '/dashboard', overrides = {}) {
  const onOpenCommandPalette = overrides.onOpenCommandPalette ?? vi.fn();

  render(
    <MemoryRouter initialEntries={[pathname]}>
      <MobileBottomNav
        primaryNavItems={primaryNavItems}
        onOpenCommandPalette={onOpenCommandPalette}
      />
    </MemoryRouter>
  );

  return { onOpenCommandPalette };
}

describe('MobileBottomNav quick actions', () => {
  it('opens and closes the quick actions menu from the center FAB', async () => {
    renderMobileBottomNav();

    const fabToggle = screen.getByRole('button', { name: 'Open quick actions' });

    expect(fabToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();

    fireEvent.click(fabToggle);

    expect(await screen.findByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Garden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Themes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open quick actions' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    });
  });

  it('closes the menu and opens the command palette from Search', async () => {
    const { onOpenCommandPalette } = renderMobileBottomNav();

    fireEvent.click(screen.getByRole('button', { name: 'Open quick actions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Search' }));

    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open quick actions' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    });
  });
});
