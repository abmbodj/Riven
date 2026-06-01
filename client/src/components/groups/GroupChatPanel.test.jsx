import { render, screen } from '@testing-library/react';
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
  sendGroupMessage: vi.fn(),
  editGroupMessage: vi.fn(),
  deleteGroupMessage: vi.fn(),
}));

const authApi = await import('../../api/authApi');

describe('GroupChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.getGroupMessages.mockResolvedValue([
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
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('anchors the timestamp to the last message in a sender run', async () => {
    render(
      <GroupChatPanel
        groupId="group-1"
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
});
