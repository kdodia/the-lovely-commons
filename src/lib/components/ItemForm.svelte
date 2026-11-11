<script module lang="ts">
  import type { ItemCondition, PermissionLevel } from '$lib/types';

  /**
   * The item form shared by "Add New Item" and "Edit Item": details, category,
   * condition and who can borrow. It owns the field state and reports a
   * cleaned-up set of values through `onSubmit`; each page decides what to do
   * with them. Anything only one page needs (e.g. the edit page's blocked
   * dates) goes in the `extraSections` snippet, rendered before the buttons.
   */
  export interface ItemFormValues {
    name: string;
    description: string;
    imageUrl: string;
    categoryId: string;
    condition: ItemCondition;
    permissionLevel: PermissionLevel;
    /** Only set when the permission level is 'specific-users'. */
    allowedUserIds: string[] | undefined;
  }

  export type ItemFormInitial = Partial<Omit<ItemFormValues, 'allowedUserIds'>> & {
    allowedUserIds?: string[];
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { appStore } from '$lib/store';
  import FriendPicker from '$lib/components/FriendPicker.svelte';

  interface Props {
    /** Starting values; read once when the form is created. */
    initial?: ItemFormInitial;
    submitLabel: string;
    /** Disable the submit button until the required fields are filled in. */
    disableSubmitUntilValid?: boolean;
    /** Called with trimmed values when the required fields are filled in. */
    onSubmit: (values: ItemFormValues) => void;
    /** Called instead when submitted with required fields missing. */
    onInvalid: () => void;
    onCancel: () => void;
    extraSections?: Snippet;
  }

  let {
    initial = {},
    submitLabel,
    disableSubmitUntilValid = false,
    onSubmit,
    onInvalid,
    onCancel,
    extraSections
  }: Props = $props();

  // The initial values are deliberately captured once; the form owns its state from here.
  const initialCategory = $appStore.categories.find((c) => c.id === initial.categoryId);

  /* svelte-ignore state_referenced_locally */
  let name = $state(initial.name ?? '');
  /* svelte-ignore state_referenced_locally */
  let description = $state(initial.description ?? '');
  /* svelte-ignore state_referenced_locally */
  let imageUrl = $state(initial.imageUrl ?? '');
  let parentCategoryId = $state(initialCategory?.parentId ?? initialCategory?.id ?? '');
  let subcategoryId = $state(initialCategory?.parentId ? initialCategory.id : '');
  /* svelte-ignore state_referenced_locally */
  let condition = $state<ItemCondition>(initial.condition ?? 'good');
  /* svelte-ignore state_referenced_locally */
  let permissionLevel = $state<PermissionLevel>(initial.permissionLevel ?? 'friends');
  /* svelte-ignore state_referenced_locally */
  let allowedUserIds = $state<string[]>(initial.allowedUserIds ?? []);

  // Get all categories for dropdown
  let topLevelCategories = $derived($appStore.categories.filter((c) => !c.parentId));
  let subcategories = $derived(
    parentCategoryId
      ? $appStore.categories.filter((c) => c.parentId === parentCategoryId)
      : []
  );

  // The final category ID to use (subcategory if selected, otherwise parent)
  let categoryId = $derived(subcategoryId || parentCategoryId);

  let isValid = $derived(
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    imageUrl.trim().length > 0 &&
    categoryId.length > 0
  );

  function handleSubmit() {
    if (!isValid) {
      onInvalid();
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      categoryId,
      condition,
      permissionLevel,
      allowedUserIds: permissionLevel === 'specific-users' ? [...allowedUserIds] : undefined
    });
  }

  function handleCategoryChange() {
    // Reset subcategory when parent category changes
    subcategoryId = '';
  }
</script>

<div class="form-card card">
  <form class="item-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
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

    {#if extraSections}
      <div class="form-extras">
        {@render extraSections()}
      </div>
    {/if}

    <div class="form-actions">
      <button type="submit" class="btn btn-primary btn-lg" disabled={disableSubmitUntilValid && !isValid}>
        {submitLabel}
      </button>
      <button type="button" class="btn btn-secondary btn-lg" onclick={onCancel}>
        Cancel
      </button>
    </div>
  </form>
</div>

<!--
  Section chrome (.form-section, .form-group, .form-row) is written once. The
  `.form-extras` copies of each selector are for markup the page passes in via
  `extraSections`, which this component's scoped styles can't otherwise reach.
-->
<style>
  .form-section,
  .form-extras :global(.form-section) {
    margin-bottom: 2.5rem;
    padding-bottom: 2.5rem;
    border-bottom: 1px solid var(--border);
  }

  .form-section h3,
  .form-extras :global(.form-section h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
  }

  .form-group,
  .form-extras :global(.form-group) {
    margin-bottom: 1.5rem;
  }

  .form-group label,
  .form-extras :global(.form-group label) {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group textarea,
  .form-group select,
  .form-extras :global(.form-group input),
  .form-extras :global(.form-group textarea),
  .form-extras :global(.form-group select) {
    width: 100%;
  }

  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .form-row,
  .form-extras :global(.form-row) {
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
    .form-row,
    .form-extras :global(.form-row) {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column;
    }

    .radio-group {
      flex-direction: column;
    }
  }

  /* These come after `.form-group input` so they out-rank it */
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
