import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type {
  AppState,
  Item,
  User,
  BorrowRequest,
  Notification,
  BorrowHistory,
  Tag,
  FriendRequest,
  LenderReturnFeedback,
  WishlistItem
} from './types';
import { initialAppState } from './mockData';
import { rangesOverlap, todayLocalISO } from './dates';
import { MAX_RATING, MIN_RATING, NUDGE_DELAY_DAYS } from './constants';

export const STORAGE_KEY = 'distributed-library-app-state';

/** Result of a store action that can be rejected (e.g. date conflicts). */
export type ActionResult = { ok: true } | { ok: false; error: string };

const STATE_COLLECTIONS = [
  'users',
  'items',
  'categories',
  'tags',
  'borrowRequests',
  'borrowHistory',
  'friendRequests',
  'notifications',
  'wishlist'
] as const;

/** Generate a unique id with a readable prefix. */
export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Load state from localStorage or use initial state
function loadState(): AppState {
  const defaults = structuredClone(initialAppState);
  if (browser) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // Merge over defaults so state persisted by an older version of the
          // app (missing newer collections like `wishlist`) doesn't crash.
          const merged: AppState = { ...defaults, ...parsed };
          for (const key of STATE_COLLECTIONS) {
            if (!Array.isArray(merged[key])) {
              Object.assign(merged, { [key]: defaults[key] });
            }
          }
          if (!merged.users.some((u) => u.id === merged.currentUserId)) {
            merged.currentUserId = defaults.currentUserId;
          }
          return migrateState(merged);
        }
      } catch (e) {
        console.error('Failed to parse stored state:', e);
      }
    }
  }
  return defaults;
}

/**
 * Bring state persisted by an older version of the app up to the current
 * schema. Every step must be idempotent — this runs on every load.
 */
function migrateState(state: AppState): AppState {
  return {
    ...state,
    // Two-sided handoff arrays were added later; older requests lack them.
    borrowRequests: state.borrowRequests.map((r) => ({
      ...r,
      pickupConfirmedBy: Array.isArray(r.pickupConfirmedBy) ? r.pickupConfirmedBy : [],
      returnConfirmedBy: Array.isArray(r.returnConfirmedBy) ? r.returnConfirmedBy : []
    })),
    // Before borrower reviews existed, `rating`/`review` were written by the
    // lender about the borrower. Entries with a rating but no `reviewerId`
    // are from that era: move them to the borrower-rating fields so they
    // stop being displayed (and averaged) as item reviews.
    borrowHistory: state.borrowHistory.map((h) => {
      if (h.reviewerId || (h.rating === undefined && !h.review)) return h;
      const { rating, review, ...rest } = h;
      return {
        ...rest,
        borrowerRating: rest.borrowerRating ?? rating,
        borrowerReview: rest.borrowerReview ?? review
      };
    })
  };
}

// Save state to localStorage
function saveState(state: AppState) {
  if (browser) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Quota exceeded or storage unavailable (e.g. private mode) — the app
      // keeps working in-memory, persistence just pauses.
      console.error('Failed to save state:', e);
    }
  }
}

// Helper to create notifications with consistent structure
function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  relatedId?: string
): Notification {
  return {
    id: createId('notif'),
    userId,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
    relatedId
  };
}

/**
 * Whether a date range conflicts with the item's blocked dates or with
 * another approved/active borrow of the same item.
 */
function hasDateConflict(
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

/** Round to one decimal place, the precision ratings are displayed at. */
function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

function isValidRating(rating: number): boolean {
  return Number.isFinite(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

/**
 * The item's rating recomputed from borrower-written reviews. When there are
 * none yet the current (seeded) rating is kept rather than dropping to 0.
 */
function computeItemRating(item: Item, history: BorrowHistory[]): number {
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
function foldUserRating(user: User, newRating: number): number {
  const priorCount = Math.max(0, user.totalBorrows);
  if (priorCount === 0 || user.rating <= 0) return roundRating(newRating);
  return roundRating((user.rating * priorCount + newRating) / (priorCount + 1));
}

/** Whether any other approved/active loan still holds the item. */
function isStillOnLoan(state: AppState, itemId: string, excludeRequestId: string): boolean {
  return state.borrowRequests.some(
    (r) =>
      r.id !== excludeRequestId &&
      r.itemId === itemId &&
      (r.status === 'approved' || r.status === 'active')
  );
}

/**
 * Wishlist notifications for an item that just became available again, sent
 * only to subscribers who are allowed to see it (and not to the person who
 * just gave it back).
 */
function wishlistAvailableNotifications(
  state: AppState,
  item: Item,
  excludeUserId?: string
): Notification[] {
  return state.wishlist
    .filter(
      (w) =>
        w.itemId === item.id &&
        w.notifyOnAvailable &&
        w.userId !== excludeUserId &&
        canUserViewItem(item, w.userId, state)
    )
    .map((sub) =>
      createNotification(
        sub.userId,
        'wishlist-available',
        'Item Now Available!',
        `${item.name} is now available to borrow`,
        item.id
      )
    );
}

/**
 * Both parties have confirmed the return: move the request to history, free
 * the item, update counters and reputations, and ask the borrower to review.
 */
function finalizeReturn(
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

  const stillOnLoan = isStillOnLoan(state, request.itemId, request.id);

  const updatedItems = item
    ? state.items.map((i) =>
        i.id === item.id
          ? {
              ...i,
              available: !stillOnLoan,
              condition: feedback.condition || i.condition,
              totalBorrows: i.totalBorrows + 1
            }
          : i
      )
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
    borrowRequests: state.borrowRequests.map((r) =>
      r.id === request.id ? { ...r, status: 'completed' as const } : r
    ),
    borrowHistory: [...state.borrowHistory, history],
    notifications: [...state.notifications, ...notifications]
  };
}

// Create the main app store
function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(loadState());

  // Subscribe to changes and save to localStorage
  if (browser) {
    subscribe((state) => {
      saveState(state);
    });

    // Listen for storage events from other tabs to sync state
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          set(newState);
        } catch (e) {
          console.error('Failed to sync state from other tab:', e);
        }
      }
    });
  }

  return {
    subscribe,

    /** Test-only escape hatch: replace the whole state. App code must use action methods. */
    replaceState: (state: AppState) => set(state),

    // Reset to initial state
    reset: () => set(structuredClone(initialAppState)),

    // User actions
    setCurrentUser: (userId: string) => {
      update((state) => ({ ...state, currentUserId: userId }));
    },

    // Item actions
    addItem: (item: Item) => {
      update((state) => ({
        ...state,
        items: [...state.items, item]
      }));
    },

    updateItem: (itemId: string, updates: Partial<Item>) => {
      update((state) => ({
        ...state,
        items: state.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
      }));
    },

    /**
     * Remove an item from the library. Refused while someone physically has
     * it (an approved or active loan). Pending requests are declined with a
     * notification, and the item is scrubbed from tags and wishlists.
     */
    deleteItem: (itemId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Item not found' };
      update((state) => {
        const item = state.items.find((i) => i.id === itemId);
        if (!item) return state;

        if (item.lenderId !== state.currentUserId) {
          result = { ok: false, error: 'Only the owner can delete this item' };
          return state;
        }

        const onLoan = state.borrowRequests.some(
          (r) => r.itemId === itemId && (r.status === 'approved' || r.status === 'active')
        );
        if (onLoan) {
          result = {
            ok: false,
            error: 'This item is reserved or on loan — wait until it has been returned'
          };
          return state;
        }

        const owner = state.users.find((u) => u.id === item.lenderId);
        const denials: Notification[] = state.borrowRequests
          .filter((r) => r.itemId === itemId && r.status === 'pending')
          .map((r) =>
            createNotification(
              r.borrowerId,
              'request-denied',
              'Item No Longer Available',
              `${owner?.name ?? 'The owner'} removed ${item.name} from their library, so your request was closed`,
              r.id
            )
          );

        result = { ok: true };
        return {
          ...state,
          items: state.items.filter((i) => i.id !== itemId),
          tags: state.tags.map((tag) =>
            tag.itemIds.includes(itemId)
              ? { ...tag, itemIds: tag.itemIds.filter((id) => id !== itemId) }
              : tag
          ),
          wishlist: state.wishlist.filter((w) => w.itemId !== itemId),
          borrowRequests: state.borrowRequests.map((r) =>
            r.itemId === itemId && r.status === 'pending' ? { ...r, status: 'denied' as const } : r
          ),
          notifications: [...state.notifications, ...denials]
        };
      });
      return result;
    },

    // Borrow request actions
    createBorrowRequest: (request: BorrowRequest): ActionResult => {
      let result: ActionResult = { ok: true };
      update((state) => {
        const item = state.items.find((i) => i.id === request.itemId);
        const borrower = state.users.find((u) => u.id === request.borrowerId);

        if (!item || !borrower) {
          result = { ok: false, error: 'Item or borrower no longer exists' };
          return state;
        }

        if (hasDateConflict(state, request.itemId, request.startDate, request.endDate)) {
          result = { ok: false, error: 'Those dates conflict with an existing loan or blocked period' };
          return state;
        }

        const notification = createNotification(
          request.lenderId,
          'borrow-request',
          'New Borrow Request',
          `${borrower.name} wants to borrow your ${item.name}`,
          request.id
        );

        return {
          ...state,
          borrowRequests: [...state.borrowRequests, request],
          notifications: [...state.notifications, notification]
        };
      });
      return result;
    },

    approveRequest: (requestId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'pending') {
          result = { ok: false, error: 'Only pending requests can be approved' };
          return state;
        }

        const item = state.items.find((i) => i.id === request.itemId);
        if (!item) {
          result = { ok: false, error: 'Item no longer exists' };
          return state;
        }

        if (hasDateConflict(state, request.itemId, request.startDate, request.endDate, requestId)) {
          result = { ok: false, error: 'Those dates conflict with an existing loan or blocked period' };
          return state;
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

        result = { ok: true };
        return {
          ...state,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'approved' as const } : r
          ),
          items: state.items.map((i) => (i.id === item.id ? { ...i, available: false } : i)),
          notifications: notification
            ? [...state.notifications, notification]
            : state.notifications
        };
      });
      return result;
    },

    denyRequest: (requestId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'pending') {
          result = { ok: false, error: 'Only pending requests can be declined' };
          return state;
        }

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

        result = { ok: true };
        return {
          ...state,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'denied' as const } : r
          ),
          notifications: notification
            ? [...state.notifications, notification]
            : state.notifications
        };
      });
      return result;
    },

    /**
     * Borrower cancels a request they no longer need (pending or approved),
     * or a lender retracts an approval before pickup. Active loans can't be
     * cancelled — the item has to come back through the return flow.
     */
    cancelRequest: (requestId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        const actorId = state.currentUserId;
        const isBorrower = actorId === request.borrowerId;
        const isLender = actorId === request.lenderId;
        if (!isBorrower && !isLender) {
          result = { ok: false, error: 'Only the borrower or lender can cancel this request' };
          return state;
        }

        if (request.status === 'pending' && !isBorrower) {
          result = { ok: false, error: 'Decline the request instead of cancelling it' };
          return state;
        }
        if (request.status !== 'pending' && request.status !== 'approved') {
          result = { ok: false, error: 'Only pending or approved requests can be cancelled' };
          return state;
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
          const stillOnLoan = isStillOnLoan(state, item.id, requestId);
          if (!item.available && !stillOnLoan) {
            items = state.items.map((i) => (i.id === item.id ? { ...i, available: true } : i));
            notifications.push(...wishlistAvailableNotifications(state, item, request.borrowerId));
          }
        }

        result = { ok: true };
        return {
          ...state,
          items,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'cancelled' as const } : r
          ),
          notifications: [...state.notifications, ...notifications]
        };
      });
      return result;
    },

    /**
     * Either party confirms the physical handoff. The loan becomes active
     * only once both the borrower and the lender have confirmed.
     */
    confirmPickup: (requestId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'approved') {
          result = { ok: false, error: 'Only approved requests can be picked up' };
          return state;
        }

        const actorId = state.currentUserId;
        if (actorId !== request.borrowerId && actorId !== request.lenderId) {
          result = { ok: false, error: 'Only the borrower or lender can confirm pickup' };
          return state;
        }

        const confirmed = request.pickupConfirmedBy ?? [];
        if (confirmed.includes(actorId)) {
          result = { ok: false, error: 'You already confirmed this pickup' };
          return state;
        }

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

        result = { ok: true };
        return {
          ...state,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  pickupConfirmedBy: nowConfirmed,
                  status: bothConfirmed ? ('active' as const) : r.status
                }
              : r
          ),
          notifications: notification ? [...state.notifications, notification] : state.notifications
        };
      });
      return result;
    },

    /**
     * Either party confirms the item came back. The lender's `feedback`
     * (rating of the borrower, condition change) is recorded whichever order
     * the confirmations arrive in; the borrower's is ignored. When both have
     * confirmed, the borrow is completed and moved to history.
     */
    confirmReturn: (requestId: string, feedback: LenderReturnFeedback = {}): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'active') {
          result = { ok: false, error: 'Only active loans can be returned' };
          return state;
        }

        const actorId = state.currentUserId;
        const isLender = actorId === request.lenderId;
        if (actorId !== request.borrowerId && !isLender) {
          result = { ok: false, error: 'Only the borrower or lender can confirm a return' };
          return state;
        }

        const confirmed = request.returnConfirmedBy ?? [];
        if (confirmed.includes(actorId)) {
          result = { ok: false, error: 'You already confirmed this return' };
          return state;
        }

        if (isLender && feedback.rating !== undefined && !isValidRating(feedback.rating)) {
          result = { ok: false, error: `Rating must be between ${MIN_RATING} and ${MAX_RATING}` };
          return state;
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
          notifications: notification ? [...state.notifications, notification] : state.notifications
        };

        result = { ok: true };
        return bothConfirmed
          ? finalizeReturn(withConfirmation, updatedRequest, lenderFeedback)
          : withConfirmation;
      });
      return result;
    },

    /**
     * The borrower reviews the item after a completed borrow. One review per
     * history entry; the item's rating is recomputed from borrower reviews.
     */
    submitItemReview: (historyId: string, rating: number, review: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Borrow not found' };
      update((state) => {
        const entry = state.borrowHistory.find((h) => h.id === historyId);
        if (!entry) return state;

        if (entry.borrowerId !== state.currentUserId) {
          result = { ok: false, error: 'Only the borrower can review this item' };
          return state;
        }
        if (entry.reviewerId) {
          result = { ok: false, error: 'You already reviewed this borrow' };
          return state;
        }
        if (!isValidRating(rating)) {
          result = { ok: false, error: `Rating must be between ${MIN_RATING} and ${MAX_RATING}` };
          return state;
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

        result = { ok: true };
        return {
          ...state,
          borrowHistory,
          items: item
            ? state.items.map((i) =>
                i.id === item.id ? { ...i, rating: computeItemRating(i, borrowHistory) } : i
              )
            : state.items,
          notifications: notification ? [...state.notifications, notification] : state.notifications
        };
      });
      return result;
    },

    // Nudge lender about pending request
    nudgeRequest: (requestId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'pending') {
          result = { ok: false, error: 'Only pending requests can be nudged' };
          return state;
        }

        if (request.lastNudgedAt) {
          const daysSinceNudge =
            (Date.now() - new Date(request.lastNudgedAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceNudge < NUDGE_DELAY_DAYS) {
            result = { ok: false, error: `You can send another reminder in ${NUDGE_DELAY_DAYS} days` };
            return state;
          }
        }

        const item = state.items.find((i) => i.id === request.itemId);
        const borrower = state.users.find((u) => u.id === request.borrowerId);

        // Guard against missing data
        if (!item || !borrower) {
          result = { ok: false, error: 'Item or borrower no longer exists' };
          return state;
        }

        const notification = createNotification(
          request.lenderId,
          'request-nudge',
          'Friendly Reminder',
          `👋 ${borrower.name} sent you a friendly reminder about their request for ${item.name}`,
          requestId
        );

        result = { ok: true };
        return {
          ...state,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId ? { ...r, lastNudgedAt: new Date().toISOString() } : r
          ),
          notifications: [...state.notifications, notification]
        };
      });
      return result;
    },

    // Tag actions
    createTag: (tag: Tag) => {
      update((state) => ({
        ...state,
        tags: [...state.tags, tag]
      }));
    },

    updateTag: (tagId: string, updates: Partial<Tag>) => {
      update((state) => ({
        ...state,
        tags: state.tags.map((tag) => (tag.id === tagId ? { ...tag, ...updates } : tag))
      }));
    },

    deleteTag: (tagId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Tag not found' };
      update((state) => {
        const tag = state.tags.find((t) => t.id === tagId);
        if (!tag) return state;
        if (tag.createdBy !== state.currentUserId) {
          result = { ok: false, error: 'Only the tag\'s creator can delete it' };
          return state;
        }
        result = { ok: true };
        return { ...state, tags: state.tags.filter((t) => t.id !== tagId) };
      });
      return result;
    },

    addItemToTag: (tagId: string, itemId: string) => {
      update((state) => ({
        ...state,
        tags: state.tags.map((tag) =>
          tag.id === tagId && !tag.itemIds.includes(itemId)
            ? { ...tag, itemIds: [...tag.itemIds, itemId] }
            : tag
        )
      }));
    },

    removeItemFromTag: (tagId: string, itemId: string) => {
      update((state) => ({
        ...state,
        tags: state.tags.map((tag) =>
          tag.id === tagId
            ? { ...tag, itemIds: tag.itemIds.filter((id) => id !== itemId) }
            : tag
        )
      }));
    },

    // Friend request actions
    sendFriendRequest: (fromUserId: string, toUserId: string, message?: string) => {
      update((state) => {
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
      });
    },

    acceptFriendRequest: (requestId: string) => {
      update((state) => {
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
          friendRequests: state.friendRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'accepted' as const } : r
          ),
          notifications: [...state.notifications, notification]
        };
      });
    },

    declineFriendRequest: (requestId: string, message?: string) => {
      update((state) => {
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
          friendRequests: state.friendRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'declined' as const } : r
          ),
          notifications: [...state.notifications, notification]
        };
      });
    },

    promoteToCloseFriend: (userId: string, friendId: string) => {
      update((state) => ({
        ...state,
        users: state.users.map((user) =>
          user.id === userId
            ? {
                ...user,
                closeFriendIds: user.closeFriendIds.includes(friendId)
                  ? user.closeFriendIds
                  : [...user.closeFriendIds, friendId]
              }
            : user
        )
      }));
    },

    demoteFromCloseFriend: (userId: string, friendId: string) => {
      update((state) => ({
        ...state,
        users: state.users.map((user) =>
          user.id === userId
            ? {
                ...user,
                closeFriendIds: user.closeFriendIds.filter((id) => id !== friendId)
              }
            : user
        )
      }));
    },

    // Wishlist actions
    addToWishlist: (itemId: string, notifyOnAvailable: boolean = true) => {
      update((state) => {
        // Only items that exist and are visible to the user can be wishlisted
        const item = state.items.find((i) => i.id === itemId);
        if (!item || !canUserViewItem(item, state.currentUserId, state)) return state;

        // Check if already in wishlist
        const existing = state.wishlist.find(
          (w) => w.userId === state.currentUserId && w.itemId === itemId
        );
        if (existing) return state;

        const wishlistItem: WishlistItem = {
          id: createId('wish'),
          userId: state.currentUserId,
          itemId,
          notifyOnAvailable,
          addedAt: new Date().toISOString()
        };

        return {
          ...state,
          wishlist: [...state.wishlist, wishlistItem]
        };
      });
    },

    removeFromWishlist: (itemId: string) => {
      update((state) => ({
        ...state,
        wishlist: state.wishlist.filter(
          (w) => !(w.userId === state.currentUserId && w.itemId === itemId)
        )
      }));
    },

    toggleWishlistNotification: (itemId: string) => {
      update((state) => ({
        ...state,
        wishlist: state.wishlist.map((w) =>
          w.userId === state.currentUserId && w.itemId === itemId
            ? { ...w, notifyOnAvailable: !w.notifyOnAvailable }
            : w
        )
      }));
    },

    // Notification actions
    markNotificationAsRead: (notificationId: string) => {
      update((state) => ({
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      }));
    },

    markAllNotificationsAsRead: (userId: string) => {
      update((state) => ({
        ...state,
        notifications: state.notifications.map((n) =>
          n.userId === userId ? { ...n, read: true } : n
        )
      }));
    }
  };
}

export const appStore = createAppStore();

// Derived stores for convenient access
export const currentUser = derived(appStore, ($state) =>
  $state.users.find((u) => u.id === $state.currentUserId)
);

export const currentUserItems = derived(appStore, ($state) =>
  $state.items.filter((item) => item.lenderId === $state.currentUserId)
);

export const currentUserNotifications = derived(appStore, ($state) =>
  $state.notifications
    .filter((n) => n.userId === $state.currentUserId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);

export const unreadNotificationsCount = derived(currentUserNotifications, ($notifications) =>
  $notifications.filter((n) => !n.read).length
);

export const incomingRequests = derived(appStore, ($state) =>
  $state.borrowRequests.filter(
    (req) => req.lenderId === $state.currentUserId && req.status === 'pending'
  )
);

export const outgoingRequests = derived(appStore, ($state) =>
  $state.borrowRequests.filter((req) => req.borrowerId === $state.currentUserId)
);

// Loans the current user has approved but that haven't been picked up yet
export const approvedLoans = derived(appStore, ($state) =>
  $state.borrowRequests.filter(
    (req) => req.lenderId === $state.currentUserId && req.status === 'approved'
  )
);

export const activeLoans = derived(appStore, ($state) =>
  $state.borrowRequests.filter(
    (req) => req.lenderId === $state.currentUserId && req.status === 'active'
  )
);

// The borrower-side mirror of approvedLoans + activeLoans: items the current
// user is holding or about to pick up.
export const borrowedByMe = derived(appStore, ($state) =>
  $state.borrowRequests.filter(
    (req) =>
      req.borrowerId === $state.currentUserId &&
      (req.status === 'approved' || req.status === 'active')
  )
);

/**
 * Completed borrows of an item by a user that haven't been reviewed yet,
 * most recent first. Drives the inline review form on the item page.
 */
export function pendingItemReviews(state: AppState, itemId: string, userId: string): BorrowHistory[] {
  return state.borrowHistory
    .filter((h) => h.itemId === itemId && h.borrowerId === userId && !h.reviewerId)
    .sort((a, b) => (a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0));
}

/** Whether a user has confirmed the given handoff step on a request. */
export function hasConfirmed(
  request: BorrowRequest,
  step: 'pickup' | 'return',
  userId: string
): boolean {
  const list = step === 'pickup' ? request.pickupConfirmedBy : request.returnConfirmedBy;
  return (list ?? []).includes(userId);
}

export const incomingFriendRequests = derived(appStore, ($state) =>
  $state.friendRequests.filter(
    (req) => req.toUserId === $state.currentUserId && req.status === 'pending'
  )
);

export const outgoingFriendRequests = derived(appStore, ($state) =>
  $state.friendRequests.filter((req) => req.fromUserId === $state.currentUserId)
);

// Derived store for current user's wishlist
export const currentUserWishlist = derived(appStore, ($state) =>
  $state.wishlist
    .filter((w) => w.userId === $state.currentUserId)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
);

// Derived store for wishlist items with full item details
export const currentUserWishlistItems = derived(appStore, ($state) => {
  const wishlistEntries = $state.wishlist.filter((w) => w.userId === $state.currentUserId);
  return wishlistEntries
    .map((entry) => {
      const item = $state.items.find((i) => i.id === entry.itemId);
      return item ? { ...entry, item } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
});

// Derived store for items the current user can view
export const visibleItems = derived(appStore, ($state) =>
  $state.items.filter((item) => canUserViewItem(item, $state.currentUserId, $state))
);

// Whether a user is at least a friend of the lender (close friends count too)
function isFriendOfLender(lender: User, userId: string): boolean {
  return lender.friendIds.includes(userId) || lender.closeFriendIds.includes(userId);
}

// Helper function to check if a user can view an item
export function canUserViewItem(item: Item, currentUserId: string, state: AppState): boolean {
  if (item.lenderId === currentUserId) return true;

  const lender = state.users.find((u) => u.id === item.lenderId);
  if (!lender) return false;

  switch (item.permissionLevel) {
    case 'specific-users': {
      return item.allowedUserIds?.includes(currentUserId) || false;
    }
    case 'close-friends': {
      return lender.closeFriendIds.includes(currentUserId);
    }
    case 'friends': {
      return isFriendOfLender(lender, currentUserId);
    }
    case 'friends-of-friends': {
      if (isFriendOfLender(lender, currentUserId)) return true;
      // Check if any of user's friends are friends with the lender
      const currentUserData = state.users.find((u) => u.id === currentUserId);
      if (!currentUserData) return false;
      return currentUserData.friendIds.some((friendId) => lender.friendIds.includes(friendId));
    }
    case 'neighbors': {
      // For simplicity, all users in same city are neighbors.
      // Both sides need a known city — missing addresses never match.
      const currentUserCity = state.users.find((u) => u.id === currentUserId)?.address?.city;
      const lenderCity = lender.address?.city;
      return !!currentUserCity && currentUserCity === lenderCity;
    }
    default:
      return false;
  }
}

// Helper to get category path (for breadcrumbs)
export function getCategoryPath(categoryId: string, state: AppState): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let currentCat = state.categories.find((c) => c.id === categoryId);

  // The visited set guards against cyclic parentId chains, which would
  // otherwise loop forever.
  while (currentCat && !visited.has(currentCat.id)) {
    visited.add(currentCat.id);
    path.unshift(currentCat.name);
    currentCat = currentCat.parentId
      ? state.categories.find((c) => c.id === currentCat!.parentId)
      : undefined;
  }

  return path;
}

// Helper to get permission level display info
export function getPermissionLevelInfo(permissionLevel: string): {
  label: string;
  icon: string;
  color: string;
} {
  switch (permissionLevel) {
    case 'close-friends':
      return { label: 'Close Friends', icon: '💚', color: '#10b981' };
    case 'friends':
      return { label: 'Friends', icon: '👥', color: '#3b82f6' };
    case 'friends-of-friends':
      return { label: 'Friends of Friends', icon: '🔗', color: '#8b5cf6' };
    case 'neighbors':
      return { label: 'Neighbors', icon: '🏘️', color: '#f59e0b' };
    case 'specific-users':
      return { label: 'Specific People', icon: '🔒', color: '#6b7280' };
    default:
      return { label: 'Unknown', icon: '❓', color: '#6b7280' };
  }
}
