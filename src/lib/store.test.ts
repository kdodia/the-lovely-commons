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
	borrowedByMe,
	visibleItems,
	hasConfirmed,
	pendingItemReviews
} from './store';
import type { AppState, Item, User, BorrowRequest, BorrowHistory, Tag } from './types';

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
		it('removes an item the current user owns', () => {
			const item = createTestItem({ lenderId: 'user1' });
			appStore.replaceState(createTestState({ items: [item] }));

			expect(appStore.deleteItem('item1')).toEqual({ ok: true });
			expect(get(appStore).items).toHaveLength(0);
		});

		it('refuses to delete someone else\'s item', () => {
			appStore.replaceState(createTestState({ items: [createTestItem({ lenderId: 'user2' })] }));

			const result = appStore.deleteItem('item1');
			expect(result.ok).toBe(false);
			expect(get(appStore).items).toHaveLength(1);
		});

		it('returns an error for an unknown item', () => {
			expect(appStore.deleteItem('nope').ok).toBe(false);
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

	describe('confirmReturn', () => {
		function activeLoanState() {
			const item = createTestItem({ lenderId: 'user2', rating: 4.0 });
			const request: BorrowRequest = {
				id: 'req1',
				itemId: 'item1',
				borrowerId: 'user1',
				lenderId: 'user2',
				startDate: '2024-01-15',
				endDate: '2024-01-20',
				status: 'active',
				pickupConfirmedBy: ['user1', 'user2'],
				createdAt: new Date().toISOString()
			};
			return createTestState({ items: [item], borrowRequests: [request] });
		}

		it('completes the borrow once both sides confirm and records the lender feedback', () => {
			appStore.replaceState(activeLoanState());

			appStore.setCurrentUser('user2');
			expect(appStore.confirmReturn('req1', { rating: 5, review: 'Great borrower!' })).toEqual({ ok: true });
			expect(get(appStore).borrowRequests[0].status).toBe('active');
			expect(get(appStore).borrowHistory).toHaveLength(0);

			appStore.setCurrentUser('user1');
			expect(appStore.confirmReturn('req1')).toEqual({ ok: true });

			const state = get(appStore);
			expect(state.borrowRequests[0].status).toBe('completed');
			expect(state.borrowHistory).toHaveLength(1);
			expect(state.borrowHistory[0].borrowerRating).toBe(5);
			expect(state.borrowHistory[0].borrowerReview).toBe('Great borrower!');
			// No item review yet — that's the borrower's job
			expect(state.borrowHistory[0].rating).toBeUndefined();
			expect(state.borrowHistory[0].reviewerId).toBeUndefined();
			expect(state.items[0].available).toBe(true);
		});

		it('leaves the item rating alone until a borrower reviews it', () => {
			appStore.replaceState(activeLoanState());

			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 5 });
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1');

			expect(get(appStore).items[0].rating).toBe(4.0);
		});

		it('folds the lender rating into the borrower reputation', () => {
			appStore.replaceState(activeLoanState());
			// user1 starts at 4.5 over 10 borrows; one 5 → (45 + 5) / 11 ≈ 4.5, one 1 → 4.2
			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 1 });
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1');

			const borrower = get(appStore).users.find((u) => u.id === 'user1');
			expect(borrower?.rating).toBe(4.2);
			expect(borrower?.totalBorrows).toBe(11);
		});

		it('asks the borrower to review the item once the return completes', () => {
			appStore.replaceState(activeLoanState());
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1');
			expect(get(appStore).notifications.filter((n) => n.type === 'review-request')).toHaveLength(0);

			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 5 });

			const prompts = get(appStore).notifications.filter((n) => n.type === 'review-request');
			expect(prompts).toHaveLength(1);
			expect(prompts[0].userId).toBe('user1');
			expect(prompts[0].relatedId).toBe('item1');
		});

		it('keeps the lender feedback even when the lender confirms first', () => {
			appStore.replaceState(activeLoanState());
			appStore.setCurrentUser('user2');
			appStore.confirmReturn('req1', { rating: 3, condition: 'fair' });
			appStore.setCurrentUser('user1');
			appStore.confirmReturn('req1', { rating: 5 }); // borrower's "feedback" is ignored

			const state = get(appStore);
			expect(state.borrowHistory[0].borrowerRating).toBe(3);
			expect(state.borrowHistory[0].conditionAfter).toBe('fair');
			expect(state.items[0].condition).toBe('fair');
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

/** Confirm a handoff step from both parties, restoring the current user afterwards. */
function confirmBothSides(
	step: 'pickup' | 'return',
	requestId: string,
	lenderFeedback: { rating?: number; review?: string } = { rating: 5 }
) {
	const before = get(appStore);
	const request = before.borrowRequests.find((r) => r.id === requestId);
	if (!request) throw new Error(`no request ${requestId}`);
	const original = before.currentUserId;

	appStore.setCurrentUser(request.lenderId);
	const lenderResult =
		step === 'pickup'
			? appStore.confirmPickup(requestId)
			: appStore.confirmReturn(requestId, lenderFeedback);
	appStore.setCurrentUser(request.borrowerId);
	const borrowerResult =
		step === 'pickup' ? appStore.confirmPickup(requestId) : appStore.confirmReturn(requestId);
	appStore.setCurrentUser(original);

	if (!lenderResult.ok) return lenderResult;
	return borrowerResult;
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

		expect(confirmBothSides('pickup', 'req1').ok).toBe(true);
		state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('active');

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

describe('item deletion cleanup', () => {
	function stateWithItem(requests: BorrowRequest[] = []) {
		return createTestState({
			items: [createTestItem({ lenderId: 'user1' })],
			tags: [{ id: 'tag1', name: 'Kitchen', createdBy: 'user1', itemIds: ['item1', 'other'] }],
			wishlist: [
				{ id: 'w1', userId: 'user2', itemId: 'item1', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' },
				{ id: 'w2', userId: 'user2', itemId: 'other', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' }
			],
			borrowRequests: requests
		});
	}

	it('is blocked while the item is reserved or on loan', () => {
		for (const status of ['approved', 'active'] as const) {
			appStore.replaceState(
				stateWithItem([createLifecycleRequest({ borrowerId: 'user2', lenderId: 'user1', status })])
			);
			const result = appStore.deleteItem('item1');
			expect(result.ok).toBe(false);
			expect(get(appStore).items).toHaveLength(1);
		}
	});

	it('scrubs the item from tags and wishlists', () => {
		appStore.replaceState(stateWithItem());
		expect(appStore.deleteItem('item1').ok).toBe(true);

		const state = get(appStore);
		expect(state.tags[0].itemIds).toEqual(['other']);
		expect(state.wishlist.map((w) => w.id)).toEqual(['w2']);
	});

	it('declines outstanding pending requests and tells each requester', () => {
		appStore.replaceState(
			stateWithItem([
				createLifecycleRequest({ id: 'p1', borrowerId: 'user2', lenderId: 'user1' }),
				createLifecycleRequest({ id: 'p2', borrowerId: 'user3', lenderId: 'user1', startDate: '2030-03-01', endDate: '2030-03-02' }),
				createLifecycleRequest({ id: 'done', borrowerId: 'user3', lenderId: 'user1', status: 'completed' })
			])
		);
		expect(appStore.deleteItem('item1').ok).toBe(true);

		const state = get(appStore);
		expect(state.borrowRequests.find((r) => r.id === 'p1')?.status).toBe('denied');
		expect(state.borrowRequests.find((r) => r.id === 'p2')?.status).toBe('denied');
		expect(state.borrowRequests.find((r) => r.id === 'done')?.status).toBe('completed');
		const denials = state.notifications.filter((n) => n.type === 'request-denied');
		expect(denials.map((n) => n.userId).sort()).toEqual(['user2', 'user3']);
	});
});

describe('tag management', () => {
	const tag: Tag = { id: 'tag1', name: 'Old Name', createdBy: 'user1', itemIds: ['item1'] };

	beforeEach(() => {
		appStore.replaceState(createTestState({ tags: [tag] }));
	});

	it('renames a tag', () => {
		appStore.updateTag('tag1', { name: 'New Name' });
		expect(get(appStore).tags[0].name).toBe('New Name');
		expect(get(appStore).tags[0].itemIds).toEqual(['item1']);
	});

	it('deletes a tag the current user created', () => {
		expect(appStore.deleteTag('tag1')).toEqual({ ok: true });
		expect(get(appStore).tags).toHaveLength(0);
	});

	it('refuses to delete another user\'s tag', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.deleteTag('tag1').ok).toBe(false);
		expect(get(appStore).tags).toHaveLength(1);
	});

	it('reports an unknown tag', () => {
		expect(appStore.deleteTag('missing').ok).toBe(false);
	});
});

describe('specific-users items', () => {
	it('are visible only to the hand-picked users (and the owner)', () => {
		appStore.replaceState(createTestState({ currentUserId: 'user2' }));
		appStore.addItem(
			createTestItem({ lenderId: 'user2', permissionLevel: 'specific-users', allowedUserIds: ['user3'] })
		);

		// owner
		expect(get(visibleItems)).toHaveLength(1);
		// allowed
		appStore.setCurrentUser('user3');
		expect(get(visibleItems)).toHaveLength(1);
		// a close friend who wasn't picked
		appStore.setCurrentUser('user1');
		expect(get(visibleItems)).toHaveLength(0);
	});

	it('hide from everyone but the owner when nobody is picked', () => {
		appStore.replaceState(createTestState({ currentUserId: 'user2' }));
		appStore.addItem(createTestItem({ lenderId: 'user2', permissionLevel: 'specific-users', allowedUserIds: [] }));
		appStore.setCurrentUser('user1');
		expect(get(visibleItems)).toHaveLength(0);
	});
});

describe('borrowedByMe', () => {
	it('returns approved and active loans where the current user is the borrower', () => {
		appStore.replaceState(
			createTestState({
				borrowRequests: [
					createLifecycleRequest({ id: 'mine-approved', status: 'approved' }),
					createLifecycleRequest({ id: 'mine-active', status: 'active' }),
					createLifecycleRequest({ id: 'mine-pending', status: 'pending' }),
					createLifecycleRequest({ id: 'mine-done', status: 'completed' }),
					createLifecycleRequest({ id: 'theirs', status: 'active', borrowerId: 'user3', lenderId: 'user1' })
				]
			})
		);

		expect(get(borrowedByMe).map((r) => r.id).sort()).toEqual(['mine-active', 'mine-approved']);
		// and the lender-side stores don't leak the borrower's loans
		expect(get(activeLoans).map((r) => r.id)).toEqual(['theirs']);
	});
});

describe('two-sided pickup', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ status: 'approved' })]
			})
		);
	});

	it('does not advance on a single confirmation', () => {
		expect(appStore.confirmPickup('req1')).toEqual({ ok: true });
		const request = get(appStore).borrowRequests[0];
		expect(request.status).toBe('approved');
		expect(request.pickupConfirmedBy).toEqual(['user1']);
		expect(hasConfirmed(request, 'pickup', 'user1')).toBe(true);
		expect(hasConfirmed(request, 'pickup', 'user2')).toBe(false);
	});

	it('nudges the other party after the first confirmation', () => {
		appStore.confirmPickup('req1');
		const notes = get(appStore).notifications.filter((n) => n.type === 'pickup-confirmed');
		expect(notes).toHaveLength(1);
		expect(notes[0].userId).toBe('user2');
		expect(notes[0].message).toContain('confirm on your side');
	});

	it('activates the loan once both parties confirm, in either order', () => {
		appStore.setCurrentUser('user2');
		appStore.confirmPickup('req1');
		appStore.setCurrentUser('user1');
		appStore.confirmPickup('req1');
		expect(get(appStore).borrowRequests[0].status).toBe('active');
	});

	it('rejects users who are not party to the loan', () => {
		appStore.setCurrentUser('user3');
		expect(appStore.confirmPickup('req1').ok).toBe(false);
		expect(get(appStore).borrowRequests[0].pickupConfirmedBy ?? []).toHaveLength(0);
	});

	it('rejects confirming twice from the same side', () => {
		expect(appStore.confirmPickup('req1').ok).toBe(true);
		expect(appStore.confirmPickup('req1').ok).toBe(false);
		expect(get(appStore).borrowRequests[0].pickupConfirmedBy).toEqual(['user1']);
	});

	it('rejects pickup on a request that is not approved', () => {
		appStore.replaceState(
			createTestState({ borrowRequests: [createLifecycleRequest({ status: 'pending' })] })
		);
		expect(appStore.confirmPickup('req1').ok).toBe(false);
	});

	it('treats legacy requests without confirmation arrays as unconfirmed', () => {
		const legacy = createLifecycleRequest({ status: 'approved' });
		delete legacy.pickupConfirmedBy;
		delete legacy.returnConfirmedBy;
		appStore.replaceState(createTestState({ borrowRequests: [legacy] }));

		expect(hasConfirmed(legacy, 'pickup', 'user1')).toBe(false);
		expect(appStore.confirmPickup('req1').ok).toBe(true);
		expect(get(appStore).borrowRequests[0].pickupConfirmedBy).toEqual(['user1']);
	});
});

describe('two-sided return', () => {
	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', available: false })],
				borrowRequests: [createLifecycleRequest({ status: 'active', pickupConfirmedBy: ['user1', 'user2'] })]
			})
		);
	});

	it('does not complete on a single confirmation', () => {
		expect(appStore.confirmReturn('req1')).toEqual({ ok: true });
		const state = get(appStore);
		expect(state.borrowRequests[0].status).toBe('active');
		expect(state.borrowHistory).toHaveLength(0);
		expect(state.items[0].available).toBe(false);
		const notes = state.notifications.filter((n) => n.type === 'return-confirmed');
		expect(notes.map((n) => n.userId)).toEqual(['user2']);
	});

	it('rejects non-parties and double confirmations', () => {
		appStore.setCurrentUser('user3');
		expect(appStore.confirmReturn('req1').ok).toBe(false);
		appStore.setCurrentUser('user1');
		expect(appStore.confirmReturn('req1').ok).toBe(true);
		expect(appStore.confirmReturn('req1').ok).toBe(false);
	});

	it('rejects a return on a loan that is not active', () => {
		appStore.replaceState(
			createTestState({ borrowRequests: [createLifecycleRequest({ status: 'approved' })] })
		);
		expect(appStore.confirmReturn('req1').ok).toBe(false);
	});

	it('rejects an out-of-range lender rating', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.confirmReturn('req1', { rating: 9 }).ok).toBe(false);
		expect(get(appStore).borrowRequests[0].returnConfirmedBy ?? []).toHaveLength(0);
	});
});

describe('submitItemReview', () => {
	const completed: BorrowHistory = {
		id: 'hist1',
		itemId: 'item1',
		borrowerId: 'user1',
		lenderId: 'user2',
		startDate: '2024-01-01',
		endDate: '2024-01-03',
		borrowerRating: 5
	};

	beforeEach(() => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', rating: 4.0 })],
				borrowHistory: [completed]
			})
		);
	});

	it('lets the borrower review once and recomputes the item rating from borrower reviews', () => {
		expect(pendingItemReviews(get(appStore), 'item1', 'user1')).toHaveLength(1);

		expect(appStore.submitItemReview('hist1', 3, '  Works, but loud.  ')).toEqual({ ok: true });

		const state = get(appStore);
		const entry = state.borrowHistory[0];
		expect(entry.rating).toBe(3);
		expect(entry.review).toBe('Works, but loud.');
		expect(entry.reviewerId).toBe('user1');
		expect(entry.reviewedAt).toBeTruthy();
		// The lender's rating of the borrower is untouched
		expect(entry.borrowerRating).toBe(5);
		// Item rating now comes from borrower reviews only
		expect(state.items[0].rating).toBe(3);
		expect(pendingItemReviews(state, 'item1', 'user1')).toHaveLength(0);

		// Second attempt is refused
		expect(appStore.submitItemReview('hist1', 5, 'changed my mind').ok).toBe(false);
		expect(get(appStore).borrowHistory[0].rating).toBe(3);
	});

	it('averages across multiple borrower reviews', () => {
		appStore.replaceState(
			createTestState({
				items: [createTestItem({ lenderId: 'user2', rating: 4.0 })],
				borrowHistory: [
					{ ...completed, id: 'h-old', rating: 5, review: 'great', reviewerId: 'user3', borrowerId: 'user3' },
					completed
				]
			})
		);
		appStore.submitItemReview('hist1', 4, '');
		expect(get(appStore).items[0].rating).toBe(4.5);
	});

	it('rejects anyone but the borrower', () => {
		appStore.setCurrentUser('user2');
		expect(appStore.submitItemReview('hist1', 5, 'nice').ok).toBe(false);
		expect(get(appStore).borrowHistory[0].reviewerId).toBeUndefined();
	});

	it('rejects invalid ratings and unknown borrows', () => {
		expect(appStore.submitItemReview('hist1', 0, '').ok).toBe(false);
		expect(appStore.submitItemReview('hist1', 6, '').ok).toBe(false);
		expect(appStore.submitItemReview('missing', 5, '').ok).toBe(false);
	});

	it('notifies the lender', () => {
		appStore.submitItemReview('hist1', 4, 'Solid.');
		const notes = get(appStore).notifications.filter((n) => n.type === 'item-reviewed');
		expect(notes).toHaveLength(1);
		expect(notes[0].userId).toBe('user2');
		expect(notes[0].relatedId).toBe('item1');
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

	it('releases the item when an approved reservation is cancelled', () => {
		appStore.replaceState(createTestState({
			items: [createTestItem({ lenderId: 'user2', available: false })],
			borrowRequests: [createLifecycleRequest({ status: 'approved' })],
			wishlist: [{ id: 'w1', userId: 'user3', itemId: 'item1', notifyOnAvailable: true, addedAt: '2024-01-01T00:00:00Z' }]
		}));
		// lender retracts
		appStore.setCurrentUser('user2');
		expect(appStore.cancelRequest('req1').ok).toBe(true);
		const state = get(appStore);
		expect(state.items[0].available).toBe(true);
		expect(state.notifications.filter((n) => n.type === 'wishlist-available').map((n) => n.userId)).toEqual(['user3']);
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

	it('migrates legacy lender-written reviews and requests without handoff arrays', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				currentUserId: 'user1',
				users: [{ id: 'user1', name: 'Legacy', email: '', profilePic: '', bio: '', friendIds: [], closeFriendIds: [], rating: 5, totalBorrows: 0, totalLends: 0 }],
				items: [],
				borrowRequests: [
					{ id: 'r1', itemId: 'i1', borrowerId: 'user1', lenderId: 'user2', startDate: '2024-01-01', endDate: '2024-01-02', status: 'approved', createdAt: '2024-01-01T00:00:00Z' }
				],
				borrowHistory: [
					{ id: 'h1', itemId: 'i1', borrowerId: 'user1', lenderId: 'user2', startDate: '2024-01-01', endDate: '2024-01-02', rating: 4, review: 'Returned on time' },
					{ id: 'h2', itemId: 'i1', borrowerId: 'user1', lenderId: 'user2', startDate: '2024-02-01', endDate: '2024-02-02', rating: 5, review: 'Loved it', reviewerId: 'user1' }
				]
			})
		);
		vi.resetModules();
		const mod = await import('./store');

		const state = get(mod.appStore);
		expect(state.borrowRequests[0].pickupConfirmedBy).toEqual([]);
		expect(state.borrowRequests[0].returnConfirmedBy).toEqual([]);

		const legacy = state.borrowHistory.find((h) => h.id === 'h1');
		expect(legacy?.rating).toBeUndefined();
		expect(legacy?.review).toBeUndefined();
		expect(legacy?.borrowerRating).toBe(4);
		expect(legacy?.borrowerReview).toBe('Returned on time');

		const modern = state.borrowHistory.find((h) => h.id === 'h2');
		expect(modern?.rating).toBe(5);
		expect(modern?.reviewerId).toBe('user1');
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
