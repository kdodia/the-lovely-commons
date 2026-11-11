import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ReviewForm from './ReviewForm.svelte';
import { appStore } from '$lib/store';
import { itemPageState, item } from './testFixtures';
import type { BorrowHistory } from '$lib/types';

function borrow(overrides: Partial<BorrowHistory> = {}): BorrowHistory {
	return {
		id: 'hist1',
		itemId: 'item1',
		borrowerId: 'borrower',
		lenderId: 'lender',
		startDate: '2030-01-10',
		endDate: '2030-01-12',
		actualReturnDate: '2030-01-12',
		...overrides
	};
}

describe('ReviewForm', () => {
	beforeEach(() => {
		appStore.replaceState(itemPageState({ borrowHistory: [borrow()] }));
	});

	it('invites a review of a finished borrow', () => {
		render(ReviewForm, { props: { item, onToast: vi.fn() } });

		expect(screen.getByRole('heading', { name: 'How was the Stand Mixer?' })).toBeInTheDocument();
		expect(screen.getByText(/You borrowed it 1\/10\/2030 – 1\/12\/2030/)).toBeInTheDocument();
	});

	it('renders nothing when there is nothing to review', () => {
		appStore.replaceState(itemPageState({ borrowHistory: [borrow({ reviewerId: 'borrower', rating: 4 })] }));
		render(ReviewForm, { props: { item, onToast: vi.fn() } });
		expect(screen.queryByRole('heading')).not.toBeInTheDocument();
	});

	it('renders nothing for someone who did not borrow it', () => {
		appStore.replaceState(itemPageState({ currentUserId: 'lender', borrowHistory: [borrow()] }));
		render(ReviewForm, { props: { item, onToast: vi.fn() } });
		expect(screen.queryByRole('heading')).not.toBeInTheDocument();
	});

	it('saves the chosen rating and text, then the prompt goes away', async () => {
		const onToast = vi.fn();
		render(ReviewForm, { props: { item, onToast } });

		await fireEvent.click(screen.getByRole('radio', { name: 'Rate 4 out of 5 stars' }));
		await fireEvent.input(screen.getByLabelText('Review (optional)'), { target: { value: 'Great mixer' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

		expect(get(appStore).borrowHistory[0]).toMatchObject({
			rating: 4,
			review: 'Great mixer',
			reviewerId: 'borrower'
		});
		expect(onToast).toHaveBeenCalledWith('Thanks for your review!', 'success');
		expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
	});

	it('starts from the default rating', async () => {
		render(ReviewForm, { props: { item, onToast: vi.fn() } });
		await fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

		expect(get(appStore).borrowHistory[0].rating).toBe(5);
	});
});
