<script lang="ts">
  import { appStore, canUserViewItem } from '$lib/store';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import type { Item } from '$lib/types';

  type SortOption = 'popular' | 'rating' | 'recent' | 'alphabetical';

  let searchQuery = $state('');
  let debouncedSearchQuery = $state(''); // Debounced version for filtering
  let selectedCategory = $state('all');
  let selectedTag = $state('all');
  let viewMode = $state<'grid' | 'list'>('grid');
  let sortBy = $state<SortOption>('popular');
  let showAvailableOnly = $state(false);
  let showSuggestions = $state(false);
  let searchInputFocused = $state(false);

  // Debounce search input. Reading searchQuery synchronously here is what
  // registers it as a dependency — reading it only inside the timeout
  // callback would leave this effect with nothing to react to, so it would
  // run exactly once and the grid would never filter.
  $effect(() => {
    const query = searchQuery;
    const timeout = setTimeout(() => {
      debouncedSearchQuery = query;
    }, 300); // 300ms debounce delay
    return () => clearTimeout(timeout);
  });

  // Fuzzy search scoring - returns a score (higher = better match), or -1 for no match
  function fuzzyScore(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match gets highest score
    if (lowerText === lowerQuery) return 100;

    // Starts with query gets high score
    if (lowerText.startsWith(lowerQuery)) return 90;

    // Contains exact query
    if (lowerText.includes(lowerQuery)) return 80;

    // Word boundary match (query matches start of a word)
    const words = lowerText.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(lowerQuery)) return 70;
    }

    // Fuzzy character matching
    let queryIdx = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    let totalMatches = 0;

    for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIdx]) {
        queryIdx++;
        totalMatches++;
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 0;
      }
    }

    // All query characters must be found in order
    if (queryIdx < lowerQuery.length) return -1;

    // Score based on consecutive matches and coverage
    return 50 + (maxConsecutive / lowerQuery.length) * 20 + (totalMatches / lowerText.length) * 10;
  }

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

  // Search suggestions based on current query
  let searchSuggestions = $derived.by(() => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const query = searchQuery.toLowerCase();
    const suggestions: Array<{ text: string; type: 'item' | 'category' | 'tag'; score: number }> = [];

    // Item name suggestions
    for (const item of viewableItems) {
      const score = fuzzyScore(item.name, query);
      if (score > 0) {
        suggestions.push({ text: item.name, type: 'item', score });
      }
    }

    // Category suggestions
    for (const category of $appStore.categories) {
      const score = fuzzyScore(category.name, query);
      if (score > 0) {
        suggestions.push({ text: category.name, type: 'category', score });
      }
    }

    // Tag suggestions
    for (const tag of $appStore.tags) {
      const score = fuzzyScore(tag.name, query);
      if (score > 0) {
        suggestions.push({ text: tag.name, type: 'tag', score });
      }
    }

    // Sort by score and deduplicate
    const seen = new Set<string>();
    return suggestions
      .sort((a, b) => b.score - a.score)
      .filter(s => {
        const key = s.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  });

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

  function selectSuggestion(suggestion: { text: string; type: string }) {
    searchQuery = suggestion.text;
    debouncedSearchQuery = suggestion.text;
    showSuggestions = false;
  }

  function handleSearchFocus() {
    searchInputFocused = true;
    if (searchQuery.length >= 2) {
      showSuggestions = true;
    }
  }

  function handleSearchBlur() {
    searchInputFocused = false;
    // Delay hiding suggestions to allow click to register
    setTimeout(() => {
      if (!searchInputFocused) {
        showSuggestions = false;
      }
    }, 200);
  }

  function handleSearchInput() {
    showSuggestions = searchQuery.length >= 2;
  }

  function clearSearch() {
    searchQuery = '';
    debouncedSearchQuery = '';
    showSuggestions = false;
  }
</script>

<div class="browse-page fade-in">
  <div class="container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Browse Items</h1>
        <p class="page-subtitle">Discover what your community is sharing</p>
      </div>
    </header>

    <div class="filters-section">
      <div class="search-bar">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <label for="search-items" class="sr-only">Search items</label>
        <input
          id="search-items"
          type="text"
          placeholder="Search items, categories, or tags..."
          bind:value={searchQuery}
          oninput={handleSearchInput}
          onfocus={handleSearchFocus}
          onblur={handleSearchBlur}
          class="search-input"
          autocomplete="off"
          role="combobox"
          aria-expanded={showSuggestions && searchSuggestions.length > 0}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
        />
        {#if searchQuery}
          <button
            class="clear-search"
            onclick={clearSearch}
            aria-label="Clear search"
            type="button"
          >
            ✕
          </button>
        {/if}

        {#if showSuggestions && searchSuggestions.length > 0}
          <ul class="search-suggestions" id="search-suggestions" role="listbox">
            {#each searchSuggestions as suggestion}
              <li role="option" aria-selected="false">
                <button
                  class="suggestion-item"
                  onclick={() => selectSuggestion(suggestion)}
                  type="button"
                >
                  <span class="suggestion-icon" aria-hidden="true">
                    {#if suggestion.type === 'item'}📦
                    {:else if suggestion.type === 'category'}📁
                    {:else}🏷️{/if}
                  </span>
                  <span class="suggestion-text">{suggestion.text}</span>
                  <span class="suggestion-type">{suggestion.type}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="filter-row">
        <div class="filter-group">
          <label for="category-filter">Category:</label>
          <select id="category-filter" bind:value={selectedCategory}>
            <option value="all">All Categories</option>
            {#each topCategories as category}
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
            {#each $appStore.tags as tag}
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
          <input
            type="checkbox"
            bind:checked={showAvailableOnly}
            class="toggle-checkbox"
          />
          <span class="toggle-switch"></span>
          <span class="toggle-text">
            Show available only
            <span class="available-count">({availableCount} items)</span>
          </span>
        </label>
      </div>
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

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .filters-section {
    background-color: var(--background);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 2rem;
    border: 1px solid var(--border);
  }

  .search-bar {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.25rem;
    z-index: 1;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 3rem 0.875rem 3rem;
    font-size: 1rem;
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    transition: all var(--transition);
  }

  .search-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .clear-search {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--text-muted);
    font-size: 0.875rem;
    transition: all var(--transition);
  }

  .clear-search:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }

  .search-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-top: 0.25rem;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    max-height: 300px;
    overflow-y: auto;
    list-style: none;
    padding: 0.25rem;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    border-radius: var(--radius);
    transition: background-color var(--transition);
  }

  .suggestion-item:hover {
    background-color: var(--surface);
  }

  .suggestion-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .suggestion-text {
    flex: 1;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .suggestion-type {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: capitalize;
    background-color: var(--surface);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius);
  }

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

  .view-toggle {
    display: flex;
    gap: 0.25rem;
    background-color: var(--surface);
    padding: 0.25rem;
    border-radius: var(--radius);
  }

  .view-btn {
    padding: 0.5rem 0.875rem;
    font-size: 1.25rem;
    border-radius: var(--radius);
    color: var(--text-secondary);
    transition: all var(--transition);
  }

  .view-btn:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
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
    .page-title {
      font-size: 1.5rem;
    }

    .filter-row {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-group {
      min-width: auto;
    }

    .view-toggle {
      align-self: flex-end;
    }

    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
