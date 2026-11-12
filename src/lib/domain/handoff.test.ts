import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	hasConfirmed
} from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('confirmReturn', () => {
		function activeLoanState() {
			const item = createTestItem({ lenderId: 'user2', rating: 4.0 });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'active',
				pickupConfirmedBy: ['user1', 'user2'],
				createdAt: new Date().toISOString()
			};
			return createTestState({ items: [item], borrowRequests: [request] });
		}

		it('completes the borrow once both sides confirm and records the lender feedback', () => {
			appStore.replaceState(activeLoanState());

			appStore.setCurrentUser('user2');
			expect(appStore.confirmReturn('req1', { rating: 5, review: 'Great borrower!' })).toEqual({ ok: true });
			expect(get(appStore).borrowRequests[0].status).toBe('active');
			expect(get(appStore).borrowHistory).toHaveLength(0);

			appStore.setCurrentUser('user1');
			expect(appStore.confirmReturn('req1')).toEqual({ ok: true });

			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('completed');
			expect(state.borrowHistory).toHaveLength(1);
			expect(state.borrowHistory[0].borrowerRating).toBe(5);
			expect(state.borrowHistory[0].borrowerReview).toBe('Great borrower!');
			// No item review yet — that's the borrower's job
			expect(state.borrowHistory[0].rating).toBeUndefined();
			expect(state.borrowHistory[0].reviewerId).toBeUndefined();
			expect(state.items[0].available).toBe(true);
		});

		it('leaves the item rating alone until a borrower reviews it', () => {
			appStore.replaceState(activeLoanState());

			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 5 });
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1');

			expect(get(appStore).items[0].rating).toBe(4.0);
		});

		it('folds the lender rating into the borrower reputation', () => {
			appStore.replaceState(activeLoanState());
			// user1 starts at 4.5 over 10 borrows; one 5 → (45 + 5) / 11 ≈ 4.5, one 1 → 4.2
			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 1 });
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1');

			const borrower = get(appStore).users.find((u) => u.id === 'user1');
			expect(borrower?.rating).toBe(4.2);
			expect(borrower?.totalBorrows).toBe(11);
		});

		it('asks the borrower to review the item once the return completes', () => {
			appStore.replaceState(activeLoanState());
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1');
			expect(get(appStore).notifications.filter((n) => n.type === 'review-request')).toHaveLength(0);

			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 5 });

			const prompts = get(appStore).notifications.filter((n) => n.type === 'review-request');
			expect(prompts).toHaveLength(1);
			expect(prompts[0].userId).toBe('user1');
			expect(prompts[0].relatedId).toBe('item1');
		});

		it('keeps the lender feedback even when the lender confirms first', () => {
			appStore.replaceState(activeLoanState());
			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 3, condition: 'fair' });
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1', { rating: 5 }); // borrower's "feedback" is ignored

			const state = get(appStore);
			expect(state.borrowHistory[0].borrowerRating).toBe(3);
			expect(state.borrowHistory[0].conditionAfter).toBe('fair');
			expect(state.items[0].condition).toBe('fair');
		});
	});
});

describe('two-sided pickup', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				// Approved but not picked up: the item is still at home
				items: [createTestItem({ lenderId: 'user2', available: true })],
				borrowRequests: [createLifecycleRequest({ status: 'approved' })]
			})
		);
	});

	it('does not advance on a single confirmation', () => {
		expect(appStore.confirmPickup('req1')).toEqual({ ok: true });
		const request = get(appStore).borrowRequests[0];
		expect(request.status).toBe('approved');
		expect(request.pickupConfirmedBy).toEqual(['user1']);
		expect(hasConfirmed(request, 'pickup', 'user1')).toBe(true);
		expect(hasConfirmed(request, 'pickup', 'user2')).toBe(false);
	});

	it('nudges the other party after the first confirmation', () => {
		appStore.confirmPickup('req1');
		const notes = get(appStore).notifications.filter((n) => n.type === 'pickup-confirmed');
		expect(notes).toHaveLength(1);
		expect(notes[0].userId).toBe('user2');
		expect(notes[0].message).toContain('confirm on your side');
	});

	it('activates the loan once both parties confirm, in either order', () => {
		appStore.setCurrentUser('user2');
		appStore.confirmPickup('req1');
		appStore.setCurrentUser('user1');
		appStore.confirmPickup('req1');
		expect(get(appStore).borrowRequests[0].status).toBe('active');
	});

	it('marks the item out only when the second confirmation starts the loan', () => {
		appStore.confirmPickup('req1');
		expect(get(appStore).items[0].available).toBe(true);
		appStore.setCurrentUser('user2');
		appStore.confirmPickup('req1');
		expect(get(appStore).items[0].available).toBe(false);
	});

	it('rejects users who are not party to the loan', () => {
		appStore.setCurrentUser('user3');
		expect(appStore.confirmPickup('req1').ok).toBe(false);
		expect(get(appStore).borrowRequests[0].pickupConfirmedBy ?? []).toHaveLength(0);
	});

	it('rejects confirming twice from the same side', () => {
		expect(appStore.confirmPickup('req1').ok).toBe(true);
		expect(appStore.confirmPickup('req1').ok).toBe(false);
		expect(get(appStore).borrowRequests[0].pickupConfirmedBy).toEqual(['user1']);
	});

	it('rejects pickup on a request that is not approved', () => {
		appStore.replaceState(
			createTestState({ borrowRequests: [createLifecycleRequest({ status: 'pending' })] })
		);
		expect(appStore.confirmPickup('req1').ok).toBe(false);
	});

	it('treats legacy requests without confirmation arrays as unconfirmed', () => {
		const legacy = createLifecycleRequest({ status: 'approved' });
		delete legacy.pickupConfirmedBy;
		delete legacy.returnConfirmedBy;
		appStore.replaceState(createTestState({ borrowRequests: [legacy] }));

		expect(hasConfirmed(legacy, 'pickup', 'user1')).toBe(false);
		expect(appStore.confirmPickup('req1').ok).toBe(true);
		expect(get(appStore).borrowRequests[0].pickupConfirmedBy).toEqual(['user1']);
	});
});

describe('two-sided return', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ status: 'active', pickupConfirmedBy: ['user1', 'user2'] })]
			})
		);
	});

	it('does not complete on a single confirmation', () => {
		expect(appStore.confirmReturn('req1')).toEqual({ ok: true });
		const state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('active');
		expect(state.borrowHistory).toHaveLength(0);
		expect(state.items[0].available).toBe(false);
		const notes = state.notifications.filter((n) => n.type === 'return-confirmed');
		expect(notes.map((n) => n.userId)).toEqual(['user2']);
	});

	it('rejects non-parties and double confirmations', () => {
		appStore.setCurrentUser('user3');
		expect(appStore.confirmReturn('req1').ok).toBe(false);
		appStore.setCurrentUser('user1');
		expect(appStore.confirmReturn('req1').ok).toBe(true);
		expect(appStore.confirmReturn('req1').ok).toBe(false);
	});

	it('rejects a return on a loan that is not active', () => {
		appStore.replaceState(
			createTestState({ borrowRequests: [createLifecycleRequest({ status: 'approved' })] })
		);
		expect(appStore.confirmReturn('req1').ok).toBe(false);
	});

	it('rejects an out-of-range lender rating', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.confirmReturn('req1', { rating: 9 }).ok).toBe(false);
		expect(get(appStore).borrowRequests[0].returnConfirmedBy ?? []).toHaveLength(0);
	});
});
