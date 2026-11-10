/**
 * Overdue loans.
 *
 * A loan is overdue when it is active (picked up) and its end date is before
 * today's local date; due today is not overdue. Approved-but-not-collected
 * requests are never overdue.
 *
 * - Return reminder (manual): only the lender, only for an active loan that
 *   is overdue, and not once the borrower has confirmed the return. At most
 *   one per RETURN_REMINDER_COOLDOWN_DAYS calendar days, counted from the
 *   local day of the last reminder. The borrower is notified.
 * - Overdue announcement (automatic sweep): every overdue loan not yet
 *   announced, whoever it belongs to, is announced once — the borrower is
 *   asked to return the item and the lender is told it is late — and marked
 *   with `overdueNotifiedAt`. Loans whose item, lender or borrower is gone
 *   are skipped. This is independent of the manual reminder cooldown.
 */
import type { AppState, BorrowRequest, Notification } from '../types';
import { addDays, daysBetween, formatDisplayDate, toLocalISODate, todayLocalISO } from '../dates';
import { DATE_FORMAT_OPTIONS, RETURN_REMINDER_COOLDOWN_DAYS } from '../constants';
import { accept, reject, type Transition } from './transition';
import { patchById } from './lists';
import { createNotification } from './notifications';
import { hasConfirmed } from './handoff';

/**
 * Whether a loan is overdue: the item has been picked up (`active`) and its
 * end date is before `today`. Due today is not overdue.
 */
export function isOverdue(request: BorrowRequest, today: string = todayLocalISO()): boolean {
  return request.status === 'active' && request.endDate < today;
}

/** Whole days an overdue loan is past its end date; 0 when not overdue. */
export function daysOverdue(request: BorrowRequest, today: string = todayLocalISO()): number {
  return isOverdue(request, today) ? daysBetween(request.endDate, today) : 0;
}

/**
 * The loans with overdue ones first, most overdue first. Everything else
 * keeps its original order (the sort is stable).
 */
export function sortOverdueFirst(
  loans: BorrowRequest[],
  today: string = todayLocalISO()
): BorrowRequest[] {
  return [...loans].sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today));
}

/**
 * The local day ('YYYY-MM-DD') from which the lender may send another return
 * reminder, or null if they never have. The cooldown counts calendar days so
 * the store and the dashboard agree on when the button comes back.
 */
export function nextReturnReminderDate(request: BorrowRequest): string | null {
  if (!request.lastRemindedAt) return null;
  return toLocalISODate(addDays(new Date(request.lastRemindedAt), RETURN_REMINDER_COOLDOWN_DAYS));
}

// Active loans past their return date, from each side.
export function overdueLentBy(state: AppState, userId: string, today: string): BorrowRequest[] {
  return state.borrowRequests.filter((req) => req.lenderId === userId && isOverdue(req, today));
}

export function overdueBorrowedBy(state: AppState, userId: string, today: string): BorrowRequest[] {
  return state.borrowRequests.filter((req) => req.borrowerId === userId && isOverdue(req, today));
}

/**
 * The lender asks the borrower to bring back an overdue item. Limited to
 * one reminder per RETURN_REMINDER_COOLDOWN_DAYS so it stays a nudge.
 */
export function sendReturnReminder(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Loan not found');

  if (request.lenderId !== state.currentUserId) {
    return reject(state, 'Only the lender can send a return reminder');
  }
  if (request.status !== 'active') {
    return reject(state, 'Reminders can only be sent for items currently on loan');
  }

  const today = todayLocalISO();
  if (!isOverdue(request, today)) {
    return reject(
      state,
      `This loan isn't overdue yet — it's due back ${formatDisplayDate(request.endDate, DATE_FORMAT_OPTIONS.short)}`
    );
  }

  const item = state.items.find((i) => i.id === request.itemId);
  const lender = state.users.find((u) => u.id === request.lenderId);
  const borrower = state.users.find((u) => u.id === request.borrowerId);
  if (!item || !lender || !borrower) return reject(state, 'Item or borrower no longer exists');

  // Once the borrower has confirmed the hand-back, the lender just needs
  // to confirm on their side.
  if (hasConfirmed(request, 'return', request.borrowerId)) {
    return reject(
      state,
      `${borrower.name} already confirmed the return — confirm on your side to finish`
    );
  }

  const nextAllowed = nextReturnReminderDate(request);
  if (nextAllowed && today < nextAllowed) {
    return reject(
      state,
      `You already sent a reminder — you can send another on ${formatDisplayDate(nextAllowed, DATE_FORMAT_OPTIONS.short)}`
    );
  }

  const days = daysOverdue(request, today);
  const notification = createNotification(
    request.borrowerId,
    'return-reminder',
    'Return Reminder',
    `${lender.name} is asking for their ${item.name} back — it was due ${days} ${days === 1 ? 'day' : 'days'} ago`,
    requestId
  );

  return accept({
    ...state,
    borrowRequests: patchById(state.borrowRequests, requestId, {
      lastRemindedAt: new Date().toISOString()
    }),
    notifications: [...state.notifications, notification]
  });
}

/**
 * Announce newly overdue loans, once each, to both people: the borrower
 * is asked to return the item and the lender is told it's late. Looks at
 * every request (state is shared by all users) and marks each as
 * announced, so running it again is a no-op that doesn't write state.
 * The result is how many loans were announced.
 */
export function notifyOverdueLoans(state: AppState): Transition<number> {
  const today = todayLocalISO();
  const announcedAt = new Date().toISOString();
  const notifications: Notification[] = [];
  const announcedIds = new Set<string>();
  for (const request of state.borrowRequests) {
    if (!isOverdue(request, today) || request.overdueNotifiedAt) continue;
    const item = state.items.find((i) => i.id === request.itemId);
    const lender = state.users.find((u) => u.id === request.lenderId);
    const borrower = state.users.find((u) => u.id === request.borrowerId);
    if (!item || !lender || !borrower) continue;

    notifications.push(
      createNotification(
        request.borrowerId,
        'return-reminder',
        'Return Reminder',
        `${lender.name}'s ${item.name} was due back on ${formatDisplayDate(request.endDate, DATE_FORMAT_OPTIONS.short)}. Please return it.`,
        request.id
      ),
      createNotification(
        request.lenderId,
        'loan-overdue',
        'Loan Overdue',
        `${item.name}, lent to ${borrower.name}, is now overdue.`,
        request.id
      )
    );
    announcedIds.add(request.id);
  }

  if (announcedIds.size === 0) return { state, result: 0 };
  return {
    state: {
      ...state,
      borrowRequests: state.borrowRequests.map((r) =>
        announcedIds.has(r.id) ? { ...r, overdueNotifiedAt: announcedAt } : r
      ),
      notifications: [...state.notifications, ...notifications]
    },
    result: announcedIds.size
  };
}
