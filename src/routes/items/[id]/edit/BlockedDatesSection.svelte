<script lang="ts">
  import { formatDisplayDate, todayLocalISO } from '$lib/dates';
  import type { ToastType } from '$lib/useToast.svelte';

  type BlockedDate = { startDate: string; endDate: string; reason?: string };

  /**
   * "Blocked Dates" section of the edit form: dates the owner keeps for
   * themselves. Changes are only held in `blockedDates` (bound to the page);
   * the page saves them with the rest of the form.
   *
   * Uses the form chrome classes (.form-section, .form-group, .form-row), which
   * ItemForm styles for anything passed in through its `extraSections`.
   */
  interface Props {
    blockedDates: BlockedDate[];
    onToast: (message: string, type?: ToastType) => void;
  }

  let { blockedDates = $bindable(), onToast }: Props = $props();

  let showDateBlockForm = $state(false);
  let blockStartDate = $state('');
  let blockEndDate = $state('');
  let blockReason = $state('');

  function addBlockedDate() {
    if (!blockStartDate || !blockEndDate) {
      onToast('Please select both start and end dates', 'error');
      return;
    }

    // Validate that the range is ordered (same-day blocks are allowed)
    if (blockEndDate < blockStartDate) {
      onToast('End date must not be before start date', 'error');
      return;
    }

    blockedDates = [
      ...blockedDates,
      {
        startDate: blockStartDate,
        endDate: blockEndDate,
        reason: blockReason || undefined
      }
    ];

    // Reset form
    blockStartDate = '';
    blockEndDate = '';
    blockReason = '';
    showDateBlockForm = false;

    onToast('Date block added — save changes to apply it', 'info');
  }

  function removeBlockedDate(index: number) {
    blockedDates = blockedDates.filter((_, i) => i !== index);
    onToast('Date block removed — save changes to apply it', 'info');
  }
</script>

<div class="form-section">
  <div class="section-header">
    <h3>Blocked Dates</h3>
    <button
      type="button"
      class="btn btn-sm btn-secondary"
      onclick={() => (showDateBlockForm = !showDateBlockForm)}
    >
      {showDateBlockForm ? 'Cancel' : '+ Block Dates'}
    </button>
  </div>
  <p class="section-description">Block dates when you need to use this item personally</p>

  {#if showDateBlockForm}
    <div class="date-block-form">
      <div class="form-row">
        <div class="form-group">
          <label for="block-start">Start Date</label>
          <input
            type="date"
            id="block-start"
            bind:value={blockStartDate}
            min={todayLocalISO()}
          />
        </div>
        <div class="form-group">
          <label for="block-end">End Date</label>
          <input
            type="date"
            id="block-end"
            bind:value={blockEndDate}
            min={blockStartDate || todayLocalISO()}
          />
        </div>
      </div>
      <div class="form-group">
        <label for="block-reason">Reason (optional)</label>
        <input
          type="text"
          id="block-reason"
          bind:value={blockReason}
          placeholder="e.g., Using for camping trip"
        />
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick={addBlockedDate}>
        Add Block
      </button>
    </div>
  {/if}

  {#if blockedDates.length > 0}
    <div class="blocked-dates-list">
      {#each blockedDates as block, index}
        <div class="blocked-date-card">
          <div class="blocked-date-info">
            <span class="blocked-date-icon" aria-hidden="true">🚫</span>
            <div>
              <div class="blocked-date-range">
                {formatDisplayDate(block.startDate)} - {formatDisplayDate(block.endDate)}
              </div>
              {#if block.reason}
                <div class="blocked-date-reason">{block.reason}</div>
              {/if}
            </div>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-error"
            onclick={() => removeBlockedDate(index)}
          >
            Remove
          </button>
        </div>
      {/each}
    </div>
  {:else if !showDateBlockForm}
    <p class="empty-message">No blocked dates. This item is available for all future dates.</p>
  {/if}
</div>

<style>
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  /* Longer selector so it out-ranks ItemForm's `.form-section h3` margin */
  .form-section .section-header h3 {
    margin: 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
  }

  .date-block-form {
    background-color: var(--surface);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    margin-bottom: 1rem;
  }

  .blocked-dates-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .blocked-date-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background-color: var(--surface);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }

  .blocked-date-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .blocked-date-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .blocked-date-range {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .blocked-date-reason {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .empty-message {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }

  @media (max-width: 768px) {
    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }
</style>
