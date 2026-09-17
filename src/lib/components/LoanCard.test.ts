import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LoanCard from './LoanCard.svelte';
import { appStore } from '$lib/store';
import type { AppState, BorrowRequest } from '$lib/types';

function baseState(overrides: Partial<AppState> = {}): AppState {
	return {
		currentUserId: 'lender',
		users: [
			{
				id: 'lender',
				name: 'Lena Lender',
				email: 'l@example.com',
				profilePic: '',
				bio: '',
				friendIds: ['borrower'],
				closeFriendIds: [],
				rating: 5,
				totalBorrows: 0,
				totalLends: 0
			},
			{
				id: 'borrower',
				name: 'Bo Borrower',
				email: 'b@example.com',
				profilePic: '',
				bio: '',
				friendIds: ['lender'],
				closeFriendIds: [],
				rating: 5,
				totalBorrows: 0,
				totalLends: 0
			}
		],
		items: [
			{
				id: 'item1',
				name: 'Stand Mixer',
				description: '',
				categoryId: 'c',
				lenderId: 'lender',
				imageUrl: '',
				condition: 'good',
				permissionLevel: 'friends',
				tagIds: [],
				rating: 5,
				totalBorrows: 0,
				available: false,
				createdAt: '2024-01-01T00:00:00Z'
			}
		],
		categories: [],
		tags: [],
		borrowRequests: [],
		borrowHistory: [],
		friendRequests: [],
		notifications: [],
		wishlist: [],
		...overrides
	};
}

function request(overrides: Partial<BorrowRequest> = {}): BorrowRequest {
	return {
		id: 'req1',
		itemId: 'item1',
		borrowerId: 'borrower',
		lenderId: 'lender',
		startDate: '2030-01-10',
		endDate: '2030-01-12',
		status: 'approved',
		createdAt: '2030-01-01T00:00:00Z',
		...overrides
	};
}

describe('LoanCard', () => {
	beforeEach(() => {
		appStore.replaceState(baseState());
	});

	it('offers pickup confirmation on an approved loan nobody has confirmed', async () => {
		const onConfirmPickup = vi.fn();
		render(LoanCard, { props: { request: request(), perspective: 'lender', onConfirmPickup } });

		expect(screen.getByText('Awaiting pickup', { exact: false })).toBeInTheDocument();
		expect(screen.getByText('Reserved for')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Pickup' }));
		expect(onConfirmPickup).toHaveBeenCalledWith('req1');
	});

	it('shows a waiting state once the current user has confirmed', () => {
		render(LoanCard, {
			props: {
				request: request({ pickupConfirmedBy: ['lender'] }),
				perspective: 'lender',
				onConfirmPickup: vi.fn()
			}
		});

		expect(screen.queryByRole('button', { name: 'Confirm Pickup' })).not.toBeInTheDocument();
		expect(screen.getByText(/waiting for Bo Borrower/)).toBeInTheDocument();
	});

	it('prompts the current user when the other party already confirmed', () => {
		appStore.replaceState(baseState({ currentUserId: 'borrower' }));
		render(LoanCard, {
			props: {
				request: request({ pickupConfirmedBy: ['lender'] }),
				perspective: 'borrower',
				onConfirmPickup: vi.fn()
			}
		});

		expect(screen.getByText(/Lena Lender confirmed the pickup/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Confirm Pickup' })).toBeInTheDocument();
		expect(screen.getByText('Pick up from')).toBeInTheDocument();
	});

	it('switches to return confirmation and flags overdue active loans', async () => {
		const onConfirmReturn = vi.fn();
		render(LoanCard, {
			props: {
				request: request({ status: 'active', endDate: '2000-01-01' }),
				perspective: 'lender',
				onConfirmReturn
			}
		});

		expect(screen.getByText(/overdue/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Return' }));
		expect(onConfirmReturn).toHaveBeenCalledWith('req1');
	});

	it('only offers cancellation while the loan is still awaiting pickup', () => {
		const onCancel = vi.fn();
		const { unmount } = render(LoanCard, {
			props: { request: request(), perspective: 'borrower', onCancel }
		});
		expect(screen.getByRole('button', { name: 'Cancel Request' })).toBeInTheDocument();
		unmount();

		render(LoanCard, {
			props: { request: request({ status: 'active' }), perspective: 'borrower', onCancel }
		});
		expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
	});
});
