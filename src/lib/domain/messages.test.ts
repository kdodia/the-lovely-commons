import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { REQUEST_MESSAGE_MAX_LENGTH } from '$lib/constants';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('sendRequestMessage', () => {
	// user1 borrows user2's item; user3 is a bystander.
	function setup(status: BorrowRequest['status'] = 'pending', overrides: Partial<BorrowRequest> = {}) {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2', name: 'Drill' })],
			borrowRequests: [createLifecycleRequest({ status, message: 'Can I borrow it?', ...overrides })]
		}));
	}

	const messages = () => get(appStore).borrowRequests[0].messages ?? [];
	const messageNotifications = () =>
		get(appStore).notifications.filter((n) => n.type === 'request-message');

	it('lets the borrower message and notifies the lender', () => {
		setup();
		expect(appStore.sendRequestMessage('req1', '  Saturday morning ok?  ')).toEqual({ ok: true });

		expect(messages()).toHaveLength(1);
		expect(messages()[0]).toMatchObject({ fromUserId: 'user1', text: 'Saturday morning ok?' });
		expect(messages()[0].id).toBeTruthy();
		expect(Number.isNaN(Date.parse(messages()[0].at))).toBe(false);
		// The opening message stays where it was and is not copied into the thread
		expect(get(appStore).borrowRequests[0].message).toBe('Can I borrow it?');

		const notes = messageNotifications();
		expect(notes).toHaveLength(1);
		expect(notes[0]).toMatchObject({ userId: 'user2', relatedId: 'req1' });
		expect(notes[0].message).toBe('Test User 1 about Drill: "Saturday morning ok?"');
	});

	it('lets the lender reply and notifies the borrower, keeping order', () => {
		setup('approved', {
			messages: [{ id: 'm1', fromUserId: 'user1', text: 'First', at: '2030-01-01T10:00:00Z' }]
		});
		appStore.setCurrentUser('user2');
		expect(appStore.sendRequestMessage('req1', 'Second').ok).toBe(true);

		expect(messages().map((m) => [m.fromUserId, m.text])).toEqual([
			['user1', 'First'],
			['user2', 'Second']
		]);
		expect(messageNotifications().map((n) => n.userId)).toEqual(['user1']);
	});

	it('works on requests stored without a messages array', () => {
		setup('active');
		expect(get(appStore).borrowRequests[0].messages).toBeUndefined();
		expect(appStore.sendRequestMessage('req1', 'Running ten minutes late').ok).toBe(true);
		expect(messages()).toHaveLength(1);
	});

	it('truncates long messages in the notification preview', () => {
		setup();
		const long = 'word '.repeat(40).trim();
		expect(appStore.sendRequestMessage('req1', long).ok).toBe(true);
		const note = messageNotifications()[0].message;
		expect(note.length).toBeLessThan(long.length);
		expect(note).toMatch(/…"$/);
		expect(messages()[0].text).toBe(long);
	});

	it('refuses someone who is not the borrower or lender', () => {
		setup();
		appStore.setCurrentUser('user3');
		const result = appStore.sendRequestMessage('req1', 'Hi');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/borrower or lender/);
		expect(messages()).toHaveLength(0);
		expect(messageNotifications()).toHaveLength(0);
	});

	it.each(['', '   ', '\n\t '])('refuses empty text %j', (text) => {
		setup();
		const result = appStore.sendRequestMessage('req1', text);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/Write a message/);
		expect(messages()).toHaveLength(0);
	});

	it('refuses text over the length limit but measures it after trimming', () => {
		setup();
		const tooLong = appStore.sendRequestMessage('req1', 'x'.repeat(REQUEST_MESSAGE_MAX_LENGTH + 1));
		expect(tooLong.ok).toBe(false);
		if (!tooLong.ok) expect(tooLong.error).toContain(`${REQUEST_MESSAGE_MAX_LENGTH} characters`);
		expect(messages()).toHaveLength(0);

		const padded = `  ${'x'.repeat(REQUEST_MESSAGE_MAX_LENGTH)}  `;
		expect(appStore.sendRequestMessage('req1', padded).ok).toBe(true);
	});

	it.each(['denied', 'cancelled', 'completed'] as const)('refuses messages once %s', (status) => {
		setup(status);
		const result = appStore.sendRequestMessage('req1', 'Hello?');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/closed/);
		expect(messages()).toHaveLength(0);
		expect(messageNotifications()).toHaveLength(0);
	});

	it.each(['pending', 'approved', 'active'] as const)('allows messages while %s', (status) => {
		setup(status);
		expect(appStore.sendRequestMessage('req1', 'Hello').ok).toBe(true);
		appStore.setCurrentUser('user2');
		expect(appStore.sendRequestMessage('req1', 'Hi back').ok).toBe(true);
		expect(messages()).toHaveLength(2);
	});

	it('reports a missing request', () => {
		setup();
		expect(appStore.sendRequestMessage('nope', 'Hi')).toEqual({ ok: false, error: 'Request not found' });
	});
});
