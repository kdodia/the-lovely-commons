/**
 * Local-timezone date helpers.
 *
 * All dates in app state are stored as 'YYYY-MM-DD' strings representing a
 * calendar day in the user's local timezone. `Date.prototype.toISOString()`
 * converts to UTC and can shift the calendar day for users outside UTC, so
 * these helpers must be used instead when converting between Date objects
 * and stored date strings.
 */

/** Format a Date as 'YYYY-MM-DD' using its local calendar day. */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a 'YYYY-MM-DD' string as local midnight (not UTC midnight). */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Today's date as a 'YYYY-MM-DD' string in local time. */
export function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

/** A new Date shifted by the given number of days (original is not mutated). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Local midnight of the given date (defaults to now). */
export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Format a stored 'YYYY-MM-DD' string for display without a UTC shift. */
export function formatDisplayDate(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', options);
}

/**
 * Whether two inclusive 'YYYY-MM-DD' ranges overlap.
 * Lexicographic comparison is safe for this format.
 */
export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA <= endB && startB <= endA;
}
