/**
 * The two physical handoffs of a loan, each confirmed by both people.
 *
 * - Pickup: allowed only while the request is approved, by its borrower or
 *   lender, once each (`pickupConfirmedBy`). The first confirmation tells
 *   the other party to confirm on their side; the second makes the loan
 *   active and marks the item out (`available: false`).
 * - Return: allowed only while the loan is active, by its borrower or
 *   lender, once each (`returnConfirmedBy`). The lender may pass feedback (a
 *   rating of the borrower from MIN_RATING to MAX_RATING, a note, the item's
 *   condition); it is kept whichever side confirms first, and anything the
 *   borrower passes is ignored. The first confirmation tells the other party
 *   to confirm on their side; the second completes the loan.
 * - Completing a loan moves it to history, marks the item back
 *   (`available: true`) unless another loan of it is still active, updates
 *   the item's condition and borrow count, both users' counters and the
 *   borrower's rating, asks the borrower to review the item, and (if the
 *   item was out and is now back) tells wishlist subscribers other than the
 *   borrower. Approved loans for later dates do not keep it out.
 */
import type { AppState, BorrowHistory, BorrowRequest, LenderReturnFeedback, Notification } from '../types';
import { todayLocalISO } from '../dates';
import { MAX_RATING, MIN_RATING } from '../constants';
import { accept, reject, type Transition } from './transition';
import { createId } from './ids';
import { patchById } from './lists';
import { appendNotifications, createNotification } from './notifications';
import { isOnLoan } from './requests';
import { foldUserRating, isValidRating } from './reviews';
import { wishlistAvailableNotifications } from './wishlist';

/** Whether a user has confirmed the given handoff step on a request. */
export function hasConfirmed(
  request: BorrowRequest,
  step: 'pickup' | 'return',
  userId: string
): boolean {
  const list = step === 'pickup' ? request.pickupConfirmedBy : request.returnConfirmedBy;
  return (list ?? []).includes(userId);
}

/**
 * Either party confirms the physical handoff. The loan becomes active
 * only once both the borrower and the lender have confirmed.
 */
export function confirmPickup(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  if (request.status !== 'approved') return reject(state, 'Only approved requests can be picked up');

  const actorId = state.currentUserId;
  if (actorId !== request.borrowerId && actorId !== request.lenderId) {
    return reject(state, 'Only the borrower or lender can confirm pickup');
  }

  const confirmed = request.pickupConfirmedBy ?? [];
  if (confirmed.includes(actorId)) return reject(state, 'You already confirmed this pickup');

  const nowConfirmed = [...confirmed, actorId];
  const bothConfirmed =
    nowConfirmed.includes(request.borrowerId) && nowConfirmed.includes(request.lenderId);
  const otherPartyId = actorId === request.borrowerId ? request.lenderId : request.borrowerId;
  const actor = state.users.find((u) => u.id === actorId);
  const item = state.items.find((i) => i.id === request.itemId);

  const notification = item
    ? createNotification(
        otherPartyId,
        'pickup-confirmed',
        bothConfirmed ? 'Loan Started' : 'Pickup Confirmed',
        bothConfirmed
          ? `${actor?.name ?? 'The other party'} confirmed too — the loan of ${item.name} is now active`
          : `${actor?.name ?? 'The other party'} confirmed the pickup of ${item.name} — confirm on your side`,
        requestId
      )
    : null;

  return accept({
    ...state,
    borrowRequests: patchById(state.borrowRequests, requestId, (r) => ({
      ...r,
      pickupConfirmedBy: nowConfirmed,
      status: bothConfirmed ? ('active' as const) : r.status
    })),
    // The item leaves its owner when the loan starts.
    items: bothConfirmed && item ? patchById(state.items, item.id, { available: false }) : state.items,
    notifications: appendNotifications(state.notifications, notification)
  });
}

/**
 * Either party confirms the item came back. The lender's `feedback`
 * (rating of the borrower, condition change) is recorded whichever order
 * the confirmations arrive in; the borrower's is ignored. When both have
 * confirmed, the borrow is completed and moved to history.
 */
export function confirmReturn(
  state: AppState,
  requestId: string,
  feedback: LenderReturnFeedback = {}
): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');

  if (request.status !== 'active') return reject(state, 'Only active loans can be returned');

  const actorId = state.currentUserId;
  const isLender = actorId === request.lenderId;
  if (actorId !== request.borrowerId && !isLender) {
    return reject(state, 'Only the borrower or lender can confirm a return');
  }

  const confirmed = request.returnConfirmedBy ?? [];
  if (confirmed.includes(actorId)) return reject(state, 'You already confirmed this return');

  if (isLender && feedback.rating !== undefined && !isValidRating(feedback.rating)) {
    return reject(state, `Rating must be between ${MIN_RATING} and ${MAX_RATING}`);
  }

  const lenderFeedback = isLender ? feedback : (request.lenderReturnFeedback ?? {});
  const nowConfirmed = [...confirmed, actorId];
  const bothConfirmed =
    nowConfirmed.includes(request.borrowerId) && nowConfirmed.includes(request.lenderId);

  const updatedRequest: BorrowRequest = {
    ...request,
    returnConfirmedBy: nowConfirmed,
    lenderReturnFeedback: lenderFeedback
  };

  const otherPartyId = isLender ? request.borrowerId : request.lenderId;
  const actor = state.users.find((u) => u.id === actorId);
  const item = state.items.find((i) => i.id === request.itemId);
  const notification = item
    ? createNotification(
        otherPartyId,
        bothConfirmed ? 'item-returned' : 'return-confirmed',
        bothConfirmed ? 'Return Complete' : 'Return Confirmed',
        bothConfirmed
          ? `${actor?.name ?? 'The other party'} confirmed too — ${item.name} is back home`
          : `${actor?.name ?? 'The other party'} confirmed the return of ${item.name} — confirm on your side`,
        requestId
      )
    : null;

  const withConfirmation: AppState = {
    ...state,
    borrowRequests: state.borrowRequests.map((r) => (r.id === requestId ? updatedRequest : r)),
    notifications: appendNotifications(state.notifications, notification)
  };

  return accept(
    bothConfirmed
      ? finalizeReturn(withConfirmation, updatedRequest, lenderFeedback)
      : withConfirmation
  );
}

/**
 * Both parties have confirmed the return: move the request to history, mark
 * the item back, update counters and reputations, and ask the borrower to review.
 */
export function finalizeReturn(
  state: AppState,
  request: BorrowRequest,
  feedback: LenderReturnFeedback
): AppState {
  const item = state.items.find((i) => i.id === request.itemId);
  const conditionBefore = item?.condition;
  const wasUnavailable = item ? !item.available : false;

  const history: BorrowHistory = {
    id: createId('hist'),
    itemId: request.itemId,
    borrowerId: request.borrowerId,
    lenderId: request.lenderId,
    startDate: request.startDate,
    endDate: request.endDate,
    actualReturnDate: todayLocalISO(),
    borrowerRating: feedback.rating,
    borrowerReview: feedback.review || undefined,
    conditionBefore,
    conditionAfter: feedback.condition || conditionBefore
  };

  const stillOnLoan = isOnLoan(state, request.itemId, request.id);

  const updatedItems = item
    ? patchById(state.items, item.id, (i) => ({
        ...i,
        available: !stillOnLoan,
        condition: feedback.condition || i.condition,
        totalBorrows: i.totalBorrows + 1
      }))
    : state.items;

  const updatedUsers = state.users.map((u) => {
    if (u.id === request.borrowerId) {
      return {
        ...u,
        rating: feedback.rating !== undefined ? foldUserRating(u, feedback.rating) : u.rating,
        totalBorrows: u.totalBorrows + 1
      };
    }
    if (u.id === request.lenderId) return { ...u, totalLends: u.totalLends + 1 };
    return u;
  });

  const notifications: Notification[] = [];
  const lender = state.users.find((u) => u.id === request.lenderId);
  if (item) {
    notifications.push(
      createNotification(
        request.borrowerId,
        'review-request',
        'How was the item?',
        `${item.name} is back with ${lender?.name ?? 'its owner'}. Leave a quick review to help others.`,
        item.id
      )
    );
    if (wasUnavailable && !stillOnLoan) {
      notifications.push(...wishlistAvailableNotifications(state, item, request.borrowerId));
    }
  }

  return {
    ...state,
    items: updatedItems,
    users: updatedUsers,
    borrowRequests: patchById(state.borrowRequests, request.id, { status: 'completed' }),
    borrowHistory: [...state.borrowHistory, history],
    notifications: [...state.notifications, ...notifications]
  };
}
