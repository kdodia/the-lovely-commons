<script lang="ts">
  import { appStore } from '$lib/store';
  import type { Item, User } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';
  import RequestStatus from './RequestStatus.svelte';
  import RequestForm from './RequestForm.svelte';

  /**
   * The call-to-action under the item details, for a viewer who may see the
   * item: their pending request if they already have one, otherwise the
   * request form when they are allowed to borrow it, otherwise nothing.
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

  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));

  // Has the current user already requested this item?
  let existingRequest = $derived(
    $appStore.borrowRequests.find(
      (req) =>
        req.itemId === item.id &&
        req.borrowerId === $appStore.currentUserId &&
        req.status === 'pending'
    )
  );

  // The page has already checked the viewer may see the item.
  let canRequest = $derived(
    currentUser && item.lenderId !== $appStore.currentUserId && item.available && !existingRequest
  );
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
