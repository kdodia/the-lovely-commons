/**
 * Reviews and ratings. Each completed borrow (a history entry) can carry two
 * separate ratings:
 *
 * - The lender's rating of the borrower (`borrowerRating`/`borrowerReview`),
 *   given when the lender confirms the return (see handoff.ts). It is folded
 *   into the borrower's `User.rating` as a running mean weighted by their
 *   completed borrows; a borrower with no borrows or no rating yet simply
 *   takes the new rating.
 * - The borrower's review of the item (`rating`/`review`/`reviewerId`),
 *   written afterwards with submitItemReview: only by that borrow's
 *   borrower, once per borrow, with a rating from MIN_RATING to MAX_RATING.
 *   The item's rating becomes the mean of all borrower reviews of it; with
 *   none yet it keeps its current (seeded) rating. The lender is notified.
 *
 * Ratings are rounded to one decimal place. Only entries with a
 * `reviewerId` count as item reviews. Who may read the lender notes about a
 * borrower is decided in permissions.ts.
 */
import type { AppState, BorrowHistory, Item, User } from '../types';
import { MAX_RATING, MIN_RATING } from '../constants';
import { accept, reject, type Transition } from './transition';
import { patchById } from './lists';
import { appendNotifications, createNotification } from './notifications';

/** Round to one decimal place, the precision ratings are displayed at. */
export function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isValidRating(rating: number): boolean {
  return Number.isFinite(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

/**
 * The item's rating recomputed from borrower-written reviews. When there are
 * none yet the current (seeded) rating is kept rather than dropping to 0.
 */
export function computeItemRating(item: Item, history: BorrowHistory[]): number {
  const ratings = history
    .filter((h) => h.itemId === item.id && h.reviewerId && typeof h.rating === 'number')
    .map((h) => h.rating as number);
  if (ratings.length === 0) return item.rating;
  return roundRating(ratings.reduce((sum, r) => sum + r, 0) / ratings.length);
}

/**
 * Fold a new lender rating into the borrower's reputation as a running mean
 * weighted by their completed borrows, so a seeded 4.8 over 23 borrows isn't
 * wiped out by a single new rating.
 */
export function foldUserRating(user: User, newRating: number): number {
  const priorCount = Math.max(0, user.totalBorrows);
  if (priorCount === 0 || user.rating <= 0) return roundRating(newRating);
  return roundRating((user.rating * priorCount + newRating) / (priorCount + 1));
}

/**
 * The borrower reviews the item after a completed borrow. One review per
 * history entry; the item's rating is recomputed from borrower reviews.
 */
export function submitItemReview(
  state: AppState,
  historyId: string,
  rating: number,
  review: string
): Transition {
  const entry = state.borrowHistory.find((h) => h.id === historyId);
  if (!entry) return reject(state, 'Borrow not found');

  if (entry.borrowerId !== state.currentUserId) {
    return reject(state, 'Only the borrower can review this item');
  }
  if (entry.reviewerId) return reject(state, 'You already reviewed this borrow');
  if (!isValidRating(rating)) {
    return reject(state, `Rating must be between ${MIN_RATING} and ${MAX_RATING}`);
  }

  const reviewed: BorrowHistory = {
    ...entry,
    rating,
    review: review.trim() || undefined,
    reviewerId: state.currentUserId,
    reviewedAt: new Date().toISOString()
  };
  const borrowHistory = state.borrowHistory.map((h) => (h.id === historyId ? reviewed : h));

  const item = state.items.find((i) => i.id === entry.itemId);
  const reviewer = state.users.find((u) => u.id === state.currentUserId);
  const notification = item
    ? createNotification(
        entry.lenderId,
        'item-reviewed',
        'New Review',
        `${reviewer?.name ?? 'A borrower'} rated your ${item.name} ${rating} out of ${MAX_RATING}`,
        item.id
      )
    : null;

  return accept({
    ...state,
    borrowHistory,
    items: item
      ? patchById(state.items, item.id, (i) => ({ ...i, rating: computeItemRating(i, borrowHistory) }))
      : state.items,
    notifications: appendNotifications(state.notifications, notification)
  });
}

/**
 * Completed borrows of an item by a user that haven't been reviewed yet,
 * most recent first. Drives the inline review form on the item page.
 */
export function pendingItemReviews(state: AppState, itemId: string, userId: string): BorrowHistory[] {
  return state.borrowHistory
    .filter((h) => h.itemId === itemId && h.borrowerId === userId && !h.reviewerId)
    .sort((a, b) => (a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0));
}

// Completed borrows where lenders left a rating and/or note about this user as
// a borrower, newest return first. Does not check who may view them.
export function getBorrowerFeedback(userId: string, state: AppState): BorrowHistory[] {
  return state.borrowHistory
    .filter(
      (h) => h.borrowerId === userId && (h.borrowerRating != null || !!h.borrowerReview?.trim())
    )
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}
