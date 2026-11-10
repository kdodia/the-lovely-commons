<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';

  /** "Decline Friend Request": an optional note to the sender. Render only while open. */
  interface Props {
    onCancel: () => void;
    /** The trimmed note, or undefined when left empty. */
    onConfirm: (message: string | undefined) => void;
  }

  let { onCancel, onConfirm }: Props = $props();

  let message = $state('');
</script>

<Modal title="Decline Friend Request" onClose={onCancel}>
  <!-- The title sits closer to this line than in the other dialogs -->
  <p style="margin-top: -0.5rem">Would you like to include a message? (optional)</p>
  <div class="form-group">
    <textarea
      bind:value={message}
      placeholder="Let them know why you're declining..."
      rows="4"
      class="decline-textarea"
    ></textarea>
  </div>
  {#snippet actions()}
    <button class="btn btn-secondary" onclick={onCancel}>Cancel</button>
    <button class="btn btn-error" onclick={() => onConfirm(message.trim() || undefined)}>Decline Request</button>
  {/snippet}
</Modal>

<style>
  .form-group {
    margin-bottom: 1.5rem;
  }

  .decline-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.9375rem;
    resize: vertical;
    transition: border-color var(--transition);
    background-color: var(--background);
    color: var(--text-primary);
  }

  .decline-textarea:focus {
    outline: none;
    border-color: var(--primary);
  }
</style>
