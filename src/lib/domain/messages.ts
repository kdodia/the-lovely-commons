/**
 * The message thread on a borrow request.
 *
 * Only the request's borrower and lender may post, and only while it is
 * pending, approved or active; once denied, cancelled or completed the
 * thread is read-only. Text is trimmed, must not be empty, and may be at
 * most REQUEST_MESSAGE_MAX_LENGTH characters after trimming. The other party
 * is notified with a preview cut to REQUEST_MESSAGE_PREVIEW_LENGTH
 * characters. The request's original `message` stays where it is and is
 * not copied into the thread.
 */
import type { AppState, BorrowRequest, RequestMessage } from '../types';
import { REQUEST_MESSAGE_MAX_LENGTH, REQUEST_MESSAGE_PREVIEW_LENGTH } from '../constants';
import { accept, reject, type Transition } from './transition';
import { createId } from './ids';
import { patchById } from './lists';
import { createNotification } from './notifications';

/**
 * Whether a user may add to a request's message thread: they are its borrower
 * or lender and it is still open (pending, approved or active).
 */
export function canSendRequestMessage(request: BorrowRequest, userId: string): boolean {
  const isParty = userId === request.borrowerId || userId === request.lenderId;
  return (
    isParty &&
    (request.status === 'pending' || request.status === 'approved' || request.status === 'active')
  );
}

/**
 * Borrower or lender adds a message to the request's thread, e.g. to agree
 * a pickup time. Open while the request is pending, approved or active;
 * the other party is notified.
 */
export function sendRequestMessage(state: AppState, requestId: string, text: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  const actorId = state.currentUserId;
  const isBorrower = actorId === request.borrowerId;
  if (!isBorrower && actorId !== request.lenderId) {
    return reject(state, 'Only the borrower or lender can message about this request');
  }
  if (!canSendRequestMessage(request, actorId)) {
    return reject(state, 'This request is closed, so no new messages can be sent');
  }

  const body = text.trim();
  if (!body) return reject(state, 'Write a message before sending');
  if (body.length > REQUEST_MESSAGE_MAX_LENGTH) {
    return reject(
      state,
      `Messages can be at most ${REQUEST_MESSAGE_MAX_LENGTH} characters (this one is ${body.length})`
    );
  }

  const message: RequestMessage = {
    id: createId('msg'),
    fromUserId: actorId,
    text: body,
    at: new Date().toISOString()
  };

  const item = state.items.find((i) => i.id === request.itemId);
  const actor = state.users.find((u) => u.id === actorId);
  const preview =
    body.length > REQUEST_MESSAGE_PREVIEW_LENGTH
      ? `${body.slice(0, REQUEST_MESSAGE_PREVIEW_LENGTH).trimEnd()}…`
      : body;
  const notification = createNotification(
    isBorrower ? request.lenderId : request.borrowerId,
    'request-message',
    'New Message',
    `${actor?.name ?? 'Someone'} about ${item?.name ?? 'your request'}: "${preview}"`,
    requestId
  );

  return accept({
    ...state,
    borrowRequests: patchById(state.borrowRequests, requestId, (r) => ({
      ...r,
      messages: [...(r.messages ?? []), message]
    })),
    notifications: [...state.notifications, notification]
  });
}
