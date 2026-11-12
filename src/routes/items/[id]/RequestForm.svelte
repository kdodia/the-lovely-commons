<script lang="ts">
  import { appStore, createId, firstSelectableStartDate } from '$lib/store';
  import type { BorrowRequest, Item } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';
  import { addDays, toLocalISODate } from '$lib/dates';

  /**
   * "Request to Borrow": the opening button and, once opened, the form that
   * sends a borrow request. The dates are chosen on the availability calendar
   * in the sidebar, so the three draft values are shared with the page.
   */
  interface Props {
    item: Item;
    startDate: string;
    endDate: string;
    showRequestForm: boolean;
    onToast: (message: string, type?: ToastType) => void;
  }

  let {
    item,
    startDate = $bindable(),
    endDate = $bindable(),
    showRequestForm = $bindable(),
    onToast
  }: Props = $props();

  let requestMessage = $state('');

  function openRequestForm() {
    showRequestForm = true;
    // Preset the first day from tomorrow that the calendar lets you pick
    // (none if the next 60 days are all taken).
    startDate = firstSelectableStartDate(
      $appStore,
      item.id,
      toLocalISODate(addDays(new Date(), 1))
    );
  }

  function submitRequest() {
    if (!startDate || !endDate) return;

    // The store checks the dates (order, conflicts) and who may ask.
    const request: BorrowRequest = {
      id: createId('req'),
      itemId: item.id,
      borrowerId: $appStore.currentUserId,
      lenderId: item.lenderId,
      startDate,
      endDate,
      status: 'pending',
      message: requestMessage,
      createdAt: new Date().toISOString()
    };

    const result = appStore.createBorrowRequest(request);
    if (!result.ok) {
      onToast(result.error, 'error');
      return;
    }

    onToast('Borrow request sent!', 'success');
    showRequestForm = false;
    startDate = '';
    endDate = '';
    requestMessage = '';
  }
</script>

{#if !showRequestForm}
  <button class="btn btn-primary btn-lg" onclick={openRequestForm}>
    Request to Borrow
  </button>
  {#if !item.available}
    <p class="action-hint">It's out on loan right now, but you can ask for later dates.</p>
  {/if}
  <p class="action-hint">Or select dates from the calendar</p>
{:else}
  <div class="request-form">
    <h3>Request to Borrow</h3>

    {#if startDate && endDate}
      <div class="selected-dates-display">
        <div class="date-badge">
          <span class="date-label">From</span>
          <span class="date-value">
            {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
        <span class="date-arrow" aria-hidden="true">→</span>
        <div class="date-badge">
          <span class="date-label">To</span>
          <span class="date-value">
            {new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
      </div>
      <p class="dates-change-hint">Use the calendar to change dates</p>
    {:else if startDate}
      <div class="dates-incomplete">
        <span class="incomplete-icon" aria-hidden="true">📅</span>
        <p>Select an end date from the calendar to complete your booking</p>
      </div>
    {:else}
      <div class="dates-incomplete">
        <span class="incomplete-icon" aria-hidden="true">📅</span>
        <p>Select your dates from the calendar to continue</p>
      </div>
    {/if}

    <div class="form-group">
      <label for="message">Message (optional)</label>
      <textarea
        id="message"
        bind:value={requestMessage}
        placeholder="Let the lender know why you need this item..."
        rows="3"
      ></textarea>
    </div>
    <div class="form-actions">
      <button
        class="btn btn-primary"
        onclick={submitRequest}
        disabled={!startDate || !endDate}
      >
        Send Request
      </button>
      <button class="btn btn-secondary" onclick={() => { showRequestForm = false; startDate = ''; endDate = ''; }}>
        Cancel
      </button>
    </div>
  </div>
{/if}

<style>
  .request-form {
    background-color: var(--surface);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
  }

  .request-form h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .form-group textarea {
    width: 100%;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .action-hint {
    margin: 0.75rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }

  .selected-dates-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: var(--radius);
    margin-bottom: 0.5rem;
  }

  .date-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .date-label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .date-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .date-arrow {
    font-size: 1.25rem;
    color: var(--primary);
  }

  .dates-change-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    margin: 0 0 1rem 0;
  }

  .dates-incomplete {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem;
    background-color: var(--background);
    border-radius: var(--radius);
    margin-bottom: 1rem;
    text-align: center;
  }

  .incomplete-icon {
    font-size: 2rem;
  }

  .dates-incomplete p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .selected-dates-display {
      flex-direction: column;
      gap: 0.5rem;
    }

    .date-arrow {
      transform: rotate(90deg);
    }
  }
</style>
