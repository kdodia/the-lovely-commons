<script lang="ts">
  import type { User } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import UsersGrid from './UsersGrid.svelte';
  import UserCard from './UserCard.svelte';

  interface Props {
    /** The current user's close friends. */
    users: User[];
    currentUserId: string | undefined;
    onDemote: (friendId: string) => void;
  }

  let { users, currentUserId, onDemote }: Props = $props();
</script>

<UsersGrid>
  {#if users.length === 0}
    <EmptyState icon="💚" title="No close friends yet" description="Promote friends to your inner circle to share special items with them" />
  {:else}
    {#each users as user}
      <UserCard {user} theirCloseFriend={!!currentUserId && user.closeFriendIds.includes(currentUserId)}>
        {#snippet actions()}
          <span class="badge badge-success">Close Friend</span>
          <button class="btn btn-sm btn-secondary" onclick={() => onDemote(user.id)}>Remove</button>
        {/snippet}
      </UserCard>
    {/each}
  {/if}
</UsersGrid>
