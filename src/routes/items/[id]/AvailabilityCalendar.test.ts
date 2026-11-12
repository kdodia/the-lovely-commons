import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AvailabilityCalendar from './AvailabilityCalendar.svelte';
import { appStore } from '$lib/store';
import { itemPageState, item } from './testFixtures';

function ariaLabel(day: string): string | null {
	// The (,|$) boundary stops "June 1" from matching "June 10".
	return screen.getByLabelText(new RegExp(`^${day}(,|$)`)).getAttribute('aria-label');
}

describe('AvailabilityCalendar', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows an overdue loan as booked through today, and tomorrow as free', () => {
		// Today is Wednesday 2026-06-10; the loan was due back on June 5.
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
		appStore.replaceState(
			itemPageState({
				borrowRequests: [
					{
						id: 'late',
						itemId: 'item1',
						borrowerId: 'borrower',
						lenderId: 'lender',
						startDate: '2026-06-01',
						endDate: '2026-06-05',
						status: 'active',
						createdAt: '2026-05-30T10:00:00Z'
					}
				]
			})
		);
		render(AvailabilityCalendar, {
			props: { item, startDate: '', endDate: '', showRequestForm: false }
		});

		expect(ariaLabel('Friday, June 5')).toContain(', booked');
		expect(ariaLabel('Monday, June 8')).toContain(', booked');
		expect(ariaLabel('Wednesday, June 10')).toContain(', booked');
		expect(ariaLabel('Thursday, June 11')).not.toContain(', booked');
	});
});
