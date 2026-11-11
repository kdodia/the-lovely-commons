/**
 * Tags: user-made collections of items (many-to-many by item id).
 *
 * - create: the tag is stored as given; its `createdBy` is not checked.
 * - update (e.g. rename) and adding/removing items: not restricted to the
 *   creator. An item is never listed twice in one tag. Item visibility is
 *   not checked when adding.
 * - delete: only the tag's creator.
 * Deleting an item removes it from every tag (see items.ts).
 */
import type { AppState, Tag } from '../types';
import { accept, reject, type Transition } from './transition';
import { patchById } from './lists';

export function createTag(state: AppState, tag: Tag): AppState {
  return {
    ...state,
    tags: [...state.tags, tag]
  };
}

export function updateTag(state: AppState, tagId: string, updates: Partial<Tag>): AppState {
  return {
    ...state,
    tags: patchById(state.tags, tagId, updates)
  };
}

export function deleteTag(state: AppState, tagId: string): Transition {
  const tag = state.tags.find((t) => t.id === tagId);
  if (!tag) return reject(state, 'Tag not found');
  if (tag.createdBy !== state.currentUserId) {
    return reject(state, 'Only the tag\'s creator can delete it');
  }
  return accept({ ...state, tags: state.tags.filter((t) => t.id !== tagId) });
}

export function addItemToTag(state: AppState, tagId: string, itemId: string): AppState {
  return {
    ...state,
    tags: state.tags.map((tag) =>
      tag.id === tagId && !tag.itemIds.includes(itemId)
        ? { ...tag, itemIds: [...tag.itemIds, itemId] }
        : tag
    )
  };
}

export function removeItemFromTag(state: AppState, tagId: string, itemId: string): AppState {
  return {
    ...state,
    tags: patchById(state.tags, tagId, (tag) => ({
      ...tag,
      itemIds: tag.itemIds.filter((id) => id !== itemId)
    }))
  };
}
