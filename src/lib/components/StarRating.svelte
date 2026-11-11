<script lang="ts">
  /**
   * A read-only row of stars for a whole-number rating (0-5, clamped).
   * Pass `label` to expose it to screen readers as an image
   * (e.g. "4 out of 5 stars"); `title` adds a hover tooltip.
   */
  interface Props {
    value: number | undefined;
    label?: string;
    title?: string;
    size?: 'sm' | 'md';
  }

  let { value, label, title, size = 'md' }: Props = $props();

  let count = $derived(Math.max(0, Math.min(5, Math.floor(Number(value) || 0))));
</script>

<div class="star-row {size}" role={label ? 'img' : undefined} aria-label={label} {title}>
  {#each Array(count) as _}
    <span aria-hidden="true">⭐</span>
  {/each}
</div>

<style>
  .sm {
    font-size: 0.75rem;
  }

  .md {
    font-size: 0.875rem;
  }
</style>
