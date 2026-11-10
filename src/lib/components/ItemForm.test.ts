import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ItemForm from './ItemForm.svelte';
import { appStore } from '$lib/store';
import type { AppState } from '$lib/types';

function baseState(): AppState {
	const user = (id: string, name: string, friendIds: string[] = []) => ({
		id,
		name,
		email: `${id}@example.com`,
		profilePic: '',
		bio: '',
		friendIds,
		closeFriendIds: [],
		rating: 5,
		totalBorrows: 0,
		totalLends: 0
	});
	return {
		currentUserId: 'me',
		users: [user('me', 'Me Myself', ['pal']), user('pal', 'Pat Pal', ['me'])],
		items: [],
		categories: [
			{ id: 'tools', name: 'Tools', icon: '🔧' },
			{ id: 'hand', name: 'Hand Tools', parentId: 'tools', icon: '🔨' },
			{ id: 'kitchen', name: 'Kitchen', icon: '🍳' }
		],
		tags: [],
		borrowRequests: [],
		borrowHistory: [],
		friendRequests: [],
		notifications: [],
		wishlist: []
	};
}

function props(overrides: Record<string, unknown> = {}) {
	return {
		submitLabel: 'Save It',
		onSubmit: vi.fn(),
		onInvalid: vi.fn(),
		onCancel: vi.fn(),
		...overrides
	};
}

async function fillRequired() {
	await fireEvent.input(screen.getByLabelText('Item Name *'), { target: { value: '  Ladder  ' } });
	await fireEvent.input(screen.getByLabelText('Description *'), { target: { value: ' Tall ' } });
	await fireEvent.input(screen.getByLabelText('Image URL *'), { target: { value: ' https://x.test/a.jpg ' } });
	await fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'kitchen' } });
}

describe('ItemForm', () => {
	beforeEach(() => {
		appStore.replaceState(baseState());
	});

	it('starts blank with friends / good as the defaults', () => {
		render(ItemForm, { props: props() });

		expect(screen.getByLabelText('Item Name *')).toHaveValue('');
		expect(screen.getByRole('radio', { name: /^Good/ })).toBeChecked();
		expect(screen.getByRole('radio', { name: /^Friends All your friends/ })).toBeChecked();
		expect(screen.getByRole('button', { name: 'Save It' })).toBeEnabled();
	});

	it('submits trimmed values and leaves allowedUserIds unset for other levels', async () => {
		const p = props();
		render(ItemForm, { props: p });
		await fillRequired();
		await fireEvent.click(screen.getByRole('radio', { name: /^Fair/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save It' }));

		expect(p.onInvalid).not.toHaveBeenCalled();
		expect(p.onSubmit).toHaveBeenCalledWith({
			name: 'Ladder',
			description: 'Tall',
			imageUrl: 'https://x.test/a.jpg',
			categoryId: 'kitchen',
			condition: 'fair',
			permissionLevel: 'friends',
			allowedUserIds: undefined
		});
	});

	it('calls onInvalid instead of onSubmit when a required field is missing', async () => {
		const p = props();
		const { container } = render(ItemForm, { props: p });
		await fireEvent.input(screen.getByLabelText('Item Name *'), { target: { value: 'Only a name' } });
		// fireEvent.submit skips the browser's own `required` check
		await fireEvent.submit(container.querySelector('form')!);

		expect(p.onInvalid).toHaveBeenCalledOnce();
		expect(p.onSubmit).not.toHaveBeenCalled();
	});

	it('can keep submit disabled until the required fields are filled in', async () => {
		render(ItemForm, { props: props({ disableSubmitUntilValid: true }) });
		const submit = screen.getByRole('button', { name: 'Save It' });
		expect(submit).toBeDisabled();

		await fillRequired();
		expect(submit).toBeEnabled();
	});

	it('prefills from initial values, including a subcategory', () => {
		render(ItemForm, {
			props: props({
				initial: {
					name: 'Hammer',
					description: 'Claw',
					imageUrl: 'https://x.test/h.jpg',
					categoryId: 'hand',
					condition: 'poor',
					permissionLevel: 'neighbors'
				}
			})
		});

		expect(screen.getByLabelText('Item Name *')).toHaveValue('Hammer');
		expect(screen.getByLabelText('Category *')).toHaveValue('tools');
		expect(screen.getByLabelText('Subcategory (optional)')).toHaveValue('hand');
		expect(screen.getByRole('radio', { name: /^Poor/ })).toBeChecked();
		expect(screen.getByRole('radio', { name: /^Neighbors/ })).toBeChecked();
	});

	it('submits the subcategory when one is chosen and resets it when the parent changes', async () => {
		const p = props({ initial: { name: 'a', description: 'b', imageUrl: 'https://x.test/c.jpg', categoryId: 'hand' } });
		render(ItemForm, { props: p });
		await fireEvent.click(screen.getByRole('button', { name: 'Save It' }));
		expect(p.onSubmit.mock.calls[0][0].categoryId).toBe('hand');

		await fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'tools' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Save It' }));
		expect(p.onSubmit.mock.calls[1][0].categoryId).toBe('tools');
	});

	it('shows the friend picker for specific people and submits the chosen ids', async () => {
		const p = props();
		render(ItemForm, { props: p });
		expect(screen.queryByRole('group', { name: 'Choose who can see this item' })).not.toBeInTheDocument();

		await fillRequired();
		await fireEvent.click(screen.getByRole('radio', { name: /^Specific People/ }));
		await fireEvent.click(screen.getByRole('checkbox', { name: /Pat Pal/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save It' }));

		expect(p.onSubmit.mock.calls[0][0]).toMatchObject({
			permissionLevel: 'specific-users',
			allowedUserIds: ['pal']
		});
	});

	it('renders extra sections before the buttons', () => {
		const extraSections = createRawSnippet(() => ({
			render: () => '<div class="form-section"><h3>Extra Part</h3></div>'
		}));
		render(ItemForm, { props: props({ extraSections }) });

		expect(screen.getByRole('heading', { name: 'Extra Part' })).toBeInTheDocument();
	});

	it('calls onCancel from the Cancel button', async () => {
		const p = props();
		render(ItemForm, { props: p });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(p.onCancel).toHaveBeenCalledOnce();
	});
});
