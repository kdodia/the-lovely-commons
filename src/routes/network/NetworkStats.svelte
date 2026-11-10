<script lang="ts">
  interface Props {
    closeFriends: number;
    friends: number;
    friendsOfFriends: number;
    neighbors: number;
    /** The current user's city, for the neighbors caption. */
    city?: string;
  }

  let { closeFriends, friends, friendsOfFriends, neighbors, city }: Props = $props();
</script>

<div class="stats-grid">
  <div class="stat-card card">
    <div class="stat-icon" aria-hidden="true">💚</div>
    <div class="stat-info">
      <div class="stat-value">{closeFriends}</div>
      <div class="stat-label">Close Friends</div>
      <div class="stat-desc">Your most trusted circle</div>
    </div>
  </div>

  <div class="stat-card card">
    <div class="stat-icon" aria-hidden="true">👥</div>
    <div class="stat-info">
      <div class="stat-value">{friends}</div>
      <div class="stat-label">Friends</div>
      <div class="stat-desc">Direct connections</div>
    </div>
  </div>

  <div class="stat-card card">
    <div class="stat-icon" aria-hidden="true">🔗</div>
    <div class="stat-info">
      <div class="stat-value">{friendsOfFriends}</div>
      <div class="stat-label">Friends of Friends</div>
      <div class="stat-desc">Extended network</div>
    </div>
  </div>

  <div class="stat-card card">
    <div class="stat-icon" aria-hidden="true">🏘️</div>
    <div class="stat-info">
      <div class="stat-value">{neighbors}</div>
      <div class="stat-label">Neighbors</div>
      <div class="stat-desc">People in {city}</div>
    </div>
  </div>
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .stat-icon {
    font-size: 3rem;
    flex-shrink: 0;
  }

  .stat-info {
    flex: 1;
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .stat-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
