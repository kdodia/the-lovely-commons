/**
 * Wishlist.
 *
 * The current user can wishlist an item that exists and that they are
 * allowed to see (see permissions), once per item; adding it again does
 * nothing. They can remove their own entry and switch its "notify when
 * available" flag on or off. Each entry belongs to the user who added it.
 *
 * An item is available when it is here now: no loan of it is active. When
 * it comes back (a loan's return is completed and no other loan of it is
 * active), every subscriber with notifications on who may still see the
 * item is told — except the person who just gave it back. Approving or
 * cancelling a reservation for later dates does not change availability,
 * so it sends nothing.
 */
import type { AppState, Item, Notification, WishlistItem } from '../types';
import { createId } from './ids';
import { createNotification } from './notifications';
import { canUserViewItem } from './permissions';

export function addToWishlist(
  state: AppState,
  itemId: string,
  notifyOnAvailable: boolean = true
): AppState {
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
}

export function removeFromWishlist(state: AppState, itemId: string): AppState {
  return {
    ...state,
    wishlist: state.wishlist.filter(
      (w) => !(w.userId === state.currentUserId && w.itemId === itemId)
    )
  };
}

export function toggleWishlistNotification(state: AppState, itemId: string): AppState {
  return {
    ...state,
    wishlist: state.wishlist.map((w) =>
      w.userId === state.currentUserId && w.itemId === itemId
        ? { ...w, notifyOnAvailable: !w.notifyOnAvailable }
        : w
    )
  };
}

/**
 * Wishlist notifications for an item that just became available again, sent
 * only to subscribers who are allowed to see it (and not to the person who
 * just gave it back).
 */
export function wishlistAvailableNotifications(
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

/** A user's wishlist entries, most recently added first. */
export function wishlistFor(state: AppState, userId: string): WishlistItem[] {
  return state.wishlist
    .filter((w) => w.userId === userId)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

/**
 * A user's wishlist entries joined with their items, most recently added
 * first. Entries whose item no longer exists are left out.
 */
export function wishlistItemsFor(state: AppState, userId: string) {
  const wishlistEntries = state.wishlist.filter((w) => w.userId === userId);
  return wishlistEntries
    .map((entry) => {
      const item = state.items.find((i) => i.id === entry.itemId);
      return item ? { ...entry, item } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}
