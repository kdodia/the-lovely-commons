import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import type { BorrowRequest } from '$lib/types';
import { createTestState, createTestItem, createLifecycleRequest, confirmBothSides } from '../../test/fixtures';
import {
	approveRequest,
	canRequestItem,
	cancelRequest,
	createBorrowRequest,
	hasDateConflict,
	nextNudgeDate,
	nudgeRequest,
	occupiedRanges,
	occupiedUntil
} from './requests';
import { addDays, toLocalISODate } from '$lib/dates';
import { NUDGE_DELAY_DAYS } from '$lib/constants';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('createBorrowRequest', () => {
		it('creates a borrow request and notification', () => {
			const item = createTestItem({ lenderId: 'user2' });
			appStore.replaceState(createTestState({ items: [item] }));

			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};

			appStore.createBorrowRequest(request);

			const state = get(appStore);
			expect(state.borrowRequests).toHaveLength(1);
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('borrow-request');
			expect(state.notifications[0].userId).toBe('user2');
		});
	});

	describe('approveRequest / denyRequest', () => {
		it('approves a pending request and notifies the borrower, leaving the item available', () => {
			const item = createTestItem({ lenderId: 'user2' });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			const result = appStore.approveRequest('req1');

			expect(result.ok).toBe(true);
			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('approved');
			// Approval reserves dates, not the item: it is marked out at pickup
			expect(state.items[0].available).toBe(true);
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('request-approved');
			expect(state.notifications[0].userId).toBe('user1');
		});

		it('creates notification on denial', () => {
			const item = createTestItem({ lenderId: 'user2' });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			const result = appStore.denyRequest('req1');

			expect(result.ok).toBe(true);
			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('denied');
			expect(state.notifications[0].type).toBe('request-denied');
		});
	});

	describe('nudgeRequest', () => {
		it('sends nudge and creates notification', () => {
			const item = createTestItem({ lenderId: 'user2' });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				// Old enough that the first nudge is allowed
				createdAt: addDays(new Date(), -NUDGE_DELAY_DAYS).toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			const result = appStore.nudgeRequest('req1');

			expect(result).toEqual({ ok: true });
			const state = get(appStore);
			expect(state.borrowRequests[0].lastNudgedAt).toBeDefined();
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('request-nudge');
		});
	});
});

describe('nudgeRequest cooldown', () => {
	// Request made Monday 2030-01-07 at 18:00 local; NUDGE_DELAY_DAYS is 3.
	const createdAt = new Date(2030, 0, 7, 18, 0).toISOString();

	function stateAt(overrides: Partial<BorrowRequest> = {}) {
		return createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [createLifecycleRequest({ createdAt, ...overrides })]
		});
	}

	afterEach(() => {
		vi.useRealTimers();
	});

	it('refuses the first nudge before the delay since the request, naming the day', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2030, 0, 9, 23, 59));
		const state = stateAt();

		const { state: next, result } = nudgeRequest(state, 'req1');

		expect(next).toBe(state);
		expect(result).toEqual({ ok: false, error: expect.stringContaining('Jan 10') });
	});

	it('allows the first nudge on that day, even before the hour it was made', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2030, 0, 10, 8, 0));

		const { state: next, result } = nudgeRequest(stateAt(), 'req1');

		expect(result).toEqual({ ok: true });
		expect(next.borrowRequests[0].lastNudgedAt).toBe(new Date(2030, 0, 10, 8, 0).toISOString());
		expect(next.notifications.map((n) => [n.type, n.userId])).toEqual([['request-nudge', 'user2']]);
	});

	it('refuses another nudge until the delay after the last one', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2030, 0, 10, 8, 0));
		const nudged = nudgeRequest(stateAt(), 'req1').state;

		vi.setSystemTime(new Date(2030, 0, 12, 22, 0));
		const early = nudgeRequest(nudged, 'req1');
		expect(early.state).toBe(nudged);
		expect(early.result).toEqual({
			ok: false,
			error: 'You already sent a reminder — you can send another on Jan 13'
		});

		vi.setSystemTime(new Date(2030, 0, 13, 7, 0));
		expect(nudgeRequest(nudged, 'req1').result).toEqual({ ok: true });
	});

	it('refuses anyone but the borrower', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2030, 0, 20, 12, 0));
		for (const actor of ['user2', 'user3']) {
			const state = { ...stateAt(), currentUserId: actor };
			const { state: next, result } = nudgeRequest(state, 'req1');
			expect(next).toBe(state);
			expect(result).toEqual({ ok: false, error: 'Only the person who asked can send a reminder' });
		}
	});

	it('refuses a request that is no longer pending', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2030, 0, 20, 12, 0));
		expect(nudgeRequest(stateAt({ status: 'approved' }), 'req1').result).toEqual({
			ok: false,
			error: 'Only pending requests can be nudged'
		});
	});

	// Spring-forward changes: NZ (run with TZ=Pacific/Auckland) on
	// 2030-09-29, the US on 2030-03-10, the EU on 2030-03-31. Across one, the
	// three calendar days are 71 hours, which elapsed-time counting got wrong.
	it.each([
		['Pacific/Auckland', [2030, 8, 27]],
		['America/*', [2030, 2, 8]],
		['Europe/*', [2030, 2, 29]]
	] as const)('counts calendar days across a daylight-saving change (%s)', (_zone, [y, m, d]) => {
		vi.useFakeTimers();
		const made = new Date(y, m, d, 9, 0);
		vi.setSystemTime(new Date(y, m, d + NUDGE_DELAY_DAYS, 8, 30));
		const state = stateAt({ createdAt: made.toISOString() });

		expect(nextNudgeDate(state.borrowRequests[0])).toBe(toLocalISODate(new Date(y, m, d + NUDGE_DELAY_DAYS)));
		expect(nudgeRequest(state, 'req1').result).toEqual({ ok: true });

		vi.setSystemTime(new Date(y, m, d + NUDGE_DELAY_DAYS - 1, 23, 30));
		expect(nudgeRequest(state, 'req1').result.ok).toBe(false);
	});
});

describe('borrow lifecycle', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2' })],
				borrowRequests: [createLifecycleRequest()]
			})
		);
	});

	it('drives a request through pending → approved → active → completed', () => {
		expect(appStore.approveRequest('req1').ok).toBe(true);
		let state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('approved');
		expect(state.items[0].available).toBe(true);

		expect(confirmBothSides('pickup', 'req1').ok).toBe(true);
		state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('active');
		expect(state.items[0].available).toBe(false);

		expect(confirmBothSides('return', 'req1', { rating: 5, review: 'Great!' }).ok).toBe(true);
		state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('completed');
		expect(state.items[0].available).toBe(true);
		expect(state.borrowHistory).toHaveLength(1);
	});

	it('rejects approving a request that overlaps an approved loan', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [
					createLifecycleRequest({ id: 'req-existing', status: 'approved', borrowerId: 'user3' }),
					createLifecycleRequest({ id: 'req-new', startDate: '2030-01-11', endDate: '2030-01-14' })
				]
			})
		);

		const result = appStore.approveRequest('req-new');
		expect(result.ok).toBe(false);
		expect(get(appStore).borrowRequests.find((r) => r.id === 'req-new')?.status).toBe('pending');
	});

	it('rejects approving a request that overlaps blocked dates', () => {
		appStore.replaceState(
			createTestState({
				items: [
					createTestItem({
						lenderId: 'user2',
						blockedDates: [{ startDate: '2030-01-11', endDate: '2030-01-11' }]
					})
				],
				borrowRequests: [createLifecycleRequest()]
			})
		);

		expect(appStore.approveRequest('req1').ok).toBe(false);
	});

	it('rejects approving a request twice', () => {
		expect(appStore.approveRequest('req1').ok).toBe(true);
		const notificationsAfterFirst = get(appStore).notifications.length;

		expect(appStore.approveRequest('req1').ok).toBe(false);
		expect(get(appStore).notifications).toHaveLength(notificationsAfterFirst);
	});

	it('marks the item back on return even when a later loan is approved', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [
					createLifecycleRequest({ id: 'req-a', status: 'active' }),
					createLifecycleRequest({
						id: 'req-b',
						status: 'approved',
						borrowerId: 'user3',
						startDate: '2030-02-01',
						endDate: '2030-02-03'
					})
				]
			})
		);

		expect(confirmBothSides('return', 'req-a').ok).toBe(true);
		// req-b is only a reservation for February; the item is home now
		expect(get(appStore).items[0].available).toBe(true);
	});

	it('keeps the item out on return while another loan of it is active', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [
					createLifecycleRequest({ id: 'req-a', status: 'active' }),
					createLifecycleRequest({
						id: 'req-b',
						status: 'active',
						borrowerId: 'user3',
						startDate: '2030-02-01',
						endDate: '2030-02-03'
					})
				]
			})
		);

		expect(confirmBothSides('return', 'req-a').ok).toBe(true);
		expect(get(appStore).items[0].available).toBe(false);
	});

	it('increments borrow/lend counters on completion', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', totalBorrows: 5 })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })]
			})
		);

		confirmBothSides('return', 'req1');
		const state = get(appStore);
		expect(state.items[0].totalBorrows).toBe(6);
		expect(state.users.find((u) => u.id === 'user1')?.totalBorrows).toBe(11);
		expect(state.users.find((u) => u.id === 'user2')?.totalLends).toBe(21);
	});

	it('createBorrowRequest rejects ranges conflicting with existing loans', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ id: 'req-existing', status: 'active' })]
			})
		);

		const result = appStore.createBorrowRequest(
			createLifecycleRequest({ id: 'req-clash', startDate: '2030-01-12', endDate: '2030-01-15' })
		);
		expect(result.ok).toBe(false);
		expect(get(appStore).borrowRequests).toHaveLength(1);
	});
});

describe('cancelRequest', () => {
	it('lets the borrower cancel a pending request and tells the lender', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [createLifecycleRequest()]
		}));
		expect(appStore.cancelRequest('req1')).toEqual({ ok: true });
		const state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('cancelled');
		expect(state.notifications.filter((n) => n.type === 'request-cancelled').map((n) => n.userId)).toEqual(['user2']);
	});

	it('frees the dates of a cancelled approval without touching availability', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2', available: true })],
			borrowRequests: [createLifecycleRequest({ status: 'approved' })],
			wishlist: [{ id: 'w1', userId: 'user3', itemId: 'item1', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' }]
		}));
		// lender retracts
		appStore.setCurrentUser('user2');
		expect(appStore.cancelRequest('req1').ok).toBe(true);
		const state = get(appStore);
		expect(state.items[0].available).toBe(true);
		expect(state.borrowRequests[0].status).toBe('cancelled');
		// The item never left, so nobody is told it is "available again"
		expect(state.notifications.filter((n) => n.type === 'wishlist-available')).toEqual([]);
	});

	it('refuses lenders on pending requests, non-parties, and active loans', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [
				createLifecycleRequest({ id: 'pending' }),
				createLifecycleRequest({ id: 'active', status: 'active' })
			]
		}));
		appStore.setCurrentUser('user2');
		expect(appStore.cancelRequest('pending').ok).toBe(false);
		appStore.setCurrentUser('user3');
		expect(appStore.cancelRequest('pending').ok).toBe(false);
		appStore.setCurrentUser('user1');
		expect(appStore.cancelRequest('active').ok).toBe(false);
		expect(get(appStore).borrowRequests.every((r) => r.status !== 'cancelled')).toBe(true);
	});
});

// Direct tests of the rules, without the store.

describe('request rules as pure transitions', () => {
	it('returns the same state object, untouched, when a rule refuses', () => {
		const state = createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [createLifecycleRequest({ status: 'approved' })]
		});
		const snapshot = structuredClone(state);

		const { state: next, result } = approveRequest(state, 'req1');
		expect(result).toEqual({ ok: false, error: 'Only pending requests can be approved' });
		expect(next).toBe(state);
		expect(state).toEqual(snapshot);
	});

	it('builds the next state without mutating the one it was given', () => {
		const state = createTestState({
			items: [createTestItem({ lenderId: 'user2' })],
			borrowRequests: [createLifecycleRequest({ status: 'approved' })]
		});
		const snapshot = structuredClone(state);

		const { state: next, result } = cancelRequest(state, 'req1');
		expect(result).toEqual({ ok: true });
		expect(next).not.toBe(state);
		expect(next.borrowRequests[0].status).toBe('cancelled');
		expect(next.items).toBe(state.items);
		expect(state).toEqual(snapshot);
	});
});

describe('who may request an item', () => {
	// user1 (the actor) is a friend of user2, who owns item1 (friends-only).
	const pending = (overrides: Partial<BorrowRequest> = {}) =>
		createLifecycleRequest({ id: 'req-new', ...overrides });

	it('allows a friend with no open request, whether or not the item is out', () => {
		for (const available of [true, false]) {
			const state = createTestState({ items: [createTestItem({ available })] });
			expect(canRequestItem(state, 'item1', 'user1')).toBe(true);
			expect(createBorrowRequest(state, pending()).result).toEqual({ ok: true });
		}
	});

	it('refuses the owner, users who cannot see it, and missing items', () => {
		const state = createTestState({
			items: [createTestItem({ permissionLevel: 'close-friends' })]
		});
		expect(canRequestItem(state, 'item1', 'user2')).toBe(false); // owner
		expect(canRequestItem(state, 'item1', 'user3')).toBe(false); // not a close friend
		expect(canRequestItem(state, 'gone', 'user1')).toBe(false);

		const asOwner = { ...state, currentUserId: 'user2' };
		expect(createBorrowRequest(asOwner, pending({ borrowerId: 'user2' })).result).toEqual({
			ok: false,
			error: "You can't borrow your own item"
		});
		const asStranger = { ...state, currentUserId: 'user3' };
		expect(createBorrowRequest(asStranger, pending({ borrowerId: 'user3' })).result).toEqual({
			ok: false,
			error: "This item isn't shared with you"
		});
	});

	it('refuses a second open request from the same borrower, but not after one closes', () => {
		for (const status of ['pending', 'approved', 'active'] as const) {
			const state = createTestState({
				items: [createTestItem()],
				borrowRequests: [createLifecycleRequest({ status })]
			});
			expect(canRequestItem(state, 'item1', 'user1')).toBe(false);
			const later = pending({ startDate: '2030-03-01', endDate: '2030-03-02' });
			expect(createBorrowRequest(state, later).result).toEqual({
				ok: false,
				error: 'You already have an open request for this item'
			});
		}
		for (const status of ['completed', 'denied', 'cancelled'] as const) {
			const state = createTestState({
				items: [createTestItem()],
				borrowRequests: [createLifecycleRequest({ status })]
			});
			expect(canRequestItem(state, 'item1', 'user1')).toBe(true);
		}
	});

	it('lets someone else request other dates while the item is reserved or out', () => {
		const state = createTestState({
			currentUserId: 'user3',
			items: [createTestItem({ permissionLevel: 'friends-of-friends', available: false })],
			borrowRequests: [createLifecycleRequest({ status: 'active' })] // 2030-01-10..12
		});
		const mine = pending({ borrowerId: 'user3', startDate: '2030-01-13', endDate: '2030-01-14' });
		expect(createBorrowRequest(state, mine).result).toEqual({ ok: true });

		const overlapping = { ...mine, startDate: '2030-01-12' };
		expect(createBorrowRequest(state, overlapping).result).toEqual({
			ok: false,
			error: 'Those dates conflict with an existing loan or blocked period'
		});
	});

	it('refuses a request made for someone else, naming another lender, or out of order', () => {
		const state = createTestState({ items: [createTestItem()] });
		const refused = (request: BorrowRequest) => {
			const { state: next, result } = createBorrowRequest(state, request);
			expect(next).toBe(state);
			return result;
		};

		expect(refused(pending({ borrowerId: 'user3' }))).toEqual({
			ok: false,
			error: 'You can only send a borrow request for yourself'
		});
		expect(refused(pending({ lenderId: 'user3' }))).toEqual({
			ok: false,
			error: "This request doesn't name the item's owner as lender"
		});
		expect(refused(pending({ startDate: '2030-01-12', endDate: '2030-01-10' }))).toEqual({
			ok: false,
			error: 'End date must not be before start date'
		});
		expect(refused(pending({ endDate: '' }))).toEqual({
			ok: false,
			error: 'Choose a start and an end date'
		});
		expect(refused(pending({ status: 'approved' }))).toEqual({
			ok: false,
			error: 'A new request must start as pending'
		});
	});
});

describe('nextNudgeDate', () => {
	it('counts NUDGE_DELAY_DAYS calendar days from when the request was made', () => {
		const createdAt = new Date(2030, 0, 10, 23, 30).toISOString();
		expect(nextNudgeDate(createLifecycleRequest({ createdAt }))).toBe('2030-01-13');
	});

	it('counts from the last nudge once there has been one', () => {
		const request = createLifecycleRequest({
			createdAt: new Date(2030, 0, 1, 9, 0).toISOString(),
			lastNudgedAt: new Date(2030, 0, 20, 0, 15).toISOString()
		});
		expect(nextNudgeDate(request)).toBe('2030-01-23');
	});
});

describe('an overdue loan holds the item through today', () => {
	// Today is 2030-01-20; user3's loan of item1 (2030-01-10..12) is still out.
	const overdue = createLifecycleRequest({ id: 'late', status: 'active', borrowerId: 'user3' });
	const stateWith = (...requests: BorrowRequest[]) =>
		createTestState({
			items: [createTestItem({ available: false })],
			borrowRequests: [overdue, ...requests]
		});

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2030, 0, 20, 12, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('extends only an overdue active loan to today', () => {
		expect(occupiedUntil(overdue, '2030-01-20')).toBe('2030-01-20');
		expect(occupiedUntil(overdue, '2030-01-12')).toBe('2030-01-12'); // due today
		expect(occupiedUntil({ ...overdue, status: 'approved' }, '2030-01-20')).toBe('2030-01-12');
		expect(occupiedRanges(stateWith(), 'item1')).toEqual([
			{ startDate: '2030-01-10', endDate: '2030-01-20' }
		]);
	});

	it('blocks the days after its end date up to and including today', () => {
		const state = stateWith();
		expect(hasDateConflict(state, 'item1', '2030-01-13', '2030-01-13')).toBe(true);
		expect(hasDateConflict(state, 'item1', '2030-01-18', '2030-01-19')).toBe(true);
		expect(hasDateConflict(state, 'item1', '2030-01-20', '2030-01-22')).toBe(true);
		const inStretch = createLifecycleRequest({ startDate: '2030-01-15', endDate: '2030-01-16' });
		expect(createBorrowRequest(state, inStretch).result).toEqual({
			ok: false,
			error: 'Those dates conflict with an existing loan or blocked period'
		});
	});

	it('leaves the days after today free', () => {
		const state = stateWith();
		expect(hasDateConflict(state, 'item1', '2030-01-21', '2030-01-23')).toBe(false);
		const later = createLifecycleRequest({ startDate: '2030-01-21', endDate: '2030-01-23' });
		expect(createBorrowRequest(state, later).result).toEqual({ ok: true });
	});

	it('refuses to approve dates that overlap the overdue stretch', () => {
		const state = stateWith(
			createLifecycleRequest({ id: 'clash', startDate: '2030-01-19', endDate: '2030-01-22' }),
			createLifecycleRequest({ id: 'clear', startDate: '2030-01-21', endDate: '2030-01-22' })
		);
		expect(approveRequest(state, 'clash').result).toEqual({
			ok: false,
			error: 'Those dates conflict with an existing loan or blocked period'
		});
		expect(approveRequest(state, 'clear').result).toEqual({ ok: true });
	});
});
