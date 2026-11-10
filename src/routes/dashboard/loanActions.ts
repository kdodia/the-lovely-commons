import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import type { ToastType } from '$lib/useToast.svelte';

type Notify = (message: string, type?: ToastType) => void;

/**
 * The dashboard's request and loan actions. Each one calls the store, then
 * tells the user what happened (or why it was refused) through `notify`, which
 * is the page's `toaster.showToast`. Wording lives here, in one place.
 */
export function createLoanActions(notify: Notify) {
  const findRequest = (id: string) => get(appStore).borrowRequests.find((r) => r.id === id);

  function approve(requestId: string) {
    const result = appStore.approveRequest(requestId);
    if (result.ok) notify('Request approved! The item is now reserved.', 'success');
    else notify(result.error, 'error');
  }

  function deny(requestId: string) {
    const result = appStore.denyRequest(requestId);
    if (result.ok) notify('Request declined', 'info');
    else notify(result.error, 'error');
  }

  function cancel(requestId: string) {
    const result = appStore.cancelRequest(requestId);
    if (result.ok) notify('Request cancelled', 'info');
    else notify(result.error, 'error');
  }

  function sendReminder(requestId: string) {
    const result = appStore.sendReturnReminder(requestId);
    if (!result.ok) {
      notify(result.error, 'error');
      return;
    }
    const borrowerId = findRequest(requestId)?.borrowerId;
    const borrower = get(appStore).users.find((u) => u.id === borrowerId);
    notify(`Reminder sent to ${borrower?.name ?? 'the borrower'}`, 'success');
  }

  /** Returns true when the message was accepted so the thread can clear its draft. */
  function sendMessage(requestId: string, text: string): boolean {
    const result = appStore.sendRequestMessage(requestId, text);
    if (!result.ok) notify(result.error, 'error');
    return result.ok;
  }

  function confirmPickup(requestId: string) {
    const before = findRequest(requestId);
    const result = appStore.confirmPickup(requestId);
    if (!result.ok) {
      notify(result.error, 'error');
      return;
    }
    if (findRequest(requestId)?.status === 'active') {
      notify('Both sides confirmed — the loan is now active', 'success');
    } else {
      const state = get(appStore);
      const otherId = before?.borrowerId === state.currentUserId ? before?.lenderId : before?.borrowerId;
      const other = state.users.find((u) => u.id === otherId);
      notify(`Pickup confirmed — waiting for ${other?.name ?? 'the other party'}`, 'success');
    }
  }

  /** Borrower side: no rating to give, confirm directly. (The lender goes through ReturnModal.) */
  function confirmReturnAsBorrower(requestId: string) {
    const result = appStore.confirmReturn(requestId);
    if (!result.ok) {
      notify(result.error, 'error');
      return;
    }
    if (findRequest(requestId)?.status === 'completed') {
      notify('Returned! Check your notifications to leave a review.', 'success');
    } else {
      notify('Return confirmed — waiting for the lender to confirm too', 'success');
    }
  }

  return { approve, deny, cancel, sendReminder, sendMessage, confirmPickup, confirmReturnAsBorrower };
}

export type LoanActions = ReturnType<typeof createLoanActions>;
