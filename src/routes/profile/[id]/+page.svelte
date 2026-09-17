<script lang="ts">
  import { page } from '$app/stores';
  import { appStore, canUserViewItem } from '$lib/store';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import { formatDisplayDate } from '$lib/dates';

  let userId = $derived($page.params.id);
  let user = $derived($appStore.users.find((u) => u.id === userId));
  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));

  let userItems = $derived(
    $appStore.items.filter(
      (item) => item.lenderId === userId &&
                item.available &&
                canUserViewItem(item, $appStore.currentUserId, $appStore)
    )
  );

  let borrowHistory = $derived(
    $appStore.borrowHistory.filter((h) => h.borrowerId === userId || h.lenderId === userId)
  );

  // In-flight borrow requests for this user. Completed requests are excluded
  // (their BorrowHistory entry already represents them), and another user's
  // pending/denied requests are private — a visitor only sees requests they
  // are themselves a party to.
  let borrowRequests = $derived(
    $appStore.borrowRequests.filter(
      (r) =>
        (r.borrowerId === userId || r.lenderId === userId) &&
        r.status !== 'completed' &&
        (userId === $appStore.currentUserId ||
          r.borrowerId === $appStore.currentUserId ||
          r.lenderId === $appStore.currentUserId)
    )
  );

  // Separate lending and borrowing activities
  let lendingActivity = $derived(
    [...borrowRequests.filter(r => r.lenderId === userId), ...borrowHistory.filter(h => h.lenderId === userId)].sort((a, b) => {
      const dateA = 'createdAt' in a ? new Date(a.createdAt).getTime() : new Date(a.endDate).getTime();
      const dateB = 'createdAt' in b ? new Date(b.createdAt).getTime() : new Date(b.endDate).getTime();
      return dateB - dateA;
    })
  );

  let borrowingActivity = $derived(
    [...borrowRequests.filter(r => r.borrowerId === userId), ...borrowHistory.filter(h => h.borrowerId === userId)].sort((a, b) => {
      const dateA = 'createdAt' in a ? new Date(a.createdAt).getTime() : new Date(a.endDate).getTime();
      const dateB = 'createdAt' in b ? new Date(b.createdAt).getTime() : new Date(b.endDate).getTime();
      return dateB - dateA;
    })
  );

  let activityTab = $state<'lending' | 'borrowing'>('borrowing');

  let isCurrentUser = $derived(userId === $appStore.currentUserId);
  let isFriend = $derived(currentUser && userId ? currentUser.friendIds.includes(userId) : false);
  let isCloseFriend = $derived(currentUser && userId ? currentUser.closeFriendIds.includes(userId) : false);
  let theyMarkedMeCloseFriend = $derived(user?.closeFriendIds.includes($appStore.currentUserId) || false);
</script>

{#if !user}
  <div class="container">
    <div class="error-state">
      <h2>User not found</h2>
      <p>This user doesn't exist or has been removed.</p>
      <a href="/" class="btn btn-primary">Back to Browse</a>
    </div>
  </div>
{:else}
  <div class="profile-page fade-in">
    <div class="container">
      <div class="profile-header card">
        <img src={user.profilePic} alt={user.name} class="profile-avatar" />
        <div class="profile-info">
          <h1 class="profile-name">{user.name}</h1>
          <p class="profile-bio">{user.bio}</p>

          <div class="profile-stats">
            <div class="stat-item">
              <span class="stat-value"><span aria-hidden="true">⭐</span> {user.rating.toFixed(1)}</span>
              <span class="stat-label">Rating</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{user.totalLends}</span>
              <span class="stat-label">Items Lent</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{user.totalBorrows}</span>
              <span class="stat-label">Items Borrowed</span>
            </div>
          </div>

          <div class="profile-badges">
            {#if isCurrentUser}
              <span class="badge badge-primary">Your Profile</span>
            {/if}
            {#if isCloseFriend}
              <span class="badge badge-success">Close Friend</span>
            {:else if isFriend}
              <span class="badge badge-primary">Friend</span>
            {/if}
            {#if !isCurrentUser && theyMarkedMeCloseFriend}
              <span class="badge badge-success"><span aria-hidden="true">💚</span> Their Close Friend</span>
            {/if}
          </div>
        </div>
      </div>

      <div class="profile-content">
        <section class="items-section">
          <h2 class="section-title">Available Items ({userItems.length})</h2>
          {#if userItems.length === 0}
            <div class="empty-state">
              <span class="empty-icon" aria-hidden="true">📦</span>
              <p>
                {isCurrentUser
                  ? "You haven't added any items yet"
                  : `${user.name} hasn't added any items yet`}
              </p>
            </div>
          {:else}
            <div class="items-grid">
              {#each userItems as item (item.id)}
                <ItemCard {item} />
              {/each}
            </div>
          {/if}
        </section>

        {#if lendingActivity.length > 0 || borrowingActivity.length > 0}
          <section class="history-section">
            <h2 class="section-title">Activity History</h2>

            <div class="activity-tabs">
              <button
                class="activity-tab"
                class:active={activityTab === 'borrowing'}
                onclick={() => (activityTab = 'borrowing')}
              >
                <span aria-hidden="true">📤</span>
                <span>Borrowing</span>
                {#if borrowingActivity.length > 0}
                  <span class="tab-badge">{borrowingActivity.length}</span>
                {/if}
              </button>
              <button
                class="activity-tab"
                class:active={activityTab === 'lending'}
                onclick={() => (activityTab = 'lending')}
              >
                <span aria-hidden="true">📥</span>
                <span>Lending</span>
                {#if lendingActivity.length > 0}
                  <span class="tab-badge">{lendingActivity.length}</span>
                {/if}
              </button>
            </div>

            <div class="history-list">
              {#each (activityTab === 'borrowing' ? borrowingActivity : lendingActivity).slice(0, 10) as activity}
                {@const item = $appStore.items.find((i) => i.id === activity.itemId)}
                {@const otherUser = $appStore.users.find(
                  (u) => u.id === (activityTab === 'borrowing' ? activity.lenderId : activity.borrowerId)
                )}
                {@const status = 'status' in activity ? activity.status : 'completed'}
                {@const isRequest = 'status' in activity}
                <div class="history-item" class:active-item={status === 'active' || status === 'approved'}>
                  <a href="/items/{item?.id}" class="history-item-image-link">
                    <img src={item?.imageUrl} alt={item?.name} class="history-item-image" />
                  </a>
                  <div class="history-details">
                    <div class="history-action">
                      <span><span aria-hidden="true">{activityTab === 'borrowing' ? '📤' : '📥'}</span> {activityTab === 'borrowing' ? 'Borrowed' : 'Lent'}</span>
                      <a href="/items/{item?.id}" class="history-link"><strong>{item?.name}</strong></a>
                      <span>{activityTab === 'borrowing' ? 'from' : 'to'}</span>
                      <a href="/profile/{otherUser?.id}" class="history-link"><strong>{otherUser?.name}</strong></a>
                      {#if status === 'active'}
                        <span class="badge badge-success">Active</span>
                      {:else if status === 'approved'}
                        <span class="badge badge-success">Approved</span>
                      {:else if status === 'pending'}
                        <span class="badge badge-warning">Pending</span>
                      {:else if status === 'denied'}
                        <span class="badge badge-error">Declined</span>
                      {:else if status === 'cancelled'}
                        <span class="badge">Cancelled</span>
                      {:else if status === 'completed' && isRequest}
                        <span class="badge badge-primary">Returned</span>
                      {/if}
                    </div>
                    <div class="history-date">
                      {#if status === 'active' || status === 'approved'}
                        Return by: {formatDisplayDate(activity.endDate, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      {:else if status === 'pending'}
                        Requested: {new Date('createdAt' in activity ? activity.createdAt : activity.endDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      {:else if status === 'denied' || status === 'cancelled'}
                        {new Date('createdAt' in activity ? activity.createdAt : activity.endDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      {:else}
                        {formatDisplayDate(activity.endDate, {
                          month: 'short',
                          year: 'numeric'
                        })}
                      {/if}
                    </div>
                    {#if 'rating' in activity && activity.rating}
                      <div class="history-rating">
                        {#each Array(Math.max(0, Math.min(5, Math.floor(Number(activity.rating) || 0)))) as _}
                          <span aria-hidden="true">⭐</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .profile-header {
    display: flex;
    gap: 2rem;
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .profile-avatar {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid var(--primary);
    flex-shrink: 0;
  }

  .profile-info {
    flex: 1;
  }

  .profile-name {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .profile-bio {
    color: var(--text-secondary);
    margin: 0 0 1.5rem 0;
    line-height: 1.6;
  }

  .profile-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .profile-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 1.5rem 0;
  }

  .items-section {
    margin-bottom: 3rem;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin: 0;
  }

  .history-section {
    margin-top: 3rem;
  }

  .activity-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--border);
  }

  .activity-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all var(--transition);
  }

  .activity-tab:hover {
    color: var(--text-primary);
    background-color: var(--surface);
  }

  .activity-tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .activity-tab .tab-badge {
    background-color: var(--primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .history-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--surface);
    border-radius: var(--radius);
    align-items: center;
  }

  .history-item.active-item {
    background-color: rgba(16, 185, 129, 0.05);
    border-left: 3px solid var(--primary);
  }

  .history-item-image-link {
    display: block;
    flex-shrink: 0;
    transition: opacity var(--transition);
  }

  .history-item-image-link:hover {
    opacity: 0.8;
  }

  .history-item-image {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: var(--radius);
    flex-shrink: 0;
    display: block;
  }

  .history-details {
    flex: 1;
  }

  .history-action {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .history-action strong {
    color: var(--text-primary);
  }

  .history-link {
    text-decoration: none;
    color: inherit;
    transition: color var(--transition);
  }

  .history-link:hover {
    color: var(--primary);
  }

  .history-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .history-rating {
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .error-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .profile-stats {
      justify-content: center;
    }

    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
