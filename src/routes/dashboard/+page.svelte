<script lang="ts">
  import {
    appStore,
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
  import Toast from '$lib/components/Toast.svelte';
  import RatingScore from '$lib/components/RatingScore.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import UserChip from '$lib/components/UserChip.svelte';
  import StarRatingInput from '$lib/components/StarRatingInput.svelte';
  import LoanCard from '$lib/components/LoanCard.svelte';
  import RequestThread from '$lib/components/RequestThread.svelte';
  import { MAX_RATING, MIN_RATING, DEFAULT_RATING } from '$lib/constants';
  import { formatDisplayDate } from '$lib/dates';
  import { useToast } from '$lib/useToast.svelte';
  import type { ItemCondition } from '$lib/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Tabs from '$lib/components/Tabs.svelte';

  const TABS = ['incoming', 'outgoing', 'lending', 'borrowing'] as const;
  type Tab = (typeof TABS)[number];

  // Notifications can deep-link to a tab, e.g. /dashboard?tab=borrowing
  function tabFromUrl(url: URL): Tab | null {
    const tab = url.searchParams.get('tab');
    return TABS.find((t) => t === tab) ?? null;
  }

  let activeTab = $state<Tab>('incoming');
  const toaster = useToast();

  $effect(() => {
    const tab = tabFromUrl($page.url);
    if (tab) activeTab = tab;
  });

  /** "1 item you lent is overdue" / "2 items you borrowed are overdue" */
  function overdueSummary(count: number, side: 'lent' | 'borrowed'): string {
    return count === 1
      ? `1 item you ${side} is overdue`
      : `${count} items you ${side} are overdue`;
  }

  let lendingCount = $derived($approvedLoans.length + $activeLoans.length);
  // Approved-then-active ordering keeps "pick up soon" above "on loan".
  let lendingLoans = $derived(sortOverdueFirst([...$approvedLoans, ...$activeLoans]));
  let borrowingLoans = $derived(
    sortOverdueFirst(
      [...$borrowedByMe].sort((a, b) => (a.status === b.status ? 0 : a.status === 'approved' ? -1 : 1))
    )
  );

  // Return modal state (lender side: rates the borrower, records condition)
  let showReturnModal = $state(false);
  let selectedLoanId = $state<string | null>(null);
  let returnRating = $state(DEFAULT_RATING);
  let returnReview = $state('');
  let conditionChanged = $state(false);
  let newCondition = $state<ItemCondition>('good');

  // Get the current item for the selected loan
  let selectedLoanItem = $derived.by(() => {
    if (!selectedLoanId) return null;
    const loan = $activeLoans.find(l => l.id === selectedLoanId);
    if (!loan) return null;
    return $appStore.items.find(i => i.id === loan.itemId);
  });

  let selectedLoanBorrower = $derived.by(() => {
    if (!selectedLoanId) return null;
    const loan = $activeLoans.find(l => l.id === selectedLoanId);
    if (!loan) return null;
    return $appStore.users.find(u => u.id === loan.borrowerId);
  });

  const conditionLabels: Record<ItemCondition, { label: string; description: string }> = {
    excellent: { label: 'Excellent', description: 'Like new, no visible wear' },
    good: { label: 'Good', description: 'Minor wear, fully functional' },
    fair: { label: 'Fair', description: 'Noticeable wear, works well' },
    poor: { label: 'Poor', description: 'Significant wear, still usable' }
  };

  function approveRequest(requestId: string) {
    const result = appStore.approveRequest(requestId);
    if (result.ok) {
      toaster.showToast('Request approved! The item is now reserved.', 'success');
    } else {
      toaster.showToast(result.error, 'error');
    }
  }

  function denyRequest(requestId: string) {
    const result = appStore.denyRequest(requestId);
    if (result.ok) {
      toaster.showToast('Request declined', 'info');
    } else {
      toaster.showToast(result.error, 'error');
    }
  }

  function cancelRequest(requestId: string) {
    const result = appStore.cancelRequest(requestId);
    if (result.ok) {
      toaster.showToast('Request cancelled', 'info');
    } else {
      toaster.showToast(result.error, 'error');
    }
  }

  function sendReminder(requestId: string) {
    const result = appStore.sendReturnReminder(requestId);
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }
    const loan = $appStore.borrowRequests.find((r) => r.id === requestId);
    const borrower = $appStore.users.find((u) => u.id === loan?.borrowerId);
    toaster.showToast(`Reminder sent to ${borrower?.name ?? 'the borrower'}`, 'success');
  }

  // Which request threads are expanded, so the incoming card can drop its
  // quote of the opening message while the thread shows it.
  let openThreads = $state<Record<string, boolean>>({});

  function sendMessage(requestId: string, text: string): boolean {
    const result = appStore.sendRequestMessage(requestId, text);
    if (!result.ok) toaster.showToast(result.error, 'error');
    return result.ok;
  }

  function confirmPickup(requestId: string) {
    const before = $appStore.borrowRequests.find((r) => r.id === requestId);
    const result = appStore.confirmPickup(requestId);
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }
    const after = $appStore.borrowRequests.find((r) => r.id === requestId);
    if (after?.status === 'active') {
      toaster.showToast('Both sides confirmed — the loan is now active', 'success');
    } else {
      const other = $appStore.users.find(
        (u) => u.id === (before?.borrowerId === $appStore.currentUserId ? before?.lenderId : before?.borrowerId)
      );
      toaster.showToast(`Pickup confirmed — waiting for ${other?.name ?? 'the other party'}`, 'success');
    }
  }

  /** Borrower side: no rating to give, confirm directly. */
  function confirmReturnAsBorrower(requestId: string) {
    const result = appStore.confirmReturn(requestId);
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }
    const after = $appStore.borrowRequests.find((r) => r.id === requestId);
    if (after?.status === 'completed') {
      toaster.showToast('Returned! Check your notifications to leave a review.', 'success');
    } else {
      toaster.showToast('Return confirmed — waiting for the lender to confirm too', 'success');
    }
  }

  /** Lender side: open the modal to rate the borrower and note the condition. */
  function openReturnModal(requestId: string) {
    selectedLoanId = requestId;
    returnRating = DEFAULT_RATING;
    returnReview = '';
    conditionChanged = false;
    const loan = $activeLoans.find(l => l.id === requestId);
    if (loan) {
      const item = $appStore.items.find(i => i.id === loan.itemId);
      if (item) {
        newCondition = item.condition;
      }
    }
    showReturnModal = true;
  }

  function submitReturn() {
    if (!selectedLoanId) return;

    // Validate rating is within valid range
    if (returnRating < MIN_RATING || returnRating > MAX_RATING) {
      toaster.showToast(`Rating must be between ${MIN_RATING} and ${MAX_RATING}`, 'error');
      return;
    }

    const requestId = selectedLoanId;
    const result = appStore.confirmReturn(requestId, {
      rating: returnRating,
      review: returnReview,
      // Pass condition only if it was changed
      condition: conditionChanged ? newCondition : undefined
    });
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }

    const after = $appStore.borrowRequests.find((r) => r.id === requestId);
    const conditionNote = conditionChanged
      ? ` Condition updated to ${conditionLabels[newCondition].label}.`
      : '';
    if (after?.status === 'completed') {
      toaster.showToast(`Return complete!${conditionNote}`, 'success');
    } else {
      toaster.showToast(`Return confirmed — waiting for the borrower to confirm too.${conditionNote}`, 'success');
    }

    cancelReturn();
  }

  function cancelReturn() {
    showReturnModal = false;
    selectedLoanId = null;
    returnRating = DEFAULT_RATING;
    returnReview = '';
    conditionChanged = false;
  }
</script>

<div class="dashboard-page fade-in">
  <div class="container">
    <PageHeader title="Dashboard" subtitle="Manage what you're lending and borrowing" />

    {#if $overdueLentLoans.length > 0 || $overdueBorrowedLoans.length > 0}
      <div class="overdue-banner" role="status">
        <span class="overdue-banner-icon" aria-hidden="true">⏰</span>
        <div class="overdue-banner-links">
          {#if $overdueLentLoans.length > 0}
            <button class="overdue-banner-link" onclick={() => (activeTab = 'lending')}>
              {overdueSummary($overdueLentLoans.length, 'lent')}
            </button>
          {/if}
          {#if $overdueBorrowedLoans.length > 0}
            <button class="overdue-banner-link" onclick={() => (activeTab = 'borrowing')}>
              {overdueSummary($overdueBorrowedLoans.length, 'borrowed')}
            </button>
          {/if}
        </div>
      </div>
    {/if}

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
        <div class="requests-list" id="incoming-panel" role="tabpanel" aria-labelledby="incoming-tab">
          {#if $incomingRequests.length === 0}
            <EmptyState icon="📬" title="No incoming requests" description="When people request to borrow your items, they'll appear here" />
          {:else}
            {#each $incomingRequests as request (request.id)}
              {@const item = $appStore.items.find((i) => i.id === request.itemId)}
              {@const borrower = $appStore.users.find((u) => u.id === request.borrowerId)}
              <div class="request-card card">
                <div class="request-content">
                  <a href="/items/{item?.id}" class="request-item-link">
                    <img src={item?.imageUrl} alt={item?.name} class="request-item-image" />
                  </a>
                  <div class="request-details">
                    <a href="/items/{item?.id}" class="request-title-link">
                      <h3 class="request-title">{item?.name}</h3>
                    </a>
                    <div class="request-meta">
                      <UserChip userId={borrower?.id} name={borrower?.name ?? ''} src={borrower?.profilePic} />
                      <span class="rating"><RatingScore value={borrower?.rating} /></span>
                    </div>
                    <div class="request-dates">
                      <span aria-hidden="true">📅</span>
                      <span
                        >{formatDisplayDate(request.startDate)} - {formatDisplayDate(request.endDate)}</span
                      >
                    </div>
                    {#if request.message && !openThreads[request.id]}
                      <p class="request-message">"{request.message}"</p>
                    {/if}
                    <RequestThread {request} onSend={sendMessage} bind:open={
                        () => openThreads[request.id] ?? false,
                        (open) => (openThreads[request.id] = open)
                      } />
                  </div>
                </div>
                <div class="request-actions">
                  <button class="btn btn-primary" onclick={() => approveRequest(request.id)}>
                    ✓ Approve
                  </button>
                  <button class="btn btn-secondary" onclick={() => denyRequest(request.id)}>
                    ✗ Deny
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {:else if activeTab === 'outgoing'}
        <div class="requests-list" id="outgoing-panel" role="tabpanel" aria-labelledby="outgoing-tab">
          {#if $outgoingRequests.length === 0}
            <EmptyState icon="📦" title="No outgoing requests" description="Requests you make to borrow items will appear here" />
          {:else}
            {#each $outgoingRequests as request (request.id)}
              {@const item = $appStore.items.find((i) => i.id === request.itemId)}
              {@const lender = $appStore.users.find((u) => u.id === request.lenderId)}
              <div class="request-card card">
                <div class="request-content">
                  <a href="/items/{item?.id}" class="request-item-link">
                    <img src={item?.imageUrl} alt={item?.name} class="request-item-image" />
                  </a>
                  <div class="request-details">
                    <a href="/items/{item?.id}" class="request-title-link">
                      <h3 class="request-title">{item?.name ?? 'Removed item'}</h3>
                    </a>
                    <div class="request-meta">
                      <span>Requested from</span>
                      <UserChip userId={lender?.id} name={lender?.name ?? ''} src={lender?.profilePic} />
                    </div>
                    <div class="request-dates">
                      <span aria-hidden="true">📅</span>
                      <span
                        >{formatDisplayDate(request.startDate)} - {formatDisplayDate(request.endDate)}</span
                      >
                    </div>
                    <div class="status-badge-inline">
                      {#if request.status === 'pending'}
                        <span class="badge badge-warning">⏳ Pending</span>
                      {:else if request.status === 'approved'}
                        <span class="badge badge-success">✓ Approved — awaiting pickup</span>
                      {:else if request.status === 'active'}
                        <span class="badge badge-success">🔄 Borrowing now</span>
                      {:else if request.status === 'completed'}
                        <span class="badge badge-primary">✓ Returned</span>
                      {:else if request.status === 'cancelled'}
                        <span class="badge badge-error">Cancelled</span>
                      {:else if request.status === 'denied'}
                        <span class="badge badge-error">✗ Declined</span>
                      {/if}
                    </div>
                    <RequestThread {request} onSend={sendMessage} />
                  </div>
                </div>
                {#if request.status === 'pending'}
                  <div class="request-actions">
                    <button class="btn btn-secondary" onclick={() => cancelRequest(request.id)}>
                      Cancel Request
                    </button>
                  </div>
                {:else if request.status === 'approved' || request.status === 'active'}
                  <div class="request-actions">
                    <button class="btn btn-secondary" onclick={() => (activeTab = 'borrowing')}>
                      Manage in Borrowing
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {:else if activeTab === 'lending'}
        <div class="requests-list" id="lending-panel" role="tabpanel" aria-labelledby="lending-tab">
          {#if lendingLoans.length === 0}
            <EmptyState icon="📋" title="Nothing lent out right now" description="Items you've approved for borrowing will appear here" />
          {:else}
            <p class="panel-hint">
              Pickups and returns need a confirmation from both of you, so the app reflects who
              actually has the item.
            </p>
            {#each lendingLoans as loan (loan.id)}
              <LoanCard
                request={loan}
                perspective="lender"
                onConfirmPickup={confirmPickup}
                onConfirmReturn={openReturnModal}
                onCancel={cancelRequest}
                onSendReminder={sendReminder}
                onSendMessage={sendMessage}
              />
            {/each}
          {/if}
        </div>
      {:else if activeTab === 'borrowing'}
        <div class="requests-list" id="borrowing-panel" role="tabpanel" aria-labelledby="borrowing-tab">
          {#if borrowingLoans.length === 0}
            <EmptyState icon="🎒" title="You're not borrowing anything" description="Approved requests and items you're holding will appear here" />
          {:else}
            <p class="panel-hint">
              Confirm when you pick an item up and again when you hand it back — the lender
              confirms on their side too.
            </p>
            {#each borrowingLoans as loan (loan.id)}
              <LoanCard
                request={loan}
                perspective="borrower"
                onConfirmPickup={confirmPickup}
                onConfirmReturn={confirmReturnAsBorrower}
                onCancel={cancelRequest}
                onSendMessage={sendMessage}
              />
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showReturnModal}
  <Modal title="Confirm Return" size="form" onClose={cancelReturn}>
    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control - Label is associated with radiogroup via aria-labelledby -->
      <label id="rating-label">How was lending to {selectedLoanBorrower?.name ?? 'this borrower'}?</label>
      <p class="modal-hint">This rates the borrower, not the item — they'll be asked to review the item separately.</p>
      <StarRatingInput bind:value={returnRating} labelledby="rating-label" size="lg" />
    </div>

    <div class="form-group">
      <label for="review">Note (optional)</label>
      <textarea
        id="review"
        bind:value={returnReview}
        placeholder="Returned on time? Good communication?"
        rows="3"
      ></textarea>
    </div>

    <!-- Condition tracking section -->
    <div class="form-group condition-section">
      <div class="condition-header">
        <span class="condition-title">Item Condition</span>
        {#if selectedLoanItem}
          <span class="current-condition">
            Current: <strong>{conditionLabels[selectedLoanItem.condition].label}</strong>
          </span>
        {/if}
      </div>

      <div class="condition-toggle">
        <label class="toggle-label">
          <input
            type="checkbox"
            bind:checked={conditionChanged}
            class="toggle-checkbox"
          />
          <span class="toggle-text">Condition has changed</span>
        </label>
      </div>

      {#if conditionChanged}
        <div class="condition-options" role="radiogroup" aria-label="Select new condition">
          {#each (['excellent', 'good', 'fair', 'poor'] as const) as condition}
            <label
              class="condition-option"
              class:selected={newCondition === condition}
              class:downgrade={selectedLoanItem && condition !== selectedLoanItem.condition &&
                ['excellent', 'good', 'fair', 'poor'].indexOf(condition) >
                ['excellent', 'good', 'fair', 'poor'].indexOf(selectedLoanItem.condition)}
            >
              <input
                type="radio"
                name="condition"
                value={condition}
                bind:group={newCondition}
                class="sr-only"
              />
              <span class="condition-label">{conditionLabels[condition].label}</span>
              <span class="condition-description">{conditionLabels[condition].description}</span>
            </label>
          {/each}
        </div>
        {#if selectedLoanItem && newCondition !== selectedLoanItem.condition}
          <p class="condition-note">
            {#if ['excellent', 'good', 'fair', 'poor'].indexOf(newCondition) > ['excellent', 'good', 'fair', 'poor'].indexOf(selectedLoanItem.condition)}
              <span class="note-warning">⚠️ This will downgrade the item's condition from {conditionLabels[selectedLoanItem.condition].label} to {conditionLabels[newCondition].label}</span>
            {:else}
              <span class="note-upgrade">✨ This will upgrade the item's condition to {conditionLabels[newCondition].label}</span>
            {/if}
          </p>
        {/if}
      {/if}
    </div>
    {#snippet actions()}
      <button class="btn btn-secondary" onclick={cancelReturn}>Cancel</button>
      <button class="btn btn-primary" onclick={submitReturn}>Confirm Return</button>
    {/snippet}
  </Modal>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .overdue-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    border: 1px solid var(--error);
    border-left-width: 4px;
    border-radius: var(--radius);
    background-color: rgba(239, 68, 68, 0.08);
  }

  .overdue-banner-icon {
    font-size: 1.25rem;
  }

  .overdue-banner-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
  }

  .overdue-banner-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--error);
    text-decoration: underline;
    cursor: pointer;
  }

  .overdue-banner-link:hover {
    text-decoration: none;
  }

  .panel-hint {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .modal-hint {
    margin: 0 0 0.5rem 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .request-content {
    display: flex;
    gap: 1.5rem;
    flex: 1;
    min-width: 0;
  }

  .request-item-image {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: var(--radius);
    flex-shrink: 0;
    display: block;
  }

  .request-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .request-dates {
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
    overflow-wrap: anywhere;
  }

  .request-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .status-badge-inline {
    margin-top: 0.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.9375rem;
    resize: vertical;
    transition: border-color var(--transition);
  }

  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  @media (max-width: 768px) {
    .request-content {
      flex-direction: column;
    }

    .request-item-image {
      width: 100%;
      height: 200px;
    }

    .request-actions {
      flex-direction: row;
    }

  }

  /* Condition tracking styles */
  .condition-section {
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
    margin-top: 1.5rem;
  }

  .condition-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .condition-title {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .current-condition {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .condition-toggle {
    margin-bottom: 1rem;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-weight: normal;
  }

  .toggle-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--primary);
    cursor: pointer;
  }

  .toggle-text {
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .condition-options {
    display: grid;
    gap: 0.5rem;
  }

  .condition-option {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.875rem 1rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
    font-weight: normal;
    margin-bottom: 0;
  }

  .condition-option:hover {
    border-color: var(--primary);
    background-color: rgba(16, 185, 129, 0.05);
  }

  .condition-option.selected {
    border-color: var(--primary);
    background-color: rgba(16, 185, 129, 0.1);
  }

  .condition-option.downgrade {
    border-color: var(--warning);
  }

  .condition-option.downgrade.selected {
    background-color: rgba(245, 158, 11, 0.1);
  }

  .condition-label {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .condition-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .condition-note {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
  }

  .note-warning {
    color: var(--warning);
    background-color: rgba(245, 158, 11, 0.1);
    display: block;
    padding: 0.75rem;
    border-radius: var(--radius);
  }

  .note-upgrade {
    color: var(--success);
    background-color: rgba(16, 185, 129, 0.1);
    display: block;
    padding: 0.75rem;
    border-radius: var(--radius);
  }
</style>
