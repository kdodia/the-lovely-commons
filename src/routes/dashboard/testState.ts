import type { AppState, BorrowRequest } from '$lib/types';

/** Two users (lender is the current user), one item, no requests. For the dashboard tests. */
export function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    currentUserId: 'lender',
    users: [
      {
        id: 'lender',
        name: 'Lena Lender',
        email: 'l@example.com',
        profilePic: '',
        bio: '',
        friendIds: ['borrower'],
        closeFriendIds: [],
        rating: 5,
        totalBorrows: 0,
        totalLends: 0
      },
      {
        id: 'borrower',
        name: 'Bo Borrower',
        email: 'b@example.com',
        profilePic: '',
        bio: '',
        friendIds: ['lender'],
        closeFriendIds: [],
        rating: 4,
        totalBorrows: 0,
        totalLends: 0
      }
    ],
    items: [
      {
        id: 'item1',
        name: 'Stand Mixer',
        description: '',
        categoryId: 'c',
        lenderId: 'lender',
        imageUrl: '',
        condition: 'good',
        permissionLevel: 'friends',
        tagIds: [],
        rating: 5,
        totalBorrows: 0,
        available: false,
        createdAt: '2024-01-01T00:00:00Z'
      }
    ],
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

export function request(overrides: Partial<BorrowRequest> = {}): BorrowRequest {
  return {
    id: 'req1',
    itemId: 'item1',
    borrowerId: 'borrower',
    lenderId: 'lender',
    startDate: '2030-01-10',
    endDate: '2030-01-12',
    status: 'pending',
    message: 'Can I borrow this?',
    createdAt: '2030-01-01T00:00:00Z',
    ...overrides
  };
}
