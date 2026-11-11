import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from './Modal.svelte';

const body = createRawSnippet(() => ({
	render: () => '<div><p>Are you sure?</p><button>First</button><button>Last</button></div>'
}));
const actions = createRawSnippet(() => ({
	render: () => '<span><button>Confirm</button></span>'
}));

function setup(props: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	const view = render(Modal, { props: { title: 'Delete it?', onClose, children: body, ...props } });
	return { onClose, ...view };
}

describe('Modal', () => {
	it('renders an accessible dialog named by its title', () => {
		setup();
		const dialog = screen.getByRole('dialog', { name: 'Delete it?' });
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(screen.getByText('Are you sure?')).toBeInTheDocument();
	});

	it('moves focus to the dialog when it opens', () => {
		setup();
		expect(screen.getByRole('dialog')).toHaveFocus();
	});

	it('closes on Escape', async () => {
		const { onClose } = setup();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('ignores other keys', async () => {
		const { onClose } = setup();
		await fireEvent.keyDown(window, { key: 'Enter' });
		expect(onClose).not.toHaveBeenCalled();
	});

	it('closes when the backdrop is clicked but not when the dialog is', async () => {
		const { onClose } = setup();
		await fireEvent.click(screen.getByRole('dialog'));
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('dialog').parentElement!);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('renders the actions snippet when given', () => {
		setup({ actions });
		expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
	});

	it('has no close button in the confirm sizes', () => {
		setup({ size: 'sm' });
		expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
	});

	it('shows a header close button in the form size', async () => {
		const { onClose } = setup({ size: 'form', actions });
		await fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('heading', { name: 'Delete it?' })).toBeInTheDocument();
	});

	it('keeps Tab inside the dialog by wrapping from last to first', async () => {
		setup();
		const last = screen.getByRole('button', { name: 'Last' });
		last.focus();
		await fireEvent.keyDown(last, { key: 'Tab' });
		expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
	});

	it('keeps Shift+Tab inside the dialog by wrapping from the dialog to the last control', async () => {
		setup();
		const dialog = screen.getByRole('dialog');
		await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
		expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
	});

	it('gives each dialog its own title id', () => {
		setup({ title: 'One' });
		setup({ title: 'Two' });
		const ids = screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'));
		expect(new Set(ids).size).toBe(2);
	});

	it('hands focus back to the opener when it closes', () => {
		const opener = document.createElement('button');
		document.body.appendChild(opener);
		opener.focus();
		const { unmount } = setup();
		expect(opener).not.toHaveFocus();
		unmount();
		expect(opener).toHaveFocus();
		opener.remove();
	});
});
