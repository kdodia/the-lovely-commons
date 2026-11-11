<script lang="ts">
  interface Props {
    /** Overdue loans where the current user is the lender. */
    lentCount: number;
    /** Overdue loans where the current user is the borrower. */
    borrowedCount: number;
    onShow: (tab: 'lending' | 'borrowing') => void;
  }

  let { lentCount, borrowedCount, onShow }: Props = $props();

  /** "1 item you lent is overdue" / "2 items you borrowed are overdue" */
  function summary(count: number, side: 'lent' | 'borrowed'): string {
    return count === 1
      ? `1 item you ${side} is overdue`
      : `${count} items you ${side} are overdue`;
  }
</script>

{#if lentCount > 0 || borrowedCount > 0}
  <div class="overdue-banner" role="status">
    <span class="overdue-banner-icon" aria-hidden="true">⏰</span>
    <div class="overdue-banner-links">
      {#if lentCount > 0}
        <button class="overdue-banner-link" onclick={() => onShow('lending')}>
          {summary(lentCount, 'lent')}
        </button>
      {/if}
      {#if borrowedCount > 0}
        <button class="overdue-banner-link" onclick={() => onShow('borrowing')}>
          {summary(borrowedCount, 'borrowed')}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overdue-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    border: 1px solid var(--error);
    border-left-width: 4px;
    border-radius: var(--radius);
    background-color: rgba(239, 68, 68, 0.08);
  }

  .overdue-banner-icon {
    font-size: 1.25rem;
  }

  .overdue-banner-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
  }

  .overdue-banner-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--error);
    text-decoration: underline;
    cursor: pointer;
  }

  .overdue-banner-link:hover {
    text-decoration: none;
  }
</style>
