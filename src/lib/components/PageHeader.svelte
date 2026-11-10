<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The title block at the top of a page: <h1>, an optional subtitle and
   * optional actions (children) aligned to the right.
   *
   * Two per-page quirks are kept as opt-in props so pages look as they did:
   * `stack` stacks the actions under the title on narrow screens ('stretch'
   * makes them full width, 'start' left-aligns them), and `shrinkTitle`
   * drops the title to 1.5rem there.
   */
  interface Props {
    title: string;
    subtitle?: string;
    stack?: 'stretch' | 'start';
    shrinkTitle?: boolean;
    children?: Snippet;
  }

  let { title, subtitle, stack, shrinkTitle = false, children }: Props = $props();
</script>

<header class="page-header {stack ? `stack-${stack}` : ''}" class:shrink-title={shrinkTitle}>
  <div>
    <h1 class="page-title">{title}</h1>
    {#if subtitle}
      <p class="page-subtitle">{subtitle}</p>
    {/if}
  </div>
  {@render children?.()}
</header>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
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

  @media (max-width: 768px) {
    .stack-stretch {
      flex-direction: column;
      align-items: stretch;
    }

    .stack-start {
      flex-direction: column;
      align-items: flex-start;
    }

    .shrink-title .page-title {
      font-size: 1.5rem;
    }
  }
</style>
