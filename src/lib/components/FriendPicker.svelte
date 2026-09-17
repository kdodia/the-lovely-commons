<script lang="ts">
  import { appStore } from '$lib/store';
  import FallbackImage from './FallbackImage.svelte';

  interface Props {
    /** Selected user ids — bindable so forms can read the result back. */
    selectedIds: string[];
    /** Whose friends to list; defaults to the current user. */
    ownerId?: string;
  }

  let { selectedIds = $bindable([]), ownerId }: Props = $props();

  let owner = $derived($appStore.users.find((u) => u.id === (ownerId ?? $appStore.currentUserId)));

  // Friends and close friends, close friends first, then alphabetical.
  let friends = $derived.by(() => {
    if (!owner) return [];
    const ids = new Set([...owner.closeFriendIds, ...owner.friendIds]);
    return $appStore.users
      .filter((u) => ids.has(u.id))
      .sort((a, b) => {
        const aClose = owner.closeFriendIds.includes(a.id) ? 0 : 1;
        const bClose = owner.closeFriendIds.includes(b.id) ? 0 : 1;
        return aClose - bClose || a.name.localeCompare(b.name);
      });
  });

  function toggle(userId: string) {
    selectedIds = selectedIds.includes(userId)
      ? selectedIds.filter((id) => id !== userId)
      : [...selectedIds, userId];
  }
</script>

<div class="friend-picker" role="group" aria-label="Choose who can see this item">
  {#if friends.length === 0}
    <p class="picker-empty">
      You don't have any friends yet. Add some on the <a href="/network">Network</a> page first.
    </p>
  {:else}
    <p class="picker-summary" aria-live="polite">
      {#if selectedIds.length === 0}
        Nobody selected yet — only you will see this item until you pick someone.
      {:else}
        Shared with {selectedIds.length} {selectedIds.length === 1 ? 'person' : 'people'}
      {/if}
    </p>
    <ul class="picker-list">
      {#each friends as friend (friend.id)}
        <li>
          <label class="picker-row" class:selected={selectedIds.includes(friend.id)}>
            <input
              type="checkbox"
              checked={selectedIds.includes(friend.id)}
              onchange={() => toggle(friend.id)}
            />
            <span class="picker-avatar">
              <FallbackImage src={friend.profilePic} alt="" fallbackType="avatar" />
            </span>
            <span class="picker-name">{friend.name}</span>
            {#if owner?.closeFriendIds.includes(friend.id)}
              <span class="badge badge-success picker-badge">💚 Close friend</span>
            {/if}
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .friend-picker {
    margin-top: 0.75rem;
    padding: 1rem;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    background-color: var(--surface);
  }

  .picker-empty,
  .picker-summary {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .picker-empty {
    margin-bottom: 0;
  }

  .picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .picker-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background-color: var(--background);
    cursor: pointer;
    font-weight: normal;
    margin: 0;
    transition: border-color var(--transition), background-color var(--transition);
  }

  .picker-row:hover {
    border-color: var(--primary);
  }

  .picker-row.selected {
    border-color: var(--primary);
    background-color: rgba(16, 185, 129, 0.08);
  }

  .picker-row input[type='checkbox'] {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .picker-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .picker-name {
    flex: 1;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .picker-badge {
    font-size: 0.6875rem;
  }
</style>
