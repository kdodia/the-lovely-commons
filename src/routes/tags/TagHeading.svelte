<script lang="ts">
  import type { Tag } from '$lib/types';

  /**
   * The selected tag's name with Rename and Delete. Renaming swaps the name for
   * an inline form (Enter saves, Escape cancels). Render it keyed by tag id so
   * switching tags leaves edit mode.
   */
  interface Props {
    tag: Tag;
    /** Save a new name; return false to stay in edit mode (the caller says why). */
    onRename: (name: string) => boolean;
    /** Ask to delete the tag (the page confirms). */
    onDelete: () => void;
  }

  let { tag, onRename, onDelete }: Props = $props();

  let editing = $state(false);
  let editedName = $state('');
  let renameInput = $state<HTMLInputElement | undefined>();

  $effect(() => {
    if (editing && renameInput) renameInput.focus();
  });

  function startRename() {
    editedName = tag.name;
    editing = true;
  }

  function save() {
    if (onRename(editedName.trim())) editing = false;
  }

  function cancel() {
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cancel();
    }
  }
</script>

<div class="tag-heading">
  {#if editing}
    <form class="rename-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
      <label for="rename-tag" class="sr-only">Tag name</label>
      <input
        id="rename-tag"
        type="text"
        class="rename-input"
        bind:value={editedName}
        bind:this={renameInput}
        onkeydown={handleKeydown}
        maxlength="60"
      />
      <button type="submit" class="btn btn-primary btn-sm" disabled={!editedName.trim()}>Save</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick={cancel}>Cancel</button>
    </form>
  {:else}
    <h2>{tag.name}</h2>
    <div class="tag-heading-actions">
      <button class="btn btn-secondary btn-sm" onclick={startRename}>Rename</button>
      <button class="btn btn-secondary btn-sm btn-danger-text" onclick={onDelete}>Delete</button>
    </div>
  {/if}
</div>

<style>
  .tag-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .tag-heading h2 {
    margin: 0;
    font-size: 1.75rem;
  }

  .tag-heading-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-danger-text {
    color: var(--error);
  }

  .rename-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex: 1;
    flex-wrap: wrap;
  }

  .rename-input {
    flex: 1;
    min-width: 200px;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
