<script lang="ts">
  import type { Item } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';
  import WishlistButton from './WishlistButton.svelte';

  /** Title row (name, Save / Edit Item) and the rating + condition row. */
  interface Props {
    item: Item;
    isOwner: boolean;
    onToast: (message: string, type?: ToastType) => void;
  }

  let { item, isOwner, onToast }: Props = $props();
</script>

<div class="item-title-row">
  <h1 class="item-title">{item.name}</h1>
  <div class="title-actions">
    {#if !isOwner}
      <WishlistButton itemId={item.id} {onToast} />
    {/if}
    {#if isOwner}
      <a href="/items/{item.id}/edit" class="btn btn-secondary">Edit Item</a>
    {/if}
  </div>
</div>

<div class="item-meta-row">
  <div class="rating-large">
    <span aria-hidden="true">⭐</span>
    <span class="rating-value">{item.rating.toFixed(1)}</span>
    <span class="rating-count">({item.totalBorrows} borrows)</span>
  </div>
  <span class="badge badge-primary">{item.condition}</span>
</div>

<style>
  .item-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .item-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .title-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .item-meta-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .rating-large {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
  }

  .rating-value {
    font-weight: 700;
    color: var(--text-primary);
  }

  .rating-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
