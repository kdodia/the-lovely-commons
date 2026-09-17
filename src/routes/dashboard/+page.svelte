<script lang="ts">
  import { appStore, incomingRequests, outgoingRequests, approvedLoans, activeLoans } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import { MAX_RATING, MIN_RATING, DEFAULT_RATING } from '$lib/constants';
  import { formatDisplayDate, todayLocalISO } from '$lib/dates';
  import { useToast } from '$lib/useToast.svelte';
  import type { ItemCondition } from '$lib/types';

  let activeTab = $state<'incoming' | 'outgoing' | 'active'>('incoming');
  const toaster = useToast();

  // Return modal state
  let showReturnModal = $state(false);
  let selectedLoanId = $state<string | null>(null);
  let returnRating = $state(DEFAULT_RATING);
  let returnReview = $state('');
  let hoveredStar = $state(0);
  let returnModalElement = $state<HTMLDivElement | undefined>();
  let conditionChanged = $state(false);
  let newCondition = $state<ItemCondition>('good');

  // Get the current item for the selected loan
  let selectedLoanItem = $derived.by(() => {
    if (!selectedLoanId) return null;
    const loan = $activeLoans.find(l => l.id === selectedLoanId);
    if (!loan) return null;
    return $appStore.items.find(i => i.id === loan.itemId);
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

  function markPickedUp(requestId: string) {
    const result = appStore.markPickedUp(requestId);
    if (result.ok) {
      toaster.showToast('Loan started — marked as picked up', 'success');
    } else {
      toaster.showToast(result.error, 'error');
    }
  }

  function markAsReturned(requestId: string) {
    selectedLoanId = requestId;
    returnRating = DEFAULT_RATING;
    returnReview = '';
    conditionChanged = false;
    // Initialize newCondition to current item condition
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

    // Pass condition only if it was changed
    const conditionToUpdate = conditionChanged ? newCondition : undefined;
    const result = appStore.completeBorrow(selectedLoanId, returnRating, returnReview, conditionToUpdate);
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }

    const message = conditionChanged
      ? `Item marked as returned! Condition updated to ${conditionLabels[newCondition].label}.`
      : 'Item marked as returned!';
    toaster.showToast(message, 'success');

    // Reset modal state
    showReturnModal = false;
    selectedLoanId = null;
    returnRating = DEFAULT_RATING;
    returnReview = '';
    conditionChanged = false;
  }

  function cancelReturn() {
    showReturnModal = false;
    selectedLoanId = null;
    returnRating = DEFAULT_RATING;
    returnReview = '';
    conditionChanged = false;
  }

  // Handle escape key for modal
  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cancelReturn();
    }
  }

  // Focus modal when it opens
  $effect(() => {
    if (showReturnModal && returnModalElement) {
      returnModalElement.focus();
    }
  });
</script>

<div class="dashboard-page fade-in">
  <div class="container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Manage your lending activity</p>
      </div>
    </header>

    <div class="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
      <button
        role="tab"
        class="tab"
        class:active={activeTab === 'incoming'}
        aria-selected={activeTab === 'incoming'}
        aria-controls="incoming-panel"
        id="incoming-tab"
        onclick={() => (activeTab = 'incoming')}
      >
        <span aria-hidden="true">📥</span>
        <span>Incoming Requests</span>
        {#if $incomingRequests.length > 0}
          <span class="tab-badge" aria-label="{$incomingRequests.length} incoming requests">{$incomingRequests.length}</span>
        {/if}
      </button>

      <button
        role="tab"
        class="tab"
        class:active={activeTab === 'outgoing'}
        aria-selected={activeTab === 'outgoing'}
        aria-controls="outgoing-panel"
        id="outgoing-tab"
        onclick={() => (activeTab = 'outgoing')}
      >
        <span aria-hidden="true">📤</span>
        <span>My Requests</span>
      </button>

      <button
        role="tab"
        class="tab"
        class:active={activeTab === 'active'}
        aria-selected={activeTab === 'active'}
        aria-controls="active-panel"
        id="active-tab"
        onclick={() => (activeTab = 'active')}
      >
        <span aria-hidden="true">🔄</span>
        <span>Active Loans</span>
        {#if $approvedLoans.length + $activeLoans.length > 0}
          <span class="tab-badge" aria-label="{$approvedLoans.length + $activeLoans.length} loans">{$approvedLoans.length + $activeLoans.length}</span>
        {/if}
      </button>
    </div>

    <div class="tab-content">
      {#if activeTab === 'incoming'}
        <div class="requests-list">
          {#if $incomingRequests.length === 0}
            <div class="empty-state">
              <span class="empty-icon" aria-hidden="true">📬</span>
              <h3>No incoming requests</h3>
              <p>When people request to borrow your items, they'll appear here</p>
            </div>
          {:else}
            {#each $incomingRequests as request}
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
                      <a href="/profile/{borrower?.id}" class="user-link">
                        <img
                          src={borrower?.profilePic}
                          alt={borrower?.name}
                          class="borrower-avatar"
                        />
                        <span class="borrower-name">{borrower?.name}</span>
                      </a>
                      <span class="rating"><span aria-hidden="true">⭐</span> {borrower?.rating.toFixed(1)}</span>
                    </div>
                    <div class="request-dates">
                      <span aria-hidden="true">📅</span>
                      <span
                        >{formatDisplayDate(request.startDate)} - {formatDisplayDate(request.endDate)}</span
                      >
                    </div>
                    {#if request.message}
                      <p class="request-message">"{request.message}"</p>
                    {/if}
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
        <div class="requests-list">
          {#if $outgoingRequests.length === 0}
            <div class="empty-state">
              <span class="empty-icon" aria-hidden="true">📦</span>
              <h3>No outgoing requests</h3>
              <p>Requests you make to borrow items will appear here</p>
            </div>
          {:else}
            {#each $outgoingRequests as request}
              {@const item = $appStore.items.find((i) => i.id === request.itemId)}
              {@const lender = $appStore.users.find((u) => u.id === request.lenderId)}
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
                      <span>Requested from</span>
                      <a href="/profile/{lender?.id}" class="user-link">
                        <img src={lender?.profilePic} alt={lender?.name} class="borrower-avatar" />
                        <span class="borrower-name">{lender?.name}</span>
                      </a>
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
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {:else if activeTab === 'active'}
        <div class="requests-list">
          {#if $approvedLoans.length === 0 && $activeLoans.length === 0}
            <div class="empty-state">
              <span class="empty-icon" aria-hidden="true">📋</span>
              <h3>No active loans</h3>
              <p>Items currently borrowed from you will appear here</p>
            </div>
          {:else}
            {#each $approvedLoans as loan}
              {@const item = $appStore.items.find((i) => i.id === loan.itemId)}
              {@const borrower = $appStore.users.find((u) => u.id === loan.borrowerId)}
              <div class="request-card card">
                <div class="request-content">
                  <a href="/items/{loan.itemId}" class="request-item-link">
                    <img src={item?.imageUrl} alt={item?.name} class="request-item-image" />
                  </a>
                  <div class="request-details">
                    <a href="/items/{loan.itemId}" class="request-title-link">
                      <h3 class="request-title">{item?.name}</h3>
                    </a>
                    <div class="request-meta">
                      <span>Reserved for</span>
                      <a href="/profile/{borrower?.id}" class="user-link">
                        <img
                          src={borrower?.profilePic}
                          alt={borrower?.name}
                          class="borrower-avatar"
                        />
                        <span class="borrower-name">{borrower?.name}</span>
                      </a>
                    </div>
                    <div class="request-dates">
                      <span aria-hidden="true">📅</span>
                      <span>{formatDisplayDate(loan.startDate)} - {formatDisplayDate(loan.endDate)}</span>
                    </div>
                    <div class="status-badge-inline">
                      <span class="badge badge-warning">⏳ Awaiting pickup</span>
                    </div>
                  </div>
                </div>
                <div class="request-actions">
                  <button class="btn btn-primary" onclick={() => markPickedUp(loan.id)}>
                    Mark as Picked Up
                  </button>
                </div>
              </div>
            {/each}
            {#each $activeLoans as loan}
              {@const item = $appStore.items.find((i) => i.id === loan.itemId)}
              {@const borrower = $appStore.users.find((u) => u.id === loan.borrowerId)}
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
                      <span>Borrowed by</span>
                      <a href="/profile/{borrower?.id}" class="user-link">
                        <img
                          src={borrower?.profilePic}
                          alt={borrower?.name}
                          class="borrower-avatar"
                        />
                        <span class="borrower-name">{borrower?.name}</span>
                      </a>
                    </div>
                    <div class="request-dates">
                      <span aria-hidden="true">📅</span>
                      <span class:overdue={loan.endDate < todayLocalISO()}
                        >Return by: {formatDisplayDate(loan.endDate)}</span
                      >
                    </div>
                  </div>
                </div>
                <div class="request-actions">
                  <button class="btn btn-primary" onclick={() => markAsReturned(loan.id)}>
                    Mark as Returned
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showReturnModal}
  <!-- svelte-ignore a11y_click_events_have_key_events - Modal overlay has onkeydown handler for Escape key -->
  <div class="modal-overlay" onclick={cancelReturn} onkeydown={handleModalKeydown} role="presentation">
    <div class="modal-content" bind:this={returnModalElement} onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="return-modal-title" tabindex="-1">
      <div class="modal-header">
        <h2 id="return-modal-title">Mark Item as Returned</h2>
        <button class="modal-close" onclick={cancelReturn} aria-label="Close modal">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control - Label is associated with radiogroup via aria-labelledby -->
          <label id="rating-label">How was the experience?</label>
          <div class="star-rating" role="radiogroup" aria-labelledby="rating-label">
            {#each [1, 2, 3, 4, 5] as star}
              <button
                type="button"
                class="star"
                class:filled={star <= (hoveredStar || returnRating)}
                role="radio"
                aria-label="Rate {star} out of 5 stars"
                aria-checked={star === returnRating}
                onclick={() => (returnRating = star)}
                onmouseenter={() => (hoveredStar = star)}
                onmouseleave={() => (hoveredStar = 0)}
              >
                <span aria-hidden="true">⭐</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label for="review">Review (optional)</label>
          <textarea
            id="review"
            bind:value={returnReview}
            placeholder="Share your experience with this item..."
            rows="4"
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
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={cancelReturn}>Cancel</button>
        <button class="btn btn-primary" onclick={submitReturn}>Complete Return</button>
      </div>
    </div>
  </div>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .page-header {
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .dashboard-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--border);
    overflow-x: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--text-primary);
    background-color: var(--surface);
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .tab-badge {
    background-color: var(--primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .requests-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .request-card {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
  }

  .request-content {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .request-item-link {
    display: block;
    flex-shrink: 0;
    transition: opacity var(--transition);
  }

  .request-item-link:hover {
    opacity: 0.8;
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
  }

  .request-title-link {
    text-decoration: none;
    color: inherit;
    transition: color var(--transition);
  }

  .request-title-link:hover {
    color: var(--primary);
  }

  .request-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .user-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
    transition: all var(--transition);
    border-radius: var(--radius);
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem;
  }

  .user-link:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .user-link:hover .borrower-name {
    color: var(--primary);
  }

  .request-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .borrower-avatar {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .borrower-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .request-dates {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .request-dates .overdue {
    color: var(--error);
    font-weight: 600;
  }

  .request-message {
    font-style: italic;
    color: var(--text-secondary);
    margin: 0;
    padding: 0.75rem;
    background-color: var(--surface);
    border-radius: var(--radius);
    border-left: 3px solid var(--primary);
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

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin: 0;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    line-height: 1;
    transition: color var(--transition);
  }

  .modal-close:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border);
    justify-content: flex-end;
  }

  .star-rating {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .star {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    transition: transform var(--transition), opacity var(--transition);
    opacity: 0.3;
  }

  .star:hover {
    transform: scale(1.2);
  }

  .star.filled {
    opacity: 1;
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
    .request-card {
      flex-direction: column;
      align-items: stretch;
    }

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

    .tab {
      padding: 0.875rem 1rem;
      font-size: 0.875rem;
    }

    .tab span:nth-child(2) {
      display: none;
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
