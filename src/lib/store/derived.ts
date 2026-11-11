/**
 * Derived stores: views of the shared state from the current user's point of
 * view. Each is a thin wrapper over a selector in `$lib/domain`.
 */
import { derived } from 'svelte/store';
import { todayLocalISO } from '../dates';
import * as rules from '../domain';
import { appStore } from './appStore';

// Derived stores for convenient access
export const currentUser = derived(appStore, ($state) => rules.currentUserOf($state));

export const currentUserItems = derived(appStore, ($state) =>
  rules.itemsOwnedBy($state, $state.currentUserId)
);

export const currentUserNotifications = derived(appStore, ($state) =>
  rules.notificationsFor($state, $state.currentUserId)
);

export const unreadNotificationsCount = derived(currentUserNotifications, ($notifications) =>
  $notifications.filter((n) => !n.read).length
);

export const incomingRequests = derived(appStore, ($state) =>
  rules.incomingRequestsFor($state, $state.currentUserId)
);

export const outgoingRequests = derived(appStore, ($state) =>
  rules.outgoingRequestsFor($state, $state.currentUserId)
);

// Loans the current user has approved but that haven't been picked up yet
export const approvedLoans = derived(appStore, ($state) =>
  rules.approvedLoansFor($state, $state.currentUserId)
);

export const activeLoans = derived(appStore, ($state) =>
  rules.activeLoansFor($state, $state.currentUserId)
);

// The borrower-side mirror of approvedLoans + activeLoans: items the current
// user is holding or about to pick up.
export const borrowedByMe = derived(appStore, ($state) =>
  rules.borrowedBy($state, $state.currentUserId)
);

// Active loans past their return date, from each side. "Today" is read when
// the state changes, which is often enough for a day-granular flag.
export const overdueLentLoans = derived(appStore, ($state) =>
  rules.overdueLentBy($state, $state.currentUserId, todayLocalISO())
);

export const overdueBorrowedLoans = derived(appStore, ($state) =>
  rules.overdueBorrowedBy($state, $state.currentUserId, todayLocalISO())
);

export const incomingFriendRequests = derived(appStore, ($state) =>
  rules.incomingFriendRequestsFor($state, $state.currentUserId)
);

export const outgoingFriendRequests = derived(appStore, ($state) =>
  rules.outgoingFriendRequestsFor($state, $state.currentUserId)
);

// Derived store for current user's wishlist
export const currentUserWishlist = derived(appStore, ($state) =>
  rules.wishlistFor($state, $state.currentUserId)
);

// Derived store for wishlist items with full item details
export const currentUserWishlistItems = derived(appStore, ($state) =>
  rules.wishlistItemsFor($state, $state.currentUserId)
);

// Derived store for items the current user can view
export const visibleItems = derived(appStore, ($state) =>
  rules.visibleItemsFor($state, $state.currentUserId)
);
