<script module lang="ts">
  export interface TabDef<T extends string = string> {
    id: T;
    label: string;
    icon: string;
    /** Shown in a small pill after the label when greater than zero. */
    count?: number;
    /** Accessible text for the count pill, e.g. "3 incoming requests". */
    countLabel?: string;
  }
</script>

<script lang="ts" generics="T extends string">
  /**
   * A row of tabs (a WAI-ARIA tablist). The caller owns the content below it;
   * use `bind:value` to learn which tab is selected.
   *
   * variant="page"    the heavier strip used for a page's main sections
   * variant="section" the lighter strip used inside a page section
   * iconsOnly         hide the text labels on narrow screens (they stay as
   *                   the accessible names)
   * scroll            (default true) keep tabs on one line and scroll sideways
   *                   when they don't fit; false lets them wrap instead
   * panels            tabs get id="{id}-tab" and aria-controls="{id}-panel";
   *                   give the matching panels those ids
   */
  interface Props {
    tabs: TabDef<T>[];
    value: T;
    label: string;
    variant?: 'page' | 'section';
    iconsOnly?: boolean;
    scroll?: boolean;
    panels?: boolean;
  }

  let { tabs, value = $bindable(), label, variant = 'section', iconsOnly = false, scroll = true, panels = false }: Props =
    $props();
</script>

<div class="tabs {variant}" class:icons-only={iconsOnly} class:scroll role="tablist" aria-label={label}>
  {#each tabs as tab (tab.id)}
    <button
      role="tab"
      class="tab"
      class:active={value === tab.id}
      aria-selected={value === tab.id}
      aria-controls={panels ? `${tab.id}-panel` : undefined}
      aria-label={tab.label}
      id={panels ? `${tab.id}-tab` : undefined}
      onclick={() => (value = tab.id)}
    >
      <span aria-hidden="true">{tab.icon}</span>
      <span>{tab.label}</span>
      {#if tab.count}
        <span class="tab-badge" aria-label={tab.countLabel}>{tab.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .tab:hover {
    color: var(--text-primary);
    background-color: var(--surface);
  }

  .tab-badge {
    background-color: var(--primary);
    color: white;
    padding: 0.125rem 0.5rem;
  }

  /* page: main sections of a page */
  .page {
    margin-bottom: 2rem;
  }

  .page .tab {
    border-bottom: 3px solid transparent;
  }

  .page .tab-badge {
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  /* section: inside a page section */
  .section {
    margin-bottom: 1.5rem;
  }

  .scroll {
    overflow-x: auto;
  }

  .section .tab {
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 0.9375rem;
  }

  .scroll .tab {
    white-space: nowrap;
  }

  .section .tab-badge {
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  @media (max-width: 768px) {
    .page .tab {
      padding: 0.875rem 1rem;
      font-size: 0.875rem;
    }

    .section.icons-only .tab {
      padding: 1rem;
    }

    .icons-only .tab span:nth-child(2) {
      display: none;
    }
  }
</style>
