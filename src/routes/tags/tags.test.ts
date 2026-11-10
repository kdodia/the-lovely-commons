import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TagHeading from './TagHeading.svelte';
import TagDetails from './TagDetails.svelte';
import CreateTagForm from './CreateTagForm.svelte';
import type { Item, Tag } from '$lib/types';

const tag: Tag = { id: 't1', name: 'Camping', createdBy: 'u1', itemIds: ['i1'] };

function item(id: string, name: string): Item {
  return {
    id,
    name,
    description: '',
    categoryId: 'c',
    lenderId: 'u1',
    imageUrl: '',
    condition: 'good',
    permissionLevel: 'friends',
    tagIds: [],
    rating: 5,
    totalBorrows: 0,
    available: true,
    createdAt: '2024-01-01T00:00:00Z'
  };
}

describe('TagHeading', () => {
  it('renames on Save and leaves edit mode when accepted', async () => {
    const onRename = vi.fn().mockReturnValue(true);
    render(TagHeading, { props: { tag, onRename, onDelete: vi.fn() } });

    await fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Tag name') as HTMLInputElement;
    expect(input.value).toBe('Camping');
    await fireEvent.input(input, { target: { value: '  Hiking  ' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onRename).toHaveBeenCalledWith('Hiking');
    expect(screen.queryByLabelText('Tag name')).not.toBeInTheDocument();
  });

  it('stays in edit mode when the rename is refused', async () => {
    const onRename = vi.fn().mockReturnValue(false);
    render(TagHeading, { props: { tag, onRename, onDelete: vi.fn() } });

    await fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    await fireEvent.keyDown(screen.getByLabelText('Tag name'), { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('Camping');
    expect(screen.getByLabelText('Tag name')).toBeInTheDocument();
  });

  it('cancels with Escape and offers delete', async () => {
    const onDelete = vi.fn();
    render(TagHeading, { props: { tag, onRename: vi.fn(), onDelete } });

    await fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    await fireEvent.keyDown(screen.getByLabelText('Tag name'), { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Camping' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('TagDetails', () => {
  it('lists items in the tag with remove and the rest with add', async () => {
    const onAddItem = vi.fn();
    const onRemoveItem = vi.fn();
    render(TagDetails, {
      props: {
        tag,
        tagItems: [item('i1', 'Tent')],
        availableItems: [item('i2', 'Stove')],
        onRename: vi.fn(),
        onDelete: vi.fn(),
        onAddItem,
        onRemoveItem
      }
    });

    expect(screen.getByText('Items in this collection (1)')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Tent from tag' }));
    expect(onRemoveItem).toHaveBeenCalledWith('i1');
    await fireEvent.click(screen.getByRole('button', { name: 'Add Stove to tag' }));
    expect(onAddItem).toHaveBeenCalledWith('i2');
  });

  it('explains empty lists', () => {
    render(TagDetails, {
      props: {
        tag,
        tagItems: [],
        availableItems: [],
        onRename: vi.fn(),
        onDelete: vi.fn(),
        onAddItem: vi.fn(),
        onRemoveItem: vi.fn()
      }
    });
    expect(screen.getByText(/No items in this tag yet/)).toBeInTheDocument();
    expect(screen.getByText('All your items are already in this collection!')).toBeInTheDocument();
  });
});

describe('CreateTagForm', () => {
  it('disables Create until a name is typed', async () => {
    const onCreate = vi.fn();
    render(CreateTagForm, { props: { name: '', onCreate, onCancel: vi.fn() } });

    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    await fireEvent.input(screen.getByPlaceholderText(/Tag name/), { target: { value: 'Party' } });
    expect(create).toBeEnabled();
    await fireEvent.click(create);
    expect(onCreate).toHaveBeenCalled();
  });
});
