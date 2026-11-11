/**
 * Items in the library.
 *
 * - add: the item is stored as given. Neither the actor nor the item's
 *   `lenderId` is checked.
 * - update: the given fields are merged into the item. The actor is not
 *   checked.
 * - delete: only the item's owner, and not while an approved or active
 *   request holds it (someone has reserved it or has it). Pending requests
 *   for it are declined and each requester is told; the item is removed from
 *   every tag and every wishlist.
 *
 * Categories form a tree through `parentId`; an item's category path runs
 * from the root down to its category.
 */
import type { AppState, Item, Notification } from '../types';
import { accept, reject, type Transition } from './transition';
import { patchById } from './lists';
import { createNotification } from './notifications';
import { isReservedOrOnLoan } from './requests';

export function addItem(state: AppState, item: Item): AppState {
  return {
    ...state,
    items: [...state.items, item]
  };
}

export function updateItem(state: AppState, itemId: string, updates: Partial<Item>): AppState {
  return {
    ...state,
    items: patchById(state.items, itemId, updates)
  };
}

/**
 * Remove an item from the library. Refused while an approved or active
 * loan holds it (someone has reserved it or has it). Pending requests are declined with a
 * notification, and the item is scrubbed from tags and wishlists.
 */
export function deleteItem(state: AppState, itemId: string): Transition {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return reject(state, 'Item not found');

  if (item.lenderId !== state.currentUserId) {
    return reject(state, 'Only the owner can delete this item');
  }

  if (isReservedOrOnLoan(state, itemId)) {
    return reject(state, 'This item is reserved or on loan — wait until it has been returned');
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

  return accept({
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
  });
}

/** The items a user has put in the library. */
export function itemsOwnedBy(state: AppState, userId: string): Item[] {
  return state.items.filter((item) => item.lenderId === userId);
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
