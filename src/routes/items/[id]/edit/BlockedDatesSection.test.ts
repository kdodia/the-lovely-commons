import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BlockedDatesSection from './BlockedDatesSection.svelte';

function renderSection(blockedDates: Array<{ startDate: string; endDate: string; reason?: string }> = []) {
	const onToast = vi.fn();
	render(BlockedDatesSection, { props: { blockedDates, onToast } });
	return { onToast };
}

describe('BlockedDatesSection', () => {
	it('says so when nothing is blocked', () => {
		renderSection();
		expect(screen.getByText('No blocked dates. This item is available for all future dates.')).toBeInTheDocument();
	});

	it('lists existing blocks with their reason', () => {
		renderSection([{ startDate: '2030-01-05', endDate: '2030-01-07', reason: 'Camping' }]);
		expect(screen.getByText('1/5/2030 - 1/7/2030')).toBeInTheDocument();
		expect(screen.getByText('Camping')).toBeInTheDocument();
	});

	it('toggles the add form and hides the empty message while it is open', async () => {
		renderSection();
		await fireEvent.click(screen.getByRole('button', { name: '+ Block Dates' }));

		expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
		expect(screen.queryByText(/No blocked dates/)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByLabelText('Start Date')).not.toBeInTheDocument();
	});

	it('requires both dates', async () => {
		const { onToast } = renderSection();
		await fireEvent.click(screen.getByRole('button', { name: '+ Block Dates' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add Block' }));

		expect(onToast).toHaveBeenCalledWith('Please select both start and end dates', 'error');
	});

	it('rejects an end before the start', async () => {
		const { onToast } = renderSection();
		await fireEvent.click(screen.getByRole('button', { name: '+ Block Dates' }));
		await fireEvent.input(screen.getByLabelText('Start Date'), { target: { value: '2030-02-10' } });
		await fireEvent.input(screen.getByLabelText('End Date'), { target: { value: '2030-02-09' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add Block' }));

		expect(onToast).toHaveBeenCalledWith('End date must not be before start date', 'error');
	});

	it('adds a block (same-day allowed), tells the owner to save, and removes it again', async () => {
		const { onToast } = renderSection();
		await fireEvent.click(screen.getByRole('button', { name: '+ Block Dates' }));
		await fireEvent.input(screen.getByLabelText('Start Date'), { target: { value: '2030-02-10' } });
		await fireEvent.input(screen.getByLabelText('End Date'), { target: { value: '2030-02-10' } });
		await fireEvent.input(screen.getByLabelText('Reason (optional)'), { target: { value: 'Trip' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add Block' }));

		expect(onToast).toHaveBeenCalledWith('Date block added — save changes to apply it', 'info');
		expect(screen.getByText('2/10/2030 - 2/10/2030')).toBeInTheDocument();
		expect(screen.getByText('Trip')).toBeInTheDocument();
		expect(screen.queryByLabelText('Start Date')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
		expect(onToast).toHaveBeenCalledWith('Date block removed — save changes to apply it', 'info');
		expect(screen.queryByText('2/10/2030 - 2/10/2030')).not.toBeInTheDocument();
	});
});
