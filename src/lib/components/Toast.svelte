<script lang="ts">
  import { fly } from 'svelte/transition';

  interface Props {
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
    onClose?: () => void;
  }

  let { message, type = 'info', duration = 3000, onClose }: Props = $props();

  let visible = $state(true);
  let exitTimer: ReturnType<typeof setTimeout> | undefined;

  function dismiss() {
    visible = false;
    // Let the exit transition play before telling the parent to clear state
    exitTimer = setTimeout(() => onClose?.(), 300);
  }

  // (Re)start the auto-dismiss timer whenever a new message arrives, so a
  // toast shown while a previous one is on screen gets its full duration.
  $effect(() => {
    void message;
    visible = true;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  });

  $effect(() => () => clearTimeout(exitTimer));

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
</script>

{#if visible}
  <div class="toast toast-{type}" transition:fly={{ y: -20, duration: 300 }} role="alert">
    <span class="toast-icon" aria-hidden="true">{icons[type]}</span>
    <span class="toast-message">{message}</span>
    <button class="toast-close" onclick={dismiss} aria-label="Close notification">×</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: 5rem;
    right: 1rem;
    min-width: 250px;
    max-width: 400px;
    padding: 1rem 1.25rem;
    background-color: var(--background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1000;
    border: 1px solid var(--border);
  }

  .toast-success {
    border-left: 4px solid var(--success);
  }

  .toast-error {
    border-left: 4px solid var(--error);
  }

  .toast-warning {
    border-left: 4px solid var(--warning);
  }

  .toast-info {
    border-left: 4px solid var(--secondary);
  }

  .toast-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .toast-close {
    font-size: 1.5rem;
    color: var(--text-muted);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    line-height: 1;
    transition: color var(--transition);
  }

  .toast-close:hover {
    color: var(--text-primary);
  }

  @media (max-width: 640px) {
    .toast {
      right: 0.5rem;
      left: 0.5rem;
      min-width: auto;
    }
  }
</style>
