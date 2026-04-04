import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MobileBottomNav from './MobileBottomNav.jsx';

vi.mock('../routes/config.jsx', () => ({
  prefetchRoute: vi.fn(),
  routes: [],
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

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
  const onFabPress = overrides.onFabPress ?? vi.fn();

  render(
    <MemoryRouter initialEntries={[pathname]}>
      <MobileBottomNav
        primaryNavItems={primaryNavItems}
        onFabPress={onFabPress}
      />
    </MemoryRouter>
  );

  return { onFabPress };
}

describe('MobileBottomNav default nav', () => {
  it('renders primary nav links', () => {
    renderMobileBottomNav();
    expect(screen.getByRole('link', { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /study/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /classes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument();
  });

  it('calls onFabPress when the FAB button is tapped', () => {
    const { onFabPress } = renderMobileBottomNav();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onFabPress).toHaveBeenCalledTimes(1);
  });
});

describe('MobileBottomNav study mode', () => {
    const mockStudyMode = {
        currentIndex: 1,
        totalSections: 5,
        onSections: vi.fn(),
        onDetails: vi.fn(),
        onNote: vi.fn(),
        onPrev: vi.fn(),
        onNext: vi.fn(),
        canPrev: true,
        canNext: true,
    };

    function renderStudyNav(studyMode = mockStudyMode) {
        return render(
            <MemoryRouter>
                <MobileBottomNav
                    primaryNavItems={[]}
                    onFabPress={vi.fn()}
                    studyMode={studyMode}
                />
            </MemoryRouter>
        );
    }

    it('renders study tabs when studyMode is provided', () => {
        renderStudyNav();
        expect(screen.getByText('Sections')).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.getByText('Note')).toBeInTheDocument();
    });

    it('shows section count in study mode', () => {
        renderStudyNav();
        expect(screen.getByText('2 / 5')).toBeInTheDocument();
    });

    it('calls onSections when Sections tab is tapped', () => {
        renderStudyNav();
        fireEvent.click(screen.getByText('Sections'));
        expect(mockStudyMode.onSections).toHaveBeenCalled();
    });

    it('calls onPrev when prev button is tapped', () => {
        renderStudyNav();
        fireEvent.click(screen.getByLabelText('Previous section'));
        expect(mockStudyMode.onPrev).toHaveBeenCalled();
    });

    it('calls onNext when next button is tapped', () => {
        renderStudyNav();
        fireEvent.click(screen.getByLabelText('Next section'));
        expect(mockStudyMode.onNext).toHaveBeenCalled();
    });

    it('disables prev button when canPrev is false', () => {
        renderStudyNav({ ...mockStudyMode, canPrev: false });
        expect(screen.getByLabelText('Previous section')).toBeDisabled();
    });

    it('does not render study tabs when studyMode is null', () => {
        render(
            <MemoryRouter>
                <MobileBottomNav
                    primaryNavItems={[{ to: '/home', label: 'Home', icon: () => null, matchers: ['/home'] }]}
                    onFabPress={vi.fn()}
                    studyMode={null}
                />
            </MemoryRouter>
        );
        expect(screen.queryByText('Sections')).not.toBeInTheDocument();
    });
});
