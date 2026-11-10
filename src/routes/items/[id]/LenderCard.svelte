<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import RatingScore from '$lib/components/RatingScore.svelte';
  import type { User } from '$lib/types';

  /** "Lent by" card linking to the owner's profile. */
  let { lender }: { lender: User | undefined } = $props();
</script>

<div class="lender-card">
  <Avatar src={lender?.profilePic} alt={lender?.name ?? ""} size="4rem" border="3px" />
  <div class="lender-info">
    <span class="lender-label">Lent by</span>
    <a href="/profile/{lender?.id}" class="lender-name-large">{lender?.name}</a>
    <div class="lender-stats">
      <span><RatingScore value={lender?.rating} /></span>
      <span>•</span>
      <span>{lender?.totalLends} items lent</span>
    </div>
  </div>
</div>

<style>
  .lender-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--surface);
    border-radius: var(--radius-lg);
    margin-bottom: 1.5rem;
  }

  .lender-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .lender-name-large {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary);
    display: block;
    margin: 0.25rem 0;
  }

  .lender-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
