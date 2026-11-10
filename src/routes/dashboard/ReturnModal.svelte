<script lang="ts">
  import { appStore, activeLoans } from '$lib/store';
  import Modal from '$lib/components/Modal.svelte';
  import StarRatingInput from '$lib/components/StarRatingInput.svelte';
  import { MAX_RATING, MIN_RATING, DEFAULT_RATING } from '$lib/constants';
  import type { ToastType } from '$lib/useToast.svelte';
  import type { ItemCondition } from '$lib/types';

  /**
   * The lender's "Confirm Return" dialog: rates the borrower (not the item),
   * adds an optional note and records a change in the item's condition, then
   * confirms the return. Render it only while open (`{#if loanId}`): each
   * mount starts from a fresh form.
   */
  interface Props {
    /** The active loan being returned. */
    loanId: string;
    onClose: () => void;
    /** The page's `toaster.showToast`. */
    notify: (message: string, type?: ToastType) => void;
  }

  let { loanId, onClose, notify }: Props = $props();

  // Best to worst; a later index than the item's current condition is a downgrade.
  const CONDITIONS: ItemCondition[] = ['excellent', 'good', 'fair', 'poor'];

  const conditionLabels: Record<ItemCondition, { label: string; description: string }> = {
    excellent: { label: 'Excellent', description: 'Like new, no visible wear' },
    good: { label: 'Good', description: 'Minor wear, fully functional' },
    fair: { label: 'Fair', description: 'Noticeable wear, works well' },
    poor: { label: 'Poor', description: 'Significant wear, still usable' }
  };

  let loan = $derived($activeLoans.find((l) => l.id === loanId));
  let item = $derived(loan ? $appStore.items.find((i) => i.id === loan.itemId) : null);
  let borrower = $derived(loan ? $appStore.users.find((u) => u.id === loan.borrowerId) : null);

  let rating = $state(DEFAULT_RATING);
  let review = $state('');
  let conditionChanged = $state(false);
  // Starts at the item's current condition (read once when the dialog opens).
  // svelte-ignore state_referenced_locally
  let newCondition = $state<ItemCondition>(item?.condition ?? 'good');

  let isDowngrade = $derived(
    !!item && CONDITIONS.indexOf(newCondition) > CONDITIONS.indexOf(item.condition)
  );

  function submit() {
    // Validate rating is within valid range
    if (rating < MIN_RATING || rating > MAX_RATING) {
      notify(`Rating must be between ${MIN_RATING} and ${MAX_RATING}`, 'error');
      return;
    }

    const result = appStore.confirmReturn(loanId, {
      rating,
      review,
      // Pass condition only if it was changed
      condition: conditionChanged ? newCondition : undefined
    });
    if (!result.ok) {
      notify(result.error, 'error');
      return;
    }

    const after = $appStore.borrowRequests.find((r) => r.id === loanId);
    const conditionNote = conditionChanged
      ? ` Condition updated to ${conditionLabels[newCondition].label}.`
      : '';
    if (after?.status === 'completed') {
      notify(`Return complete!${conditionNote}`, 'success');
    } else {
      notify(`Return confirmed — waiting for the borrower to confirm too.${conditionNote}`, 'success');
    }

    onClose();
  }
</script>

<Modal title="Confirm Return" size="form" {onClose}>
  <div class="form-group">
    <!-- svelte-ignore a11y_label_has_associated_control - Label is associated with radiogroup via aria-labelledby -->
    <label id="rating-label">How was lending to {borrower?.name ?? 'this borrower'}?</label>
    <p class="modal-hint">This rates the borrower, not the item — they'll be asked to review the item separately.</p>
    <StarRatingInput bind:value={rating} labelledby="rating-label" size="lg" />
  </div>

  <div class="form-group">
    <label for="review">Note (optional)</label>
    <textarea
      id="review"
      bind:value={review}
      placeholder="Returned on time? Good communication?"
      rows="3"
    ></textarea>
  </div>

  <!-- Condition tracking section -->
  <div class="form-group condition-section">
    <div class="condition-header">
      <span class="condition-title">Item Condition</span>
      {#if item}
        <span class="current-condition">
          Current: <strong>{conditionLabels[item.condition].label}</strong>
        </span>
      {/if}
    </div>

    <div class="condition-toggle">
      <label class="toggle-label">
        <input type="checkbox" bind:checked={conditionChanged} class="toggle-checkbox" />
        <span class="toggle-text">Condition has changed</span>
      </label>
    </div>

    {#if conditionChanged}
      <div class="condition-options" role="radiogroup" aria-label="Select new condition">
        {#each CONDITIONS as condition}
          <label
            class="condition-option"
            class:selected={newCondition === condition}
            class:downgrade={item &&
              condition !== item.condition &&
              CONDITIONS.indexOf(condition) > CONDITIONS.indexOf(item.condition)}
          >
            <input
              type="radio"
              name="condition"
              value={condition}
              bind:group={newCondition}
              class="sr-only"
            />
            <span class="condition-label">{conditionLabels[condition].label}</span>
            <span class="condition-description">{conditionLabels[condition].description}</span>
          </label>
        {/each}
      </div>
      {#if item && newCondition !== item.condition}
        <p class="condition-note">
          {#if isDowngrade}
            <span class="note-warning">⚠️ This will downgrade the item's condition from {conditionLabels[item.condition].label} to {conditionLabels[newCondition].label}</span>
          {:else}
            <span class="note-upgrade">✨ This will upgrade the item's condition to {conditionLabels[newCondition].label}</span>
          {/if}
        </p>
      {/if}
    {/if}
  </div>
  {#snippet actions()}
    <button class="btn btn-secondary" onclick={onClose}>Cancel</button>
    <button class="btn btn-primary" onclick={submit}>Confirm Return</button>
  {/snippet}
</Modal>

<style>
  .modal-hint {
    margin: 0 0 0.5rem 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.9375rem;
    resize: vertical;
    transition: border-color var(--transition);
  }

  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  .condition-section {
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
    margin-top: 1.5rem;
  }

  .condition-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .condition-title {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .current-condition {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .condition-toggle {
    margin-bottom: 1rem;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-weight: normal;
  }

  .toggle-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--primary);
    cursor: pointer;
  }

  .toggle-text {
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .condition-options {
    display: grid;
    gap: 0.5rem;
  }

  .condition-option {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.875rem 1rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
    font-weight: normal;
    margin-bottom: 0;
  }

  .condition-option:hover {
    border-color: var(--primary);
    background-color: rgba(16, 185, 129, 0.05);
  }

  .condition-option.selected {
    border-color: var(--primary);
    background-color: rgba(16, 185, 129, 0.1);
  }

  .condition-option.downgrade {
    border-color: var(--warning);
  }

  .condition-option.downgrade.selected {
    background-color: rgba(245, 158, 11, 0.1);
  }

  .condition-label {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .condition-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .condition-note {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
  }

  .note-warning {
    color: var(--warning);
    background-color: rgba(245, 158, 11, 0.1);
    display: block;
    padding: 0.75rem;
    border-radius: var(--radius);
  }

  .note-upgrade {
    color: var(--success);
    background-color: rgba(16, 185, 129, 0.1);
    display: block;
    padding: 0.75rem;
    border-radius: var(--radius);
  }
</style>
