<script lang="ts">
  import type { BorrowRequest } from '$lib/types';
  import { appStore, hasConfirmed } from '$lib/store';
  import { formatDisplayDate, todayLocalISO } from '$lib/dates';
  import FallbackImage from './FallbackImage.svelte';

  interface Props {
    request: BorrowRequest;
    /** Which side of the loan the current user is on. */
    perspective: 'lender' | 'borrower';
    onConfirmPickup?: (requestId: string) => void;
    onConfirmReturn?: (requestId: string) => void;
    onCancel?: (requestId: string) => void;
  }

  let { request, perspective, onConfirmPickup, onConfirmReturn, onCancel }: Props = $props();

  let item = $derived($appStore.items.find((i) => i.id === request.itemId));
  let otherUserId = $derived(perspective === 'lender' ? request.borrowerId : request.lenderId);
  let otherUser = $derived($appStore.users.find((u) => u.id === otherUserId));
  let me = $derived($appStore.currentUserId);

  let step = $derived<'pickup' | 'return'>(request.status === 'approved' ? 'pickup' : 'return');
  let iConfirmed = $derived(hasConfirmed(request, step, me));
  let theyConfirmed = $derived(hasConfirmed(request, step, otherUserId));
  let overdue = $derived(request.status === 'active' && request.endDate < todayLocalISO());
  let canCancel = $derived(request.status === 'approved' && !!onCancel);
</script>

<div class="loan-card card" data-testid="loan-card">
  <div class="loan-content">
    <a href="/items/{request.itemId}" class="loan-item-link">
      <div class="loan-item-image">
        <FallbackImage src={item?.imageUrl} alt={item?.name ?? 'Item'} fallbackType="item" />
      </div>
    </a>
    <div class="loan-details">
      <a href="/items/{request.itemId}" class="loan-title-link">
        <h3 class="loan-title">{item?.name ?? 'Removed item'}</h3>
      </a>
      <div class="loan-meta">
        <span>
          {#if perspective === 'lender'}
            {request.status === 'approved' ? 'Reserved for' : 'Borrowed by'}
          {:else}
            {request.status === 'approved' ? 'Pick up from' : 'Borrowed from'}
          {/if}
        </span>
        <a href="/profile/{otherUserId}" class="user-link">
          <span class="user-avatar">
            <FallbackImage src={otherUser?.profilePic} alt={otherUser?.name ?? 'User'} fallbackType="avatar" />
          </span>
          <span class="user-name">{otherUser?.name ?? 'Unknown user'}</span>
        </a>
      </div>
      <div class="loan-dates">
        <span aria-hidden="true">📅</span>
        {#if request.status === 'active'}
          <span class:overdue>
            Return by {formatDisplayDate(request.endDate)}{overdue ? ' — overdue' : ''}
          </span>
        {:else}
          <span>{formatDisplayDate(request.startDate)} - {formatDisplayDate(request.endDate)}</span>
        {/if}
      </div>

      <div class="handoff-status" aria-live="polite">
        {#if request.status === 'approved'}
          <span class="badge badge-warning">⏳ Awaiting pickup</span>
        {:else}
          <span class="badge badge-success">🔄 On loan</span>
        {/if}
        {#if iConfirmed}
          <span class="handoff-note waiting">
            ✓ You confirmed the {step} — waiting for {otherUser?.name ?? 'the other party'}
          </span>
        {:else if theyConfirmed}
          <span class="handoff-note ready">
            {otherUser?.name ?? 'The other party'} confirmed the {step} — confirm on your side
          </span>
        {/if}
      </div>
    </div>
  </div>

  <div class="loan-actions">
    {#if request.status === 'approved' && !iConfirmed && onConfirmPickup}
      <button class="btn btn-primary" onclick={() => onConfirmPickup(request.id)}>
        Confirm Pickup
      </button>
    {:else if request.status === 'active' && !iConfirmed && onConfirmReturn}
      <button class="btn btn-primary" onclick={() => onConfirmReturn(request.id)}>
        Confirm Return
      </button>
    {/if}
    {#if canCancel && onCancel}
      <button class="btn btn-secondary" onclick={() => onCancel(request.id)}>
        {perspective === 'lender' ? 'Cancel Reservation' : 'Cancel Request'}
      </button>
    {/if}
  </div>
</div>

<style>
  .loan-card {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
  }

  .loan-content {
    display: flex;
    gap: 1.5rem;
    flex: 1;
    min-width: 0;
  }

  .loan-item-link {
    display: block;
    flex-shrink: 0;
    transition: opacity var(--transition);
  }

  .loan-item-link:hover {
    opacity: 0.8;
  }

  .loan-item-image {
    width: 120px;
    height: 120px;
    border-radius: var(--radius);
    overflow: hidden;
  }

  .loan-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .loan-title-link {
    text-decoration: none;
    color: inherit;
    transition: color var(--transition);
  }

  .loan-title-link:hover {
    color: var(--primary);
  }

  .loan-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .loan-meta,
  .loan-dates {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    flex-wrap: wrap;
  }

  .user-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
    border-radius: var(--radius);
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem;
    transition: all var(--transition);
  }

  .user-link:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .user-link:hover .user-name {
    color: var(--primary);
  }

  .user-avatar {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .overdue {
    color: var(--error);
    font-weight: 600;
  }

  .handoff-status {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .handoff-note {
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius);
  }

  .handoff-note.waiting {
    color: var(--text-secondary);
    background-color: var(--surface);
  }

  .handoff-note.ready {
    color: var(--primary);
    background-color: rgba(16, 185, 129, 0.1);
    font-weight: 500;
  }

  .loan-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .loan-actions:empty {
    display: none;
  }

  @media (max-width: 768px) {
    .loan-card {
      flex-direction: column;
      align-items: stretch;
    }

    .loan-content {
      flex-direction: column;
    }

    .loan-item-image {
      width: 100%;
      height: 200px;
    }

    .loan-actions {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
</style>
