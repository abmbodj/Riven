import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Messages from './Messages.jsx';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    user: { id: 99, username: 'Avery' },
    socket: null,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../components/ui/ReportModal', () => ({
  default: () => null,
}));

vi.mock('../components/FileViewer', () => ({
  default: () => null,
}));

vi.mock('../api/authApi', () => ({
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  getUserProfile: vi.fn(),
  sendMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  acceptSharedDeck: vi.fn(),
  reportContent: vi.fn(),
}));

const authApi = await import('../api/authApi');

describe('Messages desktop workspace', () => {
  it('shows conversations alongside the active chat thread', async () => {
    authApi.getConversations.mockResolvedValue([
      {
        userId: 21,
        username: 'Bianca',
        avatar: null,
        unreadCount: 1,
        lastMessage: 'See you in lab',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'text',
        isOwnMessage: false,
      },
      {
        userId: 33,
        username: 'Marcus',
        avatar: null,
        unreadCount: 0,
        lastMessage: 'Deck looks good',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'text',
        isOwnMessage: true,
      },
    ]);
    authApi.getMessages.mockResolvedValue([
      {
        id: 1,
        isMine: false,
        senderAvatar: null,
        content: 'See you in lab',
        created_at: new Date().toISOString(),
      },
    ]);
    authApi.getUserProfile.mockResolvedValue({
      id: 21,
      username: 'Bianca',
      avatar: null,
    });

    render(
      <MemoryRouter initialEntries={['/messages/21']}>
        <Routes>
          <Route path="/messages/:userId" element={<Messages />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
    expect(screen.getByText('Marcus')).toBeInTheDocument();
    expect(screen.getAllByText('See you in lab').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Search conversations'), {
      target: { value: 'Marcus' },
    });

    await waitFor(() => {
      expect(screen.getByText('Marcus')).toBeInTheDocument();
      expect(screen.queryAllByText('Bianca').length).toBe(1);
    });

    fireEvent.change(screen.getByLabelText('Search conversations'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: /show unread/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
      expect(screen.queryByText('Marcus')).not.toBeInTheDocument();
    });
  });
});
