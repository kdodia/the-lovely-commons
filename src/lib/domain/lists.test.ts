import { describe, it, expect } from 'vitest';
import { patchById } from './lists';
import { appendNotifications, createNotification } from './notifications';
import { accept, reject } from './transition';
import { createTestState } from '../../test/fixtures';

describe('patchById', () => {
	const list = [
		{ id: 'a', n: 1 },
		{ id: 'b', n: 2 }
	];

	it('merges an object patch into the matching entry only', () => {
		const next = patchById(list, 'b', { n: 5 });
		expect(next).toEqual([
			{ id: 'a', n: 1 },
			{ id: 'b', n: 5 }
		]);
		expect(next[0]).toBe(list[0]);
		expect(list[1].n).toBe(2);
	});

	it('applies a function patch to the matching entry', () => {
		expect(patchById(list, 'a', (e) => ({ ...e, n: e.n * 10 }))[0].n).toBe(10);
	});

	it('leaves the entries as they were when no id matches', () => {
		expect(patchById(list, 'missing', { n: 0 })).toEqual(list);
	});
});

describe('appendNotifications', () => {
	it('appends in order, skips nulls, and keeps the same array when nothing is added', () => {
		const first = createNotification('user1', 'borrow-request', 'A', 'a');
		const second = createNotification('user2', 'borrow-request', 'B', 'b');
		const existing = [first];

		expect(appendNotifications(existing, null)).toBe(existing);
		expect(appendNotifications(existing, null, second).map((n) => n.title)).toEqual(['A', 'B']);
	});
});

describe('accept / reject', () => {
	it('carry the state through with the matching result', () => {
		const state = createTestState();
		expect(accept(state)).toEqual({ state, result: { ok: true } });
		const refused = reject(state, 'No');
		expect(refused.state).toBe(state);
		expect(refused.result).toEqual({ ok: false, error: 'No' });
	});
});
