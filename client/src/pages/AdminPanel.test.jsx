import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPanel from './AdminPanel.jsx';

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

const {
  authState,
  adminGetStats,
  getAllUsers,
  adminGetMessages,
  adminGetFeedback,
  adminGetReports,
} = vi.hoisted(() => ({
  authState: {
    isAdmin: true,
    isOwner: true,
    user: { id: 1, username: 'owner' },
  },
  adminGetStats: vi.fn(),
  getAllUsers: vi.fn(),
  adminGetMessages: vi.fn(),
  adminGetFeedback: vi.fn(),
  adminGetReports: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    ...authState,
    adminGetStats,
    getAllUsers,
    adminDeleteUser: vi.fn(),
    adminUpdateUserRole: vi.fn(),
    adminGetMessages,
    adminCreateMessage: vi.fn(),
    adminUpdateMessage: vi.fn(),
    adminDeleteMessage: vi.fn(),
    adminGetFeedback,
    adminToggleFeedbackFavorite: vi.fn(),
    adminDeleteFeedback: vi.fn(),
    adminThankFeedback: vi.fn(),
    adminGetReports,
    adminResolveReport: vi.fn(),
    adminCloseReport: vi.fn(),
    adminBanUser: vi.fn(),
    toggleSimulateFree: vi.fn(),
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    heavy: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../hooks/useGSAP', () => ({
  useGSAP: () => ({
    container: { current: null },
  }),
}));

vi.mock('../components/admin/OverviewTab', () => ({
  default: () => <div>Overview Content</div>,
}));

vi.mock('../components/admin/UsersTab', () => ({
  default: () => <div>Users Content</div>,
}));

vi.mock('../components/admin/ReportsTab', () => ({
  default: () => <div>Reports Content</div>,
}));

vi.mock('../components/admin/BroadcastsTab', () => ({
  default: () => <div>Broadcasts Content</div>,
}));

vi.mock('../components/admin/FeedbackTab', async () => {
  const { default: FeedbackTab } = await vi.importActual('../components/admin/FeedbackTab.jsx');
  return { default: FeedbackTab };
});

vi.mock('../components/admin/AccountTab', () => ({
  default: () => <div>Account Content</div>,
}));

const renderAdminPanel = () => render(
  <MemoryRouter>
    <AdminPanel />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAdmin = true;
  authState.isOwner = true;
  authState.user = { id: 1, username: 'owner' };
  adminGetStats.mockResolvedValue({});
  getAllUsers.mockResolvedValue([]);
  adminGetMessages.mockResolvedValue([]);
  adminGetFeedback.mockResolvedValue([]);
  adminGetReports.mockResolvedValue([]);
});

describe('AdminPanel feedback access', () => {
  it('shows the owner-only feedback tab for owners', async () => {
    renderAdminPanel();

    await waitFor(() => {
      expect(adminGetStats).toHaveBeenCalled();
      expect(adminGetFeedback).toHaveBeenCalled();
    });

    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
  });

  it('hides the feedback tab from non-owner admins', async () => {
    authState.isOwner = false;

    renderAdminPanel();

    await waitFor(() => {
      expect(adminGetStats).toHaveBeenCalled();
    });

    expect(screen.queryByRole('button', { name: /feedback/i })).not.toBeInTheDocument();
    expect(adminGetFeedback).not.toHaveBeenCalled();
  });

  it('shows a feedback load error instead of an empty inbox when the fetch fails', async () => {
    adminGetFeedback.mockRejectedValue(
      Object.assign(new Error('feedback_submissions missing'), { status: 500 })
    );

    renderAdminPanel();

    await waitFor(() => {
      expect(adminGetFeedback).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

    expect(await screen.findByText(/could not load feedback/i)).toBeInTheDocument();
    expect(screen.getByText(/feedback_submissions missing/i)).toBeInTheDocument();
    expect(screen.queryByText(/no feedback yet/i)).not.toBeInTheDocument();
  });

  it('refreshes admin data from the command header', async () => {
    renderAdminPanel();

    await waitFor(() => {
      expect(adminGetStats).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh admin data/i }));

    await waitFor(() => {
      expect(adminGetStats).toHaveBeenCalledTimes(2);
      expect(getAllUsers).toHaveBeenCalledTimes(2);
      expect(adminGetReports).toHaveBeenCalledTimes(2);
    });
  });
});
