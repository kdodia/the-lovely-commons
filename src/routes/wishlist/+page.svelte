<script lang="ts">
  import { appStore, currentUserWishlistItems } from '$lib/store';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { useToast } from '$lib/useToast.svelte';

  const toaster = useToast();

  function removeFromWishlist(itemId: string) {
    appStore.removeFromWishlist(itemId);
    toaster.showToast('Removed from wishlist', 'success');
  }

  function toggleNotification(itemId: string, currentState: boolean) {
    appStore.toggleWishlistNotification(itemId);
    toaster.showToast(currentState ? 'Notifications disabled' : 'Notifications enabled', 'success');
  }
</script>

<div class="wishlist-page fade-in">
  <div class="container">
    <header class="page-header">
      <div>
        <h1 class="page-title">My Wishlist</h1>
        <p class="page-subtitle">Items you've saved for later</p>
      </div>
    </header>

    {#if $currentUserWishlistItems.length > 0}
      <div class="wishlist-stats">
        <span class="stat">
          <span class="stat-value">{$currentUserWishlistItems.length}</span>
          <span class="stat-label">{$currentUserWishlistItems.length === 1 ? 'item' : 'items'} saved</span>
        </span>
        <span class="stat">
          <span class="stat-value">{$currentUserWishlistItems.filter(w => w.item.available).length}</span>
          <span class="stat-label">available now</span>
        </span>
        <span class="stat">
          <span class="stat-value">{$currentUserWishlistItems.filter(w => w.notifyOnAvailable).length}</span>
          <span class="stat-label">with notifications</span>
        </span>
      </div>

      <div class="wishlist-grid">
        {#each $currentUserWishlistItems as entry (entry.id)}
          <div class="wishlist-item-wrapper">
            <ItemCard item={entry.item} />
            <div class="wishlist-actions">
              <div class="notification-control">
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    checked={entry.notifyOnAvailable}
                    onchange={() => toggleNotification(entry.itemId, entry.notifyOnAvailable)}
                    class="toggle-checkbox"
                  />
                  <span class="toggle-switch"></span>
                  <span class="toggle-text">Notify when available</span>
                  {#if entry.item.available}
                    <span class="badge badge-success">Available now</span>
                  {/if}
                </label>
              </div>
              <button
                class="remove-btn"
                onclick={() => removeFromWishlist(entry.itemId)}
                aria-label="Remove from wishlist"
              >
                Remove
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">💝</span>
        <h2>Your wishlist is empty</h2>
        <p>Save items you're interested in by clicking the heart button on any item page.</p>
        <a href="/" class="btn btn-primary">Browse Items</a>
      </div>
    {/if}
  </div>
</div>

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .wishlist-page {
    min-height: calc(100vh - 200px);
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .wishlist-stats {
    display: flex;
    gap: 2rem;
    padding: 1.25rem 1.5rem;
    background-color: var(--surface);
    border-radius: var(--radius-lg);
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .wishlist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .wishlist-item-wrapper {
    display: flex;
    flex-direction: column;
  }

  .wishlist-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--surface);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    border: 1px solid var(--border);
    border-top: none;
    margin-top: -0.5rem;
  }

  .notification-control {
    flex: 1;
  }

  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-checkbox {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-switch {
    position: relative;
    width: 2rem;
    height: 1.125rem;
    background-color: var(--border);
    border-radius: 999px;
    transition: background-color var(--transition);
    flex-shrink: 0;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 0.875rem;
    height: 0.875rem;
    background-color: white;
    border-radius: 50%;
    transition: transform var(--transition);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .toggle-checkbox:checked + .toggle-switch {
    background-color: var(--primary);
  }

  .toggle-checkbox:checked + .toggle-switch::after {
    transform: translateX(0.875rem);
  }

  .toggle-checkbox:focus-visible + .toggle-switch {
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
  }

  .toggle-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .remove-btn {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius);
    transition: all var(--transition);
  }

  .remove-btn:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--error);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background-color: var(--surface);
    border-radius: var(--radius-lg);
  }

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1.5rem;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin: 0 0 1.5rem 0;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    .page-title {
      font-size: 1.5rem;
    }

    .wishlist-stats {
      gap: 1rem;
    }

    .stat-value {
      font-size: 1.25rem;
    }

    .wishlist-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
