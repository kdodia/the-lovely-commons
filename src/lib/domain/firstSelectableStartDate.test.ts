import { describe, it, expect } from 'vitest';
import { firstSelectableStartDate } from './requests';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('firstSelectableStartDate', () => {
	const item = (blockedDates: { startDate: string; endDate: string }[] = []) =>
		createTestItem({ id: 'item1', lenderId: 'user2', blockedDates });

	it('returns the starting day itself when it is free', () => {
		const state = createTestState({ items: [item()] });
		expect(firstSelectableStartDate(state, 'item1', '2030-01-10')).toBe('2030-01-10');
	});

	it('skips blocked days', () => {
		const state = createTestState({
			items: [item([{ startDate: '2030-01-10', endDate: '2030-01-12' }])]
		});
		expect(firstSelectableStartDate(state, 'item1', '2030-01-10')).toBe('2030-01-13');
	});

	it('skips days held by approved or active loans but not pending requests', () => {
		const state = createTestState({
			items: [item()],
			borrowRequests: [
				createLifecycleRequest({ id: 'a', status: 'approved', startDate: '2030-01-10', endDate: '2030-01-11' }),
				createLifecycleRequest({ id: 'b', status: 'active', startDate: '2030-01-12', endDate: '2030-01-12' }),
				createLifecycleRequest({ id: 'c', status: 'pending', startDate: '2030-01-13', endDate: '2030-01-14' })
			]
		});
		expect(firstSelectableStartDate(state, 'item1', '2030-01-10')).toBe('2030-01-13');
	});

	it('crosses a month boundary', () => {
		const state = createTestState({
			items: [item([{ startDate: '2030-01-30', endDate: '2030-02-01' }])]
		});
		expect(firstSelectableStartDate(state, 'item1', '2030-01-30')).toBe('2030-02-02');
	});

	it('returns nothing when the whole window is taken, and honours the window size', () => {
		const state = createTestState({
			items: [item([{ startDate: '2030-01-01', endDate: '2030-03-31' }])]
		});
		expect(firstSelectableStartDate(state, 'item1', '2030-01-01')).toBe('');
		// 60 days from Jan 1 ends Mar 1; a longer window reaches Apr 1
		expect(firstSelectableStartDate(state, 'item1', '2030-01-01', 120)).toBe('2030-04-01');
	});
});
