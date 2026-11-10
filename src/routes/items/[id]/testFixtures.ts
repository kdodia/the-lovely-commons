import type { AppState, Item } from '$lib/types';

/** Shared fixture for the item-page component tests: a borrower viewing a lender's item. */
export const item: Item = {
	id: 'item1',
	name: 'Stand Mixer',
	description: 'Mixes',
	categoryId: 'c',
	lenderId: 'lender',
	imageUrl: '',
	condition: 'good',
	permissionLevel: 'friends',
	tagIds: [],
	rating: 5,
	totalBorrows: 0,
	available: true,
	createdAt: '2024-01-01T00:00:00Z'
};

export function itemPageState(overrides: Partial<AppState> = {}): AppState {
	const user = (id: string, name: string) => ({
		id,
		name,
		email: `${id}@example.com`,
		profilePic: '',
		bio: '',
		friendIds: [],
		closeFriendIds: [],
		rating: 5,
		totalBorrows: 0,
		totalLends: 0
	});
	return {
		currentUserId: 'borrower',
		users: [user('lender', 'Lena Lender'), user('borrower', 'Bo Borrower')],
		items: [item],
		categories: [],
		tags: [],
		borrowRequests: [],
		borrowHistory: [],
		friendRequests: [],
		notifications: [],
		wishlist: [],
		...overrides
	};
}
