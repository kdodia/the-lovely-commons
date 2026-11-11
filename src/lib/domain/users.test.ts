import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import { createTestState } from '../../test/fixtures';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('setCurrentUser', () => {
		it('changes the current user', () => {
			appStore.setCurrentUser('user2');
			const state = get(appStore);
			expect(state.currentUserId).toBe('user2');
		});
	});
});
