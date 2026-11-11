import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SuggestionsTab from './SuggestionsTab.svelte';
import DeclineModal from './DeclineModal.svelte';
import FriendRequestsTab from './FriendRequestsTab.svelte';
import type { FriendRequest, User } from '$lib/types';

function user(id: string, name: string): User {
  return {
    id,
    name,
    email: `${id}@example.com`,
    profilePic: '',
    bio: `About ${name}`,
    address: { lat: 0, lng: 0, city: 'Portland' },
    friendIds: [],
    closeFriendIds: [],
    rating: 5,
    totalBorrows: 0,
    totalLends: 2
  };
}

const pam = user('pam', 'Pam Neighbor');
const sam = user('sam', 'Sam Neighbor');

function friendRequest(overrides: Partial<FriendRequest> = {}): FriendRequest {
  return {
    id: 'fr1',
    fromUserId: 'me',
    toUserId: 'pam',
    status: 'pending',
    createdAt: '2030-03-05T12:00:00Z',
    ...overrides
  };
}

describe('SuggestionsTab', () => {
  it('offers a request to people without a pending one and shows "Request Sent" for the rest', async () => {
    const onSendRequest = vi.fn();
    render(SuggestionsTab, {
      props: { kind: 'neighbors', users: [pam, sam], sentRequests: [friendRequest()], onSendRequest }
    });

    expect(screen.getByRole('button', { name: 'Request Sent' })).toBeDisabled();
    await fireEvent.click(screen.getByRole('button', { name: 'Send Friend Request' }));
    expect(onSendRequest).toHaveBeenCalledWith('sam');
  });

  it('uses the tab-specific empty message', () => {
    const { unmount } = render(SuggestionsTab, {
      props: { kind: 'neighbors', users: [], sentRequests: [], city: 'Portland', onSendRequest: vi.fn() }
    });
    expect(screen.getByText('No other users in Portland yet')).toBeInTheDocument();
    unmount();

    render(SuggestionsTab, {
      props: { kind: 'friends-of-friends', users: [], sentRequests: [], onSendRequest: vi.fn() }
    });
    expect(screen.getByText('No friends-of-friends')).toBeInTheDocument();
  });
});

describe('DeclineModal', () => {
  it('passes the trimmed note, or nothing when it is blank', async () => {
    const onConfirm = vi.fn();
    render(DeclineModal, { props: { onCancel: vi.fn(), onConfirm } });

    await fireEvent.click(screen.getByRole('button', { name: 'Decline Request' }));
    expect(onConfirm).toHaveBeenLastCalledWith(undefined);

    await fireEvent.input(screen.getByPlaceholderText(/Let them know why/), {
      target: { value: '  Not right now  ' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Decline Request' }));
    expect(onConfirm).toHaveBeenLastCalledWith('Not right now');
  });

  it('cancels without confirming', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(DeclineModal, { props: { onCancel, onConfirm } });

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('FriendRequestsTab', () => {
  it('lists incoming requests with accept / decline and outgoing ones as pending', async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(FriendRequestsTab, {
      props: {
        incoming: [friendRequest({ id: 'in1', fromUserId: 'sam', toUserId: 'me', message: 'Hi there' })],
        outgoing: [friendRequest()],
        users: [pam, sam],
        onAccept,
        onDecline
      }
    });

    expect(screen.getByText('"Hi there"')).toBeInTheDocument();
    expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalledWith('in1');
    await fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledWith('in1');
  });

  it('shows both empty states', () => {
    render(FriendRequestsTab, {
      props: { incoming: [], outgoing: [], users: [], onAccept: vi.fn(), onDecline: vi.fn() }
    });
    expect(screen.getByText('No incoming requests')).toBeInTheDocument();
    expect(screen.getByText('No outgoing requests')).toBeInTheDocument();
  });
});
