<script lang="ts">
  import type { Item } from '$lib/types';

  /**
   * A small item card in the tag editor: a round corner button either removes
   * the item from the tag (action="remove") or adds it (action="add").
   */
  interface Props {
    item: Item;
    action: 'add' | 'remove';
    onAction: (itemId: string) => void;
  }

  let { item, action, onAction }: Props = $props();
</script>

<div class="item-card-mini card">
  <a href="/items/{item.id}" class="item-link">
    <img src={item.imageUrl} alt={item.name} class="item-thumb" />
    <div class="item-mini-info">
      <span class="item-mini-name">{item.name}</span>
    </div>
  </a>
  {#if action === 'remove'}
    <button
      class="corner-btn remove-btn"
      onclick={() => onAction(item.id)}
      aria-label="Remove {item.name} from tag"
    >
      ✕
    </button>
  {:else}
    <button
      class="corner-btn add-btn"
      onclick={() => onAction(item.id)}
      aria-label="Add {item.name} to tag"
    >
      +
    </button>
  {/if}
</div>

<style>
  .item-card-mini {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .item-link {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    flex: 1;
    transition: opacity var(--transition);
  }

  .item-link:hover {
    opacity: 0.9;
  }

  .item-thumb {
    width: 100%;
    height: 150px;
    object-fit: cover;
  }

  .item-mini-info {
    padding: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .item-mini-name {
    font-size: 0.875rem;
    font-weight: 500;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .corner-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition);
    flex-shrink: 0;
    z-index: 10;
    box-shadow: var(--shadow-md);
  }

  .add-btn {
    background-color: var(--primary);
    color: white;
  }

  .add-btn:hover {
    background-color: var(--primary-dark);
    transform: scale(1.1);
  }

  .remove-btn {
    background-color: var(--error);
    color: white;
  }

  .remove-btn:hover {
    background-color: #dc2626;
    transform: scale(1.1);
  }
</style>
