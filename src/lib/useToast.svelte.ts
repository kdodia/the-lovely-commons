import { TOAST_DURATION_MS } from './constants';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastMessage = { message: string; type: ToastType } | null;

/**
 * Reusable toast notification utility
 * Provides state and helper to show auto-dismissing toast messages
 *
 * IMPORTANT: keep the returned object intact. Destructuring `toast` reads the
 * getter once (always `null`) and disconnects it from reactivity.
 *
 * Usage:
 * ```ts
 * const toaster = useToast();
 *
 * function handleAction() {
 *   toaster.showToast('Action completed!', 'success');
 * }
 * ```
 * ```svelte
 * {#if toaster.toast}
 *   <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
 * {/if}
 * ```
 */
export function useToast() {
  let toast = $state<ToastMessage>(null);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function showToast(message: string, type: ToastType = 'success', duration = TOAST_DURATION_MS) {
    // Clear any existing timeout
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    // Set new toast message
    toast = { message, type };

    // Auto-clear after duration
    timeoutId = setTimeout(() => {
      toast = null;
      timeoutId = undefined;
    }, duration);
  }

  function clearToast() {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    toast = null;
  }

  return {
    get toast() {
      return toast;
    },
    showToast,
    clearToast
  };
}
