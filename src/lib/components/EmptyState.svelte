<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Centered "nothing here yet" block: a big icon, a title, a line of
   * explanation and optionally actions (e.g. a button) below.
   * `compact` is the smaller, title-less variant used inside page sections.
   */
  interface Props {
    icon?: string;
    title?: string;
    description?: string;
    compact?: boolean;
    actions?: Snippet;
  }

  let { icon, title, description, compact = false, actions }: Props = $props();
</script>

<div class="empty-state" class:compact>
  {#if icon}
    <span class="empty-icon" aria-hidden="true">{icon}</span>
  {/if}
  {#if title}
    <h3>{title}</h3>
  {/if}
  {#if description}
    <p class:with-actions={!!actions}>{description}</p>
  {/if}
  {@render actions?.()}
</div>

<style>
  .empty-state {
    /* Spans every column when dropped into a grid */
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-state.compact {
    padding: 3rem 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .compact .empty-icon {
    font-size: 3rem;
  }

  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  p {
    color: var(--text-secondary);
    margin: 0;
  }

  p.with-actions {
    margin-bottom: 1.5rem;
  }
</style>
