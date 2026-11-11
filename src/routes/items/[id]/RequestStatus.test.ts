import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RequestStatus from './RequestStatus.svelte';
import { appStore } from '$lib/store';
import type { AppState, BorrowRequest } from '$lib/types';
import { get } from 'svelte/store';
import { itemPageState } from './testFixtures';

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
	return new Date(Date.now() - n * DAY).toISOString();
}

function request(overrides: Partial<BorrowRequest> = {}): BorrowRequest {
	return {
		id: 'req1',
		itemId: 'item1',
		borrowerId: 'borrower',
		lenderId: 'lender',
		startDate: '2030-01-10',
		endDate: '2030-01-12',
		status: 'pending',
		message: 'Please?',
		createdAt: daysAgo(0),
		...overrides
	};
}

function stateWith(req: BorrowRequest): AppState {
	return itemPageState({ borrowRequests: [req] });
}

function renderStatus(req: BorrowRequest) {
	appStore.replaceState(stateWith(req));
	const onToast = vi.fn();
	render(RequestStatus, { props: { request: req, lenderName: 'Lena Lender', onToast } });
	return { onToast };
}

describe('RequestStatus', () => {
	beforeEach(() => {
		appStore.replaceState(stateWith(request()));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('summarises the request and who it is waiting on', () => {
		renderStatus(request());

		expect(screen.getByText('Request Sent')).toBeInTheDocument();
		expect(screen.getByText('"Please?"')).toBeInTheDocument();
		expect(screen.getByText('Waiting for Lena Lender to respond to your request')).toBeInTheDocument();
	});

	it('leaves out the quoted message when there is none', () => {
		renderStatus(request({ message: undefined }));
		expect(screen.queryByText(/^"/)).not.toBeInTheDocument();
	});

	it('says how long until a reminder is allowed on a fresh request', () => {
		renderStatus(request({ createdAt: daysAgo(0) }));
		expect(screen.getByText(/Friendly reminder available in 3 days/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Send Friendly Reminder/ })).not.toBeInTheDocument();
	});

	it('names the day the reminder becomes available, counted in calendar days', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2030, 0, 10, 9, 0));
		// Made late the evening before: three calendar days on is Jan 12,
		// so two days from today.
		renderStatus(request({ createdAt: new Date(2030, 0, 9, 23, 30).toISOString() }));
		expect(screen.getByText('Friendly reminder available in 2 days (Jan 12)')).toBeInTheDocument();
	});

	it('offers the reminder on the day across a daylight-saving change', () => {
		vi.useFakeTimers();
		// NZ clocks go forward on 2030-09-29 (run with TZ=Pacific/Auckland);
		// counting elapsed time made this a day late.
		vi.setSystemTime(new Date(2030, 8, 30, 0, 10));
		renderStatus(request({ createdAt: new Date(2030, 8, 27, 0, 30).toISOString() }));
		expect(screen.getByRole('button', { name: /Send Friendly Reminder/ })).toBeInTheDocument();
	});

	it('shows the store\'s dated refusal if the reminder is sent too early', async () => {
		const { onToast } = renderStatus(request({ createdAt: daysAgo(5) }));
		// Someone already nudged today (e.g. in another tab) before this click
		appStore.replaceState(stateWith(request({ createdAt: daysAgo(5), lastNudgedAt: daysAgo(0) })));

		await fireEvent.click(screen.getByRole('button', { name: /Send Friendly Reminder/ }));

		expect(onToast).toHaveBeenCalledWith(
			expect.stringMatching(/^You already sent a reminder — you can send another on [A-Z][a-z]{2} \d+$/),
			'error'
		);
	});

	it('says "tomorrow" when the reminder is one day away', () => {
		renderStatus(request({ createdAt: daysAgo(2) }));
		expect(screen.getByText('Friendly reminder available tomorrow')).toBeInTheDocument();
	});

	it('offers the reminder once the cooldown has passed and sends it', async () => {
		const { onToast } = renderStatus(request({ createdAt: daysAgo(5) }));

		await fireEvent.click(screen.getByRole('button', { name: /Send Friendly Reminder/ }));

		expect(onToast).toHaveBeenCalledWith('Reminder sent!', 'success');
		expect(get(appStore).borrowRequests[0].lastNudgedAt).toBeTruthy();
	});

	it('reports the store rejecting a nudge', async () => {
		const { onToast } = renderStatus(request({ createdAt: daysAgo(5) }));
		// Gone from the store by the time the button is clicked
		appStore.replaceState({ ...stateWith(request()), borrowRequests: [] });

		await fireEvent.click(screen.getByRole('button', { name: /Send Friendly Reminder/ }));

		expect(onToast).toHaveBeenCalledWith(expect.any(String), 'error');
	});

	it('shows when the last reminder went out instead of the button', () => {
		renderStatus(request({ createdAt: daysAgo(9), lastNudgedAt: daysAgo(1) }));

		expect(screen.getByText(/Reminder sent/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Send Friendly Reminder/ })).not.toBeInTheDocument();
	});

	it('counts the cooldown from the last reminder, so it can be sent again later', () => {
		renderStatus(request({ createdAt: daysAgo(20), lastNudgedAt: daysAgo(4) }));
		expect(screen.getByRole('button', { name: /Send Friendly Reminder/ })).toBeInTheDocument();
	});
});
