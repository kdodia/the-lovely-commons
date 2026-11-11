<script lang="ts">
  import type { BorrowRequest } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import RequestCard from './RequestCard.svelte';

  interface Props {
    requests: BorrowRequest[];
    onCancel: (requestId: string) => void;
    /** "Manage in Borrowing" on approved and active requests. */
    onManage: () => void;
    onSendMessage: (requestId: string, text: string) => boolean;
  }

  let { requests, onCancel, onManage, onSendMessage }: Props = $props();
</script>

<div class="requests-list" id="outgoing-panel" role="tabpanel" aria-labelledby="outgoing-tab">
  {#if requests.length === 0}
    <EmptyState icon="📦" title="No outgoing requests" description="Requests you make to borrow items will appear here" />
  {:else}
    {#each requests as request (request.id)}
      <RequestCard {request} perspective="borrower" {onCancel} {onManage} {onSendMessage} />
    {/each}
  {/if}
</div>
