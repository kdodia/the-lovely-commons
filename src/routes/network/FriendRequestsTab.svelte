<script lang="ts">
  import type { FriendRequest, User } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import FriendRequestCard from './FriendRequestCard.svelte';

  interface Props {
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
    users: User[];
    onAccept: (requestId: string) => void;
    /** Opens the decline dialog for this request. */
    onDecline: (requestId: string) => void;
  }

  let { incoming, outgoing, users, onAccept, onDecline }: Props = $props();
</script>

<div class="friend-requests-section">
  <div class="request-subsection">
    <h2 class="subsection-title">
      <span aria-hidden="true">📥</span>
      <span>Incoming Requests</span>
      {#if incoming.length > 0}
        <span class="subsection-badge">{incoming.length}</span>
      {/if}
    </h2>
    <div class="requests-list">
      {#if incoming.length === 0}
        <EmptyState icon="📬" title="No incoming requests" description="Friend requests from others will appear here" />
      {:else}
        {#each incoming as request}
          <FriendRequestCard user={users.find((u) => u.id === request.fromUserId)} message={request.message}>
            {#snippet actions()}
              <button class="btn btn-primary" onclick={() => onAccept(request.id)}>Accept</button>
              <button class="btn btn-secondary" onclick={() => onDecline(request.id)}>Decline</button>
            {/snippet}
          </FriendRequestCard>
        {/each}
      {/if}
    </div>
  </div>

  <div class="request-subsection">
    <h2 class="subsection-title">
      <span aria-hidden="true">📤</span>
      <span>Outgoing Requests</span>
      {#if outgoing.length > 0}
        <span class="subsection-badge">{outgoing.length}</span>
      {/if}
    </h2>
    <div class="requests-list">
      {#if outgoing.length === 0}
        <EmptyState icon="📮" title="No outgoing requests" description="Friend requests you've sent will appear here" />
      {:else}
        {#each outgoing as request}
          <FriendRequestCard user={users.find((u) => u.id === request.toUserId)} sentAt={request.createdAt} />
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .friend-requests-section {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .request-subsection {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .subsection-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }

  .subsection-badge {
    background-color: var(--primary);
    color: white;
    padding: 0.25rem 0.625rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
  }
</style>
