<script lang="ts">
  /** The large item photo with its Available / Currently Borrowed badge. */
  let { imageUrl, name, available }: { imageUrl: string; name: string; available: boolean } = $props();
</script>

<div class="item-image-large">
  <img src={imageUrl} alt={name} />
  {#if !available}
    <div class="status-badge unavailable">Currently Borrowed</div>
  {:else}
    <div class="status-badge available">Available</div>
  {/if}
</div>

<style>
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
</style>
