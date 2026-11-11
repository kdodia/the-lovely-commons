<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { User } from '$lib/types';
  import Avatar from '$lib/components/Avatar.svelte';
  import RatingScore from '$lib/components/RatingScore.svelte';

  /**
   * A person in one of the network tabs: avatar, name, city, rating and
   * lends, linked to their profile, with the tab's buttons underneath.
   */
  interface Props {
    user: User;
    /** Show the "Their Close Friend" badge (they've put the current user in their inner circle). */
    theirCloseFriend?: boolean;
    /** The buttons for this tab, right-aligned under the card. */
    actions: Snippet;
  }

  let { user, theirCloseFriend = false, actions }: Props = $props();
</script>

<div class="user-card card">
  <a href="/profile/{user.id}" class="user-card-link">
    <Avatar src={user.profilePic} alt={user.name} size="60px" border="2px" />
    <div class="user-info">
      <h3 class="user-name">{user.name}</h3>
      <p class="user-location">{user.address?.city}</p>
      <div class="user-stats">
        <span><RatingScore value={user.rating} /></span>
        <span>•</span>
        <span>{user.totalLends} lends</span>
      </div>
      {#if theirCloseFriend}
        <span class="badge badge-success"><span aria-hidden="true">💚</span> Their Close Friend</span>
      {/if}
    </div>
  </a>
  <div class="user-actions">
    {@render actions()}
  </div>
</div>

<style>
  .user-card {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  }

  .user-card-link {
    display: flex;
    gap: 1rem;
    text-decoration: none;
    color: inherit;
    margin-bottom: 1rem;
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }

  .user-location {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }

  .user-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .user-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }

  /* The buttons come from the tab's snippet, so reach into them. */
  .user-actions :global(.btn-sm) {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
</style>
