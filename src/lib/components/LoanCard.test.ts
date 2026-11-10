import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

		expect(screen.getByText(/Overdue by/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Return' }));
		expect(onConfirmReturn).toHaveBeenCalledWith('req1');
	});

	describe('overdue loans', () => {
		// Today is Jan 15 2030; request() ends Jan 12.
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date(2030, 0, 15, 12, 0, 0));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('shows how late the item is and offers the lender a reminder', async () => {
			const onSendReminder = vi.fn();
			render(LoanCard, {
				props: { request: request({ status: 'active' }), perspective: 'lender', onSendReminder }
			});

			expect(screen.getByText('Overdue by 3 days')).toBeInTheDocument();
			expect(screen.queryByText('On loan', { exact: false })).not.toBeInTheDocument();
			await fireEvent.click(screen.getByRole('button', { name: /Send reminder/ }));
			expect(onSendReminder).toHaveBeenCalledWith('req1');
		});

		it('uses the singular for one day', () => {
			render(LoanCard, {
				props: {
					request: request({ status: 'active', endDate: '2030-01-14' }),
					perspective: 'lender',
					onSendReminder: vi.fn()
				}
			});
			expect(screen.getByText('Overdue by 1 day')).toBeInTheDocument();
		});

		it('is not overdue on the due date itself', () => {
			render(LoanCard, {
				props: {
					request: request({ status: 'active', endDate: '2030-01-15' }),
					perspective: 'lender',
					onSendReminder: vi.fn()
				}
			});
			expect(screen.getByText('On loan', { exact: false })).toBeInTheDocument();
			expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Send reminder/ })).not.toBeInTheDocument();
		});

		it('replaces the reminder button with a note during the cooldown', () => {
			render(LoanCard, {
				props: {
					request: request({
						status: 'active',
						lastRemindedAt: new Date(2030, 0, 14, 9, 0, 0).toISOString()
					}),
					perspective: 'lender',
					onSendReminder: vi.fn()
				}
			});

			expect(screen.queryByRole('button', { name: /Send reminder/ })).not.toBeInTheDocument();
			expect(screen.getByText(/Reminder sent Jan 14 — you can\s+send another on Jan 16/)).toBeInTheDocument();
		});

		it('offers the reminder again once the cooldown has passed', () => {
			render(LoanCard, {
				props: {
					request: request({
						status: 'active',
						lastRemindedAt: new Date(2030, 0, 13, 9, 0, 0).toISOString()
					}),
					perspective: 'lender',
					onSendReminder: vi.fn()
				}
			});
			expect(screen.getByRole('button', { name: /Send reminder/ })).toBeInTheDocument();
		});

		it('asks the borrower to return it, without a reminder button', () => {
			appStore.replaceState(baseState({ currentUserId: 'borrower' }));
			render(LoanCard, {
				props: {
					request: request({ status: 'active' }),
					perspective: 'borrower',
					onConfirmReturn: vi.fn(),
					onSendReminder: vi.fn()
				}
			});

			expect(screen.getByText('Overdue by 3 days')).toBeInTheDocument();
			expect(screen.getByText(/please\s+return it to Lena Lender/)).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Send reminder/ })).not.toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Confirm Return' })).toBeInTheDocument();
		});
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
