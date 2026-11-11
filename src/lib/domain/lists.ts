/**
 * Small helpers for replacing one record in a state collection without
 * mutating it.
 */

/**
 * A copy of `list` in which the entry with the given id is replaced: merged
 * with `patch` when it is an object, or by the result of `patch(entry)` when
 * it is a function. Other entries are kept as they are.
 */
export function patchById<T extends { id: string }>(
  list: T[],
  id: string,
  patch: Partial<T> | ((entry: T) => T)
): T[] {
  return list.map((entry) =>
    entry.id === id ? (typeof patch === 'function' ? patch(entry) : { ...entry, ...patch }) : entry
  );
}
