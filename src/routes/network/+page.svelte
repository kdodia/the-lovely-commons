<script lang="ts">
  import { appStore, incomingFriendRequests } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import { useToast } from '$lib/useToast.svelte';
  import type { FriendRequest } from '$lib/types';

  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));
  const toaster = useToast();

  // Outgoing friend requests
  let outgoingFriendRequests = $derived(
    $appStore.friendRequests.filter(
      (req) => req.fromUserId === $appStore.currentUserId && req.status === 'pending'
    )
  );

  // Decline request modal state
  let showDeclineModal = $state(false);
  let declineRequestId = $state<string | null>(null);
  let declineMessage = $state('');
  let declineModalElement = $state<HTMLDivElement | undefined>();

  // Get users in each tier
  let closeFriends = $derived(
    currentUser ? $appStore.users.filter((u) => currentUser.closeFriendIds.includes(u.id)) : []
  );

  let friends = $derived(
    currentUser
      ? $appStore.users.filter(
          (u) => currentUser.friendIds.includes(u.id) && !currentUser.closeFriendIds.includes(u.id)
        )
      : []
  );

  let friendsOfFriends = $derived(
    currentUser
      ? $appStore.users.filter((u) => {
          if (u.id === currentUser.id) return false;
          if (currentUser.friendIds.includes(u.id)) return false;
          // Check if any of current user's friends are friends with this user
          return currentUser.friendIds.some((friendId) => u.friendIds.includes(friendId));
        })
      : []
  );

  let neighbors = $derived(
    currentUser
      ? $appStore.users.filter((u) => {
          if (u.id === currentUser.id) return false;
          if (currentUser.friendIds.includes(u.id)) return false;
          // Same city = neighbors
          return u.address?.city === currentUser.address?.city;
        })
      : []
  );

  let networkTab = $state<'close-friends' | 'friends' | 'friends-of-friends' | 'neighbors' | 'friend-requests'>(
    'close-friends'
  );

  function sendFriendRequest(toUserId: string) {
    if (!currentUser) return;

    // Check for duplicate or existing friend request
    const existingRequest = $appStore.friendRequests.find(
      (r) =>
        ((r.fromUserId === currentUser.id && r.toUserId === toUserId) ||
         (r.fromUserId === toUserId && r.toUserId === currentUser.id)) &&
        r.status === 'pending'
    );

    if (existingRequest) {
      toaster.showToast('Friend request already exists', 'error');
      return;
    }

    appStore.sendFriendRequest(currentUser.id, toUserId);
    toaster.showToast('Friend request sent!', 'success');
  }

  function acceptFriendRequest(requestId: string) {
    appStore.acceptFriendRequest(requestId);
    toaster.showToast('Friend request accepted!', 'success');
  }

  function openDeclineModal(requestId: string) {
    declineRequestId = requestId;
    declineMessage = '';
    showDeclineModal = true;
  }

  function cancelDecline() {
    showDeclineModal = false;
    declineRequestId = null;
    declineMessage = '';
  }

  function confirmDecline() {
    if (!declineRequestId) return;
    appStore.declineFriendRequest(declineRequestId, declineMessage.trim() || undefined);
    toaster.showToast('Friend request declined', 'info');
    cancelDecline();
  }

  // Handle escape key for modal
  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cancelDecline();
    }
  }

  // Focus modal when it opens
  $effect(() => {
    if (showDeclineModal && declineModalElement) {
      declineModalElement.focus();
    }
  });

  function promoteToCloseFriend(friendId: string) {
    if (!currentUser) return;
    appStore.promoteToCloseFriend(currentUser.id, friendId);
    toaster.showToast('Promoted to close friend!', 'success');
  }

  function demoteFromCloseFriend(friendId: string) {
    if (!currentUser) return;
    appStore.demoteFromCloseFriend(currentUser.id, friendId);
    toaster.showToast('Removed from close friends', 'success');
  }

  // Helper to check if friend request already sent
  function getFriendRequestStatus(toUserId: string): FriendRequest | undefined {
    if (!currentUser) return undefined;
    return $appStore.friendRequests.find(
      (req) =>
        req.fromUserId === currentUser.id &&
        req.toUserId === toUserId &&
        req.status === 'pending'
    );
  }
</script>

<div class="network-page fade-in">
  <div class="container">
    <header class="page-header">
      <div>
        <h1 class="page-title">My Network</h1>
        <p class="page-subtitle">Manage your connections and sharing circles</p>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card card">
        <div class="stat-icon" aria-hidden="true">💚</div>
        <div class="stat-info">
          <div class="stat-value">{closeFriends.length}</div>
          <div class="stat-label">Close Friends</div>
          <div class="stat-desc">Your most trusted circle</div>
        </div>
      </div>

      <div class="stat-card card">
        <div class="stat-icon" aria-hidden="true">👥</div>
        <div class="stat-info">
          <div class="stat-value">{friends.length}</div>
          <div class="stat-label">Friends</div>
          <div class="stat-desc">Direct connections</div>
        </div>
      </div>

      <div class="stat-card card">
        <div class="stat-icon" aria-hidden="true">🔗</div>
        <div class="stat-info">
          <div class="stat-value">{friendsOfFriends.length}</div>
          <div class="stat-label">Friends of Friends</div>
          <div class="stat-desc">Extended network</div>
        </div>
      </div>

      <div class="stat-card card">
        <div class="stat-icon" aria-hidden="true">🏘️</div>
        <div class="stat-info">
          <div class="stat-value">{neighbors.length}</div>
          <div class="stat-label">Neighbors</div>
          <div class="stat-desc">People in {currentUser?.address?.city}</div>
        </div>
      </div>
    </div>

    <div class="network-section">
      <div class="network-tabs">
        <button
          class="network-tab"
          class:active={networkTab === 'close-friends'}
          onclick={() => (networkTab = 'close-friends')}
        >
          <span aria-hidden="true">💚</span>
          <span>Close Friends</span>
          {#if closeFriends.length > 0}
            <span class="tab-badge">{closeFriends.length}</span>
          {/if}
        </button>

        <button
          class="network-tab"
          class:active={networkTab === 'friends'}
          onclick={() => (networkTab = 'friends')}
        >
          <span aria-hidden="true">👥</span>
          <span>Friends</span>
          {#if friends.length > 0}
            <span class="tab-badge">{friends.length}</span>
          {/if}
        </button>

        <button
          class="network-tab"
          class:active={networkTab === 'friends-of-friends'}
          onclick={() => (networkTab = 'friends-of-friends')}
        >
          <span aria-hidden="true">🔗</span>
          <span>Friends of Friends</span>
          {#if friendsOfFriends.length > 0}
            <span class="tab-badge">{friendsOfFriends.length}</span>
          {/if}
        </button>

        <button
          class="network-tab"
          class:active={networkTab === 'neighbors'}
          onclick={() => (networkTab = 'neighbors')}
        >
          <span aria-hidden="true">🏘️</span>
          <span>Neighbors</span>
          {#if neighbors.length > 0}
            <span class="tab-badge">{neighbors.length}</span>
          {/if}
        </button>

        <button
          class="network-tab"
          class:active={networkTab === 'friend-requests'}
          onclick={() => (networkTab = 'friend-requests')}
        >
          <span aria-hidden="true">📬</span>
          <span>Friend Requests</span>
          {#if $incomingFriendRequests.length > 0 || outgoingFriendRequests.length > 0}
            <span class="tab-badge">{$incomingFriendRequests.length + outgoingFriendRequests.length}</span>
          {/if}
        </button>
      </div>

      <div class="tab-content">
        {#if networkTab === 'close-friends'}
          <div class="users-grid">
            {#if closeFriends.length === 0}
              <div class="empty-state">
                <span class="empty-icon" aria-hidden="true">💚</span>
                <h3>No close friends yet</h3>
                <p>Promote friends to your inner circle to share special items with them</p>
              </div>
            {:else}
              {#each closeFriends as user}
                <div class="user-card card">
                  <a href="/profile/{user.id}" class="user-card-link">
                    <img src={user.profilePic} alt={user.name} class="user-avatar" />
                    <div class="user-info">
                      <h3 class="user-name">{user.name}</h3>
                      <p class="user-location">{user.address?.city}</p>
                      <div class="user-stats">
                        <span><span aria-hidden="true">⭐</span> {user.rating.toFixed(1)}</span>
                        <span>•</span>
                        <span>{user.totalLends} lends</span>
                      </div>
                      {#if currentUser && user.closeFriendIds.includes(currentUser.id)}
                        <span class="badge badge-success"><span aria-hidden="true">💚</span> Their Close Friend</span>
                      {/if}
                    </div>
                  </a>
                  <div class="user-actions">
                    <span class="badge badge-success">Close Friend</span>
                    <button
                      class="btn btn-sm btn-secondary"
                      onclick={() => demoteFromCloseFriend(user.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if networkTab === 'friends'}
          <div class="users-grid">
            {#if friends.length === 0}
              <div class="empty-state">
                <span class="empty-icon" aria-hidden="true">👥</span>
                <h3>No friends yet</h3>
                <p>Connect with friends-of-friends and neighbors to grow your network</p>
              </div>
            {:else}
              {#each friends as user}
                <div class="user-card card">
                  <a href="/profile/{user.id}" class="user-card-link">
                    <img src={user.profilePic} alt={user.name} class="user-avatar" />
                    <div class="user-info">
                      <h3 class="user-name">{user.name}</h3>
                      <p class="user-location">{user.address?.city}</p>
                      <div class="user-stats">
                        <span><span aria-hidden="true">⭐</span> {user.rating.toFixed(1)}</span>
                        <span>•</span>
                        <span>{user.totalLends} lends</span>
                      </div>
                      {#if currentUser && user.closeFriendIds.includes(currentUser.id)}
                        <span class="badge badge-success"><span aria-hidden="true">💚</span> Their Close Friend</span>
                      {/if}
                    </div>
                  </a>
                  <div class="user-actions">
                    <button
                      class="btn btn-sm btn-primary"
                      onclick={() => promoteToCloseFriend(user.id)}
                    >
                      Promote to Close Friend
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if networkTab === 'friends-of-friends'}
          <div class="users-grid">
            {#if friendsOfFriends.length === 0}
              <div class="empty-state">
                <span class="empty-icon" aria-hidden="true">🔗</span>
                <h3>No friends-of-friends</h3>
                <p>Your friends don't have any other connections yet</p>
              </div>
            {:else}
              {#each friendsOfFriends as user}
                {@const pendingRequest = getFriendRequestStatus(user.id)}
                <div class="user-card card">
                  <a href="/profile/{user.id}" class="user-card-link">
                    <img src={user.profilePic} alt={user.name} class="user-avatar" />
                    <div class="user-info">
                      <h3 class="user-name">{user.name}</h3>
                      <p class="user-location">{user.address?.city}</p>
                      <div class="user-stats">
                        <span><span aria-hidden="true">⭐</span> {user.rating.toFixed(1)}</span>
                        <span>•</span>
                        <span>{user.totalLends} lends</span>
                      </div>
                    </div>
                  </a>
                  <div class="user-actions">
                    {#if pendingRequest}
                      <button class="btn btn-sm btn-secondary" disabled>
                        Request Sent
                      </button>
                      <span class="request-sent-date">
                        {new Date(pendingRequest.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    {:else}
                      <button
                        class="btn btn-sm btn-primary"
                        onclick={() => sendFriendRequest(user.id)}
                      >
                        Send Friend Request
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if networkTab === 'neighbors'}
          <div class="users-grid">
            {#if neighbors.length === 0}
              <div class="empty-state">
                <span class="empty-icon" aria-hidden="true">🏘️</span>
                <h3>No neighbors found</h3>
                <p>No other users in {currentUser?.address?.city} yet</p>
              </div>
            {:else}
              {#each neighbors as user}
                {@const pendingRequest = getFriendRequestStatus(user.id)}
                <div class="user-card card">
                  <a href="/profile/{user.id}" class="user-card-link">
                    <img src={user.profilePic} alt={user.name} class="user-avatar" />
                    <div class="user-info">
                      <h3 class="user-name">{user.name}</h3>
                      <p class="user-location">{user.address?.city}</p>
                      <div class="user-stats">
                        <span><span aria-hidden="true">⭐</span> {user.rating.toFixed(1)}</span>
                        <span>•</span>
                        <span>{user.totalLends} lends</span>
                      </div>
                    </div>
                  </a>
                  <div class="user-actions">
                    {#if pendingRequest}
                      <button class="btn btn-sm btn-secondary" disabled>
                        Request Sent
                      </button>
                      <span class="request-sent-date">
                        {new Date(pendingRequest.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    {:else}
                      <button
                        class="btn btn-sm btn-primary"
                        onclick={() => sendFriendRequest(user.id)}
                      >
                        Send Friend Request
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if networkTab === 'friend-requests'}
          <div class="friend-requests-section">
            <div class="request-subsection">
              <h2 class="subsection-title">
                <span aria-hidden="true">📥</span>
                <span>Incoming Requests</span>
                {#if $incomingFriendRequests.length > 0}
                  <span class="subsection-badge">{$incomingFriendRequests.length}</span>
                {/if}
              </h2>
              <div class="requests-list">
                {#if $incomingFriendRequests.length === 0}
                  <div class="empty-state">
                    <span class="empty-icon" aria-hidden="true">📬</span>
                    <h3>No incoming requests</h3>
                    <p>Friend requests from others will appear here</p>
                  </div>
                {:else}
                  {#each $incomingFriendRequests as request}
                    {@const fromUser = $appStore.users.find((u) => u.id === request.fromUserId)}
                    <div class="request-card card">
                      <div class="request-content">
                        <a href="/profile/{fromUser?.id}" class="request-item-link">
                          <img src={fromUser?.profilePic} alt={fromUser?.name} class="friend-request-avatar-large" />
                        </a>
                        <div class="request-details">
                          <a href="/profile/{fromUser?.id}" class="request-title-link">
                            <h3 class="request-title">{fromUser?.name}</h3>
                          </a>
                          <p class="request-bio">{fromUser?.bio}</p>
                          <div class="request-meta">
                            <span><span aria-hidden="true">📍</span> {fromUser?.address?.city}</span>
                            <span>•</span>
                            <span><span aria-hidden="true">⭐</span> {fromUser?.rating.toFixed(1)}</span>
                            <span>•</span>
                            <span>{fromUser?.totalLends} lends</span>
                          </div>
                          {#if request.message}
                            <p class="request-message">"{request.message}"</p>
                          {/if}
                        </div>
                      </div>
                      <div class="request-actions">
                        <button class="btn btn-primary" onclick={() => acceptFriendRequest(request.id)}>
                          Accept
                        </button>
                        <button class="btn btn-secondary" onclick={() => openDeclineModal(request.id)}>
                          Decline
                        </button>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>

            <div class="request-subsection">
              <h2 class="subsection-title">
                <span aria-hidden="true">📤</span>
                <span>Outgoing Requests</span>
                {#if outgoingFriendRequests.length > 0}
                  <span class="subsection-badge">{outgoingFriendRequests.length}</span>
                {/if}
              </h2>
              <div class="requests-list">
                {#if outgoingFriendRequests.length === 0}
                  <div class="empty-state">
                    <span class="empty-icon" aria-hidden="true">📮</span>
                    <h3>No outgoing requests</h3>
                    <p>Friend requests you've sent will appear here</p>
                  </div>
                {:else}
                  {#each outgoingFriendRequests as request}
                    {@const toUser = $appStore.users.find((u) => u.id === request.toUserId)}
                    <div class="request-card card">
                      <div class="request-content">
                        <a href="/profile/{toUser?.id}" class="request-item-link">
                          <img src={toUser?.profilePic} alt={toUser?.name} class="friend-request-avatar-large" />
                        </a>
                        <div class="request-details">
                          <a href="/profile/{toUser?.id}" class="request-title-link">
                            <h3 class="request-title">{toUser?.name}</h3>
                          </a>
                          <p class="request-bio">{toUser?.bio}</p>
                          <div class="request-meta">
                            <span><span aria-hidden="true">📍</span> {toUser?.address?.city}</span>
                            <span>•</span>
                            <span><span aria-hidden="true">⭐</span> {toUser?.rating.toFixed(1)}</span>
                            <span>•</span>
                            <span>{toUser?.totalLends} lends</span>
                          </div>
                          <div class="request-sent-info">
                            <span class="badge badge-warning">⏳ Pending</span>
                            <span class="request-sent-date">
                              Sent {new Date(request.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

{#if showDeclineModal}
  <!-- svelte-ignore a11y_click_events_have_key_events - Modal overlay has onkeydown handler for Escape key -->
  <div class="modal-overlay" onclick={cancelDecline} onkeydown={handleModalKeydown} role="presentation">
    <div class="modal-content" bind:this={declineModalElement} onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="decline-modal-title" tabindex="-1">
      <h2 id="decline-modal-title">Decline Friend Request</h2>
      <p class="modal-description">Would you like to include a message? (optional)</p>
      <div class="form-group">
        <textarea
          bind:value={declineMessage}
          placeholder="Let them know why you're declining..."
          rows="4"
          class="decline-textarea"
        ></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={cancelDecline}>Cancel</button>
        <button class="btn btn-error" onclick={confirmDecline}>Decline Request</button>
      </div>
    </div>
  </div>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .page-header {
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

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

  .network-section {
    margin-top: 2rem;
  }

  .network-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--border);
    overflow-x: auto;
  }

  .network-tab {
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
    white-space: nowrap;
  }

  .network-tab:hover {
    color: var(--text-primary);
    background-color: var(--surface);
  }

  .network-tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .network-tab .tab-badge {
    background-color: var(--primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

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

  .user-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--primary);
    flex-shrink: 0;
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

  .request-sent-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin: 0;
  }

  /* Friend Requests Section */
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

  .requests-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .request-card {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
  }

  .request-content {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .request-item-link {
    display: block;
    flex-shrink: 0;
    transition: opacity var(--transition);
  }

  .request-item-link:hover {
    opacity: 0.8;
  }

  .friend-request-avatar-large {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: 50%;
    flex-shrink: 0;
    display: block;
    border: 3px solid var(--primary);
  }

  .request-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .request-title-link {
    text-decoration: none;
    color: inherit;
    transition: color var(--transition);
  }

  .request-title-link:hover {
    color: var(--primary);
  }

  .request-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .request-bio {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .request-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
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

  .request-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-content {
    background-color: var(--background);
    padding: 2rem;
    border-radius: var(--radius-lg);
    max-width: 500px;
    width: 90%;
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.2s ease-out;
  }

  .modal-content h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .modal-description {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .decline-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.9375rem;
    resize: vertical;
    transition: border-color var(--transition);
    background-color: var(--background);
    color: var(--text-primary);
  }

  .decline-textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .users-grid {
      grid-template-columns: 1fr;
    }

    .network-tab span:nth-child(2) {
      display: none;
    }

    .network-tab {
      padding: 1rem;
    }

    .request-card {
      flex-direction: column;
      align-items: stretch;
    }

    .request-content {
      flex-direction: column;
    }

    .request-actions {
      flex-direction: row;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .modal-actions {
      flex-direction: column;
    }
  }
</style>
