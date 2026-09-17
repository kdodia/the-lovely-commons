<script lang="ts">
  import { appStore, createId } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import type { Tag } from '$lib/types';
  import { useToast } from '$lib/useToast.svelte';

  let showCreateForm = $state(false);
  let newTagName = $state('');
  let selectedTagId = $state<string | null>(null);
  const toaster = useToast();

  let userTags = $derived(
    $appStore.tags.filter((tag) => tag.createdBy === $appStore.currentUserId)
  );

  let selectedTag = $derived(
    selectedTagId ? $appStore.tags.find((t) => t.id === selectedTagId) : null
  );

  let tagItems = $derived(
    selectedTag
      ? $appStore.items.filter((item) => selectedTag.itemIds.includes(item.id))
      : []
  );

  let availableItems = $derived(
    $appStore.items.filter(
      (item) =>
        item.lenderId === $appStore.currentUserId &&
        !selectedTag?.itemIds.includes(item.id)
    )
  );

  function createTag() {
    if (!newTagName.trim()) return;

    const tag: Tag = {
      id: createId('tag'),
      name: newTagName.trim(),
      createdBy: $appStore.currentUserId,
      itemIds: []
    };

    appStore.createTag(tag);
    toaster.showToast('Tag created!', 'success');
    newTagName = '';
    showCreateForm = false;
    selectedTagId = tag.id;
  }

  function addItemToTag(itemId: string) {
    if (!selectedTagId) return;
    appStore.addItemToTag(selectedTagId, itemId);
    toaster.showToast('Item added to tag!', 'success');
  }

  function removeItemFromTag(itemId: string) {
    if (!selectedTagId) return;
    appStore.removeItemFromTag(selectedTagId, itemId);
    toaster.showToast('Item removed from tag', 'success');
  }
</script>

<div class="tags-page fade-in">
  <div class="container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Tag Collections</h1>
        <p class="page-subtitle">Organize your items into custom collections</p>
      </div>
      <button class="btn btn-primary" onclick={() => (showCreateForm = !showCreateForm)}>
        <span>+</span>
        <span>Create Tag</span>
      </button>
    </header>

    {#if showCreateForm}
      <div class="create-form card">
        <h3>Create New Tag</h3>
        <div class="form-row">
          <input
            type="text"
            placeholder="Tag name (e.g., 'Camping Essentials', 'Party Items')"
            bind:value={newTagName}
            class="tag-input"
          />
          <button class="btn btn-primary" onclick={createTag} disabled={!newTagName.trim()}>
            Create
          </button>
          <button class="btn btn-secondary" onclick={() => (showCreateForm = false)}>
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <div class="tags-layout">
      <div class="tags-sidebar">
        <h3>Your Tags ({userTags.length})</h3>
        {#if userTags.length === 0}
          <div class="empty-tags">
            <p>No tags yet. Create your first tag to organize your items!</p>
          </div>
        {:else}
          <div class="tags-list">
            {#each userTags as tag}
              <button
                class="tag-item"
                class:active={selectedTagId === tag.id}
                onclick={() => (selectedTagId = tag.id)}
              >
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

      <div class="tags-content">
        {#if selectedTag}
          <div class="tag-details">
            <h2>{selectedTag.name}</h2>

            <div class="items-section">
              <h3>Items in this collection ({tagItems.length})</h3>
              {#if tagItems.length === 0}
                <div class="empty-items">
                  <p>No items in this tag yet. Add some from your items below!</p>
                </div>
              {:else}
                <div class="items-grid">
                  {#each tagItems as item}
                    <div class="item-card-mini card">
                      <a href="/items/{item.id}" class="item-link">
                        <img src={item.imageUrl} alt={item.name} class="item-thumb" />
                        <div class="item-mini-info">
                          <span class="item-mini-name">{item.name}</span>
                        </div>
                      </a>
                      <button
                        class="remove-btn"
                        onclick={() => removeItemFromTag(item.id)}
                        aria-label="Remove {item.name} from tag"
                      >
                        ✕
                      </button>
                    </div>
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
                    <div class="item-card-mini card">
                      <a href="/items/{item.id}" class="item-link">
                        <img src={item.imageUrl} alt={item.name} class="item-thumb" />
                        <div class="item-mini-info">
                          <span class="item-mini-name">{item.name}</span>
                        </div>
                      </a>
                      <button
                        class="add-btn"
                        onclick={() => addItemToTag(item.id)}
                        aria-label="Add {item.name} to tag"
                      >
                        +
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="no-selection">
            <span class="empty-icon" aria-hidden="true">🏷️</span>
            <h3>Select a tag to view items</h3>
            <p>Choose a tag from the sidebar to manage its items</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .create-form {
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .create-form h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .tag-input {
    flex: 1;
  }

  .tags-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 2rem;
  }

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

  .tags-content {
    background-color: var(--background);
    border-radius: var(--radius-lg);
    padding: 2rem;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border);
  }

  .tag-details h2 {
    margin: 0 0 2rem 0;
    font-size: 1.75rem;
  }

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

  .add-btn,
  .remove-btn {
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

  .empty-tags,
  .empty-items {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .no-selection {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .no-selection h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .no-selection p {
    color: var(--text-secondary);
    margin: 0;
  }

  .text-muted {
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .tags-layout {
      grid-template-columns: 1fr;
    }

    .items-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      flex-direction: column;
    }
  }
</style>
