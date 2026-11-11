/**
 * Borrow requests: asking, approving, declining, cancelling and nudging.
 *
 * A request's lifecycle is pending → approved → active → completed, with the
 * side exits denied and cancelled. This file covers everything up to
 * pickup; the handoffs (approved → active → completed) are in handoff.ts.
 *
 * - create: the item and the borrower must exist, and the dates must not
 *   overlap the item's blocked dates or another approved/active request for
 *   the item (pending requests do not block). The new request is stored as
 *   given and the lender is notified. The actor is not checked.
 * - approve: only from pending, only while the item exists, and only if the
 *   dates still don't conflict. The item becomes unavailable and the borrower
 *   is notified. The actor is not checked.
 * - deny: only from pending; the borrower is notified. The actor is not
 *   checked.
 * - cancel: only the borrower or the lender. The borrower may cancel while
 *   pending or approved; the lender only while approved (a pending request
 *   is declined, not cancelled). Active loans can't be cancelled. The other
 *   party is notified; cancelling an approved request frees the item if no
 *   other approved/active request holds it, and tells wishlist subscribers.
 * - nudge: only the borrower, only from pending, and not before
 *   `nextNudgeDate`: NUDGE_DELAY_DAYS calendar days after the request was
 *   made, or after the last nudge once there has been one, counted in local
 *   days. The lender is reminded.
 */
import type { AppState, BorrowRequest, Notification } from '../types';
import { addDays, formatDisplayDate, rangesOverlap, toLocalISODate, todayLocalISO } from '../dates';
import { DATE_FORMAT_OPTIONS, NUDGE_DELAY_DAYS } from '../constants';
import { accept, reject, type Transition } from './transition';
import { patchById } from './lists';
import { appendNotifications, createNotification } from './notifications';
import { wishlistAvailableNotifications } from './wishlist';

/**
 * Whether a date range conflicts with the item's blocked dates or with
 * another approved/active borrow of the same item.
 */
export function hasDateConflict(
  state: AppState,
  itemId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
): boolean {
  const item = state.items.find((i) => i.id === itemId);
  const blockedConflict = (item?.blockedDates ?? []).some((b) =>
    rangesOverlap(b.startDate, b.endDate, startDate, endDate)
  );
  if (blockedConflict) return true;

  return state.borrowRequests.some(
    (r) =>
      r.id !== excludeRequestId &&
      r.itemId === itemId &&
      (r.status === 'approved' || r.status === 'active') &&
      rangesOverlap(r.startDate, r.endDate, startDate, endDate)
  );
}

/**
 * Whether any approved/active request (other than `excludeRequestId`) holds
 * the item, i.e. it is reserved or physically out on loan.
 */
export function isReservedOrOnLoan(
  state: AppState,
  itemId: string,
  excludeRequestId?: string
): boolean {
  return state.borrowRequests.some(
    (r) =>
      r.id !== excludeRequestId &&
      r.itemId === itemId &&
      (r.status === 'approved' || r.status === 'active')
  );
}

export function createBorrowRequest(state: AppState, request: BorrowRequest): Transition {
  const item = state.items.find((i) => i.id === request.itemId);
  const borrower = state.users.find((u) => u.id === request.borrowerId);

  if (!item || !borrower) return reject(state, 'Item or borrower no longer exists');

  if (hasDateConflict(state, request.itemId, request.startDate, request.endDate)) {
    return reject(state, 'Those dates conflict with an existing loan or blocked period');
  }

  const notification = createNotification(
    request.lenderId,
    'borrow-request',
    'New Borrow Request',
    `${borrower.name} wants to borrow your ${item.name}`,
    request.id
  );

  return accept({
    ...state,
    borrowRequests: [...state.borrowRequests, request],
    notifications: [...state.notifications, notification]
  });
}

export function approveRequest(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  if (request.status !== 'pending') return reject(state, 'Only pending requests can be approved');

  const item = state.items.find((i) => i.id === request.itemId);
  if (!item) return reject(state, 'Item no longer exists');

  if (hasDateConflict(state, request.itemId, request.startDate, request.endDate, requestId)) {
    return reject(state, 'Those dates conflict with an existing loan or blocked period');
  }

  const lender = state.users.find((u) => u.id === request.lenderId);
  const notification = lender
    ? createNotification(
        request.borrowerId,
        'request-approved',
        'Request Approved!',
        `${lender.name} approved your request to borrow ${item.name}`,
        requestId
      )
    : null;

  return accept({
    ...state,
    borrowRequests: patchById(state.borrowRequests, requestId, { status: 'approved' }),
    items: patchById(state.items, item.id, { available: false }),
    notifications: appendNotifications(state.notifications, notification)
  });
}

export function denyRequest(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  if (request.status !== 'pending') return reject(state, 'Only pending requests can be declined');

  const item = state.items.find((i) => i.id === request.itemId);
  const lender = state.users.find((u) => u.id === request.lenderId);
  const notification =
    item && lender
      ? createNotification(
          request.borrowerId,
          'request-denied',
          'Request Declined',
          `${lender.name} declined your request to borrow ${item.name}`,
          requestId
        )
      : null;

  return accept({
    ...state,
    borrowRequests: patchById(state.borrowRequests, requestId, { status: 'denied' }),
    notifications: appendNotifications(state.notifications, notification)
  });
}

/**
 * Borrower cancels a request they no longer need (pending or approved),
 * or a lender retracts an approval before pickup. Active loans can't be
 * cancelled — the item has to come back through the return flow.
 */
export function cancelRequest(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  const actorId = state.currentUserId;
  const isBorrower = actorId === request.borrowerId;
  const isLender = actorId === request.lenderId;
  if (!isBorrower && !isLender) {
    return reject(state, 'Only the borrower or lender can cancel this request');
  }

  if (request.status === 'pending' && !isBorrower) {
    return reject(state, 'Decline the request instead of cancelling it');
  }
  if (request.status !== 'pending' && request.status !== 'approved') {
    return reject(state, 'Only pending or approved requests can be cancelled');
  }

  const item = state.items.find((i) => i.id === request.itemId);
  const actor = state.users.find((u) => u.id === actorId);
  const otherPartyId = isBorrower ? request.lenderId : request.borrowerId;

  const notifications: Notification[] = [];
  if (item) {
    notifications.push(
      createNotification(
        otherPartyId,
        'request-cancelled',
        isBorrower ? 'Request Cancelled' : 'Reservation Cancelled',
        isBorrower
          ? `${actor?.name ?? 'The borrower'} cancelled their request to borrow ${item.name}`
          : `${actor?.name ?? 'The lender'} cancelled your reservation of ${item.name}`,
        requestId
      )
    );
  }

  // An approved request had reserved the item; release it.
  let items = state.items;
  if (item && request.status === 'approved') {
    const stillOnLoan = isReservedOrOnLoan(state, item.id, requestId);
    if (!item.available && !stillOnLoan) {
      items = patchById(state.items, item.id, { available: true });
      notifications.push(...wishlistAvailableNotifications(state, item, request.borrowerId));
    }
  }

  return accept({
    ...state,
    items,
    borrowRequests: patchById(state.borrowRequests, requestId, { status: 'cancelled' }),
    notifications: [...state.notifications, ...notifications]
  });
}

/**
 * The borrower reminds the lender about a pending request. Limited to one
 * reminder per NUDGE_DELAY_DAYS (see `nextNudgeDate`) so it stays a nudge.
 */
export function nudgeRequest(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  if (request.borrowerId !== state.currentUserId) {
    return reject(state, 'Only the person who asked can send a reminder');
  }
  if (request.status !== 'pending') return reject(state, 'Only pending requests can be nudged');

  const nextAllowed = nextNudgeDate(request);
  if (todayLocalISO() < nextAllowed) {
    const on = formatDisplayDate(nextAllowed, DATE_FORMAT_OPTIONS.short);
    return reject(
      state,
      request.lastNudgedAt
        ? `You already sent a reminder — you can send another on ${on}`
        : `It's a little early — you can send a reminder on ${on}`
    );
  }

  const item = state.items.find((i) => i.id === request.itemId);
  const borrower = state.users.find((u) => u.id === request.borrowerId);

  // Guard against missing data
  if (!item || !borrower) return reject(state, 'Item or borrower no longer exists');

  const notification = createNotification(
    request.lenderId,
    'request-nudge',
    'Friendly Reminder',
    `👋 ${borrower.name} sent you a friendly reminder about their request for ${item.name}`,
    requestId
  );

  return accept({
    ...state,
    borrowRequests: patchById(state.borrowRequests, requestId, {
      lastNudgedAt: new Date().toISOString()
    }),
    notifications: [...state.notifications, notification]
  });
}

/**
 * The local day ('YYYY-MM-DD') from which the borrower may nudge:
 * NUDGE_DELAY_DAYS calendar days after the last nudge, or after the request
 * was made if it was never nudged. Calendar days, so a daylight-saving
 * change in between neither adds nor loses a day. `nudgeRequest` enforces
 * it and the item page shows it.
 */
export function nextNudgeDate(request: BorrowRequest): string {
  const reference = request.lastNudgedAt ?? request.createdAt;
  return toLocalISODate(addDays(new Date(reference), NUDGE_DELAY_DAYS));
}

/** Pending requests waiting for the user to answer as lender. */
export function incomingRequestsFor(state: AppState, userId: string): BorrowRequest[] {
  return state.borrowRequests.filter((req) => req.lenderId === userId && req.status === 'pending');
}

/** Every request the user has made as borrower, whatever its status. */
export function outgoingRequestsFor(state: AppState, userId: string): BorrowRequest[] {
  return state.borrowRequests.filter((req) => req.borrowerId === userId);
}

// Loans the user has approved but that haven't been picked up yet
export function approvedLoansFor(state: AppState, userId: string): BorrowRequest[] {
  return state.borrowRequests.filter((req) => req.lenderId === userId && req.status === 'approved');
}

/** Loans the user has lent out that are currently picked up. */
export function activeLoansFor(state: AppState, userId: string): BorrowRequest[] {
  return state.borrowRequests.filter((req) => req.lenderId === userId && req.status === 'active');
}

// The borrower-side mirror of approvedLoans + activeLoans: items the user
// is holding or about to pick up.
export function borrowedBy(state: AppState, userId: string): BorrowRequest[] {
  return state.borrowRequests.filter(
    (req) => req.borrowerId === userId && (req.status === 'approved' || req.status === 'active')
  );
}
