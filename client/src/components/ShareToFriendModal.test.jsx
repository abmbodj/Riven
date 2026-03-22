import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ShareToFriendModal from './ShareToFriendModal.jsx';

const renderModal = (props = {}) => render(
    <MemoryRouter>
        <ShareToFriendModal
            isOpen={true}
            onClose={vi.fn()}
            friends={[]}
            loading={false}
            sendingTo={null}
            onSend={vi.fn()}
            resourceLabel="Note"
            resourceTitle="Cell Respiration Notes"
            {...props}
        />
    </MemoryRouter>
);

describe('ShareToFriendModal', () => {
    it('renders the open state with the current resource copy', () => {
        renderModal();

        expect(screen.getByRole('heading', { name: 'Share Note' })).toBeInTheDocument();
        expect(screen.getByText('Select a friend to send "Cell Respiration Notes" to directly.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /close share note/i })).toBeInTheDocument();
    });

    it('shows the loading state while friends are being fetched', () => {
        renderModal({ loading: true });

        expect(screen.getByText('Loading friends...')).toBeInTheDocument();
    });

    it('shows the empty state with a link to find friends', () => {
        renderModal();

        expect(screen.getByText('You have no friends yet.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Find Friends' })).toHaveAttribute('href', '/friends');
    });

    it('renders populated friends and sends to the selected friend', () => {
        const onSend = vi.fn();

        renderModal({
            friends: [
                { id: 12, username: 'Bianca', avatar: null },
            ],
            onSend,
        });

        fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

        expect(screen.getByText('Bianca')).toBeInTheDocument();
        expect(onSend).toHaveBeenCalledWith(12);
    });

    it('disables the matching send button while a share is in flight', () => {
        renderModal({
            friends: [
                { id: 12, username: 'Bianca', avatar: null },
            ],
            sendingTo: 12,
        });

        const sendButton = screen.getByRole('button', { name: /sending\.\.\./i });
        expect(sendButton).toBeDisabled();
    });
});
