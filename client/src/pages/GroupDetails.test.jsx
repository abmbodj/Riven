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

vi.mock('../api/authApi', async (importOriginal) => ({
  ...(await importOriginal()),
  subscribeToGroupMeetupEvents: vi.fn(),
  getGroupMessages: vi.fn().mockResolvedValue([]),
  subscribeToGroupMessages: vi.fn(() => () => {}),
  subscribeToGroupTypingPresence: vi.fn(() => ({ startTyping: vi.fn(), stopTyping: vi.fn(), unsubscribe: vi.fn() })),
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

const makeMeetup = (overrides = {}) => {
  const now = new Date();
  const start = overrides.start_at ? new Date(overrides.start_at) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 30, 0, 0);
  const end = overrides.end_at ? new Date(overrides.end_at) : new Date(start.getTime() + (60 * 60 * 1000));

  return {
    id: 'meetup-1',
    topic: 'Calendar redesign session',
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    status: 'scheduled',
    attendee_count: 2,
    attendees: [],
    attendee_ids: ['user-1', 'visible-user'],
    is_joined: true,
    is_creator: false,
    ...overrides,
  };
};

const makeSharedSchedule = ({
  date = new Date(),
  myShareMode = 'busy_free',
  members = [],
  availability = [],
  scheduleSlots = [],
  myScheduleSlots = [],
  meetups = [],
} = {}) => {
  const dayOfWeek = date.getDay();

  return {
    my_share_mode: myShareMode,
    members: members.length ? members : [
      {
        id: 'visible-user',
        username: 'visible',
        display_name: 'Visible Member',
        avatar: 'https://cdn.test/visible.png',
        share_mode: 'busy_free',
      },
    ],
    availability: availability.length ? availability : [
      {
        id: 'visible-availability',
        user_id: 'visible-user',
        day_of_week: dayOfWeek,
        hour: 10,
      },
    ],
    my_availability: [
      {
        id: 'my-availability',
        user_id: 'user-1',
        day_of_week: dayOfWeek,
        hour: 10,
      },
    ],
    schedule_slots: scheduleSlots,
    my_schedule_slots: myScheduleSlots,
    meetups,
  };
};

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

    fireEvent.click(screen.getAllByRole('button', { name: /or propose a time/i })[0]);
    expect(screen.getByRole('dialog', { name: /new study session/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/organic chemistry problem set/i), {
      target: { value: 'Chapter 5 review' },
    });

    fireEvent.change(screen.getByPlaceholderText(/library east, room 202/i), {
      target: { value: 'Library East' },
    });

    fireEvent.click(screen.getByRole('button', { name: /propose session/i }));

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
  }, 10000);

  it('renders the week schedule by default and requests the visible month range', async () => {
    const now = new Date();
    const expectedRange = getVisibleMonthRange(now);

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(api.getGroupScheduleCalendar).toHaveBeenCalledWith('group-1', expectedRange.start, expectedRange.end);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    expect(within(primaryHub).getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(within(primaryHub).getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(within(primaryHub).getByText('Sessions this week')).toBeInTheDocument();
    expect(within(primaryHub).getByText('Find a time to meet')).toBeInTheDocument();
    expect(within(primaryHub).queryByRole('button', { name: /^day$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Rolling Week')).not.toBeInTheDocument();
    expect(screen.queryByText('Next 7 Days')).not.toBeInTheDocument();
  });

  it('dedupes repeated schedule load errors for the same visible range', async () => {
    let meetupHandlers;
    const timeoutError = new Error('canceling statement due to statement timeout');

    authApi.subscribeToGroupMeetupEvents.mockImplementationOnce((_groupId, handlers) => {
      meetupHandlers = handlers;
      return vi.fn();
    });
    api.getGroupScheduleCalendar.mockRejectedValue(timeoutError);

    renderGroupDetails();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('canceling statement due to statement timeout');
    });
    expect(mockToast.error.mock.calls.filter(([message]) => message === timeoutError.message)).toHaveLength(1);

    await act(async () => {
      meetupHandlers.onChanged();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(api.getGroupScheduleCalendar).toHaveBeenCalledTimes(2);
    });
    expect(mockToast.error.mock.calls.filter(([message]) => message === timeoutError.message)).toHaveLength(1);
  });

  it('shows month sessions in the visible month range', async () => {
    const now = new Date();
    const visibleRange = getVisibleMonthRange(now);
    const targetStart = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 2, 25), 16, 30, 0, 0);
    const targetEnd = new Date(targetStart.getTime() + (60 * 60 * 1000));
    const outsideStart = new Date(visibleRange.end);
    outsideStart.setDate(outsideStart.getDate() + 2);
    outsideStart.setHours(16, 30, 0, 0);
    const outsideEnd = new Date(outsideStart.getTime() + (60 * 60 * 1000));

    api.getGroupScheduleCalendar.mockResolvedValue(makeSharedSchedule({
      meetups: [
        makeMeetup({
          id: 'meetup-calendar-tap',
          topic: 'Calendar redesign session',
          start_at: targetStart.toISOString(),
          end_at: targetEnd.toISOString(),
        }),
        makeMeetup({
          id: 'outside-visible-range',
          topic: 'Outside visible range',
          start_at: outsideStart.toISOString(),
          end_at: outsideEnd.toISOString(),
        }),
      ],
    }));

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByTestId('group-schedule-hub').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    fireEvent.click(within(primaryHub).getByRole('button', { name: /month/i }));

    const monthOverview = within(primaryHub).getByTestId('month-overview');
    expect(monthOverview).toHaveClass('md:h-full');
    expect(monthOverview).toHaveClass('md:min-h-0');
    expect(within(primaryHub).getByText('Sessions this month')).toBeInTheDocument();
    expect(within(primaryHub).getAllByText('Calendar redesign session').length).toBeGreaterThan(0);
    expect(within(primaryHub).queryByText('Outside visible range')).not.toBeInTheDocument();

    const targetCell = within(monthOverview).getAllByRole('button').find((cell) => (
      cell.textContent?.includes(String(targetStart.getDate()))
    ));
    expect(targetCell).toBeTruthy();
  });

  it('uses Study Hub schedule language for the week heatmap and sessions rail', async () => {
    const now = new Date();
    const sessionStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 30, 0, 0);
    const sessionEnd = new Date(sessionStart.getTime() + (60 * 60 * 1000));

    api.getGroupScheduleCalendar.mockResolvedValue(makeSharedSchedule({
      myShareMode: 'full',
      members: [{
        id: 'visible-user',
        username: 'visible',
        display_name: 'Visible Member',
        share_mode: 'full',
      }],
      availability: [{
        id: 'visible-availability',
        user_id: 'visible-user',
        day_of_week: now.getDay(),
        hour: 15,
      }],
      scheduleSlots: [
        {
          id: 'visible-slot',
          user_id: 'visible-user',
          member_name: 'Visible Member',
          day_of_week: now.getDay(),
          start_time: '09:00',
          end_time: '10:00',
          visibility_mode: 'full',
          class_name: 'Bio review block',
          class_is_archived: false,
        },
      ],
      meetups: [
        makeMeetup({
          id: 'meetup-language',
          topic: 'Calendar redesign session',
          start_at: sessionStart.toISOString(),
          end_at: sessionEnd.toISOString(),
        }),
      ],
    }));

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByTestId('group-schedule-hub').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    const heatmap = within(primaryHub).getByTestId('week-availability-heatmap');

    expect(within(heatmap).getAllByRole('button', { name: /session: calendar redesign session/i }).length).toBeGreaterThan(0);
    expect(within(primaryHub).getByText('Sessions this week')).toBeInTheDocument();
    expect(within(primaryHub).getAllByText('Calendar redesign session').length).toBeGreaterThan(0);
    expect(within(primaryHub).queryByText('Nothing due')).not.toBeInTheDocument();
    expect(within(primaryHub).queryByText(/^Due /i)).not.toBeInTheDocument();

    fireEvent.click(within(primaryHub).getByRole('button', { name: /month/i }));

    expect(within(primaryHub).getByText('Sessions this month')).toBeInTheDocument();
    expect(within(primaryHub).getByText('Calendar redesign session')).toBeInTheDocument();
  });

  it('keeps week and month inside the same compact schedule shell', async () => {
    api.getGroupScheduleCalendar.mockResolvedValue(makeSharedSchedule());

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    const mainGrid = within(primaryHub).getByTestId('group-schedule-main-grid');
    const calendarSurface = within(primaryHub).getByTestId('group-schedule-calendar-surface');
    const sessionsRail = within(primaryHub).getByTestId('group-schedule-sessions-rail');

    expect(primaryHub).toHaveClass('md:flex');
    expect(primaryHub).toHaveClass('md:h-full');
    expect(primaryHub).toHaveClass('md:min-h-0');
    expect(mainGrid).toHaveClass('md:flex-1');
    expect(mainGrid).toHaveClass('md:min-h-0');
    expect(mainGrid).toHaveClass('md:overflow-hidden');
    expect(calendarSurface).toHaveClass('md:flex');
    expect(calendarSurface).toHaveClass('md:min-h-0');
    expect(calendarSurface).toHaveClass('md:overflow-hidden');
    expect(sessionsRail).toHaveClass('md:flex');
    expect(sessionsRail).toHaveClass('md:min-h-0');
    expect(sessionsRail).toHaveClass('md:overflow-hidden');
    expect(sessionsRail).not.toHaveClass('lg:sticky');

    expect(within(primaryHub).getByTestId('week-availability-heatmap')).toHaveClass('md:flex-1');

    fireEvent.click(within(primaryHub).getByRole('button', { name: /month/i }));

    expect(within(primaryHub).getByTestId('month-overview')).toHaveClass('md:flex');
    expect(within(primaryHub).getByTestId('month-overview')).toHaveClass('md:min-h-0');
  });

  it('keeps schedule controls compact on desktop instead of rendering scrollable calendar filters', async () => {
    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    const controls = primaryHub.querySelector('section');

    expect(controls).toHaveClass('md:shrink-0');
    expect(within(primaryHub).getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(within(primaryHub).getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(within(primaryHub).getByRole('button', { name: /group/i })).toBeInTheDocument();
    expect(within(primaryHub).getByRole('button', { name: /^my availability$/i })).toBeInTheDocument();
    expect(within(primaryHub).queryByTestId('calendar-filter-list')).not.toBeInTheDocument();
  });

  it('keeps the meetup composer open and shows an error when creating a meetup fails', async () => {
    api.createGroupMeetup.mockRejectedValueOnce(new Error('Create failed'));

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /or propose a time/i })[0]);

    fireEvent.change(screen.getByPlaceholderText(/organic chemistry problem set/i), {
      target: { value: 'Chapter 8 review' },
    });

    fireEvent.click(screen.getByRole('button', { name: /propose session/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Create failed');
    });
    expect(screen.getByRole('dialog', { name: /new study session/i })).toBeInTheDocument();
  });

  it('keeps group schedule actions while using the shared calendar shell', async () => {
    api.getGroupScheduleCalendar.mockResolvedValue(makeSharedSchedule({ myShareMode: null }));

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByText('Biology Lab').length).toBeGreaterThan(0);
    });

    const scheduleScroll = screen.getByTestId('group-schedule-scroll');
    expect(scheduleScroll).toHaveClass('flex-1');
    expect(scheduleScroll).toHaveClass('min-h-0');
    expect(scheduleScroll).toHaveClass('overflow-hidden');
    expect(scheduleScroll).not.toHaveClass('overflow-y-auto');
    expect(scheduleScroll).not.toHaveClass('pb-10');

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    expect(primaryHub).toHaveClass('md:h-full');
    expect(primaryHub).toHaveClass('md:min-h-0');
    expect(within(primaryHub).getByTestId('week-availability-heatmap')).toHaveClass('md:flex');
    expect(within(primaryHub).getByTestId('upcoming-sessions')).toHaveClass('md:flex');

    fireEvent.click(within(primaryHub).getByRole('button', { name: /my availability/i }));
    fireEvent.click(within(primaryHub).getByRole('button', { name: /hidden/i }));

    await waitFor(() => {
      expect(api.setGroupScheduleShare).toHaveBeenCalledWith('group-1', 'busy_free');
    });

    fireEvent.click(within(primaryHub).getAllByRole('button', { name: /propose/i })[0]);
    expect(screen.getByRole('dialog', { name: /new study session/i })).toBeInTheDocument();
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
    const dayOfWeek = new Date().getDay();
    const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];

    api.getGroupScheduleCalendar.mockResolvedValueOnce(makeSharedSchedule({
      myShareMode: 'full',
      members: [{
        id: 'active-user',
        username: 'active',
        display_name: 'Active Member',
        avatar: 'https://cdn.test/active.png',
        share_mode: 'full',
      }],
      availability: [
        {
          id: 'active-free-before-class',
          user_id: 'active-user',
          day_of_week: dayOfWeek,
          hour: 9,
        },
        {
          id: 'active-free-during-archived-class',
          user_id: 'active-user',
          day_of_week: dayOfWeek,
          hour: 11,
        },
      ],
      scheduleSlots: [
        {
          id: 'active-slot',
          user_id: 'active-user',
          member_name: 'Active Member',
          day_of_week: dayOfWeek,
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
          day_of_week: dayOfWeek,
          start_time: '11:00',
          end_time: '12:00',
          visibility_mode: 'full',
          class_name: 'Archived Class',
          class_is_archived: true,
        },
      ],
      meetups: [],
    }));

    renderGroupDetails();

    await waitFor(() => {
      expect(screen.getAllByTestId('group-schedule-hub').length).toBeGreaterThan(0);
    });

    const primaryHub = screen.getAllByTestId('group-schedule-hub')[0];
    expect(within(primaryHub).getByRole('button', { name: new RegExp(`${dayLabel} 9a: 0 of 1 free`, 'i') })).toBeInTheDocument();
    const availableCell = within(primaryHub).getByRole('button', { name: new RegExp(`${dayLabel} 11a: 1 of 1 free; free: Active Member`, 'i') });
    expect(availableCell).toBeInTheDocument();
    expect(within(availableCell).getByTestId('free-member-avatar')).toHaveAttribute('src', 'https://cdn.test/active.png');
    expect(within(availableCell).queryByText('1')).not.toBeInTheDocument();
    expect(within(primaryHub).queryByText('Visible Class')).not.toBeInTheDocument();
    expect(within(primaryHub).queryByText('Archived Class')).not.toBeInTheDocument();
  });
});
