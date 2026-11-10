<script lang="ts">
  import type { BorrowRequest } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import RequestCard from './RequestCard.svelte';

  interface Props {
    requests: BorrowRequest[];
    /**
     * Which request threads are expanded, by request id. Held by the page so
     * it survives switching tabs.
     */
    openThreads: Record<string, boolean>;
    onApprove: (requestId: string) => void;
    onDeny: (requestId: string) => void;
    onSendMessage: (requestId: string, text: string) => boolean;
  }

  let { requests, openThreads = $bindable(), onApprove, onDeny, onSendMessage }: Props = $props();
</script>

<div class="requests-list" id="incoming-panel" role="tabpanel" aria-labelledby="incoming-tab">
  {#if requests.length === 0}
    <EmptyState icon="📬" title="No incoming requests" description="When people request to borrow your items, they'll appear here" />
  {:else}
    {#each requests as request (request.id)}
      <RequestCard
        {request}
        perspective="lender"
        {onApprove}
        {onDeny}
        {onSendMessage}
        bind:threadOpen={
          () => openThreads[request.id] ?? false,
          (open) => (openThreads[request.id] = open)
        }
      />
    {/each}
  {/if}
</div>
