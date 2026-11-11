<script lang="ts">
  import { page } from '$app/stores';
  import { appStore } from '$lib/store';
  import { goto } from '$app/navigation';
  import Toast from '$lib/components/Toast.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import ItemForm, { type ItemFormValues } from '$lib/components/ItemForm.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { useToast } from '$lib/useToast.svelte';
  import BlockedDatesSection from './BlockedDatesSection.svelte';

  let itemId = $derived($page.params.id);
  let item = $derived($appStore.items.find((i) => i.id === itemId));

  // Redirect if not the owner
  $effect(() => {
    if (item && item.lenderId !== $appStore.currentUserId) {
      goto('/');
    }
  });

  const toaster = useToast();

  // Blocked dates are saved with the form but edited in their own section.
  // Reload them when a different item is loaded. Keying on the item id (rather
  // than the item object) means a background state update — e.g. cross-tab
  // sync — won't clobber unsaved edits mid-form.
  let blockedDates = $state<Array<{ startDate: string; endDate: string; reason?: string }>>([]);
  let syncedItemId = $state<string | null>(null);
  $effect(() => {
    if (!item || item.id === syncedItemId) return;
    syncedItemId = item.id;
    blockedDates = item.blockedDates || [];
  });

  function handleSubmit(values: ItemFormValues) {
    if (!item) return;

    appStore.updateItem(item.id, {
      ...values,
      blockedDates: blockedDates.length > 0 ? blockedDates : undefined
    });

    toaster.showToast('Item updated successfully!', 'success');
    setTimeout(() => {
      goto(`/items/${item.id}`);
    }, 1000);
  }

  // Delete confirmation modal
  let showDeleteConfirm = $state(false);
  let onLoan = $derived(
    !!item &&
      $appStore.borrowRequests.some(
        (r) => r.itemId === item.id && (r.status === 'approved' || r.status === 'active')
      )
  );
  let pendingRequestCount = $derived(
    item ? $appStore.borrowRequests.filter((r) => r.itemId === item.id && r.status === 'pending').length : 0
  );

  function confirmDelete() {
    if (!item) return;
    const result = appStore.deleteItem(item.id);
    showDeleteConfirm = false;
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }
    toaster.showToast('Item deleted', 'success');
    setTimeout(() => goto('/my-items'), 600);
  }
</script>

{#if !item}
  <div class="container">
    <div class="error-state">
      <h2>Item not found</h2>
      <p>The item you're looking for doesn't exist or has been removed.</p>
      <a href="/" class="btn btn-primary">Back to Browse</a>
    </div>
  </div>
{:else if item.lenderId !== $appStore.currentUserId}
  <div class="container">
    <div class="loading">Redirecting...</div>
  </div>
{:else}
  <div class="edit-item-page fade-in">
    <div class="container">
      <PageHeader title="Edit Item" subtitle="Update your item details and availability" />

      <!-- Keyed on the id so loading a different item starts the form afresh -->
      {#key item.id}
        <ItemForm
          initial={{
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            categoryId: item.categoryId,
            condition: item.condition,
            permissionLevel: item.permissionLevel,
            allowedUserIds: item.allowedUserIds
          }}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
          onInvalid={() => toaster.showToast('Please fill in all required fields', 'error')}
          onCancel={() => goto(`/items/${itemId}`)}
        >
          {#snippet extraSections()}
            <BlockedDatesSection bind:blockedDates onToast={toaster.showToast} />
          {/snippet}
        </ItemForm>
      {/key}

      <section class="danger-zone card" aria-labelledby="danger-title">
        <div>
          <h3 id="danger-title">Remove from library</h3>
          {#if onLoan}
            <p>This item is reserved or on loan. You can delete it once it has been returned.</p>
          {:else if pendingRequestCount > 0}
            <p>
              Deleting will close {pendingRequestCount} pending
              {pendingRequestCount === 1 ? 'request' : 'requests'} and remove the item from
              collections and wishlists.
            </p>
          {:else}
            <p>Deleting removes the item from your library, collections, and any wishlists.</p>
          {/if}
        </div>
        <button
          type="button"
          class="btn btn-error"
          disabled={onLoan}
          onclick={() => (showDeleteConfirm = true)}
        >
          Delete Item
        </button>
      </section>
    </div>
  </div>
{/if}

{#if showDeleteConfirm && item}
  <Modal title="Delete {item.name}?" size="sm" onClose={() => (showDeleteConfirm = false)}>
    <p>This can't be undone. Past borrow history is kept, but the item disappears from your library, collections, and wishlists.</p>
    {#snippet actions()}
      <button class="btn btn-error" onclick={confirmDelete}>Delete Item</button>
      <button class="btn btn-secondary" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
    {/snippet}
  </Modal>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .danger-zone {
    max-width: 800px;
    margin-top: 2rem;
    padding: 1.5rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  .danger-zone h3 {
    margin: 0 0 0.375rem 0;
    font-size: 1.125rem;
  }

  .danger-zone p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .danger-zone {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
