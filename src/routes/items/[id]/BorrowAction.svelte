<script lang="ts">
  import { appStore, canRequestItem } from '$lib/store';
  import type { Item, User } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';
  import RequestStatus from './RequestStatus.svelte';
  import RequestForm from './RequestForm.svelte';

  /**
   * The call-to-action under the item details, for a viewer who may see the
   * item: their pending request if they already have one, otherwise the
   * request form when they may request it (`canRequestItem`), otherwise
   * nothing.
   */
  interface Props {
    item: Item;
    lender: User | undefined;
    startDate: string;
    endDate: string;
    showRequestForm: boolean;
    onToast: (message: string, type?: ToastType) => void;
  }

  let {
    item,
    lender,
    startDate = $bindable(),
    endDate = $bindable(),
    showRequestForm = $bindable(),
    onToast
  }: Props = $props();

  // Has the current user already requested this item?
  let existingRequest = $derived(
    $appStore.borrowRequests.find(
      (req) =>
        req.itemId === item.id &&
        req.borrowerId === $appStore.currentUserId &&
        req.status === 'pending'
    )
  );

  // The domain decides (the same rule createBorrowRequest enforces). Whether
  // the item is out today does not matter: the calendar shows which dates
  // are taken.
  let canRequest = $derived(canRequestItem($appStore, item.id, $appStore.currentUserId));
</script>

{#if existingRequest}
  <div class="action-section">
    <RequestStatus request={existingRequest} lenderName={lender?.name} {onToast} />
  </div>
{:else if canRequest}
  <div class="action-section">
    <RequestForm {item} bind:startDate bind:endDate bind:showRequestForm {onToast} />
  </div>
{/if}

<style>
  .action-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
  }
</style>
