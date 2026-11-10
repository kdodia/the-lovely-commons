/**
 * How a rule reports its outcome.
 *
 * Every state-changing rule in this folder is a function of the current
 * AppState (plus its arguments) that returns the next state. Rules that can
 * refuse return a Transition: the next state together with an ActionResult
 * saying whether the action was accepted and, if not, why. A refusal returns
 * the very same state object it was given, so nothing is saved.
 *
 * The acting user is always `state.currentUserId`.
 */
import type { AppState } from '../types';

/** Result of a store action that can be rejected (e.g. date conflicts). */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** The next state and what to tell the caller. */
export type Transition<R = ActionResult> = { state: AppState; result: R };

/** The action went ahead; `state` is the new state. */
export function accept(state: AppState): Transition {
  return { state, result: { ok: true } };
}

/** The action was refused; pass the unchanged state so nothing is saved. */
export function reject(state: AppState, error: string): Transition {
  return { state, result: { ok: false, error } };
}
