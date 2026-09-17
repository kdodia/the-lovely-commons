<script lang="ts">
  import type { Item } from '$lib/types';
  import { appStore, getPermissionLevelInfo } from '$lib/store';
  import { goto } from '$app/navigation';
  import FallbackImage from './FallbackImage.svelte';
  import { DESCRIPTION_PREVIEW_LENGTH } from '$lib/constants';

  interface Props {
    item: Item;
  }

  let { item }: Props = $props();

  let lender = $derived($appStore.users.find((u) => u.id === item.lenderId));

  const permissionInfo = $derived(getPermissionLevelInfo(item.permissionLevel));

  let descriptionPreview = $derived(
    item.description.length > DESCRIPTION_PREVIEW_LENGTH
      ? `${item.description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}...`
      : item.description
  );
</script>

<!--
  The card uses a stretched link overlay instead of wrapping everything in an
  <a>, because the lender button inside would otherwise be nested interactive
  content (invalid HTML and broken for keyboard/screen-reader users).
-->
<div class="item-card card">
  <a href="/items/{item.id}" class="card-link" aria-label={item.name}></a>
  <div class="item-image">
    <FallbackImage src={item.imageUrl} alt={item.name} fallbackType="item" />
    <div class="permission-badge" style="background-color: {permissionInfo.color};">
      <span>{permissionInfo.icon}</span>
      <span>{permissionInfo.label}</span>
    </div>
    {#if !item.available}
      <div class="unavailable-badge">Currently Borrowed</div>
    {/if}
  </div>

  <div class="item-content">
    <h3 class="item-name">{item.name}</h3>

    <div class="item-meta">
      <span class="badge">{item.condition}</span>

      <div class="rating">
        <span aria-hidden="true">⭐</span>
        <span>{item.rating.toFixed(1)}</span>
      </div>
    </div>

    <p class="item-description">{descriptionPreview}</p>

    <div class="item-footer">
      <button
        class="lender-info"
        onclick={() => goto(`/profile/${lender?.id}`)}
      >
        <span class="lender-avatar">
          <FallbackImage src={lender?.profilePic} alt={lender?.name || 'User'} fallbackType="avatar" />
        </span>
        <span class="lender-name">{lender?.name}</span>
      </button>
      <span class="borrows-count">{item.totalBorrows} borrows</span>
    </div>
  </div>
</div>

<style>
  .item-card {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    position: relative;
  }

  .card-link {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
  }

  .lender-info {
    position: relative;
    z-index: 2;
  }

  .item-image {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
    background-color: var(--surface);
  }

  .item-image :global(.fallback-image) {
    transition: transform var(--transition);
  }

  .item-card:hover .item-image :global(.fallback-image) {
    transform: scale(1.05);
  }

  .permission-badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius);
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .unavailable-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background-color: rgba(239, 68, 68, 0.95);
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .item-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .item-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .item-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .lender-info {
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

  .lender-info:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .lender-info:hover .lender-name {
    color: var(--primary);
  }

  .lender-avatar {
    display: block;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .lender-name {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .item-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    flex: 1;
  }

  .item-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .borrows-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
