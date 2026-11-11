import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import { createTestState, createTestItem, createLifecycleRequest, confirmBothSides } from '../../test/fixtures';

describe('wishlist regressions', () => {
	it('rejects wishlisting an item the user cannot view', () => {
		appStore.replaceState(
			createTestState({
				// user3 is not in user2's closeFriendIds
				currentUserId: 'user3',
				items: [createTestItem({ lenderId: 'user2', permissionLevel: 'close-friends' })]
			})
		);

		appStore.addToWishlist('item1');
		expect(get(appStore).wishlist).toHaveLength(0);
	});

	it('notifies permitted subscribers when an item becomes available again', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false, permissionLevel: 'friends' })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })],
				wishlist: [
					{
						id: 'wish1',
						userId: 'user3',
						itemId: 'item1',
						notifyOnAvailable: true,
						addedAt: new Date().toISOString()
					}
				]
			})
		);

		confirmBothSides('return', 'req1');
		const notifications = get(appStore).notifications.filter((n) => n.type === 'wishlist-available');
		expect(notifications).toHaveLength(1);
		expect(notifications[0].userId).toBe('user3');
	});

	it('does not notify subscribers who cannot view the item', () => {
		appStore.replaceState(
			createTestState({
				// close-friends item: user3 is not a close friend of user2
				items: [createTestItem({ lenderId: 'user2', available: false, permissionLevel: 'close-friends' })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })],
				wishlist: [
					{
						id: 'wish1',
						userId: 'user3',
						itemId: 'item1',
						notifyOnAvailable: true,
						addedAt: new Date().toISOString()
					}
				]
			})
		);

		confirmBothSides('return', 'req1');
		expect(get(appStore).notifications.filter((n) => n.type === 'wishlist-available')).toHaveLength(0);
	});

	it('does not notify when the item was never unavailable', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: true })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })],
				wishlist: [
					{
						id: 'wish1',
						userId: 'user3',
						itemId: 'item1',
						notifyOnAvailable: true,
						addedAt: new Date().toISOString()
					}
				]
			})
		);

		confirmBothSides('return', 'req1');
		expect(get(appStore).notifications.filter((n) => n.type === 'wishlist-available')).toHaveLength(0);
	});
});
