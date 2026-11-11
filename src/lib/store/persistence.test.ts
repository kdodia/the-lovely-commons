import { describe, it, expect, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

describe('loadState resilience', () => {
	const STORAGE_KEY = 'distributed-library-app-state';

	afterEach(() => {
		localStorage.removeItem(STORAGE_KEY);
		vi.resetModules();
	});

	it('merges legacy stored state missing newer collections', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ currentUserId: 'user1', users: [], items: [] })
		);
		vi.resetModules();
		const mod = await import('./index');

		const state = get(mod.appStore);
		// Older schemas without wishlist/notifications used to crash on load
		expect(Array.isArray(state.wishlist)).toBe(true);
		expect(Array.isArray(state.notifications)).toBe(true);
	});

	it('migrates legacy lender-written reviews and requests without handoff arrays', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				currentUserId: 'user1',
				users: [{ id: 'user1', name: 'Legacy', email: '', profilePic: '', bio: '', friendIds: [], closeFriendIds: [], rating: 5, totalBorrows: 0, totalLends: 0 }],
				items: [],
				borrowRequests: [
					{ id: 'r1', itemId: 'i1', borrowerId: 'user1', lenderId: 'user2', startDate: '2024-01-01', endDate: '2024-01-02', status: 'approved', createdAt: '2024-01-01T00:00:00Z' }
				],
				borrowHistory: [
					{ id: 'h1', itemId: 'i1', borrowerId: 'user1', lenderId: 'user2', startDate: '2024-01-01', endDate: '2024-01-02', rating: 4, review: 'Returned on time' },
					{ id: 'h2', itemId: 'i1', borrowerId: 'user1', lenderId: 'user2', startDate: '2024-02-01', endDate: '2024-02-02', rating: 5, review: 'Loved it', reviewerId: 'user1' }
				]
			})
		);
		vi.resetModules();
		const mod = await import('./index');

		const state = get(mod.appStore);
		expect(state.borrowRequests[0].pickupConfirmedBy).toEqual([]);
		expect(state.borrowRequests[0].returnConfirmedBy).toEqual([]);

		const legacy = state.borrowHistory.find((h) => h.id === 'h1');
		expect(legacy?.rating).toBeUndefined();
		expect(legacy?.review).toBeUndefined();
		expect(legacy?.borrowerRating).toBe(4);
		expect(legacy?.borrowerReview).toBe('Returned on time');

		const modern = state.borrowHistory.find((h) => h.id === 'h2');
		expect(modern?.rating).toBe(5);
		expect(modern?.reviewerId).toBe('user1');
	});

	it('falls back to defaults on corrupt JSON', async () => {
		localStorage.setItem(STORAGE_KEY, '{definitely not json');
		vi.resetModules();
		const mod = await import('./index');

		const state = get(mod.appStore);
		expect(state.users.length).toBeGreaterThan(0);
		expect(state.currentUserId).toBe('user1');
	});
});
