import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import RequestForm from './RequestForm.svelte';
import { appStore } from '$lib/store';
import { itemPageState, item } from './testFixtures';

function renderForm(overrides: Record<string, unknown> = {}) {
	const onToast = vi.fn();
	render(RequestForm, {
		props: { item, startDate: '', endDate: '', showRequestForm: false, onToast, ...overrides }
	});
	return { onToast };
}

describe('RequestForm', () => {
	beforeEach(() => {
		appStore.replaceState(itemPageState());
	});

	it('starts as a single button with a hint about the calendar', () => {
		renderForm();
		expect(screen.getByRole('button', { name: 'Request to Borrow' })).toBeInTheDocument();
		expect(screen.getByText('Or select dates from the calendar on the right')).toBeInTheDocument();
	});

	it('opens the form when the button is pressed', async () => {
		renderForm();
		await fireEvent.click(screen.getByRole('button', { name: 'Request to Borrow' }));

		expect(screen.getByRole('heading', { name: 'Request to Borrow' })).toBeInTheDocument();
		// Opening presets a start date (tomorrow), so only the end date is missing
		expect(screen.getByText('Select an end date from the calendar to complete your booking')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Send Request' })).toBeDisabled();
	});

	it('asks for dates when none are chosen', () => {
		renderForm({ showRequestForm: true });
		expect(screen.getByText('Select your dates from the calendar to continue')).toBeInTheDocument();
	});

	it('shows the chosen range and sends the request', async () => {
		const { onToast } = renderForm({ showRequestForm: true, startDate: '2030-01-10', endDate: '2030-01-12' });
		expect(screen.getByText('Use the calendar to change dates')).toBeInTheDocument();

		await fireEvent.input(screen.getByLabelText('Message (optional)'), { target: { value: 'For brunch' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

		const [request] = get(appStore).borrowRequests;
		expect(request).toMatchObject({
			itemId: 'item1',
			borrowerId: 'borrower',
			lenderId: 'lender',
			startDate: '2030-01-10',
			endDate: '2030-01-12',
			status: 'pending',
			message: 'For brunch'
		});
		expect(onToast).toHaveBeenCalledWith('Borrow request sent!', 'success');
		// Back to the collapsed state
		expect(screen.getByRole('button', { name: 'Request to Borrow' })).toBeInTheDocument();
	});

	it('refuses an end date before the start date', async () => {
		const { onToast } = renderForm({ showRequestForm: true, startDate: '2030-01-12', endDate: '2030-01-10' });
		await fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

		expect(onToast).toHaveBeenCalledWith('End date must not be before start date', 'error');
		expect(get(appStore).borrowRequests).toHaveLength(0);
	});

	it('reports a rejection from the store and keeps the form open', async () => {
		appStore.replaceState(
			itemPageState({
				items: [{ ...item, blockedDates: [{ startDate: '2030-01-01', endDate: '2030-01-31' }] }]
			})
		);
		const { onToast } = renderForm({ showRequestForm: true, startDate: '2030-01-10', endDate: '2030-01-12' });
		await fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

		expect(onToast).toHaveBeenCalledWith(expect.stringContaining('conflict'), 'error');
		expect(screen.getByRole('button', { name: 'Send Request' })).toBeInTheDocument();
	});

	it('closes without sending on Cancel', async () => {
		renderForm({ showRequestForm: true, startDate: '2030-01-10', endDate: '2030-01-12' });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(screen.getByRole('button', { name: 'Request to Borrow' })).toBeInTheDocument();
		expect(get(appStore).borrowRequests).toHaveLength(0);
	});
});
