<script lang="ts">
  /** "Browse › Category › Subcategory" trail above the item. */
  let { categoryPath }: { categoryPath: string[] } = $props();
</script>

<div class="breadcrumbs">
  <a href="/">Browse</a>
  {#each categoryPath as cat}
    <span class="breadcrumb-sep">›</span>
    <span>{cat}</span>
  {/each}
</div>

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
</style>
