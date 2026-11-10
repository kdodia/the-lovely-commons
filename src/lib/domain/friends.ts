/**
 * Friendships.
 *
 * - send request: from `fromUserId` to `toUserId` (passed in, not taken from
 *   the current user). Both users must exist. Nothing happens if the sender
 *   already lists the recipient as a friend or the same request is already
 *   pending. The recipient is notified.
 * - accept / decline: only a pending request; anything else is ignored. The
 *   actor is not checked. Accepting adds each user to the other's
 *   `friendIds` (never twice); declining may carry a message, which is
 *   quoted to the sender. The sender is notified either way.
 * - promote / demote close friend: adds or removes `friendId` in
 *   `userId`'s `closeFriendIds` (passed in, not taken from the current user).
 *   Promoting does not require an existing friendship, and demoting leaves
 *   the friendship in place.
 */
import type { AppState, FriendRequest } from '../types';
import { createId } from './ids';
import { createNotification } from './notifications';
import { patchById } from './lists';

export function sendFriendRequest(
  state: AppState,
  fromUserId: string,
  toUserId: string,
  message?: string
): AppState {
  const fromUser = state.users.find((u) => u.id === fromUserId);
  const toUser = state.users.find((u) => u.id === toUserId);
  if (!fromUser || !toUser) {
    console.warn('Cannot send friend request: missing user');
    return state;
  }

  // Already friends or an identical request is pending — nothing to do
  const alreadyFriends = fromUser.friendIds.includes(toUserId);
  const alreadyPending = state.friendRequests.some(
    (r) => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'
  );
  if (alreadyFriends || alreadyPending) return state;

  const friendRequest: FriendRequest = {
    id: createId('freq'),
    fromUserId,
    toUserId,
    status: 'pending',
    message,
    createdAt: new Date().toISOString()
  };

  const notification = createNotification(
    toUserId,
    'friend-request',
    'New Friend Request',
    `${fromUser.name} sent you a friend request`,
    friendRequest.id
  );

  return {
    ...state,
    friendRequests: [...state.friendRequests, friendRequest],
    notifications: [...state.notifications, notification]
  };
}

export function acceptFriendRequest(state: AppState, requestId: string): AppState {
  const request = state.friendRequests.find((r) => r.id === requestId);
  if (!request || request.status !== 'pending') return state;

  const toUser = state.users.find((u) => u.id === request.toUserId);

  // Add each user to the other's friend list (deduplicated)
  const updatedUsers = state.users.map((user) => {
    if (user.id === request.fromUserId && !user.friendIds.includes(request.toUserId)) {
      return {
        ...user,
        friendIds: [...user.friendIds, request.toUserId]
      };
    }
    if (user.id === request.toUserId && !user.friendIds.includes(request.fromUserId)) {
      return {
        ...user,
        friendIds: [...user.friendIds, request.fromUserId]
      };
    }
    return user;
  });

  const notification = createNotification(
    request.fromUserId,
    'friend-request-accepted',
    'Friend Request Accepted',
    `${toUser?.name ?? 'Someone'} accepted your friend request`,
    requestId
  );

  return {
    ...state,
    users: updatedUsers,
    friendRequests: patchById(state.friendRequests, requestId, { status: 'accepted' }),
    notifications: [...state.notifications, notification]
  };
}

export function declineFriendRequest(state: AppState, requestId: string, message?: string): AppState {
  const request = state.friendRequests.find((r) => r.id === requestId);
  if (!request || request.status !== 'pending') return state;

  const toUser = state.users.find((u) => u.id === request.toUserId);
  const notification = createNotification(
    request.fromUserId,
    'friend-request-declined',
    'Friend Request Declined',
    message
      ? `${toUser?.name ?? 'Someone'} declined your friend request: "${message}"`
      : `${toUser?.name ?? 'Someone'} declined your friend request`,
    requestId
  );

  return {
    ...state,
    friendRequests: patchById(state.friendRequests, requestId, { status: 'declined' }),
    notifications: [...state.notifications, notification]
  };
}

export function promoteToCloseFriend(state: AppState, userId: string, friendId: string): AppState {
  return {
    ...state,
    users: patchById(state.users, userId, (user) => ({
      ...user,
      closeFriendIds: user.closeFriendIds.includes(friendId)
        ? user.closeFriendIds
        : [...user.closeFriendIds, friendId]
    }))
  };
}

export function demoteFromCloseFriend(state: AppState, userId: string, friendId: string): AppState {
  return {
    ...state,
    users: patchById(state.users, userId, (user) => ({
      ...user,
      closeFriendIds: user.closeFriendIds.filter((id) => id !== friendId)
    }))
  };
}

/** Friend requests waiting for the user to answer. */
export function incomingFriendRequestsFor(state: AppState, userId: string): FriendRequest[] {
  return state.friendRequests.filter((req) => req.toUserId === userId && req.status === 'pending');
}

/** Every friend request the user has sent, whatever its status. */
export function outgoingFriendRequestsFor(state: AppState, userId: string): FriendRequest[] {
  return state.friendRequests.filter((req) => req.fromUserId === userId);
}
