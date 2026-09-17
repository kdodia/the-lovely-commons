import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DateRangeCalendar from './DateRangeCalendar.svelte';

// Freeze "today" so the rendered month and day-of-week labels are
// deterministic: June 2026, with June 10 as today.
const FROZEN_NOW = new Date(2026, 5, 10, 12, 0, 0);

function dayButton(label: string): HTMLElement {
	// aria-label starts with e.g. "Monday, June 15" and may have suffixes like
	// ", booked". The (,|$) boundary stops "July 2" from matching "July 23".
	return screen.getByLabelText(new RegExp(`^${label}(,|$)`));
}

describe('DateRangeCalendar', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FROZEN_NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('emits the clicked local calendar day (no UTC shift)', async () => {
		const onDateSelect = vi.fn();
		render(DateRangeCalendar, { props: { onDateSelect } });

		await fireEvent.click(dayButton('Monday, June 15'));

		// Before the fix, toISOString() shifted this to 2026-06-14 east of UTC
		expect(onDateSelect).toHaveBeenCalledWith('2026-06-15', null);
	});

	it('does not disable today', () => {
		render(DateRangeCalendar, {});

		const today = dayButton('Wednesday, June 10');
		expect(today).not.toBeDisabled();
	});

	it('allows a single-day selection', async () => {
		const onDateSelect = vi.fn();
		const { rerender } = render(DateRangeCalendar, { props: { onDateSelect } });

		await fireEvent.click(dayButton('Monday, June 15'));
		await rerender({ onDateSelect, startDate: '2026-06-15' });
		await fireEvent.click(dayButton('Monday, June 15'));

		expect(onDateSelect).toHaveBeenLastCalledWith('2026-06-15', '2026-06-15');
	});

	it('rejects a range spanning booked days and explains why', async () => {
		const onDateSelect = vi.fn();
		const bookedDates = [{ startDate: '2026-06-18', endDate: '2026-06-19' }];
		const { rerender } = render(DateRangeCalendar, { props: { onDateSelect, bookedDates } });

		await fireEvent.click(dayButton('Monday, June 15'));
		await rerender({ onDateSelect, bookedDates, startDate: '2026-06-15' });
		await fireEvent.click(dayButton('Monday, June 22'));

		expect(onDateSelect).not.toHaveBeenCalledWith('2026-06-15', '2026-06-22');
		expect(screen.getByRole('alert')).toHaveTextContent(/booked or blocked/i);
	});

	it('detects conflicts across month boundaries', async () => {
		const onDateSelect = vi.fn();
		const bookedDates = [{ startDate: '2026-07-05', endDate: '2026-07-06' }];
		const { rerender } = render(DateRangeCalendar, { props: { onDateSelect, bookedDates } });

		await fireEvent.click(dayButton('Thursday, June 25'));
		await rerender({ onDateSelect, bookedDates, startDate: '2026-06-25' });

		// Page forward to July and pick an end date beyond the booked days
		await fireEvent.click(screen.getByLabelText('Next month'));
		await fireEvent.click(dayButton('Friday, July 10'));

		// Before the fix only the visible month was checked, so this passed
		expect(onDateSelect).not.toHaveBeenCalledWith('2026-06-25', '2026-07-10');
		expect(screen.getByRole('alert')).toHaveTextContent(/booked or blocked/i);
	});

	it('completes a clean cross-month selection', async () => {
		const onDateSelect = vi.fn();
		const { rerender } = render(DateRangeCalendar, { props: { onDateSelect } });

		await fireEvent.click(dayButton('Thursday, June 25'));
		await rerender({ onDateSelect, startDate: '2026-06-25' });

		await fireEvent.click(screen.getByLabelText('Next month'));
		await fireEvent.click(dayButton('Thursday, July 2'));

		expect(onDateSelect).toHaveBeenLastCalledWith('2026-06-25', '2026-07-02');
	});

	it('marks booked days as disabled', () => {
		render(DateRangeCalendar, {
			props: { bookedDates: [{ startDate: '2026-06-18', endDate: '2026-06-19' }] }
		});

		expect(dayButton('Thursday, June 18')).toBeDisabled();
		expect(dayButton('Friday, June 19')).toBeDisabled();
	});
});
