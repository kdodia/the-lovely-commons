import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Tabs from './Tabs.svelte';

const tabs = [
	{ id: 'one', label: 'First', icon: '1️⃣', count: 3, countLabel: '3 firsts' },
	{ id: 'two', label: 'Second', icon: '2️⃣' }
];

describe('Tabs', () => {
	it('renders a labelled tablist with one tab per entry', () => {
		render(Tabs, { props: { tabs, value: 'one', label: 'Sections' } });
		expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
		expect(screen.getAllByRole('tab')).toHaveLength(2);
	});

	it('marks the selected tab', () => {
		render(Tabs, { props: { tabs, value: 'two', label: 'Sections' } });
		expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'false');
		expect(screen.getByRole('tab', { name: 'Second' })).toHaveClass('active');
	});

	it('switches the selected tab on click', async () => {
		render(Tabs, { props: { tabs, value: 'one', label: 'Sections' } });
		await fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
		expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'false');
	});

	it('shows a count pill only when the count is above zero', () => {
		render(Tabs, { props: { tabs, value: 'one', label: 'Sections' } });
		expect(screen.getByLabelText('3 firsts')).toHaveTextContent('3');
		expect(document.querySelectorAll('.tab-badge')).toHaveLength(1);
	});

	it('keeps the text label as the accessible name', () => {
		render(Tabs, { props: { tabs, value: 'one', label: 'Sections', iconsOnly: true } });
		expect(screen.getByRole('tab', { name: 'First' })).toBeInTheDocument();
	});

	it('wires tabs to panels only when asked', () => {
		const { unmount } = render(Tabs, { props: { tabs, value: 'one', label: 'Sections' } });
		expect(screen.getByRole('tab', { name: 'First' })).not.toHaveAttribute('aria-controls');
		unmount();
		render(Tabs, { props: { tabs, value: 'one', label: 'Sections', panels: true } });
		const first = screen.getByRole('tab', { name: 'First' });
		expect(first).toHaveAttribute('id', 'one-tab');
		expect(first).toHaveAttribute('aria-controls', 'one-panel');
	});
});
