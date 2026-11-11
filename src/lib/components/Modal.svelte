<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The one modal dialog. Render it conditionally (`{#if open}<Modal ...>`);
   * it handles the overlay, Escape / backdrop-click to close, moving focus
   * into the dialog, keeping Tab inside it, and handing focus back to
   * whatever opened it.
   *
   * size="md"   confirm / short form dialog (500px)
   * size="sm"   narrower confirm dialog (440px)
   * size="form" taller dialog with a header (title + close button), a body
   *             and an actions footer
   */
  interface Props {
    title: string;
    onClose: () => void;
    size?: 'sm' | 'md' | 'form';
    children: Snippet;
    /** Buttons, rendered right-aligned under the content. */
    actions?: Snippet;
  }

  let { title, onClose, size = 'md', children, actions }: Props = $props();

  const uid = $props.id();
  const titleId = `modal-title-${uid}`;
  let dialog = $state<HTMLDivElement | undefined>();

  const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';

  // Move focus into the dialog on open and restore it on close.
  $effect(() => {
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  });

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  // Keep Tab / Shift+Tab cycling inside the dialog.
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events - Escape is handled on the window -->
<div class="modal-overlay {size}" onclick={onBackdropClick} role="presentation">
  <div
    class="modal-content"
    bind:this={dialog}
    onkeydown={trapFocus}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
  >
    {#if size === 'form'}
      <div class="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button class="modal-close" onclick={onClose} aria-label="Close modal">✕</button>
      </div>
      <div class="modal-body">
        {@render children()}
      </div>
      {#if actions}
        <div class="modal-footer">
          {@render actions()}
        </div>
      {/if}
    {:else}
      <h2 id={titleId}>{title}</h2>
      {@render children()}
      {#if actions}
        <div class="modal-actions">
          {@render actions()}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-content {
    background-color: var(--background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.2s ease-out;
  }

  /* md: confirm dialog, 500px */
  .md .modal-content {
    padding: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .md h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .md .modal-content :global(p) {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .md .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  /* sm: confirm dialog, 440px */
  .sm,
  .form {
    padding: 1rem;
  }

  .sm .modal-content {
    padding: 2rem;
    max-width: 440px;
    width: 100%;
  }

  .sm h2 {
    margin: 0 0 0.75rem 0;
    font-size: 1.375rem;
  }

  .sm .modal-content :global(p) {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary);
  }

  .sm .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  /* form: header / body / footer */
  .form .modal-content {
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    line-height: 1;
    transition: color var(--transition);
  }

  .modal-close:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border);
    justify-content: flex-end;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    .md .modal-content {
      padding: 1.5rem;
    }

    .md .modal-actions {
      flex-direction: column;
    }
  }
</style>
