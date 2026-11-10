import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
	it('renders icon, title and description', () => {
		render(EmptyState, { props: { icon: '📦', title: 'No items yet', description: 'Add one to start' } });
		expect(screen.getByRole('heading', { name: 'No items yet' })).toBeInTheDocument();
		expect(screen.getByText('Add one to start')).toBeInTheDocument();
		expect(screen.getByText('📦')).toHaveAttribute('aria-hidden', 'true');
	});

	it('omits the parts that are not given', () => {
		const { container } = render(EmptyState, { props: { description: 'Nothing here' } });
		expect(screen.queryByRole('heading')).not.toBeInTheDocument();
		expect(container.querySelector('.empty-icon')).toBeNull();
	});

	it('renders actions below the text', () => {
		const actions = createRawSnippet(() => ({ render: () => '<button>Add Item</button>' }));
		render(EmptyState, { props: { title: 'Empty', description: 'Hi', actions } });
		expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
	});

	it('supports a compact variant', () => {
		const { container } = render(EmptyState, { props: { compact: true, description: 'Short' } });
		expect(container.querySelector('.empty-state')).toHaveClass('compact');
	});
});
