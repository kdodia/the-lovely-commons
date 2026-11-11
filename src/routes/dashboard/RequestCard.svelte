<script lang="ts">
  import type { BorrowRequest } from '$lib/types';
  import { appStore } from '$lib/store';
  import { formatDisplayDate } from '$lib/dates';
  import RatingScore from '$lib/components/RatingScore.svelte';
  import RequestThread from '$lib/components/RequestThread.svelte';
  import UserChip from '$lib/components/UserChip.svelte';

  /**
   * One borrow request on the "Incoming Requests" or "My Requests" tab.
   *
   * perspective="lender"   an incoming request: who wants the item, with
   *                        Approve / Deny.
   * perspective="borrower" a request I made: its status, with Cancel while
   *                        pending or a shortcut to the Borrowing tab once
   *                        it is approved or active.
   */
  interface Props {
    request: BorrowRequest;
    perspective: 'lender' | 'borrower';
    /** Whether the message thread is expanded; the incoming card drops its quote while it is. */
    threadOpen?: boolean;
    onApprove?: (requestId: string) => void;
    onDeny?: (requestId: string) => void;
    onCancel?: (requestId: string) => void;
    /** Borrower side: jump to the Borrowing tab. */
    onManage?: () => void;
    onSendMessage?: (requestId: string, text: string) => boolean;
  }

  let {
    request,
    perspective,
    threadOpen = $bindable(false),
    onApprove,
    onDeny,
    onCancel,
    onManage,
    onSendMessage
  }: Props = $props();

  let item = $derived($appStore.items.find((i) => i.id === request.itemId));
  let otherUser = $derived(
    $appStore.users.find((u) => u.id === (perspective === 'lender' ? request.borrowerId : request.lenderId))
  );
</script>

<div class="request-card card">
  <div class="request-content">
    <a href="/items/{item?.id}" class="request-item-link">
      <img src={item?.imageUrl} alt={item?.name} class="request-item-image" />
    </a>
    <div class="request-details">
      <a href="/items/{item?.id}" class="request-title-link">
        <h3 class="request-title">{item?.name ?? 'Removed item'}</h3>
      </a>
      <div class="request-meta">
        {#if perspective === 'lender'}
          <UserChip userId={otherUser?.id} name={otherUser?.name ?? ''} src={otherUser?.profilePic} />
          <span class="rating"><RatingScore value={otherUser?.rating} /></span>
        {:else}
          <span>Requested from</span>
          <UserChip userId={otherUser?.id} name={otherUser?.name ?? ''} src={otherUser?.profilePic} />
        {/if}
      </div>
      <div class="request-dates">
        <span aria-hidden="true">📅</span>
        <span>{formatDisplayDate(request.startDate)} - {formatDisplayDate(request.endDate)}</span>
      </div>
      {#if perspective === 'lender'}
        {#if request.message && !threadOpen}
          <p class="request-message">"{request.message}"</p>
        {/if}
      {:else}
        <div class="status-badge-inline">
          {#if request.status === 'pending'}
            <span class="badge badge-warning">⏳ Pending</span>
          {:else if request.status === 'approved'}
            <span class="badge badge-success">✓ Approved — awaiting pickup</span>
          {:else if request.status === 'active'}
            <span class="badge badge-success">🔄 Borrowing now</span>
          {:else if request.status === 'completed'}
            <span class="badge badge-primary">✓ Returned</span>
          {:else if request.status === 'cancelled'}
            <span class="badge badge-error">Cancelled</span>
          {:else if request.status === 'denied'}
            <span class="badge badge-error">✗ Declined</span>
          {/if}
        </div>
      {/if}
      <RequestThread {request} onSend={onSendMessage} bind:open={threadOpen} />
    </div>
  </div>

  {#if perspective === 'lender'}
    <div class="request-actions">
      <button class="btn btn-primary" onclick={() => onApprove?.(request.id)}>✓ Approve</button>
      <button class="btn btn-secondary" onclick={() => onDeny?.(request.id)}>✗ Deny</button>
    </div>
  {:else if request.status === 'pending'}
    <div class="request-actions">
      <button class="btn btn-secondary" onclick={() => onCancel?.(request.id)}>Cancel Request</button>
    </div>
  {:else if request.status === 'approved' || request.status === 'active'}
    <div class="request-actions">
      <button class="btn btn-secondary" onclick={() => onManage?.()}>Manage in Borrowing</button>
    </div>
  {/if}
</div>

<style>
  .request-content {
    display: flex;
    gap: 1.5rem;
    flex: 1;
    min-width: 0;
  }

  .request-item-image {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: var(--radius);
    flex-shrink: 0;
    display: block;
  }

  .request-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .request-dates {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .request-message {
    font-style: italic;
    color: var(--text-secondary);
    margin: 0;
    padding: 0.75rem;
    background-color: var(--surface);
    border-radius: var(--radius);
    border-left: 3px solid var(--primary);
    overflow-wrap: anywhere;
  }

  .status-badge-inline {
    margin-top: 0.5rem;
  }

  .request-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .request-content {
      flex-direction: column;
    }

    .request-item-image {
      width: 100%;
      height: 200px;
    }

    .request-actions {
      flex-direction: row;
    }
  }
</style>
