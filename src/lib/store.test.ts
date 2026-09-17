import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	canUserViewItem,
	getCategoryPath,
	getPermissionLevelInfo,
	currentUser,
	currentUserItems,
	incomingRequests,
	outgoingRequests,
	activeLoans,
	visibleItems
} from './store';
import type { AppState, Item, User, BorrowRequest } from './types';

// Helper to create a minimal test state
function createTestState(overrides: Partial<AppState> = {}): AppState {
	return {
		currentUserId: 'user1',
		users: [
			{
				id: 'user1',
				name: 'Test User 1',
				email: 'test1@example.com',
				profilePic: 'https://example.com/pic1.jpg',
				bio: 'Test bio 1',
				address: { lat: 37.77, lng: -122.42, city: 'San Francisco' },
				friendIds: ['user2'],
				closeFriendIds: ['user2'],
				rating: 4.5,
				totalBorrows: 10,
				totalLends: 15
			},
			{
				id: 'user2',
				name: 'Test User 2',
				email: 'test2@example.com',
				profilePic: 'https://example.com/pic2.jpg',
				bio: 'Test bio 2',
				address: { lat: 37.78, lng: -122.41, city: 'San Francisco' },
				friendIds: ['user1', 'user3'],
				closeFriendIds: ['user1'],
				rating: 4.8,
				totalBorrows: 5,
				totalLends: 20
			},
			{
				id: 'user3',
				name: 'Test User 3',
				email: 'test3@example.com',
				profilePic: 'https://example.com/pic3.jpg',
				bio: 'Test bio 3',
				address: { lat: 37.79, lng: -122.40, city: 'Oakland' },
				friendIds: ['user2'],
				closeFriendIds: [],
				rating: 4.2,
				totalBorrows: 8,
				totalLends: 12
			}
		],
		items: [],
		categories: [
			{ id: 'cat1', name: 'Kitchen', icon: '🍳' },
			{ id: 'cat1-1', name: 'Small Appliances', parentId: 'cat1', icon: '☕' },
			{ id: 'cat1-1-1', name: 'Coffee Makers', parentId: 'cat1-1', icon: '☕' }
		],
		tags: [],
		borrowRequests: [],
		borrowHistory: [],
		friendRequests: [],
		notifications: [],
		wishlist: [],
		...overrides
	};
}

// Helper to create a test item
function createTestItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'item1',
		name: 'Test Item',
		description: 'A test item',
		categoryId: 'cat1',
		lenderId: 'user2',
		imageUrl: 'https://example.com/item.jpg',
		condition: 'good',
		permissionLevel: 'friends',
		tagIds: [],
		rating: 4.5,
		totalBorrows: 5,
		available: true,
		createdAt: '2024-01-01T00:00:00Z',
		...overrides
	};
}

describe('getPermissionLevelInfo', () => {
	it('returns correct info for close-friends', () => {
		const info = getPermissionLevelInfo('close-friends');
		expect(info.label).toBe('Close Friends');
		expect(info.icon).toBe('💚');
		expect(info.color).toBe('#10b981');
	});

	it('returns correct info for friends', () => {
		const info = getPermissionLevelInfo('friends');
		expect(info.label).toBe('Friends');
		expect(info.icon).toBe('👥');
		expect(info.color).toBe('#3b82f6');
	});

	it('returns correct info for friends-of-friends', () => {
		const info = getPermissionLevelInfo('friends-of-friends');
		expect(info.label).toBe('Friends of Friends');
		expect(info.icon).toBe('🔗');
		expect(info.color).toBe('#8b5cf6');
	});

	it('returns correct info for neighbors', () => {
		const info = getPermissionLevelInfo('neighbors');
		expect(info.label).toBe('Neighbors');
		expect(info.icon).toBe('🏘️');
		expect(info.color).toBe('#f59e0b');
	});

	it('returns correct info for specific-users', () => {
		const info = getPermissionLevelInfo('specific-users');
		expect(info.label).toBe('Specific People');
		expect(info.icon).toBe('🔒');
		expect(info.color).toBe('#6b7280');
	});

	it('returns default info for unknown permission level', () => {
		const info = getPermissionLevelInfo('unknown');
		expect(info.label).toBe('Unknown');
		expect(info.icon).toBe('❓');
	});
});

describe('getCategoryPath', () => {
	it('returns path for top-level category', () => {
		const state = createTestState();
		const path = getCategoryPath('cat1', state);
		expect(path).toEqual(['Kitchen']);
	});

	it('returns path for nested category', () => {
		const state = createTestState();
		const path = getCategoryPath('cat1-1', state);
		expect(path).toEqual(['Kitchen', 'Small Appliances']);
	});

	it('returns path for deeply nested category', () => {
		const state = createTestState();
		const path = getCategoryPath('cat1-1-1', state);
		expect(path).toEqual(['Kitchen', 'Small Appliances', 'Coffee Makers']);
	});

	it('returns empty array for non-existent category', () => {
		const state = createTestState();
		const path = getCategoryPath('non-existent', state);
		expect(path).toEqual([]);
	});
});

describe('canUserViewItem', () => {
	it('owner can always view their own items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user1', permissionLevel: 'close-friends' });
		expect(canUserViewItem(item, 'user1', state)).toBe(true);
	});

	it('close friend can view close-friends items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user2', permissionLevel: 'close-friends' });
		// user1 is a close friend of user2
		expect(canUserViewItem(item, 'user1', state)).toBe(true);
	});

	it('regular friend cannot view close-friends items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user2', permissionLevel: 'close-friends' });
		// user3 is a friend but not close friend of user2
		expect(canUserViewItem(item, 'user3', state)).toBe(false);
	});

	it('friend can view friends items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user2', permissionLevel: 'friends' });
		expect(canUserViewItem(item, 'user1', state)).toBe(true);
		expect(canUserViewItem(item, 'user3', state)).toBe(true);
	});

	it('non-friend cannot view friends items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user1', permissionLevel: 'friends' });
		// user3 is not friends with user1
		expect(canUserViewItem(item, 'user3', state)).toBe(false);
	});

	it('friends-of-friends can view items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user1', permissionLevel: 'friends-of-friends' });
		// user3 is friends with user2, who is friends with user1
		expect(canUserViewItem(item, 'user3', state)).toBe(true);
	});

	it('neighbors can view neighbor items if same city', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user2', permissionLevel: 'neighbors' });
		// user1 and user2 are both in San Francisco
		expect(canUserViewItem(item, 'user1', state)).toBe(true);
	});

	it('non-neighbors cannot view neighbor items', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'user2', permissionLevel: 'neighbors' });
		// user3 is in Oakland
		expect(canUserViewItem(item, 'user3', state)).toBe(false);
	});

	it('specific users can view specific-users items', () => {
		const state = createTestState();
		const item = createTestItem({
			lenderId: 'user2',
			permissionLevel: 'specific-users',
			allowedUserIds: ['user1']
		});
		expect(canUserViewItem(item, 'user1', state)).toBe(true);
	});

	it('non-allowed users cannot view specific-users items', () => {
		const state = createTestState();
		const item = createTestItem({
			lenderId: 'user2',
			permissionLevel: 'specific-users',
			allowedUserIds: ['user1']
		});
		expect(canUserViewItem(item, 'user3', state)).toBe(false);
	});

	it('returns false if lender not found', () => {
		const state = createTestState();
		const item = createTestItem({ lenderId: 'non-existent' });
		expect(canUserViewItem(item, 'user1', state)).toBe(false);
	});
});

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

	describe('addItem', () => {
		it('adds a new item to the store', () => {
			const newItem = createTestItem({ id: 'new-item', name: 'New Item' });
			appStore.addItem(newItem);
			const state = get(appStore);
			expect(state.items).toHaveLength(1);
			expect(state.items[0].name).toBe('New Item');
		});
	});

	describe('updateItem', () => {
		it('updates an existing item', () => {
			const item = createTestItem();
			appStore.replaceState(createTestState({ items: [item] }));

			appStore.updateItem('item1', { name: 'Updated Name', condition: 'excellent' });

			const state = get(appStore);
			expect(state.items[0].name).toBe('Updated Name');
			expect(state.items[0].condition).toBe('excellent');
		});

		it('does not affect other items', () => {
			const item1 = createTestItem({ id: 'item1', name: 'Item 1' });
			const item2 = createTestItem({ id: 'item2', name: 'Item 2' });
			appStore.replaceState(createTestState({ items: [item1, item2] }));

			appStore.updateItem('item1', { name: 'Updated' });

			const state = get(appStore);
			expect(state.items[1].name).toBe('Item 2');
		});
	});

	describe('deleteItem', () => {
		it('removes an item from the store', () => {
			const item = createTestItem();
			appStore.replaceState(createTestState({ items: [item] }));

			appStore.deleteItem('item1');

			const state = get(appStore);
			expect(state.items).toHaveLength(0);
		});
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
		it('approves a pending request, reserves the item, and notifies the borrower', () => {
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
			expect(state.items[0].available).toBe(false);
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

	describe('completeBorrow', () => {
		it('completes borrow and adds to history', () => {
			const item = createTestItem({ lenderId: 'user2', rating: 4.0 });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'active',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			appStore.completeBorrow('req1', 5, 'Great item!');

			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('completed');
			expect(state.borrowHistory).toHaveLength(1);
			expect(state.borrowHistory[0].rating).toBe(5);
			expect(state.borrowHistory[0].review).toBe('Great item!');
			expect(state.items[0].available).toBe(true);
		});

		it('updates item rating based on history', () => {
			const item = createTestItem({ lenderId: 'user2', rating: 4.0 });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'active',
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			appStore.completeBorrow('req1', 5, 'Perfect!');

			const state = get(appStore);
			// Rating should be updated (single 5-star rating = 5.0)
			expect(state.items[0].rating).toBe(5);
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
				createdAt: new Date().toISOString()
			};
			appStore.replaceState(createTestState({ items: [item], borrowRequests: [request] }));

			appStore.nudgeRequest('req1');

			const state = get(appStore);
			expect(state.borrowRequests[0].lastNudgedAt).toBeDefined();
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].type).toBe('request-nudge');
		});
	});

	describe('tag actions', () => {
		it('creates a new tag', () => {
			appStore.createTag({
				id: 'tag1',
				name: 'My Tag',
				createdBy: 'user1',
				itemIds: []
			});

			const state = get(appStore);
			expect(state.tags).toHaveLength(1);
			expect(state.tags[0].name).toBe('My Tag');
		});

		it('adds item to tag', () => {
			appStore.replaceState(createTestState({
				tags: [{ id: 'tag1', name: 'Test Tag', createdBy: 'user1', itemIds: [] }]
			}));

			appStore.addItemToTag('tag1', 'item1');

			const state = get(appStore);
			expect(state.tags[0].itemIds).toContain('item1');
		});

		it('removes item from tag', () => {
			appStore.replaceState(createTestState({
				tags: [{ id: 'tag1', name: 'Test Tag', createdBy: 'user1', itemIds: ['item1', 'item2'] }]
			}));

			appStore.removeItemFromTag('tag1', 'item1');

			const state = get(appStore);
			expect(state.tags[0].itemIds).not.toContain('item1');
			expect(state.tags[0].itemIds).toContain('item2');
		});

		it('does not add duplicate items to tag', () => {
			appStore.replaceState(createTestState({
				tags: [{ id: 'tag1', name: 'Test Tag', createdBy: 'user1', itemIds: ['item1'] }]
			}));

			appStore.addItemToTag('tag1', 'item1');

			const state = get(appStore);
			expect(state.tags[0].itemIds).toHaveLength(1);
		});
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

describe('derived stores', () => {
	beforeEach(() => {
		const item1 = createTestItem({ id: 'item1', lenderId: 'user1' });
		const item2 = createTestItem({ id: 'item2', lenderId: 'user2', permissionLevel: 'friends' });
		const request1: BorrowRequest = {
			id: 'req1',
			itemId: 'item2',
			borrowerId: 'user1',
			lenderId: 'user2',
			startDate: '2024-01-15',
			endDate: '2024-01-20',
			status: 'pending',
			createdAt: new Date().toISOString()
		};
		const request2: BorrowRequest = {
			id: 'req2',
			itemId: 'item1',
			borrowerId: 'user2',
			lenderId: 'user1',
			startDate: '2024-01-15',
			endDate: '2024-01-20',
			status: 'active',
			createdAt: new Date().toISOString()
		};

		appStore.replaceState(createTestState({
			items: [item1, item2],
			borrowRequests: [request1, request2]
		}));
	});

	it('currentUser returns the logged-in user', () => {
		const user = get(currentUser);
		expect(user?.id).toBe('user1');
		expect(user?.name).toBe('Test User 1');
	});

	it('currentUserItems returns items owned by current user', () => {
		const items = get(currentUserItems);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe('item1');
	});

	it('incomingRequests returns pending requests to current user', () => {
		// user1 has no pending incoming requests in this setup
		// Let's update with a pending request TO user1
		appStore.replaceState(createTestState({
			items: [createTestItem({ id: 'item1', lenderId: 'user1' })],
			borrowRequests: [{
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user2',
				lenderId: 'user1',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'pending',
				createdAt: new Date().toISOString()
			}]
		}));

		const requests = get(incomingRequests);
		expect(requests).toHaveLength(1);
	});

	it('outgoingRequests returns requests from current user', () => {
		const requests = get(outgoingRequests);
		expect(requests).toHaveLength(1);
		expect(requests[0].id).toBe('req1');
	});

	it('activeLoans returns active loans where user is lender', () => {
		const loans = get(activeLoans);
		expect(loans).toHaveLength(1);
		expect(loans[0].id).toBe('req2');
	});

	it('visibleItems filters based on permissions', () => {
		const items = get(visibleItems);
		// user1 can see both items (owns item1, is friends with user2 for item2)
		expect(items).toHaveLength(2);
	});
});

// Regression tests for bugs fixed in the lifecycle/permissions overhaul

function createLifecycleRequest(overrides: Partial<BorrowRequest> = {}): BorrowRequest {
	return {
		id: 'req1',
		itemId: 'item1',
		borrowerId: 'user1',
		lenderId: 'user2',
		startDate: '2030-01-10',
		endDate: '2030-01-12',
		status: 'pending',
		createdAt: new Date().toISOString(),
		...overrides
	};
}

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
		expect(state.items[0].available).toBe(false);

		expect(appStore.markPickedUp('req1').ok).toBe(true);
		state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('active');

		expect(appStore.completeBorrow('req1', 5, 'Great!').ok).toBe(true);
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

	it('keeps the item unavailable when another loan is still outstanding', () => {
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

		expect(appStore.completeBorrow('req-a', 5, '').ok).toBe(true);
		expect(get(appStore).items[0].available).toBe(false);
	});

	it('increments borrow/lend counters on completion', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', totalBorrows: 5 })],
				borrowRequests: [createLifecycleRequest({ status: 'active' })]
			})
		);

		appStore.completeBorrow('req1', 5, '');
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

describe('permission regressions', () => {
	it('denies neighbors access when either user lacks an address', () => {
		const noAddressLender: User = {
			id: 'user4',
			name: 'No Address Lender',
			email: 'na@example.com',
			profilePic: '',
			bio: '',
			friendIds: [],
			closeFriendIds: [],
			rating: 5,
			totalBorrows: 0,
			totalLends: 0
		};
		const noAddressViewer: User = { ...noAddressLender, id: 'user5', name: 'No Address Viewer' };
		const state = createTestState({
			currentUserId: 'user5',
			items: [createTestItem({ lenderId: 'user4', permissionLevel: 'neighbors' })]
		});
		state.users = [...state.users, noAddressLender, noAddressViewer];

		// Before the fix, undefined === undefined granted access here
		expect(canUserViewItem(state.items[0], 'user5', state)).toBe(false);
		// A user with an address still can't match a lender without one
		expect(canUserViewItem(state.items[0], 'user1', state)).toBe(false);
	});

	it('lets close friends view friends-level items (tiers are inclusive)', () => {
		const state = createTestState();
		// user3 is a close friend of user2 but NOT in user2's friendIds
		state.users = state.users.map((u) =>
			u.id === 'user2' ? { ...u, friendIds: ['user1'], closeFriendIds: ['user1', 'user3'] } : u
		);
		const friendsItem = createTestItem({ lenderId: 'user2', permissionLevel: 'friends' });
		const fofItem = createTestItem({ id: 'item2', lenderId: 'user2', permissionLevel: 'friends-of-friends' });
		state.items = [friendsItem, fofItem];

		expect(canUserViewItem(friendsItem, 'user3', state)).toBe(true);
		expect(canUserViewItem(fofItem, 'user3', state)).toBe(true);
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

		appStore.completeBorrow('req1', 5, '');
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

		appStore.completeBorrow('req1', 5, '');
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

		appStore.completeBorrow('req1', 5, '');
		expect(get(appStore).notifications.filter((n) => n.type === 'wishlist-available')).toHaveLength(0);
	});
});

describe('getCategoryPath cycle guard', () => {
	it('terminates on cyclic parentId chains', () => {
		const state = createTestState({
			categories: [
				{ id: 'catA', name: 'A', parentId: 'catB' },
				{ id: 'catB', name: 'B', parentId: 'catA' }
			]
		});

		// Before the fix this looped forever
		const path = getCategoryPath('catA', state);
		expect(path).toEqual(['B', 'A']);
	});
});

describe('loadState resilience', () => {
	const STORAGE_KEY = 'distributed-library-app-state';

	afterEach(() => {
		localStorage.removeItem(STORAGE_KEY);
		vi.resetModules();
	});

	it('merges legacy stored state missing newer collections', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ currentUserId: 'user1', users: [], items: [] })
		);
		vi.resetModules();
		const mod = await import('./store');

		const state = get(mod.appStore);
		// Older schemas without wishlist/notifications used to crash on load
		expect(Array.isArray(state.wishlist)).toBe(true);
		expect(Array.isArray(state.notifications)).toBe(true);
	});

	it('falls back to defaults on corrupt JSON', async () => {
		localStorage.setItem(STORAGE_KEY, '{definitely not json');
		vi.resetModules();
		const mod = await import('./store');

		const state = get(mod.appStore);
		expect(state.users.length).toBeGreaterThan(0);
		expect(state.currentUserId).toBe('user1');
	});
});
