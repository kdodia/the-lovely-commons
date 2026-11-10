import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	isOverdue,
	sortOverdueFirst,
	daysOverdue,
	nextReturnReminderDate,
	overdueLentLoans,
	overdueBorrowedLoans
} from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('overdue loans', () => {
	// Freeze "today" at Jan 15 2030, local noon. createLifecycleRequest ends Jan 12.
	const NOW = new Date(2030, 0, 15, 12, 0, 0);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('flags active loans whose end date is before today, but not on the due date', () => {
		const active = createLifecycleRequest({ status: 'active' });
		expect(isOverdue(active, '2030-01-12')).toBe(false);
		expect(isOverdue(active, '2030-01-13')).toBe(true);
		expect(daysOverdue(active, '2030-01-12')).toBe(0);
		expect(daysOverdue(active, '2030-01-13')).toBe(1);
		expect(daysOverdue(active, '2030-01-15')).toBe(3);
		// defaults to the local today
		expect(daysOverdue(active)).toBe(3);
	});

	it('only counts loans that have been picked up', () => {
		for (const status of ['pending', 'approved', 'completed', 'cancelled', 'denied'] as const) {
			expect(isOverdue(createLifecycleRequest({ status }), '2030-02-01')).toBe(false);
		}
	});

	it('splits the current user\'s overdue loans by side', () => {
		appStore.replaceState(
			createTestState({
				borrowRequests: [
					createLifecycleRequest({ id: 'borrowed-late', status: 'active' }),
					createLifecycleRequest({ id: 'borrowed-due-today', status: 'active', endDate: '2030-01-15' }),
					createLifecycleRequest({ id: 'lent-late', status: 'active', borrowerId: 'user2', lenderId: 'user1' }),
					createLifecycleRequest({ id: 'lent-reserved', status: 'approved', borrowerId: 'user2', lenderId: 'user1' }),
					createLifecycleRequest({ id: 'others', status: 'active', borrowerId: 'user3', lenderId: 'user2' })
				]
			})
		);

		expect(get(overdueBorrowedLoans).map((r) => r.id)).toEqual(['borrowed-late']);
		expect(get(overdueLentLoans).map((r) => r.id)).toEqual(['lent-late']);
	});
});

describe('sendReturnReminder', () => {
	const NOW = new Date(2030, 0, 15, 12, 0, 0);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		// user2 lent item1 to user1; due Jan 12, so 3 days overdue
		appStore.replaceState(
			createTestState({
				currentUserId: 'user2',
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })]
			})
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function reminders() {
		return get(appStore).notifications.filter((n) => n.type === 'return-reminder');
	}

	it('notifies the borrower and records when the reminder was sent', () => {
		expect(appStore.sendReturnReminder('req1')).toEqual({ ok: true });

		const notes = reminders();
		expect(notes).toHaveLength(1);
		expect(notes[0].userId).toBe('user1');
		expect(notes[0].relatedId).toBe('req1');
		expect(notes[0].message).toContain('Test Item');
		expect(notes[0].message).toContain('3 days ago');
		expect(get(appStore).borrowRequests[0].lastRemindedAt).toBe(NOW.toISOString());
	});

	it('refuses anyone but the lender', () => {
		appStore.setCurrentUser('user1'); // the borrower
		const result = appStore.sendReturnReminder('req1');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/Only the lender/);

		appStore.setCurrentUser('user3');
		expect(appStore.sendReturnReminder('req1').ok).toBe(false);
		expect(reminders()).toHaveLength(0);
	});

	it('refuses loans that are not active', () => {
		appStore.replaceState(
			createTestState({
				currentUserId: 'user2',
				items: [createTestItem({ lenderId: 'user2' })],
				borrowRequests: [createLifecycleRequest({ status: 'approved' })]
			})
		);
		expect(appStore.sendReturnReminder('req1').ok).toBe(false);
		expect(reminders()).toHaveLength(0);
	});

	it('refuses loans that are due today or later', () => {
		appStore.replaceState(
			createTestState({
				currentUserId: 'user2',
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ status: 'active', endDate: '2030-01-15' })]
			})
		);
		const result = appStore.sendReturnReminder('req1');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/isn't overdue yet/);
		expect(reminders()).toHaveLength(0);
	});

	it('refuses once the borrower has confirmed the return', () => {
		appStore.setCurrentUser('user1');
		appStore.confirmReturn('req1');
		appStore.setCurrentUser('user2');
		expect(appStore.sendReturnReminder('req1').ok).toBe(false);
		expect(reminders()).toHaveLength(0);
	});

	it('enforces the cooldown, then allows another reminder', () => {
		expect(appStore.sendReturnReminder('req1').ok).toBe(true);
		expect(nextReturnReminderDate(get(appStore).borrowRequests[0])).toBe('2030-01-17');

		// same day and the next day: still cooling down
		const again = appStore.sendReturnReminder('req1');
		expect(again.ok).toBe(false);
		if (!again.ok) expect(again.error).toMatch(/already sent a reminder/);
		vi.setSystemTime(new Date(2030, 0, 16, 23, 0, 0));
		expect(appStore.sendReturnReminder('req1').ok).toBe(false);
		expect(reminders()).toHaveLength(1);

		// RETURN_REMINDER_COOLDOWN_DAYS later
		vi.setSystemTime(new Date(2030, 0, 17, 8, 0, 0));
		expect(appStore.sendReturnReminder('req1')).toEqual({ ok: true });
		expect(reminders()).toHaveLength(2);
		expect(reminders()[1].message).toContain('5 days ago');
	});
});

describe('overdue ordering and announcements', () => {
	const NOW = new Date(2030, 0, 15, 12, 0, 0);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function loan(id: string, overrides: Partial<BorrowRequest> = {}): BorrowRequest {
		return createLifecycleRequest({ id, status: 'active', endDate: '2030-01-12', ...overrides });
	}

	const items = [createTestItem({ lenderId: 'user2', available: false })];

	describe('sortOverdueFirst', () => {
		it('puts overdue loans first, most overdue first, and keeps the rest in order', () => {
			const loans = [
				loan('approved', { status: 'approved' }),
				loan('due-today', { endDate: '2030-01-15' }),
				loan('late-3', { endDate: '2030-01-12' }),
				loan('future', { endDate: '2030-01-20' }),
				loan('late-10', { endDate: '2030-01-05' }),
				loan('late-3-b', { endDate: '2030-01-12' })
			];
			const sorted = sortOverdueFirst(loans);
			expect(sorted.map((r) => r.id)).toEqual([
				'late-10',
				'late-3',
				'late-3-b',
				'approved',
				'due-today',
				'future'
			]);
			expect(loans[0].id).toBe('approved'); // input is not mutated
		});

		it('accepts an explicit today and handles an empty list', () => {
			expect(sortOverdueFirst([])).toEqual([]);
			const loans = [loan('a', { endDate: '2030-01-12' }), loan('b', { endDate: '2030-01-10' })];
			expect(sortOverdueFirst(loans, '2030-01-11').map((r) => r.id)).toEqual(['b', 'a']);
		});
	});

	describe('notifyOverdueLoans', () => {
		function overdueNotes() {
			return get(appStore).notifications.filter(
				(n) => n.type === 'return-reminder' || n.type === 'loan-overdue'
			);
		}

		it('tells the borrower and the lender once and marks the loan announced', () => {
			appStore.replaceState(createTestState({ items, borrowRequests: [loan('req1')] }));

			expect(appStore.notifyOverdueLoans()).toBe(1);

			const notes = overdueNotes();
			expect(notes).toHaveLength(2);
			const toBorrower = notes.find((n) => n.userId === 'user1');
			const toLender = notes.find((n) => n.userId === 'user2');
			expect(toBorrower?.type).toBe('return-reminder');
			expect(toBorrower?.message).toContain('Test Item');
			expect(toBorrower?.message).toContain('Please return it');
			expect(toLender?.type).toBe('loan-overdue');
			expect(toLender?.message).toContain('is now overdue');
			expect(toLender?.message).toContain('Test User 1');
			expect(notes.every((n) => n.relatedId === 'req1')).toBe(true);
			expect(get(appStore).borrowRequests[0].overdueNotifiedAt).toBe(NOW.toISOString());
			// Independent of the manual reminder cooldown
			expect(get(appStore).borrowRequests[0].lastRemindedAt).toBeUndefined();
		});

		it('is idempotent: a second run adds nothing and leaves state untouched', () => {
			appStore.replaceState(createTestState({ items, borrowRequests: [loan('req1')] }));
			appStore.notifyOverdueLoans();
			const before = get(appStore);

			expect(appStore.notifyOverdueLoans()).toBe(0);
			expect(get(appStore)).toBe(before);
		});

		it('ignores loans due today, not yet picked up, or completed', () => {
			appStore.replaceState(
				createTestState({
					borrowRequests: [
						loan('due-today', { endDate: '2030-01-15' }),
						loan('approved', { status: 'approved' }),
						loan('completed', { status: 'completed' })
					]
				})
			);
			const before = get(appStore);

			expect(appStore.notifyOverdueLoans()).toBe(0);
			expect(get(appStore)).toBe(before);
		});

		it("announces loans between other users, not only the current user's", () => {
			appStore.replaceState(
				createTestState({
					currentUserId: 'user1',
					items,
					borrowRequests: [loan('others', { borrowerId: 'user3', lenderId: 'user2' })]
				})
			);

			expect(appStore.notifyOverdueLoans()).toBe(1);
			expect(
				overdueNotes()
					.map((n) => n.userId)
					.sort()
			).toEqual(['user2', 'user3']);
		});

		it('still allows a manual reminder afterwards', () => {
			appStore.replaceState(
				createTestState({
					currentUserId: 'user2',
					items: [createTestItem({ lenderId: 'user2', available: false })],
					borrowRequests: [loan('req1')]
				})
			);
			appStore.notifyOverdueLoans();
			expect(appStore.sendReturnReminder('req1')).toEqual({ ok: true });
		});
	});
});
