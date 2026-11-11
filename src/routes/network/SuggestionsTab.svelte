<script lang="ts">
  import type { FriendRequest, User } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import UsersGrid from './UsersGrid.svelte';
  import UserCard from './UserCard.svelte';

  /**
   * People the current user could befriend: friends-of-friends or neighbors.
   * Each card offers "Send Friend Request", or "Request Sent" with the date
   * once one is pending.
   */
  interface Props {
    kind: 'friends-of-friends' | 'neighbors';
    users: User[];
    /** The current user's pending outgoing friend requests. */
    sentRequests: FriendRequest[];
    /** The current user's city, for the neighbors empty message. */
    city?: string;
    onSendRequest: (toUserId: string) => void;
  }

  let { kind, users, sentRequests, city, onSendRequest }: Props = $props();
</script>

<UsersGrid>
  {#if users.length === 0}
    {#if kind === 'friends-of-friends'}
      <EmptyState icon="🔗" title="No friends-of-friends" description="Your friends don't have any other connections yet" />
    {:else}
      <EmptyState icon="🏘️" title="No neighbors found" description="No other users in {city} yet" />
    {/if}
  {:else}
    {#each users as user}
      {@const pendingRequest = sentRequests.find((r) => r.toUserId === user.id)}
      <UserCard {user}>
        {#snippet actions()}
          {#if pendingRequest}
            <button class="btn btn-sm btn-secondary" disabled>Request Sent</button>
            <span class="request-sent-date">
              {new Date(pendingRequest.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          {:else}
            <button class="btn btn-sm btn-primary" onclick={() => onSendRequest(user.id)}>
              Send Friend Request
            </button>
          {/if}
        {/snippet}
      </UserCard>
    {/each}
  {/if}
</UsersGrid>

<style>
  .request-sent-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
