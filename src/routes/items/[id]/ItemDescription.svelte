<script lang="ts">
  import type { Tag } from '$lib/types';

  /** Description text plus the collections (tags) the item belongs to. */
  let { description, tags }: { description: string; tags: Tag[] } = $props();
</script>

<div class="item-description">
  <h3>Description</h3>
  <p>{description}</p>
</div>

{#if tags.length > 0}
  <div class="item-tags">
    <h3>Collections</h3>
    <div class="tags-list">
      {#each tags as tag}
        <span class="badge badge-primary"><span aria-hidden="true">🏷️</span> {tag.name}</span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .item-description {
    margin-bottom: 2rem;
  }

  .item-description h3,
  .item-tags h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .item-description p {
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .item-tags {
    margin-bottom: 2rem;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
