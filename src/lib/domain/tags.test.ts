import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import type { Tag } from '$lib/types';
import { createTestState } from '../../test/fixtures';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('tag actions', () => {
		it('creates a new tag', () => {
			appStore.createTag({
				id: 'tag1',
				name: 'My Tag',
				createdBy: 'user1',
				itemIds: []
			});

			const state = get(appStore);
			expect(state.tags).toHaveLength(1);
			expect(state.tags[0].name).toBe('My Tag');
		});

		it('adds item to tag', () => {
			appStore.replaceState(createTestState({
				tags: [{ id: 'tag1', name: 'Test Tag', createdBy: 'user1', itemIds: [] }]
			}));

			appStore.addItemToTag('tag1', 'item1');

			const state = get(appStore);
			expect(state.tags[0].itemIds).toContain('item1');
		});

		it('removes item from tag', () => {
			appStore.replaceState(createTestState({
				tags: [{ id: 'tag1', name: 'Test Tag', createdBy: 'user1', itemIds: ['item1', 'item2'] }]
			}));

			appStore.removeItemFromTag('tag1', 'item1');

			const state = get(appStore);
			expect(state.tags[0].itemIds).not.toContain('item1');
			expect(state.tags[0].itemIds).toContain('item2');
		});

		it('does not add duplicate items to tag', () => {
			appStore.replaceState(createTestState({
				tags: [{ id: 'tag1', name: 'Test Tag', createdBy: 'user1', itemIds: ['item1'] }]
			}));

			appStore.addItemToTag('tag1', 'item1');

			const state = get(appStore);
			expect(state.tags[0].itemIds).toHaveLength(1);
		});
	});
});

describe('tag management', () => {
	const tag: Tag = { id: 'tag1', name: 'Old Name', createdBy: 'user1', itemIds: ['item1'] };

	beforeEach(() => {
		appStore.replaceState(createTestState({ tags: [tag] }));
	});

	it('renames a tag', () => {
		appStore.updateTag('tag1', { name: 'New Name' });
		expect(get(appStore).tags[0].name).toBe('New Name');
		expect(get(appStore).tags[0].itemIds).toEqual(['item1']);
	});

	it('deletes a tag the current user created', () => {
		expect(appStore.deleteTag('tag1')).toEqual({ ok: true });
		expect(get(appStore).tags).toHaveLength(0);
	});

	it('refuses to delete another user\'s tag', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.deleteTag('tag1').ok).toBe(false);
		expect(get(appStore).tags).toHaveLength(1);
	});

	it('reports an unknown tag', () => {
		expect(appStore.deleteTag('missing').ok).toBe(false);
	});
});
