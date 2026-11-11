<script lang="ts">
  import { appStore, incomingFriendRequests } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import { useToast } from '$lib/useToast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import NetworkStats from './NetworkStats.svelte';
  import CloseFriendsTab from './CloseFriendsTab.svelte';
  import FriendsTab from './FriendsTab.svelte';
  import SuggestionsTab from './SuggestionsTab.svelte';
  import FriendRequestsTab from './FriendRequestsTab.svelte';
  import DeclineModal from './DeclineModal.svelte';

  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));
  const toaster = useToast();

  // Outgoing friend requests
  let outgoingFriendRequests = $derived(
    $appStore.friendRequests.filter(
      (req) => req.fromUserId === $appStore.currentUserId && req.status === 'pending'
    )
  );

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

  // The incoming request the decline dialog is open for, if any
  let decliningRequestId = $state<string | null>(null);

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

  function confirmDecline(message: string | undefined) {
    if (!decliningRequestId) return;
    appStore.declineFriendRequest(decliningRequestId, message);
    toaster.showToast('Friend request declined', 'info');
    decliningRequestId = null;
  }

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
</script>

<div class="network-page fade-in">
  <div class="container">
    <PageHeader title="My Network" subtitle="Manage your connections and sharing circles" />

    <NetworkStats
      closeFriends={closeFriends.length}
      friends={friends.length}
      friendsOfFriends={friendsOfFriends.length}
      neighbors={neighbors.length}
      city={currentUser?.address?.city}
    />

    <div class="network-section">
      <Tabs
        iconsOnly
        label="Network sections"
        bind:value={networkTab}
        tabs={[
          { id: 'close-friends', label: 'Close Friends', icon: '💚', count: closeFriends.length },
          { id: 'friends', label: 'Friends', icon: '👥', count: friends.length },
          { id: 'friends-of-friends', label: 'Friends of Friends', icon: '🔗', count: friendsOfFriends.length },
          { id: 'neighbors', label: 'Neighbors', icon: '🏘️', count: neighbors.length },
          { id: 'friend-requests', label: 'Friend Requests', icon: '📬', count: $incomingFriendRequests.length + outgoingFriendRequests.length }
        ]}
      />

      <div class="tab-content">
        {#if networkTab === 'close-friends'}
          <CloseFriendsTab users={closeFriends} currentUserId={currentUser?.id} onDemote={demoteFromCloseFriend} />
        {:else if networkTab === 'friends'}
          <FriendsTab users={friends} currentUserId={currentUser?.id} onPromote={promoteToCloseFriend} />
        {:else if networkTab === 'friends-of-friends'}
          <SuggestionsTab
            kind="friends-of-friends"
            users={friendsOfFriends}
            sentRequests={outgoingFriendRequests}
            onSendRequest={sendFriendRequest}
          />
        {:else if networkTab === 'neighbors'}
          <SuggestionsTab
            kind="neighbors"
            users={neighbors}
            sentRequests={outgoingFriendRequests}
            city={currentUser?.address?.city}
            onSendRequest={sendFriendRequest}
          />
        {:else if networkTab === 'friend-requests'}
          <FriendRequestsTab
            incoming={$incomingFriendRequests}
            outgoing={outgoingFriendRequests}
            users={$appStore.users}
            onAccept={acceptFriendRequest}
            onDecline={(requestId) => (decliningRequestId = requestId)}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

{#if decliningRequestId}
  <DeclineModal onCancel={() => (decliningRequestId = null)} onConfirm={confirmDecline} />
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .network-section {
    margin-top: 2rem;
  }
</style>
