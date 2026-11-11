import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
	appStore,
	canUserViewItem,
	getPermissionLevelInfo,
	visibleItems,
	canViewBorrowerFeedback
} from '$lib/store';
import type { User, BorrowRequest } from '$lib/types';
import { createTestState, createTestItem } from '../../test/fixtures';

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

describe('borrower feedback', () => {
	const req = (status: BorrowRequest['status'], over: Partial<BorrowRequest> = {}): BorrowRequest => ({
		id: `r-${status}`,
		itemId: 'i1',
		borrowerId: 'user3',
		lenderId: 'user1',
		startDate: '2025-01-01',
		endDate: '2025-01-03',
		status,
		createdAt: '2025-01-01',
		...over
	});

	describe('canViewBorrowerFeedback', () => {
		it('allows the profile owner', () => {
			expect(canViewBorrowerFeedback('user3', 'user3', createTestState())).toBe(true);
		});

		it('allows a friend of the profile owner', () => {
			expect(canViewBorrowerFeedback('user3', 'user2', createTestState())).toBe(true);
		});

		it('hides it from strangers', () => {
			expect(canViewBorrowerFeedback('user3', 'user1', createTestState())).toBe(false);
		});

		it.each(['pending', 'approved', 'active'] as const)(
			'allows a stranger with a %s request on their item',
			(status) => {
				const state = createTestState({ borrowRequests: [req(status)] });
				expect(canViewBorrowerFeedback('user3', 'user1', state)).toBe(true);
			}
		);

		it.each(['completed', 'denied', 'cancelled'] as const)(
			'hides it from a stranger with only a %s request',
			(status) => {
				const state = createTestState({ borrowRequests: [req(status)] });
				expect(canViewBorrowerFeedback('user3', 'user1', state)).toBe(false);
			}
		);

		it('ignores requests addressed to a different lender', () => {
			const state = createTestState({ borrowRequests: [req('pending', { lenderId: 'user2' })] });
			expect(canViewBorrowerFeedback('user3', 'user1', state)).toBe(false);
		});
	});
});
