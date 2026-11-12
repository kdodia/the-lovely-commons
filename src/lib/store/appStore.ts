/**
 * The app store: the shared state plus one method per action. Each method
 * applies one rule from `$lib/domain` to the current state and returns that
 * rule's result; the rules themselves live there, not here.
 */
import { writable, get } from 'svelte/store';
import type { AppState, BorrowRequest, Item, LenderReturnFeedback, Tag } from '../types';
import { initialAppState } from '../mockData';
import * as rules from '../domain';
import type { ActionResult, Transition } from '../domain';
import { getScenario } from '../scenarios';
import { connectToStorage, loadState, migrateState } from './persistence';

// Create the main app store
function createAppStore() {
  const store = writable<AppState>(loadState());
  const { subscribe, set } = store;
  connectToStorage(store);

  /**
   * Run a rule against the current state, store the state it returns, and
   * hand back its result. A rule that changes nothing returns the state it
   * was given, and then nothing is stored (or saved).
   */
  function apply<R>(rule: (state: AppState) => Transition<R>): R {
    const current = get(store);
    const { state, result } = rule(current);
    if (state !== current) set(state);
    return result;
  }

  /** `apply` for rules that cannot be refused and just return the next state. */
  function applyState(rule: (state: AppState) => AppState): void {
    apply((state) => ({ state: rule(state), result: undefined }));
  }

  return {
    subscribe,

    /** Test-only escape hatch: replace the whole state. App code must use action methods. */
    replaceState: (state: AppState) => set(state),

    // Reset to initial state
    reset: () => set(structuredClone(initialAppState)),

    /**
     * Tester's kit: replace the whole state with a ready-made scenario (see
     * `$lib/scenarios`), acting as its user. Saved like any other change.
     */
    loadScenario: (scenarioId: string): ActionResult => {
      const scenario = getScenario(scenarioId);
      if (!scenario) return { ok: false, error: 'No such scenario' };
      set(migrateState(scenario.build()));
      return { ok: true };
    },

    // User actions
    setCurrentUser: (userId: string) => applyState((s) => rules.setCurrentUser(s, userId)),

    // Item actions
    addItem: (item: Item) => applyState((s) => rules.addItem(s, item)),
    updateItem: (itemId: string, updates: Partial<Item>) =>
      applyState((s) => rules.updateItem(s, itemId, updates)),
    deleteItem: (itemId: string): ActionResult => apply((s) => rules.deleteItem(s, itemId)),

    // Borrow request actions
    createBorrowRequest: (request: BorrowRequest): ActionResult =>
      apply((s) => rules.createBorrowRequest(s, request)),
    approveRequest: (requestId: string): ActionResult =>
      apply((s) => rules.approveRequest(s, requestId)),
    denyRequest: (requestId: string): ActionResult => apply((s) => rules.denyRequest(s, requestId)),
    cancelRequest: (requestId: string): ActionResult =>
      apply((s) => rules.cancelRequest(s, requestId)),
    sendRequestMessage: (requestId: string, text: string): ActionResult =>
      apply((s) => rules.sendRequestMessage(s, requestId, text)),
    markRequestMessagesRead: (requestId: string): ActionResult =>
      apply((s) => rules.markRequestMessagesRead(s, requestId)),
    confirmPickup: (requestId: string): ActionResult =>
      apply((s) => rules.confirmPickup(s, requestId)),
    confirmReturn: (requestId: string, feedback: LenderReturnFeedback = {}): ActionResult =>
      apply((s) => rules.confirmReturn(s, requestId, feedback)),
    submitItemReview: (historyId: string, rating: number, review: string): ActionResult =>
      apply((s) => rules.submitItemReview(s, historyId, rating, review)),
    nudgeRequest: (requestId: string): ActionResult => apply((s) => rules.nudgeRequest(s, requestId)),
    sendReturnReminder: (requestId: string): ActionResult =>
      apply((s) => rules.sendReturnReminder(s, requestId)),
    /** Returns how many loans were announced. */
    notifyOverdueLoans: (): number => apply(rules.notifyOverdueLoans),

    // Tag actions
    createTag: (tag: Tag) => applyState((s) => rules.createTag(s, tag)),
    updateTag: (tagId: string, updates: Partial<Tag>) =>
      applyState((s) => rules.updateTag(s, tagId, updates)),
    deleteTag: (tagId: string): ActionResult => apply((s) => rules.deleteTag(s, tagId)),
    addItemToTag: (tagId: string, itemId: string) =>
      applyState((s) => rules.addItemToTag(s, tagId, itemId)),
    removeItemFromTag: (tagId: string, itemId: string) =>
      applyState((s) => rules.removeItemFromTag(s, tagId, itemId)),

    // Friend request actions
    sendFriendRequest: (fromUserId: string, toUserId: string, message?: string) =>
      applyState((s) => rules.sendFriendRequest(s, fromUserId, toUserId, message)),
    acceptFriendRequest: (requestId: string) =>
      applyState((s) => rules.acceptFriendRequest(s, requestId)),
    declineFriendRequest: (requestId: string, message?: string) =>
      applyState((s) => rules.declineFriendRequest(s, requestId, message)),
    promoteToCloseFriend: (userId: string, friendId: string) =>
      applyState((s) => rules.promoteToCloseFriend(s, userId, friendId)),
    demoteFromCloseFriend: (userId: string, friendId: string) =>
      applyState((s) => rules.demoteFromCloseFriend(s, userId, friendId)),

    // Wishlist actions
    addToWishlist: (itemId: string, notifyOnAvailable: boolean = true) =>
      applyState((s) => rules.addToWishlist(s, itemId, notifyOnAvailable)),
    removeFromWishlist: (itemId: string) => applyState((s) => rules.removeFromWishlist(s, itemId)),
    toggleWishlistNotification: (itemId: string) =>
      applyState((s) => rules.toggleWishlistNotification(s, itemId)),

    // Notification actions
    markNotificationAsRead: (notificationId: string) =>
      applyState((s) => rules.markNotificationAsRead(s, notificationId)),
    markAllNotificationsAsRead: (userId: string) =>
      applyState((s) => rules.markAllNotificationsAsRead(s, userId))
  };
}

export const appStore = createAppStore();
