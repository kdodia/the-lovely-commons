<script lang="ts">
  import { appStore } from '$lib/store';
  import Avatar from '$lib/components/Avatar.svelte';
  import StarRating from '$lib/components/StarRating.svelte';
  import { MAX_RATING } from '$lib/constants';
  import { formatDisplayDate } from '$lib/dates';

  /** Borrowers' written reviews of this item, newest first. Hidden when there are none. */
  let { itemId }: { itemId: string } = $props();

  // `reviewerId` marks an entry as reviewed; entries without it are borrows
  // awaiting a review.
  let reviews = $derived(
    $appStore.borrowHistory
      .filter((h) => h.itemId === itemId && h.reviewerId && (h.review || h.rating))
      .sort((a, b) => (a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0))
  );
</script>

{#if reviews.length > 0}
  <div class="reviews-section card">
    <h3>Reviews ({reviews.length})</h3>
    <div class="reviews-list">
      {#each reviews as hist (hist.id)}
        {@const reviewer = $appStore.users.find((u) => u.id === hist.reviewerId)}
        <div class="review-item">
          <div class="review-header">
            <Avatar src={reviewer?.profilePic} alt={reviewer?.name ?? ""} size="2.5rem" />
            <div>
              <div class="reviewer-name">{reviewer?.name ?? 'A borrower'}</div>
              <div class="review-context">borrowed {formatDisplayDate(hist.endDate, { month: 'short', year: 'numeric' })}</div>
              <StarRating value={hist.rating} size="sm" label="{hist.rating ?? 0} out of {MAX_RATING} stars" />
            </div>
          </div>
          {#if hist.review}
            <p class="review-text">{hist.review}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .reviews-section {
    padding: 1.5rem;
  }

  .reviews-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .reviews-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .review-item {
    padding: 1rem;
    background-color: var(--surface);
    border-radius: var(--radius);
  }

  .review-header {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .reviewer-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .review-context {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .review-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }
</style>
