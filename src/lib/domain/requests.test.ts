import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { createTestState, createTestItem, createLifecycleRequest, confirmBothSides } from '../../test/fixtures';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('createBorrowRequest', () => {
		it('creates a borrow request and notification', () => {
			const item = createTestItem({ lenderId: 'user2' });
			appStore.replaceState(createTestState({ items: [item] }));

			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};

			appStore.createBorrowRequest(request);

			const state = get(appStore);
			expect(state.borrowRequests).toHaveLength(1);
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('borrow-request');
			expect(state.notifications[0].userId).toBe('user2');
		});
	});

	describe('approveRequest / denyRequest', () => {
		it('approves a pending request, reserves the item, and notifies the borrower', () => {
			const item = createTestItem({ lenderId: 'user2' });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			const result = appStore.approveRequest('req1');

			expect(result.ok).toBe(true);
			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('approved');
			expect(state.items[0].available).toBe(false);
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('request-approved');
			expect(state.notifications[0].userId).toBe('user1');
		});

		it('creates notification on denial', () => {
			const item = createTestItem({ lenderId: 'user2' });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			const result = appStore.denyRequest('req1');

			expect(result.ok).toBe(true);
			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('denied');
			expect(state.notifications[0].type).toBe('request-denied');
		});
	});

	describe('nudgeRequest', () => {
		it('sends nudge and creates notification', () => {
			const item = createTestItem({ lenderId: 'user2' });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			appStore.nudgeRequest('req1');

			const state = get(appStore);
			expect(state.borrowRequests[0].lastNudgedAt).toBeDefined();
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('request-nudge');
		});
	});
});

describe('borrow lifecycle', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2' })],
				borrowRequests: [createLifecycleRequest()]
			})
		);
	});

	it('drives a request through pending → approved → active → completed', () => {
		expect(appStore.approveRequest('req1').ok).toBe(true);
		let state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('approved');
		expect(state.items[0].available).toBe(false);

		expect(confirmBothSides('pickup', 'req1').ok).toBe(true);
		state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('active');

		expect(confirmBothSides('return', 'req1', { rating: 5, review: 'Great!' }).ok).toBe(true);
		state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('completed');
		expect(state.items[0].available).toBe(true);
		expect(state.borrowHistory).toHaveLength(1);
	});

	it('rejects approving a request that overlaps an approved loan', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [
					createLifecycleRequest({ id: 'req-existing', status: 'approved', borrowerId: 'user3' }),
					createLifecycleRequest({ id: 'req-new', startDate: '2030-01-11', endDate: '2030-01-14' })
				]
			})
		);

		const result = appStore.approveRequest('req-new');
		expect(result.ok).toBe(false);
		expect(get(appStore).borrowRequests.find((r) => r.id === 'req-new')?.status).toBe('pending');
	});

	it('rejects approving a request that overlaps blocked dates', () => {
		appStore.replaceState(
			createTestState({
				items: [
					createTestItem({
						lenderId: 'user2',
						blockedDates: [{ startDate: '2030-01-11', endDate: '2030-01-11' }]
					})
				],
				borrowRequests: [createLifecycleRequest()]
			})
		);

		expect(appStore.approveRequest('req1').ok).toBe(false);
	});

	it('rejects approving a request twice', () => {
		expect(appStore.approveRequest('req1').ok).toBe(true);
		const notificationsAfterFirst = get(appStore).notifications.length;

		expect(appStore.approveRequest('req1').ok).toBe(false);
		expect(get(appStore).notifications).toHaveLength(notificationsAfterFirst);
	});

	it('keeps the item unavailable when another loan is still outstanding', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [
					createLifecycleRequest({ id: 'req-a', status: 'active' }),
					createLifecycleRequest({
						id: 'req-b',
						status: 'approved',
						borrowerId: 'user3',
						startDate: '2030-02-01',
						endDate: '2030-02-03'
					})
				]
			})
		);

		expect(confirmBothSides('return', 'req-a').ok).toBe(true);
		expect(get(appStore).items[0].available).toBe(false);
	});

	it('increments borrow/lend counters on completion', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', totalBorrows: 5 })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })]
			})
		);

		confirmBothSides('return', 'req1');
		const state = get(appStore);
		expect(state.items[0].totalBorrows).toBe(6);
		expect(state.users.find((u) => u.id === 'user1')?.totalBorrows).toBe(11);
		expect(state.users.find((u) => u.id === 'user2')?.totalLends).toBe(21);
	});

	it('createBorrowRequest rejects ranges conflicting with existing loans', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ id: 'req-existing', status: 'active' })]
			})
		);

		const result = appStore.createBorrowRequest(
			createLifecycleRequest({ id: 'req-clash', startDate: '2030-01-12', endDate: '2030-01-15' })
		);
		expect(result.ok).toBe(false);
		expect(get(appStore).borrowRequests).toHaveLength(1);
	});
});

describe('cancelRequest', () => {
	it('lets the borrower cancel a pending request and tells the lender', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [createLifecycleRequest()]
		}));
		expect(appStore.cancelRequest('req1')).toEqual({ ok: true });
		const state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('cancelled');
		expect(state.notifications.filter((n) => n.type === 'request-cancelled').map((n) => n.userId)).toEqual(['user2']);
	});

	it('releases the item when an approved reservation is cancelled', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2', available: false })],
			borrowRequests: [createLifecycleRequest({ status: 'approved' })],
			wishlist: [{ id: 'w1', userId: 'user3', itemId: 'item1', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' }]
		}));
		// lender retracts
		appStore.setCurrentUser('user2');
		expect(appStore.cancelRequest('req1').ok).toBe(true);
		const state = get(appStore);
		expect(state.items[0].available).toBe(true);
		expect(state.notifications.filter((n) => n.type === 'wishlist-available').map((n) => n.userId)).toEqual(['user3']);
	});

	it('refuses lenders on pending requests, non-parties, and active loans', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [
				createLifecycleRequest({ id: 'pending' }),
				createLifecycleRequest({ id: 'active', status: 'active' })
			]
		}));
		appStore.setCurrentUser('user2');
		expect(appStore.cancelRequest('pending').ok).toBe(false);
		appStore.setCurrentUser('user3');
		expect(appStore.cancelRequest('pending').ok).toBe(false);
		appStore.setCurrentUser('user1');
		expect(appStore.cancelRequest('active').ok).toBe(false);
		expect(get(appStore).borrowRequests.every((r) => r.status !== 'cancelled')).toBe(true);
	});
});
