import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupChatPanel from './GroupChatPanel.jsx';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 80 })),
    getTotalSize: () => count * 80,
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
  }),
}));

vi.mock('../../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    heavy: vi.fn(),
  }),
}));

vi.mock('../Avatar', () => ({
  default: ({ src }) => <div data-testid="avatar">{src || 'avatar'}</div>,
}));

vi.mock('../../api/authApi', () => ({
  getGroupMessages: vi.fn(),
  subscribeToGroupMessages: vi.fn(() => () => {}),
  subscribeToGroupTypingPresence: vi.fn(() => ({
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    unsubscribe: vi.fn(),
  })),
  sendGroupMessage: vi.fn(),
  editGroupMessage: vi.fn(),
  deleteGroupMessage: vi.fn(),
}));

const authApi = await import('../../api/authApi');

describe('GroupChatPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    authApi.subscribeToGroupMessages.mockReturnValue(() => {});
    authApi.subscribeToGroupTypingPresence.mockReturnValue({
      startTyping: vi.fn(),
      stopTyping: vi.fn(),
      unsubscribe: vi.fn(),
    });
    authApi.getGroupMessages.mockResolvedValue([
      {
        id: 'm2',
        senderId: 9,
        senderUsername: 'ab',
        senderDisplayName: 'ab',
        senderAvatar: 'avatar-a',
        content: 'nvm',
        createdAt: '2026-06-01T17:01:00',
        isMine: false,
        isEdited: false,
      },
      {
        id: 'm1',
        senderId: 9,
        senderUsername: 'ab',
        senderDisplayName: 'ab',
        senderAvatar: 'avatar-a',
        content: 'okay?',
        createdAt: '2026-06-01T17:00:00',
        isMine: false,
        isEdited: false,
      },
    ]);
    authApi.sendGroupMessage.mockResolvedValue({
      id: 'saved-message',
      senderId: 42,
      senderUsername: 'me',
      senderDisplayName: 'me',
      senderAvatar: 'avatar-me',
      content: 'sent',
      createdAt: '2026-06-01T17:03:00',
      isMine: true,
      isEdited: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('anchors the timestamp to the last message in a sender run', async () => {
    render(
      <GroupChatPanel
        groupId="group-timestamp"
        currentUserId={42}
        members={[{ id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' }]}
      />
    );

    const firstMessage = await screen.findByText('okay?');
    const secondMessage = await screen.findByText('nvm');
    const firstRow = firstMessage.closest('div.flex.items-end.gap-2.mb-1');
    const secondRow = secondMessage.closest('div.flex.items-end.gap-2.mb-1');
    const firstTime = new Date('2026-06-01T17:00:00').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const secondTime = new Date('2026-06-01T17:01:00').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    expect(firstRow).not.toBeNull();
    expect(secondRow).not.toBeNull();
    expect(firstRow).not.toHaveTextContent(firstTime);
    expect(secondRow).toHaveTextContent(secondTime);
    expect(screen.getAllByText(secondTime)).toHaveLength(1);
  });

  it('shows a skeleton (not a blank spinner) during a cold load', async () => {
    authApi.getGroupMessages.mockReturnValue(new Promise(() => {})); // never resolves

    const { container } = render(
      <GroupChatPanel
        groupId="group-skeleton"
        currentUserId={42}
        members={[{ id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' }]}
      />
    );

    // Skeleton placeholder rows render while loading; composer stays usable.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);
    expect(screen.getByPlaceholderText(/message the group/i)).toBeInTheDocument();
  });

  it('renders newest-first API results chronologically', async () => {
    render(
      <GroupChatPanel
        groupId="group-ordering"
        currentUserId={42}
        members={[{ id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' }]}
      />
    );

    const older = await screen.findByText('okay?');
    const newer = await screen.findByText('nvm');

    expect(older.compareDocumentPosition(newer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('loads older pages without breaking chronological order', async () => {
    const latestPage = [
      {
        id: 'm2',
        senderId: 9,
        senderUsername: 'ab',
        senderDisplayName: 'ab',
        senderAvatar: 'avatar-a',
        content: 'newer',
        createdAt: '2026-06-01T17:05:00',
        isMine: false,
        isEdited: false,
      },
      ...Array.from({ length: 49 }, (_, index) => ({
        id: `filler-${index}`,
        senderId: 9,
        senderUsername: 'ab',
        senderDisplayName: 'ab',
        senderAvatar: 'avatar-a',
        content: `filler ${index}`,
        createdAt: `2026-06-01T17:${String(6 + index).padStart(2, '0')}:00`,
        isMine: false,
        isEdited: false,
      })),
    ];

    authApi.getGroupMessages
      .mockResolvedValueOnce(latestPage)
      .mockResolvedValueOnce([
        {
          id: 'm1',
          senderId: 9,
          senderUsername: 'ab',
          senderDisplayName: 'ab',
          senderAvatar: 'avatar-a',
          content: 'older',
          createdAt: '2026-06-01T17:00:00',
          isMine: false,
          isEdited: false,
        },
      ]);

    const { container } = render(
      <GroupChatPanel
        groupId="group-older"
        currentUserId={42}
        members={[{ id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' }]}
      />
    );

    const newer = await screen.findByText('newer');
    const scrollContainer = container.querySelector('.overflow-y-auto');

    await act(async () => {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 0 } });
      await Promise.resolve();
    });

    const older = await screen.findByText('older');
    expect(older.compareDocumentPosition(newer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(authApi.getGroupMessages).toHaveBeenLastCalledWith('group-older', { before: 'm2' });
  });

  it('renders cached messages immediately before the refresh resolves', async () => {
    const { unmount } = render(
      <GroupChatPanel
        groupId="group-cache"
        currentUserId={77}
        members={[{ id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' }]}
      />
    );

    await screen.findByText('okay?');
    unmount();

    authApi.getGroupMessages.mockReturnValue(new Promise(() => {}));

    render(
      <GroupChatPanel
        groupId="group-cache"
        currentUserId={77}
        members={[{ id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' }]}
      />
    );

    expect(screen.getByText('okay?')).toBeInTheDocument();
    expect(screen.queryByText(/no messages yet/i)).not.toBeInTheDocument();
  });

  it('keeps realtime inserts, updates, deletes, and cache chronologically correct', async () => {
    const { unmount } = render(
      <GroupChatPanel
        groupId="group-realtime"
        currentUserId={42}
        members={[
          { id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' },
          { id: 42, username: 'me', display_name: 'me', avatar: 'avatar-me' },
        ]}
      />
    );

    const first = await screen.findByText('okay?');
    const handlers = authApi.subscribeToGroupMessages.mock.calls.at(-1)[2];

    act(() => {
      handlers.onInsert({
        id: 'm3',
        senderId: 42,
        senderUsername: 'me',
        senderDisplayName: 'me',
        senderAvatar: 'avatar-me',
        content: 'later',
        createdAt: '2026-06-01T17:03:00',
        isMine: true,
        isEdited: false,
      });
    });

    const later = await screen.findByText('later');
    expect(first.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    act(() => {
      handlers.onUpdate({
        id: 'm3',
        senderId: 42,
        senderUsername: 'me',
        senderDisplayName: 'me',
        senderAvatar: 'avatar-me',
        content: 'later edited',
        createdAt: '2026-06-01T17:03:00',
        isMine: true,
        isEdited: true,
      });
    });

    expect(await screen.findByText(/later edited/)).toBeInTheDocument();

    act(() => {
      handlers.onDelete('m1');
    });

    await waitFor(() => expect(screen.queryByText('okay?')).not.toBeInTheDocument());
    unmount();

    authApi.getGroupMessages.mockReturnValue(new Promise(() => {}));

    render(
      <GroupChatPanel
        groupId="group-realtime"
        currentUserId={42}
        members={[
          { id: 9, username: 'ab', display_name: 'ab', avatar: 'avatar-a' },
          { id: 42, username: 'me', display_name: 'me', avatar: 'avatar-me' },
        ]}
      />
    );

    expect(screen.getByText(/later edited/)).toBeInTheDocument();
    expect(screen.queryByText('okay?')).not.toBeInTheDocument();
  });

  it('opens the top message menu beside the bubble instead of above it', async () => {
    authApi.getGroupMessages.mockResolvedValue([
      {
        id: 'm1',
        senderId: 42,
        senderUsername: 'me',
        senderDisplayName: 'me',
        senderAvatar: 'avatar-me',
        content: 'top message',
        createdAt: '2026-06-01T17:00:00',
        isMine: true,
        isEdited: false,
      },
    ]);

    const { container } = render(
      <GroupChatPanel
        groupId="group-menu"
        currentUserId={42}
        members={[{ id: 42, username: 'me', display_name: 'me', avatar: 'avatar-me' }]}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /open options for message: top message/i }));

    const editButton = await screen.findByRole('button', { name: 'Edit' });
    const menu = editButton.closest('div.absolute');

    expect(menu).not.toBeNull();
    expect(menu.className).toContain('top-1/2');
    expect(menu.className).toContain('right-full');
    expect(menu.className).not.toContain('bottom-full');
    expect(container).toHaveTextContent('Delete');
  });

  it('shows group typing presence and stops local typing on timeout and send', async () => {
    const startTyping = vi.fn();
    const stopTyping = vi.fn();
    const unsubscribe = vi.fn();
    authApi.subscribeToGroupTypingPresence.mockReturnValue({ startTyping, stopTyping, unsubscribe });

    render(
      <GroupChatPanel
        groupId="group-typing"
        currentUserId={42}
        members={[
          { id: 9, username: 'ab', display_name: 'Avery', avatar: 'avatar-a' },
          { id: 42, username: 'me', display_name: 'me', avatar: 'avatar-me' },
        ]}
      />
    );

    await screen.findByText('okay?');
    vi.useFakeTimers();
    const typingHandlers = authApi.subscribeToGroupTypingPresence.mock.calls.at(-1)[2];

    act(() => {
      typingHandlers.onTypingUsersChange([9]);
    });
    expect(screen.getByText('Avery is typing...')).toBeInTheDocument();

    const composer = screen.getByPlaceholderText(/message the group/i);
    act(() => {
      fireEvent.change(composer, { target: { value: 'sent' } });
    });
    expect(startTyping).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(stopTyping).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.change(composer, { target: { value: 'sent' } });
      fireEvent.keyDown(composer, { key: 'Enter' });
      await Promise.resolve();
    });
    expect(stopTyping).toHaveBeenCalledTimes(2);

    act(() => {
      typingHandlers.onTypingUsersChange([]);
    });
    expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
  });
});
