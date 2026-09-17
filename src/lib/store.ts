import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { AppState, Item, User, BorrowRequest, Notification, BorrowHistory, Tag, FriendRequest, ItemCondition, WishlistItem } from './types';
import { initialAppState } from './mockData';
import { rangesOverlap, todayLocalISO } from './dates';
import { NUDGE_DELAY_DAYS } from './constants';

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
          return merged;
        }
      } catch (e) {
        console.error('Failed to parse stored state:', e);
      }
    }
  }
  return defaults;
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

    deleteItem: (itemId: string) => {
      update((state) => ({
        ...state,
        items: state.items.filter((item) => item.id !== itemId)
      }));
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

    /** Lender confirms the borrower picked the item up: approved → active. */
    markPickedUp: (requestId: string): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'approved') {
          result = { ok: false, error: 'Only approved requests can be marked as picked up' };
          return state;
        }

        result = { ok: true };
        return {
          ...state,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'active' as const } : r
          )
        };
      });
      return result;
    },

    // Complete a borrow and move to history
    completeBorrow: (requestId: string, rating: number, review: string, newCondition?: ItemCondition): ActionResult => {
      let result: ActionResult = { ok: false, error: 'Request not found' };
      update((state) => {
        const request = state.borrowRequests.find((r) => r.id === requestId);
        if (!request) return state;

        if (request.status !== 'active' && request.status !== 'approved') {
          result = { ok: false, error: 'Only active loans can be marked as returned' };
          return state;
        }

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
          rating,
          review,
          conditionBefore,
          conditionAfter: newCondition || conditionBefore
        };

        // The item becomes available again unless another approved/active
        // loan is still outstanding for it.
        const stillOnLoan = state.borrowRequests.some(
          (r) =>
            r.id !== requestId &&
            r.itemId === request.itemId &&
            (r.status === 'approved' || r.status === 'active')
        );

        // Update item rating, availability, condition, and borrow count
        let updatedItems = state.items;
        if (item) {
          const allItemHistory = [...state.borrowHistory, history].filter(
            (h) => h.itemId === item.id && h.rating
          );

          // Guard against division by zero to prevent NaN
          const avgRating = allItemHistory.length > 0
            ? allItemHistory.reduce((sum, h) => sum + (h.rating || 0), 0) / allItemHistory.length
            : 0;

          updatedItems = state.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  rating: Math.round(avgRating * 10) / 10,
                  available: !stillOnLoan,
                  condition: newCondition || i.condition,
                  totalBorrows: i.totalBorrows + 1
                }
              : i
          );
        }

        // Keep the users' lending/borrowing counters in sync
        const updatedUsers = state.users.map((u) => {
          if (u.id === request.borrowerId) return { ...u, totalBorrows: u.totalBorrows + 1 };
          if (u.id === request.lenderId) return { ...u, totalLends: u.totalLends + 1 };
          return u;
        });

        // Notify wishlist subscribers, but only when the item actually
        // transitioned back to available and only if they're allowed to see it.
        const wishlistNotifications: Notification[] = [];
        if (item && wasUnavailable && !stillOnLoan) {
          const subscribers = state.wishlist.filter(
            (w) =>
              w.itemId === item.id &&
              w.notifyOnAvailable &&
              w.userId !== request.borrowerId &&
              canUserViewItem(item, w.userId, state)
          );

          for (const sub of subscribers) {
            wishlistNotifications.push(
              createNotification(
                sub.userId,
                'wishlist-available',
                'Item Now Available!',
                `${item.name} is now available to borrow`,
                item.id
              )
            );
          }
        }

        result = { ok: true };
        return {
          ...state,
          items: updatedItems,
          users: updatedUsers,
          borrowRequests: state.borrowRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'completed' as const } : r
          ),
          borrowHistory: [...state.borrowHistory, history],
          notifications: [...state.notifications, ...wishlistNotifications]
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
