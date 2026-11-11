<script lang="ts">
  /**
   * Interactive 1-5 star picker (a radiogroup). Use `bind:value`, and point
   * `labelledby` at the id of the label element that names the field.
   *
   * size="lg" is the larger picker used in the return modal; "md" is the
   * inline one used in the item review form.
   */
  interface Props {
    value: number;
    labelledby: string;
    size?: 'md' | 'lg';
  }

  let { value = $bindable(), labelledby, size = 'md' }: Props = $props();

  let hoveredStar = $state(0);
</script>

<div class="star-rating {size}" role="radiogroup" aria-labelledby={labelledby}>
  {#each [1, 2, 3, 4, 5] as star}
    <button
      type="button"
      class="star"
      class:filled={star <= (hoveredStar || value)}
      role="radio"
      aria-label="Rate {star} out of 5 stars"
      aria-checked={star === value}
      onclick={() => (value = star)}
      onmouseenter={() => (hoveredStar = star)}
      onmouseleave={() => (hoveredStar = 0)}
    >
      <span aria-hidden="true">⭐</span>
    </button>
  {/each}
</div>

<style>
  .star-rating {
    display: flex;
  }

  .star-rating.lg {
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .star-rating.md {
    gap: 0.375rem;
  }

  .star {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    opacity: 0.3;
    transition: transform var(--transition), opacity var(--transition);
  }

  .lg .star {
    font-size: 2rem;
  }

  .md .star {
    font-size: 1.75rem;
  }

  .lg .star:hover {
    transform: scale(1.2);
  }

  .md .star:hover {
    transform: scale(1.15);
  }

  .star.filled {
    opacity: 1;
  }
</style>
