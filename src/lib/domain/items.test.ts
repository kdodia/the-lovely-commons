import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	getCategoryPath
} from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('getCategoryPath', () => {
	it('returns path for top-level category', () => {
		const state = createTestState();
		const path = getCategoryPath('cat1', state);
		expect(path).toEqual(['Kitchen']);
	});

	it('returns path for nested category', () => {
		const state = createTestState();
		const path = getCategoryPath('cat1-1', state);
		expect(path).toEqual(['Kitchen', 'Small Appliances']);
	});

	it('returns path for deeply nested category', () => {
		const state = createTestState();
		const path = getCategoryPath('cat1-1-1', state);
		expect(path).toEqual(['Kitchen', 'Small Appliances', 'Coffee Makers']);
	});

	it('returns empty array for non-existent category', () => {
		const state = createTestState();
		const path = getCategoryPath('non-existent', state);
		expect(path).toEqual([]);
	});
});

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('addItem', () => {
		it('adds a new item to the store', () => {
			const newItem = createTestItem({ id: 'new-item', name: 'New Item' });
			appStore.addItem(newItem);
			const state = get(appStore);
			expect(state.items).toHaveLength(1);
			expect(state.items[0].name).toBe('New Item');
		});
	});

	describe('updateItem', () => {
		it('updates an existing item', () => {
			const item = createTestItem();
			appStore.replaceState(createTestState({ items: [item] }));

			appStore.updateItem('item1', { name: 'Updated Name', condition: 'excellent' });

			const state = get(appStore);
			expect(state.items[0].name).toBe('Updated Name');
			expect(state.items[0].condition).toBe('excellent');
		});

		it('does not affect other items', () => {
			const item1 = createTestItem({ id: 'item1', name: 'Item 1' });
			const item2 = createTestItem({ id: 'item2', name: 'Item 2' });
			appStore.replaceState(createTestState({ items: [item1, item2] }));

			appStore.updateItem('item1', { name: 'Updated' });

			const state = get(appStore);
			expect(state.items[1].name).toBe('Item 2');
		});
	});

	describe('deleteItem', () => {
		it('removes an item the current user owns', () => {
			const item = createTestItem({ lenderId: 'user1' });
			appStore.replaceState(createTestState({ items: [item] }));

			expect(appStore.deleteItem('item1')).toEqual({ ok: true });
			expect(get(appStore).items).toHaveLength(0);
		});

		it('refuses to delete someone else\'s item', () => {
			appStore.replaceState(createTestState({ items: [createTestItem({ lenderId: 'user2' })] }));

			const result = appStore.deleteItem('item1');
			expect(result.ok).toBe(false);
			expect(get(appStore).items).toHaveLength(1);
		});

		it('returns an error for an unknown item', () => {
			expect(appStore.deleteItem('nope').ok).toBe(false);
		});
	});
});

describe('getCategoryPath cycle guard', () => {
	it('terminates on cyclic parentId chains', () => {
		const state = createTestState({
			categories: [
				{ id: 'catA', name: 'A', parentId: 'catB' },
				{ id: 'catB', name: 'B', parentId: 'catA' }
			]
		});

		// Before the fix this looped forever
		const path = getCategoryPath('catA', state);
		expect(path).toEqual(['B', 'A']);
	});
});

describe('item deletion cleanup', () => {
	function stateWithItem(requests: BorrowRequest[] = []) {
		return createTestState({
			items: [createTestItem({ lenderId: 'user1' })],
			tags: [{ id: 'tag1', name: 'Kitchen', createdBy: 'user1', itemIds: ['item1', 'other'] }],
			wishlist: [
				{ id: 'w1', userId: 'user2', itemId: 'item1', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' },
				{ id: 'w2', userId: 'user2', itemId: 'other', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' }
			],
			borrowRequests: requests
		});
	}

	it('is blocked while the item is reserved or on loan', () => {
		for (const status of ['approved', 'active'] as const) {
			appStore.replaceState(
				stateWithItem([createLifecycleRequest({ borrowerId: 'user2', lenderId: 'user1', status })])
			);
			const result = appStore.deleteItem('item1');
			expect(result.ok).toBe(false);
			expect(get(appStore).items).toHaveLength(1);
		}
	});

	it('scrubs the item from tags and wishlists', () => {
		appStore.replaceState(stateWithItem());
		expect(appStore.deleteItem('item1').ok).toBe(true);

		const state = get(appStore);
		expect(state.tags[0].itemIds).toEqual(['other']);
		expect(state.wishlist.map((w) => w.id)).toEqual(['w2']);
	});

	it('declines outstanding pending requests and tells each requester', () => {
		appStore.replaceState(
			stateWithItem([
				createLifecycleRequest({ id: 'p1', borrowerId: 'user2', lenderId: 'user1' }),
				createLifecycleRequest({ id: 'p2', borrowerId: 'user3', lenderId: 'user1', startDate: '2030-03-01', endDate: '2030-03-02' }),
				createLifecycleRequest({ id: 'done', borrowerId: 'user3', lenderId: 'user1', status: 'completed' })
			])
		);
		expect(appStore.deleteItem('item1').ok).toBe(true);

		const state = get(appStore);
		expect(state.borrowRequests.find((r) => r.id === 'p1')?.status).toBe('denied');
		expect(state.borrowRequests.find((r) => r.id === 'p2')?.status).toBe('denied');
		expect(state.borrowRequests.find((r) => r.id === 'done')?.status).toBe('completed');
		const denials = state.notifications.filter((n) => n.type === 'request-denied');
		expect(denials.map((n) => n.userId).sort()).toEqual(['user2', 'user3']);
	});
});
