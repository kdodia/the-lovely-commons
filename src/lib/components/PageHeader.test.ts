import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import PageHeader from './PageHeader.svelte';

describe('PageHeader', () => {
	it('renders the title as the page heading', () => {
		render(PageHeader, { props: { title: 'My Library' } });
		expect(screen.getByRole('heading', { level: 1, name: 'My Library' })).toBeInTheDocument();
	});

	it('renders a subtitle only when given', async () => {
		const { container, rerender } = render(PageHeader, { props: { title: 'T' } });
		expect(container.querySelector('.page-subtitle')).toBeNull();
		await rerender({ title: 'T', subtitle: 'Manage things' });
		expect(screen.getByText('Manage things')).toBeInTheDocument();
	});

	it('renders actions passed as children', () => {
		const children = createRawSnippet(() => ({ render: () => '<button>Add Item</button>' }));
		render(PageHeader, { props: { title: 'T', children } });
		expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
	});

	it('applies the optional narrow-screen modifiers', () => {
		const { container } = render(PageHeader, { props: { title: 'T', stack: 'stretch', shrinkTitle: true } });
		const header = container.querySelector('header');
		expect(header).toHaveClass('stack-stretch');
		expect(header).toHaveClass('shrink-title');
	});
});
