<script lang="ts">
  import { appStore, nextNudgeDate } from '$lib/store';
  import type { BorrowRequest } from '$lib/types';
  import type { ToastType } from '$lib/useToast.svelte';
  import { DATE_FORMAT_OPTIONS } from '$lib/constants';
  import { daysBetween, formatDisplayDate, todayLocalISO } from '$lib/dates';

  /**
   * The borrower's own pending request: what they sent, who it is waiting on,
   * and the "Send Friendly Reminder" control with its cooldown messages.
   */
  interface Props {
    request: BorrowRequest;
    lenderName: string | undefined;
    onToast: (message: string, type?: ToastType) => void;
  }

  let { request, lenderName, onToast }: Props = $props();

  // The day the domain allows the next nudge (from the request, or from the
  // last nudge); the store refuses one before it, so the button agrees.
  let nudgeAvailableOn = $derived(nextNudgeDate(request));
  let today = $derived(todayLocalISO());
  let canNudge = $derived(today >= nudgeAvailableOn);
  let daysUntilNudge = $derived(daysBetween(today, nudgeAvailableOn));

  function nudgeLender() {
    const result = appStore.nudgeRequest(request.id);
    if (result.ok) {
      onToast('Reminder sent!', 'success');
    } else {
      onToast(result.error, 'error');
    }
  }
</script>

<div class="request-status-card">
  <div class="request-status-header">
    <span class="status-icon">⏳</span>
    <div>
      <h4>Request Sent</h4>
      <p class="request-status-date">
        Sent {new Date(request.createdAt).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}
      </p>
    </div>
  </div>
  {#if request.message}
    <p class="request-status-message">"{request.message}"</p>
  {/if}
  <div class="request-status-dates">
    <span><span aria-hidden="true">📅</span> {formatDisplayDate(request.startDate)} - {formatDisplayDate(request.endDate)}</span>
  </div>
  <p class="request-status-info">Waiting for {lenderName} to respond to your request</p>

  {#if canNudge}
    <div class="nudge-section">
      <button class="btn btn-secondary btn-sm" onclick={nudgeLender}>
        👋 Send Friendly Reminder
      </button>
      <p class="nudge-hint">Send a gentle nudge to remind {lenderName} about your request</p>
    </div>
  {:else if request.lastNudgedAt}
    <div class="nudge-sent">
      <span>✓ Reminder sent {new Date(request.lastNudgedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })}</span>
    </div>
  {:else}
    <div class="nudge-waiting">
      <span class="nudge-waiting-icon">⏳</span>
      <p class="nudge-waiting-text">
        {#if daysUntilNudge === 1}
          Friendly reminder available tomorrow
        {:else}
          Friendly reminder available in {daysUntilNudge} days ({formatDisplayDate(nudgeAvailableOn, DATE_FORMAT_OPTIONS.short)})
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .request-status-card {
    background-color: var(--surface);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    border: 2px solid var(--border);
  }

  .request-status-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .status-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .request-status-card h4 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .request-status-date {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .request-status-message {
    font-style: italic;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
    padding: 0.75rem;
    background-color: var(--background);
    border-radius: var(--radius);
    border-left: 3px solid var(--primary);
  }

  .request-status-dates {
    padding: 0.75rem;
    background-color: var(--background);
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .request-status-info {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }

  .nudge-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .nudge-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
    text-align: center;
  }

  .nudge-sent {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: var(--radius);
    text-align: center;
    font-size: 0.875rem;
    color: var(--success);
    font-weight: 500;
  }

  .nudge-waiting {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: rgba(59, 130, 246, 0.1);
    border-radius: var(--radius);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .nudge-waiting-icon {
    font-size: 1.25rem;
  }

  .nudge-waiting-text {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.4;
  }
</style>
