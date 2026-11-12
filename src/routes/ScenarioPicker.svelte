<script lang="ts">
  import { goto } from '$app/navigation';
  import { appStore } from '$lib/store';
  import { scenarios, type Scenario } from '$lib/scenarios';
  import { useToast } from '$lib/useToast.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Toast from '$lib/components/Toast.svelte';

  // Tester's kit: load a ready-made situation, acting as its user.
  let open = $state(false);
  const toaster = useToast();

  function userName(userId: string): string {
    return $appStore.users.find((u) => u.id === userId)?.name ?? userId;
  }

  async function load(scenario: Scenario) {
    const result = appStore.loadScenario(scenario.id);
    open = false;
    if (!result.ok) {
      toaster.showToast(result.error, 'error');
      return;
    }
    await goto(scenario.startPath);
    toaster.showToast(`Loaded "${scenario.title}". You are ${userName(scenario.actingUserId)}.`, 'success');
  }
</script>

<button
  class="scenario-btn"
  onclick={() => (open = true)}
  aria-haspopup="dialog"
  aria-label="Load a test scenario"
  title="Load a test scenario"
>
  <span aria-hidden="true">🧪</span>
</button>

{#if open}
  <Modal title="Load a scenario" size="form" onClose={() => (open = false)}>
    <p class="scenario-intro">
      Replaces all app data with a ready-made situation. The reset button (🔄) brings back the usual data.
    </p>
    <ul class="scenario-list">
      {#each scenarios as scenario (scenario.id)}
        <li>
          <button class="scenario-option" onclick={() => load(scenario)}>
            <span class="scenario-title">{scenario.title}</span>
            <span class="scenario-description">{scenario.description}</span>
          </button>
        </li>
      {/each}
    </ul>
  </Modal>
{/if}

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}

<style>
  .scenario-btn {
    padding: 0.5rem;
    border-radius: var(--radius);
    font-size: 1.25rem;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color var(--transition);
    color: var(--text-secondary);
  }

  .scenario-btn:hover {
    background-color: var(--surface);
  }

  .scenario-intro {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .scenario-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .scenario-option {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    padding: 0.75rem 1rem;
    text-align: left;
    background-color: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition:
      background-color var(--transition),
      border-color var(--transition);
  }

  .scenario-option:hover,
  .scenario-option:focus-visible {
    background-color: var(--surface);
    border-color: var(--primary);
  }

  .scenario-title {
    font-weight: 600;
    color: var(--text-primary);
  }

  .scenario-description {
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  @media (max-width: 640px) {
    .scenario-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 2.5rem;
      min-height: 2.5rem;
      padding: 0;
    }
  }
</style>
