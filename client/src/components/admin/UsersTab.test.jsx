import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UsersTab from './UsersTab.jsx';

const haptics = {
  light: vi.fn(),
  medium: vi.fn(),
};

const users = [
  {
    id: 1,
    username: 'owner',
    email: 'owner@example.com',
    role: 'owner',
    subscriptionTier: 'lifetime',
    createdAt: '2026-01-01T12:00:00.000Z',
  },
  {
    id: 2,
    username: 'ada',
    email: 'ada@example.com',
    role: 'admin',
    subscriptionTier: 'supporter',
    createdAt: '2026-02-01T12:00:00.000Z',
  },
  {
    id: 3,
    username: 'bea',
    email: 'bea@example.com',
    role: 'friends',
    subscriptionTier: 'lifetime',
    createdAt: '2026-03-01T12:00:00.000Z',
  },
  {
    id: 4,
    username: 'cal',
    email: 'cal@example.com',
    role: 'user',
    subscriptionTier: 'free',
    createdAt: '2026-04-01T12:00:00.000Z',
  },
];

function renderUsers(overrides = {}) {
  return render(
    <UsersTab
      users={users}
      setUsers={vi.fn()}
      onDelete={vi.fn()}
      isOwner
      onRoleChange={vi.fn().mockResolvedValue(undefined)}
      toast={{ error: vi.fn() }}
      haptics={haptics}
      {...overrides}
    />
  );
}

describe('UsersTab', () => {
  it('filters users by role and search term', () => {
    renderUsers();

    fireEvent.click(screen.getByRole('button', { name: /admins/i }));

    expect(screen.getByText('ada')).toBeInTheDocument();
    expect(screen.queryByText('cal')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search users/i), {
      target: { value: 'missing' },
    });

    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
  });

  it('calls owner role actions with the selected target role', async () => {
    const onRoleChange = vi.fn().mockResolvedValue(undefined);
    const setUsers = vi.fn();

    renderUsers({
      users: [users[3]],
      onRoleChange,
      setUsers,
    });

    fireEvent.click(screen.getByRole('button', { name: /promote/i }));

    await waitFor(() => {
      expect(onRoleChange).toHaveBeenCalledWith(4, 'admin');
      expect(setUsers).toHaveBeenCalled();
    });
  });
});
