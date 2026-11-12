import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BorrowAction from './BorrowAction.svelte';
import { appStore } from '$lib/store';
import type { AppState, BorrowRequest } from '$lib/types';
import { itemPageState, item } from './testFixtures';

function loan(overrides: Partial<BorrowRequest>): BorrowRequest {
	return {
		id: 'req1',
		itemId: 'item1',
		borrowerId: 'borrower',
		lenderId: 'lender',
		startDate: '2030-01-10',
		endDate: '2030-01-12',
		status: 'pending',
		createdAt: new Date().toISOString(),
		...overrides
	};
}

function renderFor(state: AppState) {
	appStore.replaceState(state);
	const current = state.items[0];
	render(BorrowAction, {
		props: {
			item: current,
			lender: state.users[0],
			startDate: '',
			endDate: '',
			showRequestForm: false,
			onToast: vi.fn()
		}
	});
}

describe('BorrowAction', () => {
	it('offers a request while the item is out on someone else’s loan', () => {
		const other = { ...itemPageState().users[1], id: 'other', name: 'Olly' };
		renderFor(
			itemPageState({
				users: [...itemPageState().users, other],
				items: [{ ...item, available: false }],
				borrowRequests: [loan({ borrowerId: 'other', status: 'active' })]
			})
		);
		expect(screen.getByRole('button', { name: 'Request to Borrow' })).toBeInTheDocument();
		expect(screen.getByText("It's out on loan right now, but you can ask for later dates.")).toBeInTheDocument();
	});

	it('shows the viewer’s pending request instead of the form', () => {
		renderFor(itemPageState({ borrowRequests: [loan({ status: 'pending' })] }));
		expect(screen.getByText('Request Sent')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Request to Borrow' })).not.toBeInTheDocument();
	});

	it('offers nothing to the owner', () => {
		renderFor({ ...itemPageState(), currentUserId: 'lender' });
		expect(screen.queryByRole('button', { name: 'Request to Borrow' })).not.toBeInTheDocument();
	});

	it('offers nothing to a borrower whose loan is already approved', () => {
		renderFor(itemPageState({ borrowRequests: [loan({ status: 'approved' })] }));
		expect(screen.queryByRole('button', { name: 'Request to Borrow' })).not.toBeInTheDocument();
	});
});
