<script lang="ts">
  import type { Snippet } from 'svelte';

  /** The responsive grid of UserCards (or the tab's empty state) shared by the people tabs. */
  let { children }: { children: Snippet } = $props();
</script>

<div class="users-grid">
  {@render children()}
</div>

<style>
  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .users-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
