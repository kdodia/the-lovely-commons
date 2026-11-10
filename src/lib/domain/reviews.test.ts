import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	pendingItemReviews,
	getBorrowerFeedback
} from '$lib/store';
import type { BorrowHistory } from '$lib/types';
import { createTestState, createTestItem } from '../../test/fixtures';

describe('submitItemReview', () => {
	const completed: BorrowHistory = {
		id: 'hist1',
		itemId: 'item1',
		borrowerId: 'user1',
		lenderId: 'user2',
		startDate: '2024-01-01',
		endDate: '2024-01-03',
		borrowerRating: 5
	};

	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', rating: 4.0 })],
				borrowHistory: [completed]
			})
		);
	});

	it('lets the borrower review once and recomputes the item rating from borrower reviews', () => {
		expect(pendingItemReviews(get(appStore), 'item1', 'user1')).toHaveLength(1);

		expect(appStore.submitItemReview('hist1', 3, '  Works, but loud.  ')).toEqual({ ok: true });

		const state = get(appStore);
		const entry = state.borrowHistory[0];
		expect(entry.rating).toBe(3);
		expect(entry.review).toBe('Works, but loud.');
		expect(entry.reviewerId).toBe('user1');
		expect(entry.reviewedAt).toBeTruthy();
		// The lender's rating of the borrower is untouched
		expect(entry.borrowerRating).toBe(5);
		// Item rating now comes from borrower reviews only
		expect(state.items[0].rating).toBe(3);
		expect(pendingItemReviews(state, 'item1', 'user1')).toHaveLength(0);

		// Second attempt is refused
		expect(appStore.submitItemReview('hist1', 5, 'changed my mind').ok).toBe(false);
		expect(get(appStore).borrowHistory[0].rating).toBe(3);
	});

	it('averages across multiple borrower reviews', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', rating: 4.0 })],
				borrowHistory: [
					{ ...completed, id: 'h-old', rating: 5, review: 'great', reviewerId: 'user3', borrowerId: 'user3' },
					completed
				]
			})
		);
		appStore.submitItemReview('hist1', 4, '');
		expect(get(appStore).items[0].rating).toBe(4.5);
	});

	it('rejects anyone but the borrower', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.submitItemReview('hist1', 5, 'nice').ok).toBe(false);
		expect(get(appStore).borrowHistory[0].reviewerId).toBeUndefined();
	});

	it('rejects invalid ratings and unknown borrows', () => {
		expect(appStore.submitItemReview('hist1', 0, '').ok).toBe(false);
		expect(appStore.submitItemReview('hist1', 6, '').ok).toBe(false);
		expect(appStore.submitItemReview('missing', 5, '').ok).toBe(false);
	});

	it('notifies the lender', () => {
		appStore.submitItemReview('hist1', 4, 'Solid.');
		const notes = get(appStore).notifications.filter((n) => n.type === 'item-reviewed');
		expect(notes).toHaveLength(1);
		expect(notes[0].userId).toBe('user2');
		expect(notes[0].relatedId).toBe('item1');
	});
});

describe('borrower feedback', () => {
	describe('getBorrowerFeedback', () => {
		const hist = (id: string, over: Partial<BorrowHistory>): BorrowHistory => ({
			id,
			itemId: 'gone-item',
			borrowerId: 'user3',
			lenderId: 'gone-lender',
			startDate: '2025-01-01',
			endDate: '2025-01-05',
			...over
		});

		it('returns only feedback about the user as borrower, newest first', () => {
			const state = createTestState({
				borrowHistory: [
					hist('old', { borrowerRating: 4, endDate: '2025-01-05' }),
					hist('new', { borrowerReview: 'Great', endDate: '2025-03-05' }),
					hist('none', { endDate: '2025-04-05' }),
					hist('blank', { borrowerReview: '  ', endDate: '2025-04-06' }),
					hist('as-lender', { borrowerId: 'user1', lenderId: 'user3', borrowerRating: 5 }),
					hist('other', { borrowerId: 'user2', borrowerRating: 5 })
				]
			});
			expect(getBorrowerFeedback('user3', state).map((h) => h.id)).toEqual(['new', 'old']);
		});

		it('tolerates a missing item or lender', () => {
			const state = createTestState({ borrowHistory: [hist('h', { borrowerRating: 3 })] });
			expect(getBorrowerFeedback('user3', state)).toHaveLength(1);
		});
	});
});
