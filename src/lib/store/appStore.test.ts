import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore, STORAGE_KEY } from '$lib/store';
import { createTestState, createTestItem, createLifecycleRequest } from '../../test/fixtures';

describe('appStore apply', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2' })],
				borrowRequests: [createLifecycleRequest()]
			})
		);
		localStorage.removeItem(STORAGE_KEY);
	});

	it('stores and saves the new state when a rule accepts', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.approveRequest('req1')).toEqual({ ok: true });

		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		expect(saved.borrowRequests[0].status).toBe('approved');
		expect(get(appStore).borrowRequests[0].status).toBe('approved');
	});

	it('neither replaces nor saves the state when a rule refuses', () => {
		const before = get(appStore);
		expect(appStore.confirmPickup('req1').ok).toBe(false);

		expect(get(appStore)).toBe(before);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});
