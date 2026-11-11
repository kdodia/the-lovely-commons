<script lang="ts">
  import type { BorrowRequest } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import LoanCard from '$lib/components/LoanCard.svelte';

  /**
   * The Lending tab (perspective="lender": items I've lent out) or the
   * Borrowing tab (perspective="borrower": items I'm holding or about to
   * pick up). The tab's wording is in COPY below.
   */
  interface Props {
    loans: BorrowRequest[];
    perspective: 'lender' | 'borrower';
    onConfirmPickup: (requestId: string) => void;
    onConfirmReturn: (requestId: string) => void;
    onCancel: (requestId: string) => void;
    /** Lender only. */
    onSendReminder?: (requestId: string) => void;
    onSendMessage: (requestId: string, text: string) => boolean;
  }

  let {
    loans,
    perspective,
    onConfirmPickup,
    onConfirmReturn,
    onCancel,
    onSendReminder,
    onSendMessage
  }: Props = $props();

  const COPY = {
    lender: {
      panel: 'lending',
      emptyIcon: '📋',
      emptyTitle: 'Nothing lent out right now',
      emptyDescription: "Items you've approved for borrowing will appear here",
      hint: 'Pickups and returns need a confirmation from both of you, so the app reflects who actually has the item.'
    },
    borrower: {
      panel: 'borrowing',
      emptyIcon: '🎒',
      emptyTitle: "You're not borrowing anything",
      emptyDescription: "Approved requests and items you're holding will appear here",
      hint: 'Confirm when you pick an item up and again when you hand it back — the lender confirms on their side too.'
    }
  } as const;

  let copy = $derived(COPY[perspective]);
</script>

<div class="requests-list" id="{copy.panel}-panel" role="tabpanel" aria-labelledby="{copy.panel}-tab">
  {#if loans.length === 0}
    <EmptyState icon={copy.emptyIcon} title={copy.emptyTitle} description={copy.emptyDescription} />
  {:else}
    <p class="panel-hint">{copy.hint}</p>
    {#each loans as loan (loan.id)}
      <LoanCard
        request={loan}
        {perspective}
        {onConfirmPickup}
        {onConfirmReturn}
        {onCancel}
        {onSendReminder}
        {onSendMessage}
      />
    {/each}
  {/if}
</div>

<style>
  .panel-hint {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
