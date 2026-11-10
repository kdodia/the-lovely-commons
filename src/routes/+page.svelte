<script lang="ts">
  import { appStore, canUserViewItem } from '$lib/store';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import BrowseFilters, { type SortOption, type ViewMode } from './BrowseFilters.svelte';
  import SearchBox from './SearchBox.svelte';
  import { fuzzyScore, type Suggestion } from './search';

  let debouncedSearchQuery = $state(''); // The search the grid filters by (SearchBox sets it)
  let selectedCategory = $state('all');
  let selectedTag = $state('all');
  let viewMode = $state<ViewMode>('grid');
  let sortBy = $state<SortOption>('popular');
  let showAvailableOnly = $state(false);

  // Helper to recursively get all category IDs (category + all descendants)
  function getCategoryAndDescendants(categoryId: string): string[] {
    const descendants = $appStore.categories
      .filter((c) => c.parentId === categoryId)
      .flatMap((c) => getCategoryAndDescendants(c.id));
    return [categoryId, ...descendants];
  }

  // Get items the user can view (excluding their own)
  let viewableItems = $derived(
    $appStore.items.filter((item) =>
      item.lenderId !== $appStore.currentUserId &&
      canUserViewItem(item, $appStore.currentUserId, $appStore)
    )
  );

  // What the search box can suggest: item names, then categories, then tags
  let suggestionCandidates = $derived<Suggestion[]>([
    ...viewableItems.map((item) => ({ text: item.name, type: 'item' as const })),
    ...$appStore.categories.map((c) => ({ text: c.name, type: 'category' as const })),
    ...$appStore.tags.map((t) => ({ text: t.name, type: 'tag' as const }))
  ]);

  // Derived filtered items
  let filteredItems = $derived.by(() => {
    let items = [...viewableItems];

    // Availability filter
    if (showAvailableOnly) {
      items = items.filter((item) => item.available);
    }

    // Search filter with fuzzy matching (debounced to improve performance)
    if (debouncedSearchQuery) {
      items = items
        .map((item) => {
          const nameScore = fuzzyScore(item.name, debouncedSearchQuery);
          const descScore = fuzzyScore(item.description, debouncedSearchQuery);
          const maxScore = Math.max(nameScore, descScore);
          return { item, score: maxScore };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
    }

    // Category filter (includes all descendant categories)
    if (selectedCategory !== 'all') {
      const categoryIds = getCategoryAndDescendants(selectedCategory);
      items = items.filter((item) => categoryIds.includes(item.categoryId));
    }

    // Tag filter
    if (selectedTag !== 'all') {
      const tag = $appStore.tags.find((t) => t.id === selectedTag);
      items = items.filter((item) => tag?.itemIds.includes(item.id));
    }

    // Sort items (only if not using search, which has its own relevance sorting)
    if (!debouncedSearchQuery) {
      items = [...items].sort((a, b) => {
        switch (sortBy) {
          case 'popular':
            return b.totalBorrows - a.totalBorrows;
          case 'rating':
            return b.rating - a.rating;
          case 'recent':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'alphabetical':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
    }

    return items;
  });

  // Get top-level categories
  let topCategories = $derived(
    $appStore.categories.filter((c) => !c.parentId)
  );

  // Available items count for display
  let availableCount = $derived(
    viewableItems.filter((item) => item.available).length
  );
</script>

<div class="browse-page fade-in">
  <div class="container">
    <PageHeader title="Browse Items" subtitle="Discover what your community is sharing" shrinkTitle />

    <div class="filters-section">
      <SearchBox bind:query={debouncedSearchQuery} candidates={suggestionCandidates} />
      <BrowseFilters
        categories={topCategories}
        tags={$appStore.tags}
        {availableCount}
        bind:selectedCategory
        bind:selectedTag
        bind:sortBy
        bind:viewMode
        bind:showAvailableOnly
      />
    </div>

    <div class="results-header">
      <p class="results-count">
        {filteredItems.length}
        {filteredItems.length === 1 ? 'item' : 'items'} found
        {#if debouncedSearchQuery}
          <span class="results-detail"> matching "{debouncedSearchQuery}"</span>
        {/if}
        {#if showAvailableOnly}
          <span class="results-detail"> (available only)</span>
        {/if}
      </p>
      {#if debouncedSearchQuery}
        <p class="sort-notice">Sorted by relevance</p>
      {/if}
    </div>

    {#if filteredItems.length > 0}
      <div class="items-grid" class:list-mode={viewMode === 'list'}>
        {#each filteredItems as item (item.id)}
          <ItemCard {item} />
        {/each}
      </div>
    {:else}
      <div class="no-results">
        <span class="no-results-icon" aria-hidden="true">📦</span>
        <h3>No items found</h3>
        <p>Try adjusting your filters or search query</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .browse-page {
    min-height: calc(100vh - 200px);
  }

  .filters-section {
    background-color: var(--background);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 2rem;
    border: 1px solid var(--border);
  }

  .results-header {
    margin-bottom: 1.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .results-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .results-detail {
    color: var(--text-muted);
    font-weight: 400;
  }

  .sort-notice {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .items-grid.list-mode {
    grid-template-columns: 1fr;
  }

  .no-results {
    text-align: center;
    padding: 4rem 2rem;
  }

  .no-results-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .no-results h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .no-results p {
    color: var(--text-secondary);
    margin: 0;
  }

  @media (max-width: 768px) {
    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
