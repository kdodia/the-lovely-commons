<script lang="ts">
  import { page } from '$app/stores';
  import { appStore, canUserViewItem, canViewBorrowerFeedback, getBorrowerFeedback } from '$lib/store';
  import FallbackImage from '$lib/components/FallbackImage.svelte';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import StarRating from '$lib/components/StarRating.svelte';
  import RatingScore from '$lib/components/RatingScore.svelte';
  import { formatDisplayDate } from '$lib/dates';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Tabs from '$lib/components/Tabs.svelte';

  let userId = $derived($page.params.id);
  let user = $derived($appStore.users.find((u) => u.id === userId));
  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));

  let userItems = $derived(
    $appStore.items.filter(
      (item) => item.lenderId === userId &&
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

  // Lender notes about this user as a borrower — private to the user, their
  // friends and lenders with a live request from them.
  let canSeeFeedback = $derived(
    userId ? canViewBorrowerFeedback(userId, $appStore.currentUserId, $appStore) : false
  );
  let lenderFeedback = $derived(userId ? getBorrowerFeedback(userId, $appStore) : []);

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
        <Avatar src={user.profilePic} alt={user.name} size="150px" border="4px" />
        <div class="profile-info">
          <h1 class="profile-name">{user.name}</h1>
          <p class="profile-bio">{user.bio}</p>

          <div class="profile-stats">
            <div class="stat-item">
              <span class="stat-value"><RatingScore value={user.rating} /></span>
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
          <h2 class="section-title">Items ({userItems.length})</h2>
          {#if userItems.length === 0}
            <EmptyState
              compact
              icon="📦"
              description={isCurrentUser
                ? "You haven't added any items yet"
                : `${user.name} hasn't added any items yet`}
            />
          {:else}
            <div class="items-grid">
              {#each userItems as item (item.id)}
                <ItemCard {item} />
              {/each}
            </div>
          {/if}
        </section>

        {#if canSeeFeedback && (lenderFeedback.length > 0 || isCurrentUser)}
          <section class="feedback-section">
            <h2 class="section-title">What lenders say</h2>
            {#if lenderFeedback.length === 0}
              <EmptyState compact description="No lender feedback yet" />
            {:else}
              <div class="feedback-list">
                {#each lenderFeedback as entry (entry.id)}
                  {@const lender = $appStore.users.find((u) => u.id === entry.lenderId)}
                  {@const item = $appStore.items.find((i) => i.id === entry.itemId)}
                  <div class="feedback-item">
                    <div class="feedback-lender">
                      {#if lender}
                        <a href="/profile/{lender.id}" class="feedback-avatar">
                          <FallbackImage src={lender.profilePic} alt="" fallbackType="avatar" />
                        </a>
                        <a href="/profile/{lender.id}" class="history-link"><strong>{lender.name}</strong></a>
                      {:else}
                        <span class="feedback-avatar" aria-hidden="true"></span>
                        <strong class="removed-item">a removed user</strong>
                      {/if}
                    </div>
                    {#if entry.borrowerRating}
                      <div class="history-rating">
                        <StarRating value={entry.borrowerRating} label="{entry.borrowerRating} out of 5 stars" />
                      </div>
                    {/if}
                    {#if entry.borrowerReview?.trim()}
                      <p class="feedback-note">{entry.borrowerReview}</p>
                    {/if}
                    <div class="history-date">
                      {#if item}
                        <a href="/items/{item.id}" class="history-link">{item.name}</a>
                      {:else}
                        <span class="removed-item">a removed item</span>
                      {/if}
                      &middot; {formatDisplayDate(entry.endDate, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

        {#if lendingActivity.length > 0 || borrowingActivity.length > 0}
          <section class="history-section">
            <h2 class="section-title">Activity History</h2>

            <Tabs
              label="Activity history"
              scroll={false}
              bind:value={activityTab}
              tabs={[
                { id: 'borrowing', label: 'Borrowing', icon: '📤', count: borrowingActivity.length },
                { id: 'lending', label: 'Lending', icon: '📥', count: lendingActivity.length }
              ]}
            />

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
                      {#if item}
                        <a href="/items/{item.id}" class="history-link"><strong>{item.name}</strong></a>
                      {:else}
                        <strong class="removed-item">a removed item</strong>
                      {/if}
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
                    {#if 'reviewerId' in activity && activity.reviewerId && activity.rating}
                      <div class="history-rating">
                        <StarRating value={activity.rating} title="{activityTab === 'borrowing' ? 'Their' : "The borrower's"} review of the item" />
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

  .history-section {
    margin-top: 3rem;
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

  .feedback-section {
    margin-top: 3rem;
  }

  .feedback-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .feedback-item {
    padding: 1rem;
    background-color: var(--surface);
    border-radius: var(--radius);
  }

  .feedback-lender {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  .feedback-avatar {
    display: block;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .feedback-note {
    margin: 0.5rem 0;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .removed-item {
    color: var(--text-secondary);
    font-style: italic;
  }
</style>
