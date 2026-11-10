import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import { createTestState } from '../../test/fixtures';

describe('appStore actions', () => {
	beforeEach(() => {
		// Reset store to known state before each test
		appStore.replaceState(createTestState());
	});

	describe('friend actions', () => {
		it('sends friend request and creates notification', () => {
			appStore.sendFriendRequest('user1', 'user3', 'Hi, let\'s connect!');

			const state = get(appStore);
			expect(state.friendRequests).toHaveLength(1);
			expect(state.friendRequests[0].status).toBe('pending');
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].userId).toBe('user3');
		});

		it('accepts friend request and adds to friend lists', () => {
			appStore.replaceState(createTestState({
				friendRequests: [{
					id: 'freq1',
					fromUserId: 'user3',
					toUserId: 'user1',
					status: 'pending',
					createdAt: new Date().toISOString()
				}]
			}));

			appStore.acceptFriendRequest('freq1');

			const state = get(appStore);
			expect(state.friendRequests[0].status).toBe('accepted');

			const user1 = state.users.find(u => u.id === 'user1');
			const user3 = state.users.find(u => u.id === 'user3');
			expect(user1?.friendIds).toContain('user3');
			expect(user3?.friendIds).toContain('user1');
		});

		it('declines friend request', () => {
			appStore.replaceState(createTestState({
				friendRequests: [{
					id: 'freq1',
					fromUserId: 'user3',
					toUserId: 'user1',
					status: 'pending',
					createdAt: new Date().toISOString()
				}]
			}));

			appStore.declineFriendRequest('freq1');

			const state = get(appStore);
			expect(state.friendRequests[0].status).toBe('declined');
		});

		it('promotes friend to close friend', () => {
			appStore.promoteToCloseFriend('user1', 'user2');

			const state = get(appStore);
			const user1 = state.users.find(u => u.id === 'user1');
			expect(user1?.closeFriendIds).toContain('user2');
		});

		it('demotes from close friend', () => {
			appStore.demoteFromCloseFriend('user1', 'user2');

			const state = get(appStore);
			const user1 = state.users.find(u => u.id === 'user1');
			expect(user1?.closeFriendIds).not.toContain('user2');
		});
	});
});

describe('friend request regressions', () => {
	it('does not duplicate friendIds when accepting the same request twice', () => {
		appStore.replaceState(
			createTestState({
				friendRequests: [
					{
						id: 'freq1',
						fromUserId: 'user3',
						toUserId: 'user1',
						status: 'pending',
						createdAt: new Date().toISOString()
					}
				]
			})
		);

		appStore.acceptFriendRequest('freq1');
		appStore.acceptFriendRequest('freq1');

		const state = get(appStore);
		const user1Friends = state.users.find((u) => u.id === 'user1')!.friendIds;
		expect(user1Friends.filter((id) => id === 'user3')).toHaveLength(1);
		// The second call is a no-op: only one acceptance notification exists
		expect(state.notifications.filter((n) => n.type === 'friend-request-accepted')).toHaveLength(1);
	});

	it('delivers the decline message to the requester', () => {
		appStore.replaceState(
			createTestState({
				friendRequests: [
					{
						id: 'freq1',
						fromUserId: 'user3',
						toUserId: 'user1',
						status: 'pending',
						createdAt: new Date().toISOString()
					}
				]
			})
		);

		appStore.declineFriendRequest('freq1', 'Sorry, keeping my circle small right now');

		const state = get(appStore);
		expect(state.friendRequests[0].status).toBe('declined');
		const notification = state.notifications.find((n) => n.type === 'friend-request-declined');
		expect(notification?.userId).toBe('user3');
		expect(notification?.message).toContain('Sorry, keeping my circle small right now');
	});

	it('ignores duplicate pending friend requests', () => {
		appStore.replaceState(createTestState());

		appStore.sendFriendRequest('user1', 'user3');
		appStore.sendFriendRequest('user1', 'user3');

		expect(get(appStore).friendRequests).toHaveLength(1);
	});
});
