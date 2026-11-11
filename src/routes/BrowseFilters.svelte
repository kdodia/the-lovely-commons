<script lang="ts" module>
  export type SortOption = 'popular' | 'rating' | 'recent' | 'alphabetical';
  export type ViewMode = 'grid' | 'list';
</script>

<script lang="ts">
  import type { Category, Tag } from '$lib/types';

  /** The Browse page's category / tag / sort selectors, grid-or-list toggle and "available only" switch. */
  interface Props {
    /** Top-level categories to choose from. */
    categories: Category[];
    tags: Tag[];
    /** "(N items)" beside the availability switch. */
    availableCount: number;
    selectedCategory: string;
    selectedTag: string;
    sortBy: SortOption;
    viewMode: ViewMode;
    showAvailableOnly: boolean;
  }

  let {
    categories,
    tags,
    availableCount,
    selectedCategory = $bindable(),
    selectedTag = $bindable(),
    sortBy = $bindable(),
    viewMode = $bindable(),
    showAvailableOnly = $bindable()
  }: Props = $props();
</script>

<div class="filter-row">
  <div class="filter-group">
    <label for="category-filter">Category:</label>
    <select id="category-filter" bind:value={selectedCategory}>
      <option value="all">All Categories</option>
      {#each categories as category}
        <option value={category.id}>
          {category.icon} {category.name}
        </option>
      {/each}
    </select>
  </div>

  <div class="filter-group">
    <label for="tag-filter">Tag:</label>
    <select id="tag-filter" bind:value={selectedTag}>
      <option value="all">All Tags</option>
      {#each tags as tag}
        <option value={tag.id}>{tag.name}</option>
      {/each}
    </select>
  </div>

  <div class="filter-group">
    <label for="sort-by">Sort by:</label>
    <select id="sort-by" bind:value={sortBy}>
      <option value="popular">Most Popular</option>
      <option value="rating">Highest Rated</option>
      <option value="recent">Recently Added</option>
      <option value="alphabetical">A-Z</option>
    </select>
  </div>

  <div class="view-toggle">
    <button
      class="view-btn"
      class:active={viewMode === 'grid'}
      onclick={() => (viewMode = 'grid')}
      aria-label="Grid view"
      aria-pressed={viewMode === 'grid'}
    >
      ▦
    </button>
    <button
      class="view-btn"
      class:active={viewMode === 'list'}
      onclick={() => (viewMode = 'list')}
      aria-label="List view"
      aria-pressed={viewMode === 'list'}
    >
      ☰
    </button>
  </div>
</div>

<div class="availability-filter">
  <label class="toggle-label">
    <input type="checkbox" bind:checked={showAvailableOnly} class="toggle-checkbox" />
    <span class="toggle-switch"></span>
    <span class="toggle-text">
      Show available only
      <span class="available-count">({availableCount} items)</span>
    </span>
  </label>
</div>

<style>
  .filter-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 200px;
  }

  .filter-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .filter-group select {
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
  }

  .view-btn.active {
    background-color: var(--primary);
    color: white;
  }

  .availability-filter {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
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

  .available-count {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  @media (max-width: 768px) {
    .filter-row {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-group {
      min-width: auto;
    }
  }
</style>
