import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	currentUser,
	currentUserItems,
	incomingRequests,
	outgoingRequests,
	activeLoans,
	borrowedByMe,
	visibleItems
} from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('derived stores', () => {
	beforeEach(() => {
		const item1 = createTestItem({ id: 'item1', lenderId: 'user1' });
		const item2 = createTestItem({ id: 'item2', lenderId: 'user2', permissionLevel: 'friends' });
		const request1: BorrowRequest = {
			id: 'req1',
			itemId: 'item2',
			borrowerId: 'user1',
			lenderId: 'user2',
			startDate: '2024-01-15',
			endDate: '2024-01-20',
			status: 'pending',
			createdAt: new Date().toISOString()
		};
		const request2: BorrowRequest = {
			id: 'req2',
			itemId: 'item1',
			borrowerId: 'user2',
			lenderId: 'user1',
			startDate: '2024-01-15',
			endDate: '2024-01-20',
			status: 'active',
			createdAt: new Date().toISOString()
		};

		appStore.replaceState(createTestState({
			items: [item1, item2],
			borrowRequests: [request1, request2]
		}));
	});

	it('currentUser returns the logged-in user', () => {
		const user = get(currentUser);
		expect(user?.id).toBe('user1');
		expect(user?.name).toBe('Test User 1');
	});

	it('currentUserItems returns items owned by current user', () => {
		const items = get(currentUserItems);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe('item1');
	});

	it('incomingRequests returns pending requests to current user', () => {
		// user1 has no pending incoming requests in this setup
		// Let's update with a pending request TO user1
		appStore.replaceState(createTestState({
			items: [createTestItem({ id: 'item1', lenderId: 'user1' })],
			borrowRequests: [{
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user2',
				lenderId: 'user1',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			}]
		}));

		const requests = get(incomingRequests);
		expect(requests).toHaveLength(1);
	});

	it('outgoingRequests returns requests from current user', () => {
		const requests = get(outgoingRequests);
		expect(requests).toHaveLength(1);
		expect(requests[0].id).toBe('req1');
	});

	it('activeLoans returns active loans where user is lender', () => {
		const loans = get(activeLoans);
		expect(loans).toHaveLength(1);
		expect(loans[0].id).toBe('req2');
	});

	it('visibleItems filters based on permissions', () => {
		const items = get(visibleItems);
		// user1 can see both items (owns item1, is friends with user2 for item2)
		expect(items).toHaveLength(2);
	});
});

describe('borrowedByMe', () => {
	it('returns approved and active loans where the current user is the borrower', () => {
		appStore.replaceState(
			createTestState({
				borrowRequests: [
					createLifecycleRequest({ id: 'mine-approved', status: 'approved' }),
					createLifecycleRequest({ id: 'mine-active', status: 'active' }),
					createLifecycleRequest({ id: 'mine-pending', status: 'pending' }),
					createLifecycleRequest({ id: 'mine-done', status: 'completed' }),
					createLifecycleRequest({ id: 'theirs', status: 'active', borrowerId: 'user3', lenderId: 'user1' })
				]
			})
		);

		expect(get(borrowedByMe).map((r) => r.id).sort()).toEqual(['mine-active', 'mine-approved']);
		// and the lender-side stores don't leak the borrower's loans
		expect(get(activeLoans).map((r) => r.id)).toEqual(['theirs']);
	});
});
