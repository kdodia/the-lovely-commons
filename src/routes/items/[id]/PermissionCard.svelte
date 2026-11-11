<script lang="ts">
  import { appStore, getPermissionLevelInfo } from '$lib/store';
  import type { Item, User } from '$lib/types';

  /** "Who Can Borrow This": the permission level and a plain-language sentence. */
  interface Props {
    item: Item;
    lender: User | undefined;
  }

  let { item, lender }: Props = $props();

  let permissionInfo = $derived(getPermissionLevelInfo(item.permissionLevel));
  // People the owner hand-picked (only meaningful for 'specific-users')
  let allowedUsers = $derived(
    item.permissionLevel === 'specific-users'
      ? $appStore.users.filter((u) => item.allowedUserIds?.includes(u.id))
      : []
  );
</script>

{#if permissionInfo}
  <div class="permission-card">
    <div class="permission-header">
      <span class="permission-icon">{permissionInfo.icon}</span>
      <div>
        <h4>Who Can Borrow This</h4>
        <p class="permission-level">{permissionInfo.label}</p>
      </div>
    </div>
    <p class="permission-description">
      {#if item.permissionLevel === 'close-friends'}
        This item is available only to {lender?.name}'s close friends
      {:else if item.permissionLevel === 'friends'}
        This item is available to all of {lender?.name}'s friends
      {:else if item.permissionLevel === 'friends-of-friends'}
        This item is available to friends and their extended network
      {:else if item.permissionLevel === 'neighbors'}
        This item is available to anyone in {lender?.address?.city}
      {:else if item.permissionLevel === 'specific-users'}
        {#if item.lenderId === $appStore.currentUserId}
          {#if allowedUsers.length === 0}
            Only you can see this item right now — pick people in Edit Item to share it
          {:else}
            Shared with {allowedUsers.map((u) => u.name).join(', ')}
          {/if}
        {:else}
          {lender?.name} shared this item with a few specific people, including you
        {/if}
      {/if}
    </p>
  </div>
{/if}

<style>
  .permission-card {
    padding: 1.5rem;
    background-color: var(--surface);
    border-radius: var(--radius-lg);
    margin-bottom: 2rem;
    border: 2px solid var(--border);
  }

  .permission-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .permission-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .permission-card h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .permission-level {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--primary);
  }

  .permission-description {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }
</style>
