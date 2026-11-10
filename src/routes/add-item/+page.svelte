<script lang="ts">
  import { appStore, createId } from '$lib/store';
  import { goto } from '$app/navigation';
  import Toast from '$lib/components/Toast.svelte';
  import FriendPicker from '$lib/components/FriendPicker.svelte';
  import type { Item, PermissionLevel } from '$lib/types';
  import { useToast } from '$lib/useToast.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let name = $state('');
  let description = $state('');
  let imageUrl = $state('');
  let parentCategoryId = $state('');
  let subcategoryId = $state('');
  let condition = $state<'excellent' | 'good' | 'fair' | 'poor'>('good');
  let permissionLevel = $state<PermissionLevel>('friends');
  let allowedUserIds = $state<string[]>([]);
  const toaster = useToast();

  // Get all categories for dropdown
  let topLevelCategories = $derived($appStore.categories.filter((c) => !c.parentId));
  let subcategories = $derived(
    parentCategoryId
      ? $appStore.categories.filter((c) => c.parentId === parentCategoryId)
      : []
  );

  // The final category ID to use (subcategory if selected, otherwise parent)
  let categoryId = $derived(subcategoryId || parentCategoryId);

  // Form validation
  let isValid = $derived(
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    imageUrl.trim().length > 0 &&
    categoryId.length > 0
  );

  function handleSubmit() {
    if (!isValid) {
      toaster.showToast('Please fill in all required fields', 'error');
      return;
    }

    const newItem: Item = {
      id: createId('item'),
      name: name.trim(),
      description: description.trim(),
      categoryId,
      lenderId: $appStore.currentUserId,
      imageUrl: imageUrl.trim(),
      condition,
      permissionLevel,
      allowedUserIds: permissionLevel === 'specific-users' ? [...allowedUserIds] : undefined,
      tagIds: [],
      rating: 0,
      totalBorrows: 0,
      available: true,
      createdAt: new Date().toISOString()
    };

    appStore.addItem(newItem);
    toaster.showToast('Item added successfully!', 'success');

    setTimeout(() => {
      goto('/my-items');
    }, 1000);
  }

  function handleCancel() {
    goto('/my-items');
  }

  function handleCategoryChange() {
    // Reset subcategory when parent category changes
    subcategoryId = '';
  }
</script>

<div class="add-item-page fade-in">
  <div class="container">
    <PageHeader title="Add New Item" subtitle="Share something with your community" />

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
              <label class="radio-label-vertical">
                <input type="radio" bind:group={permissionLevel} value="specific-users" />
                <div class="permission-info">
                  <span class="permission-title">Specific People</span>
                  <span class="permission-desc">Hand-pick who can see and borrow it</span>
                </div>
              </label>
            </div>
            {#if permissionLevel === 'specific-users'}
              <FriendPicker bind:selectedIds={allowedUserIds} />
            {/if}
          </fieldset>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg" disabled={!isValid}>
            Add Item
          </button>
          <button type="button" class="btn btn-secondary btn-lg" onclick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
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

  .radio-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
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

  .form-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column;
    }

    .radio-group {
      flex-direction: column;
    }
  }

  /* These stay in the page so they out-rank `.form-group input` above */
  .radio-label input[type='radio'] {
    width: auto;
    cursor: pointer;
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
</style>
