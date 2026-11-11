<script lang="ts">
  interface Props {
    /** The name being typed; held by the page so it survives closing and reopening the form. */
    name: string;
    onCreate: () => void;
    onCancel: () => void;
  }

  let { name = $bindable(), onCreate, onCancel }: Props = $props();
</script>

<div class="create-form card">
  <h3>Create New Tag</h3>
  <div class="form-row">
    <input
      type="text"
      placeholder="Tag name (e.g., 'Camping Essentials', 'Party Items')"
      bind:value={name}
      class="tag-input"
    />
    <button class="btn btn-primary" onclick={onCreate} disabled={!name.trim()}>Create</button>
    <button class="btn btn-secondary" onclick={onCancel}>Cancel</button>
  </div>
</div>

<style>
  .create-form {
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .create-form h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .tag-input {
    flex: 1;
  }

  @media (max-width: 768px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>
