// Fixture builders shared by the store and domain tests.
import { get } from 'svelte/store';
import { appStore } from '$lib/store';
import type { AppState, Item, BorrowRequest } from '$lib/types';

// Helper to create a minimal test state
export function createTestState(overrides: Partial<AppState> = {}): AppState {
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
export function createTestItem(overrides: Partial<Item> = {}): Item {
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

// Regression tests for bugs fixed in the lifecycle/permissions overhaul

export function createLifecycleRequest(overrides: Partial<BorrowRequest> = {}): BorrowRequest {
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
export function confirmBothSides(
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
