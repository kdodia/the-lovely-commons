<script lang="ts">
  import {
    incomingRequests,
    outgoingRequests,
    approvedLoans,
    activeLoans,
    borrowedByMe,
    overdueLentLoans,
    overdueBorrowedLoans,
    sortOverdueFirst
  } from '$lib/store';
  import { page } from '$app/stores';
  import { useToast } from '$lib/useToast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { createLoanActions } from './loanActions';
  import OverdueBanner from './OverdueBanner.svelte';
  import IncomingRequestsTab from './IncomingRequestsTab.svelte';
  import OutgoingRequestsTab from './OutgoingRequestsTab.svelte';
  import LoansTab from './LoansTab.svelte';
  import ReturnModal from './ReturnModal.svelte';

  const TABS = ['incoming', 'outgoing', 'lending', 'borrowing'] as const;
  type Tab = (typeof TABS)[number];

  // Notifications can deep-link to a tab, e.g. /dashboard?tab=borrowing
  function tabFromUrl(url: URL): Tab | null {
    const tab = url.searchParams.get('tab');
    return TABS.find((t) => t === tab) ?? null;
  }

  let activeTab = $state<Tab>('incoming');
  const toaster = useToast();
  const actions = createLoanActions(toaster.showToast);

  $effect(() => {
    const tab = tabFromUrl($page.url);
    if (tab) activeTab = tab;
  });

  let lendingCount = $derived($approvedLoans.length + $activeLoans.length);
  // Approved-then-active ordering keeps "pick up soon" above "on loan".
  let lendingLoans = $derived(sortOverdueFirst([...$approvedLoans, ...$activeLoans]));
  let borrowingLoans = $derived(
    sortOverdueFirst(
      [...$borrowedByMe].sort((a, b) => (a.status === b.status ? 0 : a.status === 'approved' ? -1 : 1))
    )
  );

  // Which incoming-request threads are expanded, so a card can drop its quote
  // of the opening message while the thread shows it.
  let openThreads = $state<Record<string, boolean>>({});

  // The loan the lender is confirming the return of (open return dialog), if any.
  let returningLoanId = $state<string | null>(null);
</script>

<div class="dashboard-page fade-in">
  <div class="container">
    <PageHeader title="Dashboard" subtitle="Manage what you're lending and borrowing" />

    <OverdueBanner
      lentCount={$overdueLentLoans.length}
      borrowedCount={$overdueBorrowedLoans.length}
      onShow={(tab) => (activeTab = tab)}
    />

    <Tabs
      variant="page"
      iconsOnly
      panels
      label="Dashboard sections"
      bind:value={activeTab}
      tabs={[
        { id: 'incoming', label: 'Incoming Requests', icon: '📥', count: $incomingRequests.length, countLabel: `${$incomingRequests.length} incoming requests` },
        { id: 'outgoing', label: 'My Requests', icon: '📤' },
        { id: 'lending', label: 'Lending', icon: '🤝', count: lendingCount, countLabel: `${lendingCount} items lent out` },
        { id: 'borrowing', label: 'Borrowing', icon: '🎒', count: borrowingLoans.length, countLabel: `${borrowingLoans.length} items borrowed` }
      ]}
    />

    <div class="tab-content">
      {#if activeTab === 'incoming'}
        <IncomingRequestsTab
          requests={$incomingRequests}
          bind:openThreads
          onApprove={actions.approve}
          onDeny={actions.deny}
          onSendMessage={actions.sendMessage}
        />
      {:else if activeTab === 'outgoing'}
        <OutgoingRequestsTab
          requests={$outgoingRequests}
          onCancel={actions.cancel}
          onManage={() => (activeTab = 'borrowing')}
          onSendMessage={actions.sendMessage}
        />
      {:else if activeTab === 'lending'}
        <LoansTab
          perspective="lender"
          loans={lendingLoans}
          onConfirmPickup={actions.confirmPickup}
          onConfirmReturn={(loanId) => (returningLoanId = loanId)}
          onCancel={actions.cancel}
          onSendReminder={actions.sendReminder}
          onSendMessage={actions.sendMessage}
        />
      {:else if activeTab === 'borrowing'}
        <LoansTab
          perspective="borrower"
          loans={borrowingLoans}
          onConfirmPickup={actions.confirmPickup}
          onConfirmReturn={actions.confirmReturnAsBorrower}
          onCancel={actions.cancel}
          onSendMessage={actions.sendMessage}
        />
      {/if}
    </div>
  </div>
</div>

{#if returningLoanId}
  <ReturnModal loanId={returningLoanId} notify={toaster.showToast} onClose={() => (returningLoanId = null)} />
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}
