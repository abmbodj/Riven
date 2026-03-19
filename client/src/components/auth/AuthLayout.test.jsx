import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AuthLayout from './AuthLayout.jsx';

describe('AuthLayout', () => {
  it('extends its own background into the top safe area', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout title="Log in" subtitle="Welcome back." showBackLink>
          <div>Auth content</div>
        </AuthLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('safe-area-top-owned');
  });
});
