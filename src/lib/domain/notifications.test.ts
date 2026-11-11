import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import { createTestState } from '../../test/fixtures';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('notification actions', () => {
		it('marks notification as read', () => {
			appStore.replaceState(createTestState({
				notifications: [{
					id: 'notif1',
					userId: 'user1',
					type: 'borrow-request',
					title: 'Test',
					message: 'Test message',
					read: false,
					createdAt: new Date().toISOString()
				}]
			}));

			appStore.markNotificationAsRead('notif1');

			const state = get(appStore);
			expect(state.notifications[0].read).toBe(true);
		});

		it('marks all notifications as read for user', () => {
			appStore.replaceState(createTestState({
				notifications: [
					{ id: 'notif1', userId: 'user1', type: 'borrow-request', title: 'Test 1', message: 'Msg', read: false, createdAt: new Date().toISOString() },
					{ id: 'notif2', userId: 'user1', type: 'borrow-request', title: 'Test 2', message: 'Msg', read: false, createdAt: new Date().toISOString() },
					{ id: 'notif3', userId: 'user2', type: 'borrow-request', title: 'Test 3', message: 'Msg', read: false, createdAt: new Date().toISOString() }
				]
			}));

			appStore.markAllNotificationsAsRead('user1');

			const state = get(appStore);
			expect(state.notifications[0].read).toBe(true);
			expect(state.notifications[1].read).toBe(true);
			expect(state.notifications[2].read).toBe(false); // Different user
		});
	});
});
