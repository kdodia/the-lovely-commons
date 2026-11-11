<script lang="ts">
  import type { Item, Tag } from '$lib/types';
  import TagHeading from './TagHeading.svelte';
  import TagItemCard from './TagItemCard.svelte';

  /** The selected tag: its name, the items in it, and the user's other items to add. */
  interface Props {
    tag: Tag;
    /** Items already in the tag. */
    tagItems: Item[];
    /** The user's items that are not in the tag yet. */
    availableItems: Item[];
    onRename: (name: string) => boolean;
    onDelete: () => void;
    onAddItem: (itemId: string) => void;
    onRemoveItem: (itemId: string) => void;
  }

  let { tag, tagItems, availableItems, onRename, onDelete, onAddItem, onRemoveItem }: Props = $props();
</script>

<div class="tag-details">
  <!-- Keyed so switching tags leaves rename mode -->
  {#key tag.id}
    <TagHeading {tag} {onRename} {onDelete} />
  {/key}

  <div class="items-section">
    <h3>Items in this collection ({tagItems.length})</h3>
    {#if tagItems.length === 0}
      <div class="empty-items">
        <p>No items in this tag yet. Add some from your items below!</p>
      </div>
    {:else}
      <div class="items-grid">
        {#each tagItems as item}
          <TagItemCard {item} action="remove" onAction={onRemoveItem} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="add-items-section">
    <h3>Add items to this collection</h3>
    {#if availableItems.length === 0}
      <p class="text-muted">All your items are already in this collection!</p>
    {:else}
      <div class="items-grid">
        {#each availableItems as item}
          <TagItemCard {item} action="add" onAction={onAddItem} />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .items-section,
  .add-items-section {
    margin-bottom: 3rem;
  }

  .items-section h3,
  .add-items-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .empty-items {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .text-muted {
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
