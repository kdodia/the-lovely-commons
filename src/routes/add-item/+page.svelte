<script lang="ts">
  import { appStore, createId } from '$lib/store';
  import { goto } from '$app/navigation';
  import Toast from '$lib/components/Toast.svelte';
  import ItemForm, { type ItemFormValues } from '$lib/components/ItemForm.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import type { Item } from '$lib/types';
  import { useToast } from '$lib/useToast.svelte';

  const toaster = useToast();

  function handleSubmit(values: ItemFormValues) {
    const newItem: Item = {
      id: createId('item'),
      ...values,
      lenderId: $appStore.currentUserId,
      tagIds: [],
      rating: 0,
      totalBorrows: 0,
      available: true,
      createdAt: new Date().toISOString()
    };

    appStore.addItem(newItem);
    toaster.showToast('Item added successfully!', 'success');

    setTimeout(() => {
      goto('/my-items');
    }, 1000);
  }
</script>

<div class="add-item-page fade-in">
  <div class="container">
    <PageHeader title="Add New Item" subtitle="Share something with your community" />

    <ItemForm
      submitLabel="Add Item"
      disableSubmitUntilValid
      onSubmit={handleSubmit}
      onInvalid={() => toaster.showToast('Please fill in all required fields', 'error')}
      onCancel={() => goto('/my-items')}
    />
  </div>
</div>

{#if toaster.toast}
  <Toast message={toaster.toast.message} type={toaster.toast.type} onClose={toaster.clearToast} />
{/if}
