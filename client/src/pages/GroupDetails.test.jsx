import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupDetails from './GroupDetails.jsx';
import { getVisibleMonthRange } from '../components/groups/groupScheduleUtils.js';

const {
  mockToast,
  mockHaptics,
  storageBucket,
  supabaseFromMock,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
  },
  mockHaptics: {
    light: vi.fn(),
    medium: vi.fn(),
  },
  storageBucket: {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
  },
  supabaseFromMock: vi.fn(),
}));

vi.mock('motion/react', () => {
  const createMotionComponent = (tag) => React.forwardRef(
    ({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)
  );

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: new Proxy({}, {
      get: (_, tag) => createMotionComponent(tag),
    }),
  };
});

vi.mock('../api', () => ({
  api: {
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    getGroupDecks: vi.fn(),
    getGroupFolders: vi.fn(),
    getGroupFiles: vi.fn(),
    getGroupScheduleCalendar: vi.fn(),
    setGroupScheduleShare: vi.fn(),
    createGroupMeetup: vi.fn(),
    joinGroupMeetup: vi.fn(),
    leaveGroupMeetup: vi.fn(),
    cancelGroupMeetup: vi.fn(),
    listJoinedGroupMeetups: vi.fn(),
    uploadGroupFile: vi.fn(),
    generateAiDeck: vi.fn(),
  },
}));

vi.mock('../api/authApi', () => ({
  subscribeToGroupMeetupEvents: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => mockHaptics,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      is_banned: false,
    },
  }),
}));

vi.mock('../hooks/useGSAP', () => ({
  useGSAP: () => ({ container: { current: null } }),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/ReportModal', () => ({
  default: () => null,
}));

vi.mock('../components/FileViewer', () => ({
  default: () => null,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    storage: {
      from: (...args) => supabaseFromMock(...args),
    },
  },
}));

const { api } = await import('../api');
const authApi = await import('../api/authApi');

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const renderGroupDetails = () => render(
  <MemoryRouter initialEntries={['/groups/group-1']}>
    <Routes>
      <Route path="/groups/:id" element={<GroupDetails />} />
      <Route path="/groups/:id/cram/:sessionId" element={<div>Cram Page</div>} />
    </Routes>
  </MemoryRouter>
);

describe('GroupDetails upload flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1712345678901);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    api.getGroupInfo.mockResolvedValue({
      id: 'group-1',
      name: 'Biology Lab',
      join_code: 'RIV-ABC',
      my_role: 'admin',
      class_id: 'class-1',
    });
    api.getGroupMembers.mockResolvedValue([]);
    api.getGroupDecks.mockResolvedValue([]);
    api.getGroupFolders.mockResolvedValue([]);
    api.getGroupFiles.mockResolvedValue([]);
    api.getGroupScheduleCalendar.mockResolvedValue({
      my_share_mode: null,
      members: [],
      schedule_slots: [],
      meetups: [],
    });
    api.setGroupScheduleShare.mockResolvedValue({ visibility_mode: 'busy_free' });
    api.createGroupMeetup.mockResolvedValue({ id: 'meetup-1' });
    api.joinGroupMeetup.mockResolvedValue({ status: 'joined' });
    api.leaveGroupMeetup.mockResolvedValue({ status: 'left' });
    api.cancelGroupMeetup.mockResolvedValue({ status: 'cancelled' });
    api.listJoinedGroupMeetups.mockResolvedValue([]);
    api.uploadGroupFile.mockResolvedValue({
      id: 'file-1',
      name: 'Chapter 1 Notes.pdf',
      file_url: 'https://supabase.test/storage/v1/object/public/group-files/group-1/root/1712345678901_lecture_notes.pdf',
      file_type: 'pdf',
      folder_id: null,
    });
    api.generateAiDeck.mockResolvedValue({
      deck_id: 'deck-1',
      card_count: 12,
    });
    authApi.subscribeToGroupMeetupEvents.mockReturnValue(() => {});

    storageBucket.upload.mockResolvedValue({ error: null });
    storageBucket.getPublicUrl.mockReturnValue({
      data: {
        publicUrl: 'https://supabase.test/storage/v1/object/public/group-files/group-1/root/1712345678901_lecture_notes.pdf',
      },
    });
    supabaseFromMock.mockReturnValue(storageBucket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads directly from the form without showing the flashcard prompt', async () => {
    const uploadRequest = createDeferred();
    storageBucket.upload.mockReturnValueOnce(uploadRequest.promise);

    const { container } = renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /resources/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /upload file/i })[0]);

    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1 Notes'), {
      target: { value: 'Chapter 1 Notes' },
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['pdf-data'], 'lecture notes.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    const uploadForm = screen.getByPlaceholderText('e.g. Chapter 1 Notes').closest('form');
    fireEvent.submit(uploadForm);

    expect(await screen.findByText('Uploading File...')).toBeInTheDocument();
    expect(screen.queryByText('Generate Flashcards?')).not.toBeInTheDocument();
    expect(api.generateAiDeck).not.toHaveBeenCalled();

    await act(async () => {
      uploadRequest.resolve({ error: null });
      await uploadRequest.promise;
    });

    await waitFor(() => {
      expect(storageBucket.upload).toHaveBeenCalledWith(
        'group-1/root/1712345678901_lecture_notes.pdf',
        file,
        expect.objectContaining({
          cacheControl: '3600',
          upsert: false,
        })
      );
    });

    expect(storageBucket.getPublicUrl).toHaveBeenCalledWith('group-1/root/1712345678901_lecture_notes.pdf');

    await waitFor(() => {
      expect(api.uploadGroupFile).toHaveBeenCalledWith('group-1', {
        name: 'Chapter 1 Notes.pdf',
        file_url: 'https://supabase.test/storage/v1/object/public/group-files/group-1/root/1712345678901_lecture_notes.pdf',
        file_type: 'pdf',
        folder_id: null,
      });
    });
  });

  it('returns to the form and shows an error toast when upload fails', async () => {
    storageBucket.upload.mockResolvedValueOnce({
      error: new Error('Storage blew up'),
    });

    const { container } = renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /resources/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /upload file/i })[0]);

    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1 Notes'), {
      target: { value: 'Chapter 1 Notes' },
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['pdf-data'], 'lecture notes.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    const uploadForm = screen.getByPlaceholderText('e.g. Chapter 1 Notes').closest('form');
    fireEvent.submit(uploadForm);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Storage blew up');
    });

    expect(api.generateAiDeck).not.toHaveBeenCalled();
    expect(api.uploadGroupFile).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('e.g. Chapter 1 Notes')).toBeInTheDocument();
    expect(screen.queryByText('Uploading File...')).not.toBeInTheDocument();
  });

  it('proposes a meetup without creating or navigating into a cram session', async () => {
    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /propose session/i })[0]);
    expect(screen.getByRole('dialog', { name: /pick the time/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByPlaceholderText(/organic chemistry problem set/i), {
      target: { value: 'Chapter 5 review' },
    });

    fireEvent.change(screen.getByPlaceholderText(/library east, room 202/i), {
      target: { value: 'Library East' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() => {
      expect(api.createGroupMeetup).toHaveBeenCalledWith(
        'group-1',
        expect.objectContaining({
          topic: 'Chapter 5 review',
          location_label: 'Library East',
        }),
      );
    });

    expect(api.joinGroupMeetup).not.toHaveBeenCalled();
    expect(screen.queryByText('Cram Page')).not.toBeInTheDocument();
    expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
  });

  it('renders a month calendar by default and requests the visible month range', async () => {
    const now = new Date();
    const expectedRange = getVisibleMonthRange(now);
    const expectedMonthLabel = new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(now);

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(api.getGroupScheduleCalendar).toHaveBeenCalledWith('group-1', expectedRange.start, expectedRange.end);
    });

    expect(screen.getAllByRole('grid', { name: /monthly calendar/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(expectedMonthLabel).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab', { name: /month/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab', { name: /week/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab', { name: /day/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Rolling Week')).not.toBeInTheDocument();
    expect(screen.queryByText('Next 7 Days')).not.toBeInTheDocument();
  });

  it('updates the selected-day surface when a calendar day is tapped', async () => {
    const now = new Date();
    const targetDay = Math.min(now.getDate() + 2, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    const targetStart = new Date(now.getFullYear(), now.getMonth(), targetDay, 16, 30, 0, 0);
    const targetEnd = new Date(targetStart.getTime() + (60 * 60 * 1000));
    const targetLabel = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(targetStart);

    api.getGroupScheduleCalendar.mockResolvedValueOnce({
      my_share_mode: 'busy_free',
      members: [],
      schedule_slots: [],
      meetups: [
        {
          id: 'meetup-calendar-tap',
          topic: 'Calendar redesign session',
          start_at: targetStart.toISOString(),
          end_at: targetEnd.toISOString(),
          status: 'scheduled',
          attendee_count: 2,
          attendees: [],
          attendee_ids: ['user-1', 'user-2'],
          is_joined: true,
          is_creator: false,
        },
      ],
    });

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByTestId('group-schedule-hub').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    const monthGrid = within(primaryHub).getByRole('grid', { name: /monthly calendar/i });
    const daySurface = within(primaryHub).getByTestId('group-schedule-day-surface');
    const targetCell = within(monthGrid).getAllByRole('gridcell').find((cell) => (
      cell.getAttribute('aria-label')?.includes(targetLabel)
    ));

    expect(targetCell).toBeTruthy();
    fireEvent.click(targetCell);

    expect(await within(daySurface).findByText('Calendar redesign session')).toBeInTheDocument();
    expect(within(daySurface).getByText(targetLabel)).toBeInTheDocument();
  });

  it('keeps the meetup composer open and shows an error when creating a meetup fails', async () => {
    api.createGroupMeetup.mockRejectedValueOnce(new Error('Create failed'));

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /propose session/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByPlaceholderText(/organic chemistry problem set/i), {
      target: { value: 'Chapter 8 review' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    expect(await screen.findByText('Create failed')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /add the details/i })).toBeInTheDocument();
  });

  it('keeps group schedule actions while using the shared calendar shell', async () => {
    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    const scheduleScroll = screen.getByTestId('group-schedule-scroll');
    expect(scheduleScroll).toHaveClass('flex-1');
    expect(scheduleScroll).toHaveClass('min-h-0');
    expect(scheduleScroll).toHaveClass('overflow-y-auto');

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    expect(within(primaryHub).getByRole('grid', { name: /monthly calendar/i })).toBeInTheDocument();

    fireEvent.click(within(primaryHub).getByRole('button', { name: /busy\/free/i }));

    await waitFor(() => {
      expect(api.setGroupScheduleShare).toHaveBeenCalledWith('group-1', 'busy_free');
    });

    fireEvent.click(within(primaryHub).getAllByRole('button', { name: /propose/i })[0]);
    expect(screen.getByRole('dialog', { name: /pick the time/i })).toBeInTheDocument();
  });

  it('does not surface hidden member schedule slots in the shared calendar', async () => {
    api.getGroupScheduleCalendar.mockResolvedValueOnce({
      my_share_mode: null,
      members: [
        {
          id: 'hidden-user',
          username: 'hidden',
          display_name: 'Hidden Member',
          share_mode: 'hidden',
        },
      ],
      schedule_slots: [
        {
          id: 'hidden-slot',
          user_id: 'hidden-user',
          member_name: 'Hidden Member',
          day_of_week: new Date().getDay(),
          start_time: '10:00',
          end_time: '11:00',
          visibility_mode: 'hidden',
          class_name: 'Secret Class',
        },
      ],
      meetups: [],
    });

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByTestId('group-schedule-hub').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    expect(within(primaryHub).queryByText('Hidden Member')).not.toBeInTheDocument();
    expect(within(primaryHub).queryByText('Secret Class')).not.toBeInTheDocument();
  });

  it('does not surface archived class-linked schedule slots in the shared calendar', async () => {
    api.getGroupScheduleCalendar.mockResolvedValueOnce({
      my_share_mode: 'full',
      members: [
        {
          id: 'active-user',
          username: 'active',
          display_name: 'Active Member',
          share_mode: 'full',
        },
      ],
      schedule_slots: [
        {
          id: 'active-slot',
          user_id: 'active-user',
          member_name: 'Active Member',
          day_of_week: new Date().getDay(),
          start_time: '09:00',
          end_time: '10:00',
          visibility_mode: 'full',
          class_name: 'Visible Class',
          class_is_archived: false,
        },
        {
          id: 'archived-slot',
          user_id: 'active-user',
          member_name: 'Active Member',
          day_of_week: new Date().getDay(),
          start_time: '11:00',
          end_time: '12:00',
          visibility_mode: 'full',
          class_name: 'Archived Class',
          class_is_archived: true,
        },
      ],
      meetups: [],
    });

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByTestId('group-schedule-hub').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    expect(within(primaryHub).getByText('Visible Class')).toBeInTheDocument();
    expect(within(primaryHub).queryByText('Archived Class')).not.toBeInTheDocument();
  });
});
