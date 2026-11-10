<script lang="ts">
  import { appStore, createId } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type { Tag } from '$lib/types';
  import { useToast } from '$lib/useToast.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import CreateTagForm from './CreateTagForm.svelte';
  import TagSidebar from './TagSidebar.svelte';
  import TagDetails from './TagDetails.svelte';

  let showCreateForm = $state(false);
  let newTagName = $state('');
  let selectedTagId = $state<string | null>(null);
  let showDeleteConfirm = $state(false);
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

  /** Returns false (after saying why) when the name can't be used, so the heading stays in edit mode. */
  function renameTag(name: string): boolean {
    if (!selectedTagId) return false;
    if (!name) {
      toaster.showToast('Tag name can\'t be empty', 'error');
      return false;
    }
    appStore.updateTag(selectedTagId, { name });
    toaster.showToast('Tag renamed', 'success');
    return true;
  }

  function confirmDelete() {
    if (!selectedTagId) return;
    const result = appStore.deleteTag(selectedTagId);
    showDeleteConfirm = false;
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }
    selectedTagId = null;
    toaster.showToast('Tag deleted', 'success');
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
    <PageHeader title="Tag Collections" subtitle="Organize your items into custom collections">
      <button class="btn btn-primary" onclick={() => (showCreateForm = !showCreateForm)}>
        <span>+</span>
        <span>Create Tag</span>
      </button>
    </PageHeader>

    {#if showCreateForm}
      <CreateTagForm bind:name={newTagName} onCreate={createTag} onCancel={() => (showCreateForm = false)} />
    {/if}

    <div class="tags-layout">
      <TagSidebar tags={userTags} selectedId={selectedTagId} onSelect={(id) => (selectedTagId = id)} />

      <div class="tags-content">
        {#if selectedTag}
          <TagDetails
            tag={selectedTag}
            {tagItems}
            {availableItems}
            onRename={renameTag}
            onDelete={() => (showDeleteConfirm = true)}
            onAddItem={addItemToTag}
            onRemoveItem={removeItemFromTag}
          />
        {:else}
          <EmptyState icon="🏷️" title="Select a tag to view items" description="Choose a tag from the sidebar to manage its items" />
        {/if}
      </div>
    </div>
  </div>
</div>

{#if showDeleteConfirm && selectedTag}
  <Modal title={`Delete "${selectedTag.name}"?`} size="sm" onClose={() => (showDeleteConfirm = false)}>
    <p>The collection goes away; the {selectedTag.itemIds.length} {selectedTag.itemIds.length === 1 ? 'item' : 'items'} in it stay in your library.</p>
    {#snippet actions()}
      <button class="btn btn-error" onclick={confirmDelete}>Delete Tag</button>
      <button class="btn btn-secondary" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
    {/snippet}
  </Modal>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .btn-error {
    background-color: var(--error);
    color: white;
  }

  .tags-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 2rem;
  }

  .tags-content {
    background-color: var(--background);
    border-radius: var(--radius-lg);
    padding: 2rem;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border);
  }

  @media (max-width: 768px) {
    .tags-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
