import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import RequestThread from './RequestThread.svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { appStore, unreadMessageCount } from '$lib/store';
import { REQUEST_MESSAGE_MAX_LENGTH } from '$lib/constants';
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
		items: [],
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
		message: 'Could I borrow this for a party?',
		createdAt: '2030-01-01T09:00:00Z',
		messages: [
			{ id: 'm1', fromUserId: 'lender', text: 'Sure, pick up Friday?', at: '2030-01-01T10:00:00Z' },
			{ id: 'm2', fromUserId: 'borrower', text: 'Friday works', at: '2030-01-01T11:00:00Z' }
		],
		...overrides
	};
}

describe('RequestThread', () => {
	beforeEach(() => {
		appStore.replaceState(baseState());
	});

	it('is collapsed behind a toggle that counts the opening message too', async () => {
		render(RequestThread, { props: { request: request(), onSend: vi.fn() } });

		const toggle = screen.getByRole('button', { name: /Messages \(3\)/ });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByTestId('thread-message')).not.toBeInTheDocument();

		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getAllByTestId('thread-message')).toHaveLength(3);
	});

	it('renders the opening message first, then the thread in order', () => {
		render(RequestThread, { props: { request: request(), onSend: vi.fn(), open: true } });

		const texts = screen
			.getAllByTestId('thread-message')
			.map((li) => li.querySelector('.message-text')?.textContent);
		expect(texts).toEqual(['Could I borrow this for a party?', 'Sure, pick up Friday?', 'Friday works']);
	});

	it('labels the current user\'s messages "You" and the other person\'s by name', () => {
		render(RequestThread, { props: { request: request(), onSend: vi.fn(), open: true } });

		const [opening, mine, theirs] = screen.getAllByTestId('thread-message');
		expect(within(opening).getByText('Bo Borrower')).toBeInTheDocument();
		expect(opening).not.toHaveClass('mine');
		expect(within(mine).getByText('You')).toBeInTheDocument();
		expect(mine).toHaveClass('mine');
		expect(within(theirs).getByText('Bo Borrower')).toBeInTheDocument();
	});

	it('flips the labels for the other party', () => {
		appStore.replaceState(baseState({ currentUserId: 'borrower' }));
		render(RequestThread, { props: { request: request(), onSend: vi.fn(), open: true } });

		const [opening, lenders] = screen.getAllByTestId('thread-message');
		expect(within(opening).getByText('You')).toBeInTheDocument();
		expect(within(lenders).getByText('Lena Lender')).toBeInTheDocument();
	});

	it('disables Send until there is text, then sends and clears the draft', async () => {
		const onSend = vi.fn(() => true);
		render(RequestThread, { props: { request: request(), onSend, open: true } });

		const send = screen.getByRole('button', { name: 'Send' });
		expect(send).toBeDisabled();

		const input = screen.getByLabelText('Message Bo Borrower');
		await fireEvent.input(input, { target: { value: '   ' } });
		expect(send).toBeDisabled();

		await fireEvent.input(input, { target: { value: 'See you at 6' } });
		expect(send).toBeEnabled();
		await fireEvent.click(send);
		expect(onSend).toHaveBeenCalledWith('req1', 'See you at 6');
		expect(input).toHaveValue('');
	});

	it('sends on Enter but not on Shift+Enter, and keeps the draft if sending fails', async () => {
		const onSend = vi.fn(() => false);
		render(RequestThread, { props: { request: request(), onSend, open: true } });

		const input = screen.getByLabelText('Message Bo Borrower');
		await fireEvent.input(input, { target: { value: 'Running late' } });
		await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
		expect(onSend).not.toHaveBeenCalled();

		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onSend).toHaveBeenCalledWith('req1', 'Running late');
		expect(input).toHaveValue('Running late');
	});

	it('shows a character counter near the limit and blocks over-long drafts', async () => {
		render(RequestThread, { props: { request: request(), onSend: vi.fn(), open: true } });

		const input = screen.getByLabelText('Message Bo Borrower');
		await fireEvent.input(input, { target: { value: 'short' } });
		expect(screen.queryByText(`5/${REQUEST_MESSAGE_MAX_LENGTH}`)).not.toBeInTheDocument();

		await fireEvent.input(input, { target: { value: 'x'.repeat(REQUEST_MESSAGE_MAX_LENGTH + 1) } });
		expect(
			screen.getByText(`${REQUEST_MESSAGE_MAX_LENGTH + 1}/${REQUEST_MESSAGE_MAX_LENGTH}`)
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
	});

	it.each(['denied', 'cancelled', 'completed'] as const)(
		'is read-only without a compose box once %s',
		(status) => {
			render(RequestThread, { props: { request: request({ status }), onSend: vi.fn(), open: true } });

			expect(screen.getAllByTestId('thread-message')).toHaveLength(3);
			expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
			expect(screen.getByText(/read-only/)).toBeInTheDocument();
		}
	);

	it('is read-only when no send handler is given', () => {
		render(RequestThread, { props: { request: request(), open: true } });
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('offers to start a conversation when there are no messages yet', () => {
		render(RequestThread, {
			props: { request: request({ message: undefined, messages: undefined }), onSend: vi.fn() }
		});
		expect(screen.getByRole('button', { name: /Message Bo Borrower/ })).toBeInTheDocument();
	});

	it('renders nothing for a closed request with no messages', () => {
		render(RequestThread, {
			props: {
				request: request({ status: 'cancelled', message: undefined, messages: undefined }),
				onSend: vi.fn()
			}
		});
		expect(screen.queryByTestId('request-thread')).not.toBeInTheDocument();
	});
});

describe('RequestThread unread marker', () => {
	// The lender (current user) has not opened the thread yet.
	function setup(req: BorrowRequest) {
		appStore.replaceState(baseState({ borrowRequests: [req] }));
		return req;
	}

	it('shows how many messages are new on the collapsed toggle', () => {
		const req = setup(request({ messagesReadAt: { lender: '2030-01-01T10:30:00Z' } }));
		render(RequestThread, { props: { request: req, onSend: vi.fn() } });
		// Only the borrower's 11:00 reply is newer than the mark.
		expect(screen.getByTestId('unread-badge')).toHaveTextContent('1 new');
	});

	it('has no marker when everything is read', () => {
		const req = setup(request({ messagesReadAt: { lender: '2030-01-02T00:00:00Z' } }));
		render(RequestThread, { props: { request: req, onSend: vi.fn() } });
		expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
	});

	it('opening the thread marks it read in the store and drops the marker', async () => {
		const req = setup(request());
		render(RequestThread, { props: { request: req, onSend: vi.fn() } });
		expect(screen.getByTestId('unread-badge')).toHaveTextContent('1 new');

		await fireEvent.click(screen.getByRole('button', { name: /Messages/ }));
		const stored = get(appStore).borrowRequests[0];
		expect(stored.messagesReadAt?.lender).toBeTruthy();
		expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
	});

	it('marks a message that arrives while the thread is open as read', async () => {
		setup(request({ messagesReadAt: { lender: '2030-01-02T00:00:00Z' } }));
		const rendered = render(RequestThread, {
			props: { request: get(appStore).borrowRequests[0], onSend: vi.fn(), open: true }
		});
		appStore.replaceState({ ...get(appStore), currentUserId: 'borrower' });
		appStore.sendRequestMessage('req1', 'Any news?');
		appStore.replaceState({ ...get(appStore), currentUserId: 'lender' });
		await rendered.rerender({ request: get(appStore).borrowRequests[0] });
		await tick();
		expect(unreadMessageCount(get(appStore).borrowRequests[0], 'lender')).toBe(0);
	});
});
