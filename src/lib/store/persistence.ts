/**
 * Saving app state to localStorage, loading it back (upgrading anything an
 * older version saved), and picking up changes saved by other tabs.
 */
import { browser } from '$app/environment';
import type { AppState } from '../types';
import { initialAppState } from '../mockData';

export const STORAGE_KEY = 'distributed-library-app-state';

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

// Load state from localStorage or use initial state
export function loadState(): AppState {
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
export function migrateState(state: AppState): AppState {
  return {
    ...state,
    // `available` used to turn false on approval; it now means "no loan of
    // it is active". Recompute it for items with borrow requests on record
    // (items without any keep what was saved).
    items: state.items.map((item) => {
      const requests = state.borrowRequests.filter((r) => r.itemId === item.id);
      if (requests.length === 0) return item;
      const available = !requests.some((r) => r.status === 'active');
      return item.available === available ? item : { ...item, available };
    }),
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
export function saveState(state: AppState) {
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

/**
 * In the browser, save every state the store emits and replace the store's
 * state whenever another tab saves. Does nothing during SSR.
 */
export function connectToStorage(store: {
  subscribe: (run: (state: AppState) => void) => unknown;
  set: (state: AppState) => void;
}) {
  if (!browser) return;

  // Subscribe to changes and save to localStorage
  store.subscribe((state) => {
    saveState(state);
  });

  // Listen for storage events from other tabs to sync state
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const newState = JSON.parse(event.newValue);
        store.set(newState);
      } catch (e) {
        console.error('Failed to sync state from other tab:', e);
      }
    }
  });
}
