<script lang="ts">
  import { page } from '$app/stores';
  import { appStore, canUserViewItem, getCategoryPath } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import { useToast } from '$lib/useToast.svelte';
  import ItemBreadcrumbs from './ItemBreadcrumbs.svelte';
  import ItemImage from './ItemImage.svelte';
  import ItemHeader from './ItemHeader.svelte';
  import LenderCard from './LenderCard.svelte';
  import PermissionCard from './PermissionCard.svelte';
  import ItemDescription from './ItemDescription.svelte';
  import WishlistStatusCard from './WishlistStatusCard.svelte';
  import BorrowAction from './BorrowAction.svelte';
  import AvailabilityCalendar from './AvailabilityCalendar.svelte';
  import ReviewForm from './ReviewForm.svelte';
  import ReviewsList from './ReviewsList.svelte';

  let itemId = $derived($page.params.id);
  let item = $derived($appStore.items.find((i) => i.id === itemId));
  // The same permission check the browse grid uses — deep links must not
  // reveal items the current user isn't allowed to see.
  let canView = $derived(item ? canUserViewItem(item, $appStore.currentUserId, $appStore) : false);
  let lender = $derived($appStore.users.find((u) => u.id === item?.lenderId));
  let categoryPath = $derived(item ? getCategoryPath(item.categoryId, $appStore) : []);
  // Collections are derived from the tags themselves (tag.itemIds is the
  // source of truth; item.tagIds is not kept in sync by tag actions).
  let itemTags = $derived(item ? $appStore.tags.filter((t) => t.itemIds.includes(item.id)) : []);

  // The dates being requested. Picked on the calendar (sidebar), shown and
  // sent by the request form (main column), so they live here.
  let startDate = $state('');
  let endDate = $state('');
  let showRequestForm = $state(false);

  const toaster = useToast();
</script>

{#if !item}
  <div class="container">
    <div class="error-state">
      <h2>Item not found</h2>
      <p>The item you're looking for doesn't exist or has been removed.</p>
      <a href="/" class="btn btn-primary">Back to Browse</a>
    </div>
  </div>
{:else if !canView}
  <div class="container">
    <div class="error-state">
      <h2>This item isn't shared with you</h2>
      <p>The owner has limited who can see this item. Growing your network might open it up!</p>
      <a href="/" class="btn btn-primary">Back to Browse</a>
    </div>
  </div>
{:else}
  <div class="item-detail-page fade-in">
    <div class="container">
      <ItemBreadcrumbs {categoryPath} />

      <div class="item-detail-grid">
        <div class="item-main">
          <ItemImage imageUrl={item.imageUrl} name={item.name} available={item.available} />

          <div class="item-info">
            <ItemHeader {item} isOwner={item.lenderId === $appStore.currentUserId} onToast={toaster.showToast} />
            <LenderCard {lender} />
            <PermissionCard {item} {lender} />
            <ItemDescription description={item.description} tags={itemTags} />
            <WishlistStatusCard {item} onToast={toaster.showToast} />
            <BorrowAction
              {item}
              {lender}
              bind:startDate
              bind:endDate
              bind:showRequestForm
              onToast={toaster.showToast}
            />
          </div>
        </div>

        <div class="item-sidebar">
          <AvailabilityCalendar {item} bind:startDate bind:endDate bind:showRequestForm />
          <ReviewForm {item} onToast={toaster.showToast} />
          <ReviewsList itemId={item.id} />
        </div>
      </div>
    </div>
  </div>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .item-detail-grid {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 2rem;
  }

  .item-info {
    margin-top: 2rem;
  }

  @media (max-width: 768px) {
    .item-detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
