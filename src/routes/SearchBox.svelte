<script lang="ts">
  import { searchSuggestions, type Suggestion } from './search';

  /**
   * The Browse page's search field with its suggestion dropdown.
   *
   * `query` is the search the page filters by. It follows what the user types
   * after a short pause, and jumps straight to the text when a suggestion is
   * picked or the box is cleared.
   */
  interface Props {
    query: string;
    /** What suggestions can be made from, in tie-break order: items, then categories, then tags. */
    candidates: Suggestion[];
  }

  let { query = $bindable(), candidates }: Props = $props();

  let searchQuery = $state(''); // what is in the box right now
  let showSuggestions = $state(false);
  let searchInputFocused = $state(false);

  // Debounce search input. Reading searchQuery synchronously here is what
  // registers it as a dependency — reading it only inside the timeout
  // callback would leave this effect with nothing to react to, so it would
  // run exactly once and the grid would never filter.
  $effect(() => {
    const typed = searchQuery;
    const timeout = setTimeout(() => {
      query = typed;
    }, 300); // 300ms debounce delay
    return () => clearTimeout(timeout);
  });

  let suggestions = $derived(searchSuggestions(candidates, searchQuery));

  function selectSuggestion(suggestion: Suggestion) {
    searchQuery = suggestion.text;
    query = suggestion.text;
    showSuggestions = false;
  }

  function handleFocus() {
    searchInputFocused = true;
    if (searchQuery.length >= 2) {
      showSuggestions = true;
    }
  }

  function handleBlur() {
    searchInputFocused = false;
    // Delay hiding suggestions to allow click to register
    setTimeout(() => {
      if (!searchInputFocused) {
        showSuggestions = false;
      }
    }, 200);
  }

  function handleInput() {
    showSuggestions = searchQuery.length >= 2;
  }

  function clearSearch() {
    searchQuery = '';
    query = '';
    showSuggestions = false;
  }
</script>

<div class="search-bar">
  <span class="search-icon" aria-hidden="true">🔍</span>
  <label for="search-items" class="sr-only">Search items</label>
  <input
    id="search-items"
    type="text"
    placeholder="Search items, categories, or tags..."
    bind:value={searchQuery}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    class="search-input"
    autocomplete="off"
    role="combobox"
    aria-expanded={showSuggestions && suggestions.length > 0}
    aria-controls="search-suggestions"
    aria-autocomplete="list"
  />
  {#if searchQuery}
    <button class="clear-search" onclick={clearSearch} aria-label="Clear search" type="button">
      ✕
    </button>
  {/if}

  {#if showSuggestions && suggestions.length > 0}
    <ul class="search-suggestions" id="search-suggestions" role="listbox">
      {#each suggestions as suggestion}
        <li role="option" aria-selected="false">
          <button class="suggestion-item" onclick={() => selectSuggestion(suggestion)} type="button">
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

<style>
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
</style>
