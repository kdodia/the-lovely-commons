/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// Time-related constants
export const NUDGE_DELAY_DAYS = 3; // Days to wait before allowing nudge
export const RETURN_REMINDER_COOLDOWN_DAYS = 2; // Days between overdue-return reminders
export const CALENDAR_PREVIEW_DAYS = 90; // Number of days to show in calendar
export const TOAST_DURATION_MS = 3000; // Duration to show toast notifications

// UI constants
export const DESCRIPTION_PREVIEW_LENGTH = 80; // Characters to show in item description preview
export const MAX_RATING = 5; // Maximum rating value
export const MIN_RATING = 1; // Minimum rating value
export const DEFAULT_RATING = 5; // Default rating for returns

// Date formats
export const DATE_FORMAT_OPTIONS = {
  short: { month: 'short' as const, day: 'numeric' as const },
  medium: { month: 'short' as const, day: 'numeric' as const, year: 'numeric' as const },
  long: { month: 'long' as const, day: 'numeric' as const, year: 'numeric' as const },
  time: { hour: '2-digit' as const, minute: '2-digit' as const, hour12: true }
};
