<script lang="ts">
  import { appStore } from '$lib/store';
  import type { Item } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';

  /**
   * Shown to a non-owner who has wishlisted an item that is out on loan:
   * explains why and lets them switch the "available again" notification.
   * Renders nothing in any other case.
   */
  interface Props {
    item: Item;
    onToast: (message: string, type?: ToastType) => void;
  }

  let { item, onToast }: Props = $props();

  let wishlistEntry = $derived(
    $appStore.wishlist.find((w) => w.userId === $appStore.currentUserId && w.itemId === item.id)
  );
  let notifyOnAvailable = $derived(wishlistEntry?.notifyOnAvailable ?? true);

  function toggleNotification() {
    appStore.toggleWishlistNotification(item.id);
    onToast(notifyOnAvailable ? 'Notifications disabled' : 'Notifications enabled', 'success');
  }
</script>

{#if wishlistEntry && !item.available && item.lenderId !== $appStore.currentUserId}
  <div class="wishlist-status-card">
    <div class="wishlist-status-header">
      <span class="wishlist-status-icon" aria-hidden="true">❤️</span>
      <div>
        <h4>On Your Wishlist</h4>
        <p class="wishlist-status-info">This item is currently borrowed by someone else</p>
      </div>
    </div>
    <div class="notification-toggle">
      <label class="toggle-label">
        <input
          type="checkbox"
          checked={notifyOnAvailable}
          onchange={toggleNotification}
          class="toggle-checkbox"
        />
        <span class="toggle-switch"></span>
        <span class="toggle-text">Notify me when available</span>
      </label>
    </div>
  </div>
{/if}

<style>
  .wishlist-status-card {
    background-color: rgba(239, 68, 68, 0.05);
    border: 2px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .wishlist-status-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .wishlist-status-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  .wishlist-status-card h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .wishlist-status-info {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .notification-toggle {
    padding-top: 1rem;
    border-top: 1px solid rgba(239, 68, 68, 0.15);
  }

  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
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
    width: 2.5rem;
    height: 1.375rem;
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
    width: 1.125rem;
    height: 1.125rem;
    background-color: white;
    border-radius: 50%;
    transition: transform var(--transition);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-checkbox:checked + .toggle-switch {
    background-color: var(--primary);
  }

  .toggle-checkbox:checked + .toggle-switch::after {
    transform: translateX(1.125rem);
  }

  .toggle-checkbox:focus-visible + .toggle-switch {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
  }

  .toggle-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
