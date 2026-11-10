<script lang="ts">
  import type { User } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import UsersGrid from './UsersGrid.svelte';
  import UserCard from './UserCard.svelte';

  interface Props {
    /** The current user's friends who aren't close friends yet. */
    users: User[];
    currentUserId: string | undefined;
    onPromote: (friendId: string) => void;
  }

  let { users, currentUserId, onPromote }: Props = $props();
</script>

<UsersGrid>
  {#if users.length === 0}
    <EmptyState icon="👥" title="No friends yet" description="Connect with friends-of-friends and neighbors to grow your network" />
  {:else}
    {#each users as user}
      <UserCard {user} theirCloseFriend={!!currentUserId && user.closeFriendIds.includes(currentUserId)}>
        {#snippet actions()}
          <button class="btn btn-sm btn-primary" onclick={() => onPromote(user.id)}>
            Promote to Close Friend
          </button>
        {/snippet}
      </UserCard>
    {/each}
  {/if}
</UsersGrid>
