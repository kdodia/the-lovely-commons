<script lang="ts">
  import { appStore, pendingItemReviews } from '$lib/store';
  import StarRatingInput from '$lib/components/StarRatingInput.svelte';
  import type { Item } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';
  import { DEFAULT_RATING, MAX_RATING, MIN_RATING } from '$lib/constants';
  import { formatDisplayDate } from '$lib/dates';

  /**
   * "How was the X?" prompt, shown only to someone who has borrowed this item
   * and not yet reviewed it. Renders nothing otherwise.
   */
  interface Props {
    item: Item;
    onToast: (message: string, type?: ToastType) => void;
  }

  let { item, onToast }: Props = $props();

  // The current user's most recent completed borrow that hasn't been reviewed
  let reviewableBorrow = $derived(
    pendingItemReviews($appStore, item.id, $appStore.currentUserId)[0]
  );

  let reviewRating = $state(DEFAULT_RATING);
  let reviewText = $state('');

  function submitReview() {
    if (!reviewableBorrow) return;
    if (reviewRating < MIN_RATING || reviewRating > MAX_RATING) {
      onToast(`Rating must be between ${MIN_RATING} and ${MAX_RATING}`, 'error');
      return;
    }
    const result = appStore.submitItemReview(reviewableBorrow.id, reviewRating, reviewText);
    if (!result.ok) {
      onToast(result.error, 'error');
      return;
    }
    onToast('Thanks for your review!', 'success');
    reviewRating = DEFAULT_RATING;
    reviewText = '';
  }
</script>

{#if reviewableBorrow}
  <div class="review-form-section card">
    <h3>How was the {item.name}?</h3>
    <p class="review-form-hint">
      You borrowed it {formatDisplayDate(reviewableBorrow.startDate)} – {formatDisplayDate(reviewableBorrow.endDate)}.
      Your review helps others decide.
    </p>
    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control - Label is associated with radiogroup via aria-labelledby -->
      <label id="item-rating-label">Rating</label>
      <StarRatingInput bind:value={reviewRating} labelledby="item-rating-label" />
    </div>
    <div class="form-group">
      <label for="item-review">Review (optional)</label>
      <textarea
        id="item-review"
        bind:value={reviewText}
        placeholder="Did it work well? Anything the next borrower should know?"
        rows="3"
      ></textarea>
    </div>
    <button class="btn btn-primary" onclick={submitReview}>Submit Review</button>
  </div>
{/if}

<style>
  .review-form-section {
    padding: 1.5rem;
  }

  .review-form-section h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
  }

  .review-form-hint {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
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

  .review-form-section textarea {
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.9375rem;
    resize: vertical;
  }

  .review-form-section textarea:focus {
    outline: none;
    border-color: var(--primary);
  }
</style>
