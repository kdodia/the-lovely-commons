<script lang="ts">
  import { appStore } from '$lib/store';
  import type { ToastType } from '$lib/useToast.svelte';

  /** The Save / Saved heart next to the title. Toggles the wishlist itself. */
  let { itemId, onToast }: { itemId: string; onToast: (message: string, type?: ToastType) => void } = $props();

  let isInWishlist = $derived(
    $appStore.wishlist.some((w) => w.userId === $appStore.currentUserId && w.itemId === itemId)
  );

  function toggleWishlist() {
    if (isInWishlist) {
      appStore.removeFromWishlist(itemId);
      onToast('Removed from wishlist', 'success');
    } else {
      appStore.addToWishlist(itemId, true);
      onToast("Added to wishlist! You'll be notified when available.", 'success');
    }
  }
</script>

<button
  class="wishlist-btn"
  class:active={isInWishlist}
  onclick={toggleWishlist}
  aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
  aria-pressed={isInWishlist}
>
  <span class="wishlist-icon" aria-hidden="true">{isInWishlist ? '❤️' : '🤍'}</span>
  <span class="wishlist-text">{isInWishlist ? 'Saved' : 'Save'}</span>
</button>

<style>
  .wishlist-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    transition: all var(--transition);
  }

  .wishlist-btn:hover {
    background-color: var(--surface-hover);
    border-color: var(--text-muted);
  }

  .wishlist-btn.active {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .wishlist-icon {
    font-size: 1.125rem;
  }
</style>
