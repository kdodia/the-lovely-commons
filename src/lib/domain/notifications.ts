/**
 * Notifications.
 *
 * Every notification is addressed to one user, starts unread, and may point
 * at a related record (a request, item or friend request) via `relatedId`.
 * Rules elsewhere create them with `createNotification` and append them to
 * the end of `state.notifications`; the order they are appended in is the
 * order they were raised.
 *
 * Marking as read is not restricted: any notification can be marked read by
 * id, and all of a given user's notifications can be marked read at once.
 * A user's notifications are listed newest first.
 */
import type { AppState, Notification } from '../types';
import { createId } from './ids';

// Helper to create notifications with consistent structure
export function createNotification(
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
 * `existing` with the given notifications appended in order. `null` entries
 * (a notification that could not be built, e.g. its item is gone) are
 * skipped; when nothing is added the same array is returned.
 */
export function appendNotifications(
  existing: Notification[],
  ...added: (Notification | null)[]
): Notification[] {
  const present = added.filter((n): n is Notification => n !== null);
  return present.length > 0 ? [...existing, ...present] : existing;
}

export function markNotificationAsRead(state: AppState, notificationId: string): AppState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    )
  };
}

export function markAllNotificationsAsRead(state: AppState, userId: string): AppState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.userId === userId ? { ...n, read: true } : n
    )
  };
}

/** A user's notifications, newest first. */
export function notificationsFor(state: AppState, userId: string): Notification[] {
  return state.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
