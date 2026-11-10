/**
 * The acting user.
 *
 * The prototype has no sign-in: `state.currentUserId` says who is acting, and
 * every rule treats that user as the actor. Switching it is unrestricted (the
 * navbar's user switcher), and the id is not checked against `users`.
 */
import type { AppState, User } from '../types';

export function setCurrentUser(state: AppState, userId: string): AppState {
  return { ...state, currentUserId: userId };
}

/** The acting user's record, if it exists. */
export function currentUserOf(state: AppState): User | undefined {
  return state.users.find((u) => u.id === state.currentUserId);
}
