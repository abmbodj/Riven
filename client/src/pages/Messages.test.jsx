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

vi.mock('../utils/dmCache', () => ({
    dmCache: {
        getThread: vi.fn(() => []),
        getUser: vi.fn(() => null),
        getConversations: vi.fn(() => null),
    hydrate: vi.fn(() => Promise.resolve()),
    setThread: vi.fn(),
    setUser: vi.fn(),
    setConversations: vi.fn(),
    invalidateConversations: vi.fn(),
  },
}));

vi.mock('../api/authApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  getUserProfile: vi.fn(),
  uploadMessageImage: vi.fn(),
  sendMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  subscribeToMessages: vi.fn((_userId, callbacks) => {
    callbacks?.onSubscribed?.();
    return () => {};
  }),
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
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:attachment-preview'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });
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
      expect(screen.getAllByText('Conversations').length).toBeGreaterThan(0);
    });

    const activeThreadShell = screen.getAllByTestId('messages-thread-shell').at(-1);
    expect(activeThreadShell).not.toBeNull();
    expect(activeThreadShell.className).not.toContain('safe-area-top-owned');
    expect(activeThreadShell.style.backgroundImage).toContain('radial-gradient');

    const scrollContainer = screen.getAllByTestId('messages-scroll-container').at(-1);
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer.style.backgroundImage).toBe('');
    expect(Number.parseInt(scrollContainer.style.paddingBottom, 10)).toBeGreaterThanOrEqual(16);
    expect(screen.getAllByTestId('messages-composer-dock').length).toBeGreaterThan(0);

    expect(authApi.subscribeToTypingPresence).toHaveBeenCalledWith(
      99,
      '21',
      expect.objectContaining({
        onTypingChange: expect.any(Function),
      })
    );
    expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marcus').length).toBeGreaterThan(0);
    expect(screen.getAllByText('See you in lab').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 message').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 shared').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /attach image/i }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByLabelText('Search conversations').at(-1), {
      target: { value: 'Marcus' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Marcus').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getAllByLabelText('Search conversations').at(-1), {
      target: { value: '' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: /show unread/i }).at(-1));

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
      expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
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

    const addButtons = await screen.findAllByRole('button', { name: /add to notes/i });
    expect(addButtons.length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 shared').length).toBeGreaterThan(0);

    fireEvent.click(addButtons.at(-1));

    await waitFor(() => {
      expect(authApi.acceptSharedResource).toHaveBeenCalledWith(7);
      expect(screen.getAllByRole('link', { name: /open imported note/i }).at(-1)).toHaveAttribute('href', '/note/note-copy');
    });
  });

  it('selects an image attachment and sends it through storage before creating the message', async () => {
    authApi.getConversations.mockResolvedValue([
      {
        userId: 21,
        username: 'Bianca',
        avatar: null,
        unreadCount: 0,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'text',
        isOwnMessage: false,
      },
    ]);
    authApi.getMessages.mockResolvedValue([]);
    authApi.getUserProfile.mockResolvedValue({ id: 21, username: 'Bianca', avatar: null });
    authApi.uploadMessageImage.mockResolvedValue({ path: '99/21/photo.png' });
    authApi.sendMessage.mockResolvedValue({
      id: 22,
      isMine: true,
      senderId: 99,
      receiverId: 21,
      content: '',
      messageType: 'text',
      imagePath: '99/21/photo.png',
      imageUrl: 'https://signed.example/photo.png',
      createdAt: new Date().toISOString(),
    });

    render(
      <MemoryRouter initialEntries={['/messages/21']}>
        <Routes>
          <Route path="/messages/:userId" element={<Messages />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
    });

    const image = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs.item(fileInputs.length - 1), {
      target: { files: [image] },
    });

    expect((await screen.findAllByAltText('Attachment preview')).at(-1)).toHaveAttribute('src', 'blob:attachment-preview');

    fireEvent.click(screen.getAllByRole('button', { name: /send message/i }).at(-1));

    await waitFor(() => {
      expect(authApi.uploadMessageImage).toHaveBeenCalledWith('21', image, { id: 99, username: 'Avery' });
      expect(authApi.sendMessage).toHaveBeenCalledWith(
        '21',
        '',
        'text',
        null,
        null,
        { id: 99, username: 'Avery' },
        null,
        '99/21/photo.png',
      );
    });
  });

  it('shows the specific send error returned by the message API', async () => {
    authApi.getConversations.mockResolvedValue([
      {
        userId: 21,
        username: 'Bianca',
        avatar: null,
        unreadCount: 0,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'text',
        isOwnMessage: false,
      },
    ]);
    authApi.getMessages.mockResolvedValue([]);
    authApi.getUserProfile.mockResolvedValue({ id: 21, username: 'Bianca', avatar: null });
    authApi.sendMessage.mockRejectedValue(new Error('You cannot message this user.'));

    render(
      <MemoryRouter initialEntries={['/messages/21']}>
        <Routes>
          <Route path="/messages/:userId" element={<Messages />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Bianca').length).toBeGreaterThan(0);
    });
    fireEvent.change(screen.getAllByLabelText('Message input').at(-1), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /send message/i }).at(-1));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('You cannot message this user.');
    });
  });

  it('renders image-only messages with a visible attachment frame', async () => {
    authApi.getConversations.mockResolvedValue([
      {
        userId: 21,
        username: 'Bianca',
        avatar: null,
        unreadCount: 0,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        lastMessageType: 'text',
        isOwnMessage: false,
      },
    ]);
    authApi.getMessages.mockResolvedValue([
      {
        id: 9,
        isMine: false,
        senderAvatar: null,
        senderUsername: 'Bianca',
        content: '',
        messageType: 'text',
        imagePath: '21/99/photo.png',
        imageUrl: 'https://signed.example/photo.png',
        createdAt: new Date().toISOString(),
      },
    ]);
    authApi.getUserProfile.mockResolvedValue({ id: 21, username: 'Bianca', avatar: null });

    render(
      <MemoryRouter initialEntries={['/messages/21']}>
        <Routes>
          <Route path="/messages/:userId" element={<Messages />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByRole('button', { name: /view attached image/i })).length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Attached').at(-1)).toHaveAttribute('src', 'https://signed.example/photo.png');
    expect(screen.queryAllByText(/image unavailable/i)).toHaveLength(0);
  });
});
