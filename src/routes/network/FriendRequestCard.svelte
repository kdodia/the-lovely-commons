<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { User } from '$lib/types';
  import Avatar from '$lib/components/Avatar.svelte';
  import RatingScore from '$lib/components/RatingScore.svelte';

  /**
   * A friend request on the Friend Requests tab, showing the other person
   * (the sender of an incoming request, the recipient of an outgoing one).
   * Incoming requests pass their `message` and `actions`; outgoing ones pass
   * `sentAt` and show a pending badge with the date.
   */
  interface Props {
    user: User | undefined;
    /** The note that came with an incoming request. */
    message?: string;
    /** ISO timestamp an outgoing request was sent. */
    sentAt?: string;
    /** Accept / Decline buttons. */
    actions?: Snippet;
  }

  let { user, message, sentAt, actions }: Props = $props();
</script>

<div class="request-card card">
  <div class="request-content">
    <a href="/profile/{user?.id}" class="request-item-link">
      <Avatar src={user?.profilePic} alt={user?.name ?? ''} size="100px" border="3px" />
    </a>
    <div class="request-details">
      <a href="/profile/{user?.id}" class="request-title-link">
        <h3 class="request-title">{user?.name}</h3>
      </a>
      <p class="request-bio">{user?.bio}</p>
      <div class="request-meta">
        <span><span aria-hidden="true">📍</span> {user?.address?.city}</span>
        <span>•</span>
        <span><RatingScore value={user?.rating} /></span>
        <span>•</span>
        <span>{user?.totalLends} lends</span>
      </div>
      {#if message}
        <p class="request-message">"{message}"</p>
      {/if}
      {#if sentAt}
        <div class="request-sent-info">
          <span class="badge badge-warning">⏳ Pending</span>
          <span class="request-sent-date">
            Sent {new Date(sentAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
        </div>
      {/if}
    </div>
  </div>
  {#if actions}
    <div class="request-actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .request-content {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .request-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .request-bio {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .request-message {
    font-style: italic;
    color: var(--text-secondary);
    margin: 0;
    padding: 0.75rem;
    background-color: var(--surface);
    border-radius: var(--radius);
    border-left: 3px solid var(--primary);
  }

  .request-sent-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .request-sent-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .request-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .request-content {
      flex-direction: column;
    }

    .request-actions {
      flex-direction: row;
    }
  }
</style>
