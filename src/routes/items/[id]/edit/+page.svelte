<script lang="ts">
  import { page } from '$app/stores';
  import { appStore } from '$lib/store';
  import { goto } from '$app/navigation';
  import Toast from '$lib/components/Toast.svelte';
  import type { PermissionLevel } from '$lib/types';
  import { formatDisplayDate, todayLocalISO } from '$lib/dates';
  import { useToast } from '$lib/useToast.svelte';

  let itemId = $derived($page.params.id);
  let item = $derived($appStore.items.find((i) => i.id === itemId));
  let currentUser = $derived($appStore.users.find((u) => u.id === $appStore.currentUserId));

  // Redirect if not the owner
  $effect(() => {
    if (item && item.lenderId !== $appStore.currentUserId) {
      goto('/');
    }
  });

  // Form state - Intentionally capturing initial prop values here, then syncing with $effect below
  /* svelte-ignore state_referenced_locally */
  let name = $state(item?.name || '');
  /* svelte-ignore state_referenced_locally */
  let description = $state(item?.description || '');
  /* svelte-ignore state_referenced_locally */
  let imageUrl = $state(item?.imageUrl || '');
  /* svelte-ignore state_referenced_locally */
  let condition = $state<'excellent' | 'good' | 'fair' | 'poor'>(item?.condition || 'good');
  /* svelte-ignore state_referenced_locally */
  let permissionLevel = $state<PermissionLevel>(item?.permissionLevel || 'friends');
  /* svelte-ignore state_referenced_locally */
  let blockedDates = $state<Array<{ startDate: string; endDate: string; reason?: string }>>(
    item?.blockedDates || []
  );
  const toaster = useToast();

  // Category state
  let parentCategoryId = $state('');
  let subcategoryId = $state('');

  // Populate the form when a different item is loaded. Keying on the item id
  // (rather than the item object) means a background state update — e.g.
  // cross-tab sync — won't clobber unsaved edits mid-form.
  let syncedItemId = $state<string | null>(null);
  $effect(() => {
    if (!item || item.id === syncedItemId) return;
    syncedItemId = item.id;
    name = item.name;
    description = item.description;
    imageUrl = item.imageUrl;
    condition = item.condition;
    permissionLevel = item.permissionLevel;
    blockedDates = item.blockedDates || [];

    const category = $appStore.categories.find((c) => c.id === item.categoryId);
    if (category) {
      if (category.parentId) {
        parentCategoryId = category.parentId;
        subcategoryId = category.id;
      } else {
        parentCategoryId = category.id;
        subcategoryId = '';
      }
    }
  });

  let categoryId = $derived(subcategoryId || parentCategoryId);

  // Get all categories for dropdown
  let topLevelCategories = $derived($appStore.categories.filter((c) => !c.parentId));
  let subcategories = $derived(
    parentCategoryId
      ? $appStore.categories.filter((c) => c.parentId === parentCategoryId)
      : []
  );

  // Date blocking state
  let showDateBlockForm = $state(false);
  let blockStartDate = $state('');
  let blockEndDate = $state('');
  let blockReason = $state('');

  function handleCategoryChange() {
    subcategoryId = '';
  }

  function addBlockedDate() {
    if (!blockStartDate || !blockEndDate) {
      toaster.showToast('Please select both start and end dates', 'error');
      return;
    }

    // Validate that the range is ordered (same-day blocks are allowed)
    if (blockEndDate < blockStartDate) {
      toaster.showToast('End date must not be before start date', 'error');
      return;
    }

    blockedDates = [
      ...blockedDates,
      {
        startDate: blockStartDate,
        endDate: blockEndDate,
        reason: blockReason || undefined
      }
    ];

    // Reset form
    blockStartDate = '';
    blockEndDate = '';
    blockReason = '';
    showDateBlockForm = false;

    toaster.showToast('Date block added — save changes to apply it', 'info');
  }

  function removeBlockedDate(index: number) {
    blockedDates = blockedDates.filter((_, i) => i !== index);
    toaster.showToast('Date block removed — save changes to apply it', 'info');
  }

  function handleSubmit() {
    if (!item) return;

    if (!name.trim() || !description.trim() || !imageUrl.trim() || !categoryId) {
      toaster.showToast('Please fill in all required fields', 'error');
      return;
    }

    appStore.updateItem(item.id, {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      categoryId,
      condition,
      permissionLevel,
      blockedDates: blockedDates.length > 0 ? blockedDates : undefined
    });

    toaster.showToast('Item updated successfully!', 'success');
    setTimeout(() => {
      goto(`/items/${item.id}`);
    }, 1000);
  }

  function handleCancel() {
    goto(`/items/${itemId}`);
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
      <header class="page-header">
        <div>
          <h1 class="page-title">Edit Item</h1>
          <p class="page-subtitle">Update your item details and availability</p>
        </div>
      </header>

      <div class="form-card card">
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="form-section">
            <h3>Item Details</h3>

            <div class="form-group">
              <label for="name">Item Name *</label>
              <input
                type="text"
                id="name"
                bind:value={name}
                placeholder="e.g., KitchenAid Stand Mixer"
                required
              />
            </div>

            <div class="form-group">
              <label for="description">Description *</label>
              <textarea
                id="description"
                bind:value={description}
                placeholder="Describe your item, its features, and any important details..."
                rows="4"
                required
              ></textarea>
            </div>

            <div class="form-group">
              <label for="imageUrl">Image URL *</label>
              <input
                type="url"
                id="imageUrl"
                bind:value={imageUrl}
                placeholder="https://images.unsplash.com/photo-..."
                aria-describedby="imageUrl-hint"
                required
              />
              <span id="imageUrl-hint" class="form-hint">Use a link to an image from Unsplash or another source</span>
            </div>

            {#if imageUrl}
              <div class="image-preview">
                <img src={imageUrl} alt={name ? `Preview of ${name}` : 'Item image preview'} onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
              </div>
            {/if}
          </div>

          <div class="form-section">
            <h3>Category & Condition</h3>

            <div class="form-row">
              <div class="form-group">
                <label for="category">Category *</label>
                <select id="category" bind:value={parentCategoryId} onchange={handleCategoryChange} required>
                  <option value="">Select a category</option>
                  {#each topLevelCategories as category}
                    <option value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  {/each}
                </select>
              </div>

              {#if subcategories.length > 0}
                <div class="form-group">
                  <label for="subcategory">Subcategory (optional)</label>
                  <select id="subcategory" bind:value={subcategoryId}>
                    <option value="">None</option>
                    {#each subcategories as subcat}
                      <option value={subcat.id}>
                        {subcat.icon} {subcat.name}
                      </option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>

            <fieldset class="form-group">
              <legend>Condition *</legend>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" bind:group={condition} value="excellent" />
                  <span class="badge">Excellent</span>
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={condition} value="good" />
                  <span class="badge">Good</span>
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={condition} value="fair" />
                  <span class="badge">Fair</span>
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={condition} value="poor" />
                  <span class="badge">Poor</span>
                </label>
              </div>
            </fieldset>
          </div>

          <div class="form-section">
            <h3>Who Can Borrow This?</h3>

            <fieldset class="form-group">
              <legend>Permission Level</legend>
              <div class="radio-group-vertical">
                <label class="radio-label-vertical">
                  <input type="radio" bind:group={permissionLevel} value="close-friends" />
                  <div class="permission-info">
                    <span class="permission-title">Close Friends Only</span>
                    <span class="permission-desc">Your most trusted circle</span>
                  </div>
                </label>
                <label class="radio-label-vertical">
                  <input type="radio" bind:group={permissionLevel} value="friends" />
                  <div class="permission-info">
                    <span class="permission-title">Friends</span>
                    <span class="permission-desc">All your friends can see and borrow</span>
                  </div>
                </label>
                <label class="radio-label-vertical">
                  <input type="radio" bind:group={permissionLevel} value="friends-of-friends" />
                  <div class="permission-info">
                    <span class="permission-title">Friends of Friends</span>
                    <span class="permission-desc">Extended network</span>
                  </div>
                </label>
                <label class="radio-label-vertical">
                  <input type="radio" bind:group={permissionLevel} value="neighbors" />
                  <div class="permission-info">
                    <span class="permission-title">Neighbors</span>
                    <span class="permission-desc">Anyone in your area</span>
                  </div>
                </label>
              </div>
            </fieldset>
          </div>

          <div class="form-section">
            <div class="section-header">
              <h3>Blocked Dates</h3>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                onclick={() => (showDateBlockForm = !showDateBlockForm)}
              >
                {showDateBlockForm ? 'Cancel' : '+ Block Dates'}
              </button>
            </div>
            <p class="section-description">Block dates when you need to use this item personally</p>

            {#if showDateBlockForm}
              <div class="date-block-form">
                <div class="form-row">
                  <div class="form-group">
                    <label for="block-start">Start Date</label>
                    <input
                      type="date"
                      id="block-start"
                      bind:value={blockStartDate}
                      min={todayLocalISO()}
                    />
                  </div>
                  <div class="form-group">
                    <label for="block-end">End Date</label>
                    <input
                      type="date"
                      id="block-end"
                      bind:value={blockEndDate}
                      min={blockStartDate || todayLocalISO()}
                    />
                  </div>
                </div>
                <div class="form-group">
                  <label for="block-reason">Reason (optional)</label>
                  <input
                    type="text"
                    id="block-reason"
                    bind:value={blockReason}
                    placeholder="e.g., Using for camping trip"
                  />
                </div>
                <button type="button" class="btn btn-primary btn-sm" onclick={addBlockedDate}>
                  Add Block
                </button>
              </div>
            {/if}

            {#if blockedDates.length > 0}
              <div class="blocked-dates-list">
                {#each blockedDates as block, index}
                  <div class="blocked-date-card">
                    <div class="blocked-date-info">
                      <span class="blocked-date-icon" aria-hidden="true">🚫</span>
                      <div>
                        <div class="blocked-date-range">
                          {formatDisplayDate(block.startDate)} - {formatDisplayDate(block.endDate)}
                        </div>
                        {#if block.reason}
                          <div class="blocked-date-reason">{block.reason}</div>
                        {/if}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-error"
                      onclick={() => removeBlockedDate(index)}
                    >
                      Remove
                    </button>
                  </div>
                {/each}
              </div>
            {:else if !showDateBlockForm}
              <p class="empty-message">No blocked dates. This item is available for all future dates.</p>
            {/if}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-lg">
              Save Changes
            </button>
            <button type="button" class="btn btn-secondary btn-lg" onclick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
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

  .form-card {
    padding: 2rem;
    max-width: 800px;
  }

  .form-section {
    margin-bottom: 2.5rem;
    padding-bottom: 2.5rem;
    border-bottom: 1px solid var(--border);
  }

  .form-section:last-of-type {
    border-bottom: none;
    margin-bottom: 2rem;
  }

  .form-section h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .section-header h3 {
    margin: 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
  }

  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .image-preview {
    margin-top: 1rem;
    border-radius: var(--radius);
    overflow: hidden;
    max-width: 400px;
  }

  .image-preview img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .radio-label input[type='radio'] {
    width: auto;
    cursor: pointer;
  }

  .radio-label .badge {
    cursor: pointer;
    transition: all var(--transition);
  }

  .radio-label input[type='radio']:checked + .badge {
    background-color: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .radio-group-vertical {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .radio-label-vertical {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
  }

  .radio-label-vertical:hover {
    border-color: var(--primary);
    background-color: rgba(16, 185, 129, 0.05);
  }

  .radio-label-vertical input[type='radio'] {
    width: auto;
    cursor: pointer;
    flex-shrink: 0;
  }

  .radio-label-vertical input[type='radio']:checked {
    accent-color: var(--primary);
  }

  .radio-label-vertical input[type='radio']:checked ~ .permission-info {
    color: var(--primary);
  }

  .permission-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .permission-title {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .permission-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .date-block-form {
    background-color: var(--surface);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    margin-bottom: 1rem;
  }

  .blocked-dates-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .blocked-date-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background-color: var(--surface);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }

  .blocked-date-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .blocked-date-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .blocked-date-range {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .blocked-date-reason {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .empty-message {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
  }

  .error-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  @media (max-width: 768px) {
    .form-card {
      padding: 1.5rem;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column;
    }

    .radio-group {
      flex-direction: column;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }
</style>
