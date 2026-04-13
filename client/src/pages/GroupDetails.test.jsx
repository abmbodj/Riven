import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupDetails from './GroupDetails.jsx';

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
});
