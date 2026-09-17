<script lang="ts">
  import { page } from '$app/stores';
  import { appStore, canUserViewItem, createId, getCategoryPath, getPermissionLevelInfo } from '$lib/store';
  import Toast from '$lib/components/Toast.svelte';
  import DateRangeCalendar from '$lib/components/DateRangeCalendar.svelte';
  import type { BorrowRequest } from '$lib/types';
  import { NUDGE_DELAY_DAYS } from '$lib/constants';
  import { addDays, formatDisplayDate, startOfLocalDay, toLocalISODate } from '$lib/dates';
  import { useToast } from '$lib/useToast.svelte';

  let itemId = $derived($page.params.id);
  let item = $derived($appStore.items.find((i) => i.id === itemId));
  // The same permission check the browse grid uses — deep links must not
  // reveal items the current user isn't allowed to see.
  let canView = $derived(item ? canUserViewItem(item, $appStore.currentUserId, $appStore) : false);
  let lender = $derived($appStore.users.find((u) => u.id === item?.lenderId));
  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));
  let categoryPath = $derived(item ? getCategoryPath(item.categoryId, $appStore) : []);
  let permissionInfo = $derived(item ? getPermissionLevelInfo(item.permissionLevel) : null);
  // Collections are derived from the tags themselves (tag.itemIds is the
  // source of truth; item.tagIds is not kept in sync by tag actions).
  let itemTags = $derived(item ? $appStore.tags.filter((t) => t.itemIds.includes(item.id)) : []);

  // Wishlist state
  let wishlistEntry = $derived(
    $appStore.wishlist.find(
      (w) => w.userId === $appStore.currentUserId && w.itemId === itemId
    )
  );
  let isInWishlist = $derived(!!wishlistEntry);
  let notifyOnAvailable = $derived(wishlistEntry?.notifyOnAvailable ?? true);

  // Get borrowing history for this item
  let history = $derived(
    $appStore.borrowHistory
      .filter((h) => h.itemId === itemId)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
  );

  // Get active borrows for calendar
  let activeBorrows = $derived(
    $appStore.borrowRequests.filter(
      (r) => r.itemId === itemId && (r.status === 'approved' || r.status === 'active')
    )
  );

  // Request form state
  let showRequestForm = $state(false);
  let startDate = $state('');
  let endDate = $state('');
  let requestMessage = $state('');
  const toaster = useToast();

  // Check if current user has already requested this item
  let existingRequest = $derived(
    $appStore.borrowRequests.find(
      (req) =>
        req.itemId === itemId &&
        req.borrowerId === $appStore.currentUserId &&
        req.status === 'pending'
    )
  );

  // Check if current user can request this item
  let canRequest = $derived(
    item && currentUser && canView && item.lenderId !== $appStore.currentUserId && item.available && !existingRequest
  );

  // The nudge cooldown counts from the last nudge (or the request itself if
  // never nudged), so a long-ignored request can be nudged again after
  // NUDGE_DELAY_DAYS rather than exactly once ever.
  let daysSinceLastNudgeEvent = $derived.by(() => {
    if (!existingRequest) return null;
    const reference = existingRequest.lastNudgedAt ?? existingRequest.createdAt;

    // Use day boundaries for consistent calculation across timezones
    const referenceDay = new Date(reference).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    return Math.floor((today - referenceDay) / (1000 * 60 * 60 * 24));
  });

  let canNudge = $derived(
    daysSinceLastNudgeEvent !== null && daysSinceLastNudgeEvent >= NUDGE_DELAY_DAYS
  );

  // Calculate days remaining until nudge is available
  let daysUntilNudge = $derived.by(() => {
    if (daysSinceLastNudgeEvent === null || canNudge) return null;
    return NUDGE_DELAY_DAYS - daysSinceLastNudgeEvent;
  });

  // Calculate the date when nudge becomes available
  let nudgeAvailableDate = $derived.by(() => {
    if (!existingRequest || canNudge) return null;
    const reference = existingRequest.lastNudgedAt ?? existingRequest.createdAt;
    return addDays(new Date(reference), NUDGE_DELAY_DAYS);
  });

  function openRequestForm() {
    showRequestForm = true;
    // Set min date to tomorrow
    startDate = toLocalISODate(addDays(new Date(), 1));
  }

  function nudgeLender() {
    if (!existingRequest) return;
    const result = appStore.nudgeRequest(existingRequest.id);
    if (result.ok) {
      toaster.showToast('Reminder sent!', 'success');
    } else {
      toaster.showToast(result.error, 'error');
    }
  }

  function submitRequest() {
    if (!item || !startDate || !endDate) return;

    // Validate that the range is ordered (same-day borrows are allowed)
    if (endDate < startDate) {
      toaster.showToast('End date must not be before start date', 'error');
      return;
    }

    const request: BorrowRequest = {
      id: createId('req'),
      itemId: item.id,
      borrowerId: $appStore.currentUserId,
      lenderId: item.lenderId,
      startDate,
      endDate,
      status: 'pending',
      message: requestMessage,
      createdAt: new Date().toISOString()
    };

    const result = appStore.createBorrowRequest(request);
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }

    toaster.showToast('Borrow request sent!', 'success');
    showRequestForm = false;
    startDate = '';
    endDate = '';
    requestMessage = '';
  }

  // Booked date ranges for calendar
  let bookedDateRanges = $derived(
    activeBorrows.map((b) => ({ startDate: b.startDate, endDate: b.endDate }))
  );

  // Blocked date ranges for calendar
  let blockedDateRanges = $derived(item?.blockedDates || []);

  // Min date for calendar (tomorrow)
  let minCalendarDate = $derived(startOfLocalDay(addDays(new Date(), 1)));

  // Handle date selection from calendar
  function handleDateSelect(start: string, end: string | null) {
    startDate = start;
    endDate = end || '';
    if (start && !showRequestForm) {
      showRequestForm = true;
    }
  }

  // Wishlist functions
  function toggleWishlist() {
    if (!itemId) return;
    if (isInWishlist) {
      appStore.removeFromWishlist(itemId);
      toaster.showToast('Removed from wishlist', 'success');
    } else {
      appStore.addToWishlist(itemId, true);
      toaster.showToast("Added to wishlist! You'll be notified when available.", 'success');
    }
  }

  function toggleNotification() {
    if (!itemId) return;
    appStore.toggleWishlistNotification(itemId);
    toaster.showToast(notifyOnAvailable ? 'Notifications disabled' : 'Notifications enabled', 'success');
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
      <div class="breadcrumbs">
        <a href="/">Browse</a>
        {#each categoryPath as cat}
          <span class="breadcrumb-sep">›</span>
          <span>{cat}</span>
        {/each}
      </div>

      <div class="item-detail-grid">
        <div class="item-main">
          <div class="item-image-large">
            <img src={item.imageUrl} alt={item.name} />
            {#if !item.available}
              <div class="status-badge unavailable">Currently Borrowed</div>
            {:else}
              <div class="status-badge available">Available</div>
            {/if}
          </div>

          <div class="item-info">
            <div class="item-title-row">
              <h1 class="item-title">{item.name}</h1>
              <div class="title-actions">
                {#if item.lenderId !== $appStore.currentUserId}
                  <button
                    class="wishlist-btn"
                    class:active={isInWishlist}
                    onclick={toggleWishlist}
                    aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    aria-pressed={isInWishlist}
                  >
                    <span class="wishlist-icon" aria-hidden="true">{isInWishlist ? '❤️' : '🤍'}</span>
                    <span class="wishlist-text">{isInWishlist ? 'Saved' : 'Save'}</span>
                  </button>
                {/if}
                {#if item.lenderId === $appStore.currentUserId}
                  <a href="/items/{item.id}/edit" class="btn btn-secondary">Edit Item</a>
                {/if}
              </div>
            </div>

            <div class="item-meta-row">
              <div class="rating-large">
                <span aria-hidden="true">⭐</span>
                <span class="rating-value">{item.rating.toFixed(1)}</span>
                <span class="rating-count">({item.totalBorrows} borrows)</span>
              </div>
              <span class="badge badge-primary">{item.condition}</span>
            </div>

            <div class="lender-card">
              <img src={lender?.profilePic} alt={lender?.name} class="lender-avatar-large" />
              <div class="lender-info">
                <span class="lender-label">Lent by</span>
                <a href="/profile/{lender?.id}" class="lender-name-large">{lender?.name}</a>
                <div class="lender-stats">
                  <span><span aria-hidden="true">⭐</span> {lender?.rating.toFixed(1)}</span>
                  <span>•</span>
                  <span>{lender?.totalLends} items lent</span>
                </div>
              </div>
            </div>

            {#if permissionInfo}
              <div class="permission-card">
                <div class="permission-header">
                  <span class="permission-icon">{permissionInfo.icon}</span>
                  <div>
                    <h4>Who Can Borrow This</h4>
                    <p class="permission-level">{permissionInfo.label}</p>
                  </div>
                </div>
                <p class="permission-description">
                  {#if item.permissionLevel === 'close-friends'}
                    This item is available only to {lender?.name}'s close friends
                  {:else if item.permissionLevel === 'friends'}
                    This item is available to all of {lender?.name}'s friends
                  {:else if item.permissionLevel === 'friends-of-friends'}
                    This item is available to friends and their extended network
                  {:else if item.permissionLevel === 'neighbors'}
                    This item is available to anyone in {lender?.address?.city}
                  {/if}
                </p>
              </div>
            {/if}

            <div class="item-description">
              <h3>Description</h3>
              <p>{item.description}</p>
            </div>

            {#if itemTags.length > 0}
              <div class="item-tags">
                <h3>Collections</h3>
                <div class="tags-list">
                  {#each itemTags as tag}
                    <span class="badge badge-primary"><span aria-hidden="true">🏷️</span> {tag.name}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if isInWishlist && !item.available && item.lenderId !== $appStore.currentUserId}
              <div class="wishlist-status-card">
                <div class="wishlist-status-header">
                  <span class="wishlist-status-icon" aria-hidden="true">❤️</span>
                  <div>
                    <h4>On Your Wishlist</h4>
                    <p class="wishlist-status-info">This item is currently borrowed by someone else</p>
                  </div>
                </div>
                <div class="notification-toggle">
                  <label class="toggle-label">
                    <input
                      type="checkbox"
                      checked={notifyOnAvailable}
                      onchange={toggleNotification}
                      class="toggle-checkbox"
                    />
                    <span class="toggle-switch"></span>
                    <span class="toggle-text">Notify me when available</span>
                  </label>
                </div>
              </div>
            {/if}

            {#if existingRequest}
              <div class="action-section">
                <div class="request-status-card">
                  <div class="request-status-header">
                    <span class="status-icon">⏳</span>
                    <div>
                      <h4>Request Sent</h4>
                      <p class="request-status-date">
                        Sent {new Date(existingRequest.createdAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  {#if existingRequest.message}
                    <p class="request-status-message">"{existingRequest.message}"</p>
                  {/if}
                  <div class="request-status-dates">
                    <span><span aria-hidden="true">📅</span> {formatDisplayDate(existingRequest.startDate)} - {formatDisplayDate(existingRequest.endDate)}</span>
                  </div>
                  <p class="request-status-info">Waiting for {lender?.name} to respond to your request</p>

                  {#if canNudge}
                    <div class="nudge-section">
                      <button class="btn btn-secondary btn-sm" onclick={nudgeLender}>
                        👋 Send Friendly Reminder
                      </button>
                      <p class="nudge-hint">Send a gentle nudge to remind {lender?.name} about your request</p>
                    </div>
                  {:else if existingRequest.lastNudgedAt}
                    <div class="nudge-sent">
                      <span>✓ Reminder sent {new Date(existingRequest.lastNudgedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}</span>
                    </div>
                  {:else if daysUntilNudge !== null && nudgeAvailableDate}
                    <div class="nudge-waiting">
                      <span class="nudge-waiting-icon">⏳</span>
                      <p class="nudge-waiting-text">
                        {#if daysUntilNudge === 1}
                          Friendly reminder available tomorrow
                        {:else}
                          Friendly reminder available in {daysUntilNudge} days ({nudgeAvailableDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })})
                        {/if}
                      </p>
                    </div>
                  {/if}
                </div>
              </div>
            {:else if canRequest}
              <div class="action-section">
                {#if !showRequestForm}
                  <button class="btn btn-primary btn-lg" onclick={openRequestForm}>
                    Request to Borrow
                  </button>
                  <p class="action-hint">Or select dates from the calendar on the right</p>
                {:else}
                  <div class="request-form">
                    <h3>Request to Borrow</h3>

                    {#if startDate && endDate}
                      <div class="selected-dates-display">
                        <div class="date-badge">
                          <span class="date-label">From</span>
                          <span class="date-value">
                            {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <span class="date-arrow" aria-hidden="true">→</span>
                        <div class="date-badge">
                          <span class="date-label">To</span>
                          <span class="date-value">
                            {new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <p class="dates-change-hint">Use the calendar to change dates</p>
                    {:else if startDate}
                      <div class="dates-incomplete">
                        <span class="incomplete-icon" aria-hidden="true">📅</span>
                        <p>Select an end date from the calendar to complete your booking</p>
                      </div>
                    {:else}
                      <div class="dates-incomplete">
                        <span class="incomplete-icon" aria-hidden="true">📅</span>
                        <p>Select your dates from the calendar to continue</p>
                      </div>
                    {/if}

                    <div class="form-group">
                      <label for="message">Message (optional)</label>
                      <textarea
                        id="message"
                        bind:value={requestMessage}
                        placeholder="Let the lender know why you need this item..."
                        rows="3"
                      ></textarea>
                    </div>
                    <div class="form-actions">
                      <button
                        class="btn btn-primary"
                        onclick={submitRequest}
                        disabled={!startDate || !endDate}
                      >
                        Send Request
                      </button>
                      <button class="btn btn-secondary" onclick={() => { showRequestForm = false; startDate = ''; endDate = ''; }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="item-sidebar">
          <div class="calendar-section card">
            <h3>Availability & Booking</h3>
            <p class="calendar-hint">Select dates to request this item</p>
            <DateRangeCalendar
              bookedDates={bookedDateRanges}
              blockedDates={blockedDateRanges}
              {startDate}
              {endDate}
              onDateSelect={handleDateSelect}
              minDate={minCalendarDate}
            />
          </div>

          {#if history.length > 0}
            <div class="reviews-section card">
              <h3>Reviews ({history.filter((h) => h.review).length})</h3>
              <div class="reviews-list">
                {#each history.filter((h) => h.review) as hist}
                  {@const reviewer = $appStore.users.find((u) => u.id === hist.lenderId)}
                  {@const borrower = $appStore.users.find((u) => u.id === hist.borrowerId)}
                  <div class="review-item">
                    <div class="review-header">
                      <img src={reviewer?.profilePic} alt={reviewer?.name} class="reviewer-avatar" />
                      <div>
                        <div class="reviewer-name">{reviewer?.name}</div>
                        <div class="review-context">after a borrow by {borrower?.name}</div>
                        <div class="review-rating">
                          {#each Array(hist.rating || 0) as _, i}
                            <span aria-hidden="true">⭐</span>
                          {/each}
                        </div>
                      </div>
                    </div>
                    <p class="review-text">{hist.review}</p>
                    <div class="review-date">
                      {formatDisplayDate(hist.endDate, { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 2rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .breadcrumb-sep {
    color: var(--text-muted);
  }

  .item-detail-grid {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 2rem;
  }

  .item-image-large {
    position: relative;
    width: 100%;
    height: 400px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background-color: var(--surface);
    box-shadow: var(--shadow-md);
  }

  .item-image-large img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .status-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .status-badge.available {
    background-color: var(--success);
    color: white;
  }

  .status-badge.unavailable {
    background-color: var(--error);
    color: white;
  }

  .item-info {
    margin-top: 2rem;
  }

  .item-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .item-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .title-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .wishlist-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    transition: all var(--transition);
  }

  .wishlist-btn:hover {
    background-color: var(--surface-hover);
    border-color: var(--text-muted);
  }

  .wishlist-btn.active {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .wishlist-icon {
    font-size: 1.125rem;
  }

  .wishlist-status-card {
    background-color: rgba(239, 68, 68, 0.05);
    border: 2px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .wishlist-status-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .wishlist-status-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  .wishlist-status-card h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .wishlist-status-info {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .notification-toggle {
    padding-top: 1rem;
    border-top: 1px solid rgba(239, 68, 68, 0.15);
  }

  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-checkbox {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-switch {
    position: relative;
    width: 2.5rem;
    height: 1.375rem;
    background-color: var(--border);
    border-radius: 999px;
    transition: background-color var(--transition);
    flex-shrink: 0;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1.125rem;
    height: 1.125rem;
    background-color: white;
    border-radius: 50%;
    transition: transform var(--transition);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-checkbox:checked + .toggle-switch {
    background-color: var(--primary);
  }

  .toggle-checkbox:checked + .toggle-switch::after {
    transform: translateX(1.125rem);
  }

  .toggle-checkbox:focus-visible + .toggle-switch {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
  }

  .toggle-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .item-meta-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .rating-large {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
  }

  .rating-value {
    font-weight: 700;
    color: var(--text-primary);
  }

  .rating-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .lender-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--surface);
    border-radius: var(--radius-lg);
    margin-bottom: 1.5rem;
  }

  .lender-avatar-large {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--primary);
  }

  .permission-card {
    padding: 1.5rem;
    background-color: var(--surface);
    border-radius: var(--radius-lg);
    margin-bottom: 2rem;
    border: 2px solid var(--border);
  }

  .permission-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .permission-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .permission-card h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .permission-level {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--primary);
  }

  .permission-description {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .lender-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .lender-name-large {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary);
    display: block;
    margin: 0.25rem 0;
  }

  .lender-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .item-description {
    margin-bottom: 2rem;
  }

  .item-description h3,
  .item-tags h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .item-description p {
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .item-tags {
    margin-bottom: 2rem;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .action-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
  }

  .request-form {
    background-color: var(--surface);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
  }

  .request-form h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .form-group textarea {
    width: 100%;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .request-status-card {
    background-color: var(--surface);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    border: 2px solid var(--border);
  }

  .request-status-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .status-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .request-status-card h4 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .request-status-date {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .request-status-message {
    font-style: italic;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
    padding: 0.75rem;
    background-color: var(--background);
    border-radius: var(--radius);
    border-left: 3px solid var(--primary);
  }

  .request-status-dates {
    padding: 0.75rem;
    background-color: var(--background);
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .request-status-info {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }

  .nudge-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .nudge-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
    text-align: center;
  }

  .nudge-sent {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: var(--radius);
    text-align: center;
    font-size: 0.875rem;
    color: var(--success);
    font-weight: 500;
  }

  .nudge-waiting {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: rgba(59, 130, 246, 0.1);
    border-radius: var(--radius);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .nudge-waiting-icon {
    font-size: 1.25rem;
  }

  .nudge-waiting-text {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .calendar-section,
  .reviews-section {
    padding: 1.5rem;
  }

  .calendar-section h3,
  .reviews-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .calendar-hint {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0 0 1rem 0;
  }

  .action-hint {
    margin: 0.75rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }

  .selected-dates-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: var(--radius);
    margin-bottom: 0.5rem;
  }

  .date-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .date-label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .date-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .date-arrow {
    font-size: 1.25rem;
    color: var(--primary);
  }

  .dates-change-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    margin: 0 0 1rem 0;
  }

  .dates-incomplete {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem;
    background-color: var(--background);
    border-radius: var(--radius);
    margin-bottom: 1rem;
    text-align: center;
  }

  .incomplete-icon {
    font-size: 2rem;
  }

  .dates-incomplete p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .reviews-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .review-item {
    padding: 1rem;
    background-color: var(--surface);
    border-radius: var(--radius);
  }

  .review-header {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .reviewer-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .reviewer-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .review-context {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .review-rating {
    font-size: 0.75rem;
  }

  .review-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }

  .review-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .error-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  @media (max-width: 768px) {
    .item-detail-grid {
      grid-template-columns: 1fr;
    }

    .selected-dates-display {
      flex-direction: column;
      gap: 0.5rem;
    }

    .date-arrow {
      transform: rotate(90deg);
    }
  }
</style>
