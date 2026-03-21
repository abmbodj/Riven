import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Messages from './Messages.jsx';

const toast = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    user: { id: 99, username: 'Avery' },
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => toast,
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
  subscribeToMessages: vi.fn(() => () => {}),
  subscribeToTypingPresence: vi.fn(() => ({
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    unsubscribe: vi.fn(),
  })),
  acceptSharedResource: vi.fn(),
  acceptSharedDeck: vi.fn(),
  reportContent: vi.fn(),
}));

const authApi = await import('../api/authApi');

describe('Messages desktop workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

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
        createdAt: new Date().toISOString(),
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

    const activeThreadShell = screen.getByText('Replying to Bianca').closest('.safe-area-top-owned');
    expect(activeThreadShell).not.toBeNull();
    expect(activeThreadShell.className).toContain('h-[calc(var(--app-height)-env(safe-area-inset-top,0px))]');
    expect(activeThreadShell.className).not.toContain('h-[calc(100dvh-4rem)]');
    expect(activeThreadShell.style.backgroundImage).toContain('radial-gradient');

    const scrollContainer = activeThreadShell.querySelector('.scroll-container');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer.style.backgroundImage).toBe('');

    expect(authApi.subscribeToTypingPresence).toHaveBeenCalledWith(
      99,
      '21',
      expect.objectContaining({
        onTypingChange: expect.any(Function),
      })
    );
    expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
    expect(screen.getByText('Marcus')).toBeInTheDocument();
    expect(screen.getAllByText('See you in lab').length).toBeGreaterThan(0);
    expect(screen.getByText('1 message')).toBeInTheDocument();
    expect(screen.getByText('0 shared items')).toBeInTheDocument();
    expect(screen.getByText('Replying to Bianca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach image/i })).toBeInTheDocument();

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

  it('keeps the thread open when the chat profile lookup fails', async () => {
    authApi.getConversations.mockResolvedValue([
      {
        userId: 21,
        username: 'Bianca',
        avatar: null,
        unreadCount: 0,
        lastMessage: 'See you in lab',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'text',
        isOwnMessage: false,
      },
    ]);
    authApi.getMessages.mockResolvedValue([
      {
        id: 1,
        isMine: false,
        senderAvatar: null,
        content: 'See you in lab',
        createdAt: new Date().toISOString(),
      },
    ]);
    authApi.getUserProfile.mockRejectedValue(new Error('RPC missing'));

    render(
      <MemoryRouter initialEntries={['/messages/21']}>
        <Routes>
          <Route path="/messages/:userId" element={<Messages />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Replying to Bianca')).toBeInTheDocument();
    });

    expect(screen.getAllByText('See you in lab').length).toBeGreaterThan(0);
    expect(toast.error).not.toHaveBeenCalledWith('Failed to load messages');
  });

  it('renders shared note cards and swaps to the imported open state after accept', async () => {
    authApi.getConversations.mockResolvedValue([
      {
        userId: 21,
        username: 'Bianca',
        avatar: null,
        unreadCount: 0,
        lastMessage: 'Shared a note: Lab Notes',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'note',
        isOwnMessage: false,
      },
    ]);
    authApi.getMessages.mockResolvedValue([
      {
        id: 7,
        isMine: false,
        senderAvatar: null,
        senderUsername: 'Bianca',
        content: 'Shared a note: Lab Notes',
        messageType: 'note',
        sharedResource: {
          kind: 'note',
          sourceId: 'note-7',
          title: 'Lab Notes',
          previewText: 'ATP synthesis overview',
          cardCount: null,
          acceptedId: null,
        },
        deckData: {
          kind: 'note',
          sourceId: 'note-7',
          title: 'Lab Notes',
          previewText: 'ATP synthesis overview',
          cardCount: null,
          acceptedId: null,
        },
        createdAt: new Date().toISOString(),
      },
    ]);
    authApi.getUserProfile.mockResolvedValue({
      id: 21,
      username: 'Bianca',
      avatar: null,
    });
    authApi.acceptSharedResource.mockResolvedValue({
      kind: 'note',
      resource: {
        id: 'note-copy',
        title: 'Lab Notes',
      },
      messageId: 7,
    });

    render(
      <MemoryRouter initialEntries={['/messages/21']}>
        <Routes>
          <Route path="/messages/:userId" element={<Messages />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /add to notes/i })).toBeInTheDocument();
    expect(screen.getByText('1 shared item')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add to notes/i }));

    await waitFor(() => {
      expect(authApi.acceptSharedResource).toHaveBeenCalledWith(7);
      expect(screen.getByRole('link', { name: /open imported note/i })).toHaveAttribute('href', '/note/note-copy');
    });
  });
});
