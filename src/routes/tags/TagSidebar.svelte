<script lang="ts">
  import type { Tag } from '$lib/types';

  interface Props {
    /** The current user's tags. */
    tags: Tag[];
    selectedId: string | null;
    onSelect: (tagId: string) => void;
  }

  let { tags, selectedId, onSelect }: Props = $props();
</script>

<div class="tags-sidebar">
  <h3>Your Tags ({tags.length})</h3>
  {#if tags.length === 0}
    <div class="empty-tags">
      <p>No tags yet. Create your first tag to organize your items!</p>
    </div>
  {:else}
    <div class="tags-list">
      {#each tags as tag}
        <button class="tag-item" class:active={selectedId === tag.id} onclick={() => onSelect(tag.id)}>
          <span class="tag-icon" aria-hidden="true">🏷️</span>
          <div class="tag-info">
            <span class="tag-name">{tag.name}</span>
            <span class="tag-count">{tag.itemIds.length} items</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tags-sidebar {
    background-color: var(--background);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border);
    height: fit-content;
  }

  .tags-sidebar h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
  }

  .tags-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tag-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: var(--radius);
    background-color: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
  }

  .tag-item:hover {
    background-color: var(--surface);
    border-color: var(--border);
  }

  .tag-item.active {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: var(--primary);
  }

  .tag-icon {
    font-size: 1.5rem;
  }

  .tag-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tag-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .tag-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .empty-tags {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
