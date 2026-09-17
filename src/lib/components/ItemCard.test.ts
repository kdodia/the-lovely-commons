import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ItemCard from './ItemCard.svelte';
import { appStore } from '$lib/store';
import type { Item, AppState } from '$lib/types';

// Helper to create test state
function createTestState(): AppState {
	return {
		currentUserId: 'user1',
		users: [
			{
				id: 'user1',
				name: 'Test User',
				email: 'test@example.com',
				profilePic: 'https://example.com/pic.jpg',
				bio: 'Test bio',
				friendIds: [],
				closeFriendIds: [],
				rating: 4.5,
				totalBorrows: 10,
				totalLends: 15
			},
			{
				id: 'user2',
				name: 'Lender User',
				email: 'lender@example.com',
				profilePic: 'https://example.com/lender.jpg',
				bio: 'Lender bio',
				friendIds: ['user1'],
				closeFriendIds: [],
				rating: 4.8,
				totalBorrows: 5,
				totalLends: 20
			}
		],
		items: [],
		categories: [],
		tags: [],
		borrowRequests: [],
		borrowHistory: [],
		friendRequests: [],
		notifications: [],
		wishlist: []
	};
}

// Helper to create a test item
function createTestItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'item1',
		name: 'Test Item',
		description: 'A wonderful test item that is perfect for testing purposes and demonstrations.',
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

describe('ItemCard', () => {
	beforeEach(() => {
		appStore.replaceState(createTestState());
	});

	it('renders item name', () => {
		const item = createTestItem({ name: 'My Special Item' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('My Special Item')).toBeInTheDocument();
	});

	it('renders item rating', () => {
		const item = createTestItem({ rating: 4.7 });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('4.7')).toBeInTheDocument();
	});

	it('renders item condition badge', () => {
		const item = createTestItem({ condition: 'excellent' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('excellent')).toBeInTheDocument();
	});

	it('renders borrow count', () => {
		const item = createTestItem({ totalBorrows: 12 });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('12 borrows')).toBeInTheDocument();
	});

	it('renders truncated description', () => {
		const longDescription = 'A'.repeat(100);
		const item = createTestItem({ description: longDescription });
		render(ItemCard, { props: { item } });

		// Description should be truncated to 80 chars + "..."
		const expectedText = 'A'.repeat(80) + '...';
		expect(screen.getByText(expectedText)).toBeInTheDocument();
	});

	it('does not append an ellipsis to short descriptions', () => {
		const item = createTestItem({ description: 'Short and sweet' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('Short and sweet')).toBeInTheDocument();
		expect(screen.queryByText('Short and sweet...')).not.toBeInTheDocument();
	});

	it('shows unavailable badge when item is borrowed', () => {
		const item = createTestItem({ available: false });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('Currently Borrowed')).toBeInTheDocument();
	});

	it('does not show unavailable badge when item is available', () => {
		const item = createTestItem({ available: true });
		render(ItemCard, { props: { item } });

		expect(screen.queryByText('Currently Borrowed')).not.toBeInTheDocument();
	});

	it('renders lender name', () => {
		const item = createTestItem({ lenderId: 'user2' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('Lender User')).toBeInTheDocument();
	});

	it('displays correct permission level for friends', () => {
		const item = createTestItem({ permissionLevel: 'friends' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('Friends')).toBeInTheDocument();
	});

	it('displays correct permission level for close-friends', () => {
		const item = createTestItem({ permissionLevel: 'close-friends' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('Close Friends')).toBeInTheDocument();
	});

	it('displays correct permission level for neighbors', () => {
		const item = createTestItem({ permissionLevel: 'neighbors' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('Neighbors')).toBeInTheDocument();
	});

	it('links to item detail page', () => {
		const item = createTestItem({ id: 'item123' });
		render(ItemCard, { props: { item } });

		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/items/item123');
	});

	it('renders item image with correct alt text', () => {
		const item = createTestItem({
			name: 'Camera',
			imageUrl: 'https://example.com/camera.jpg'
		});
		render(ItemCard, { props: { item } });

		const img = screen.getByAltText('Camera');
		expect(img).toHaveAttribute('src', 'https://example.com/camera.jpg');
	});

	it('renders lender avatar', () => {
		const item = createTestItem({ lenderId: 'user2' });
		render(ItemCard, { props: { item } });

		const avatar = screen.getByAltText('Lender User');
		expect(avatar).toBeInTheDocument();
	});
});

describe('ItemCard permission badges', () => {
	beforeEach(() => {
		appStore.replaceState(createTestState());
	});

	it('shows correct icon for close-friends permission', () => {
		const item = createTestItem({ permissionLevel: 'close-friends' });
		render(ItemCard, { props: { item } });

		// The badge should contain the heart icon
		expect(screen.getByText('💚')).toBeInTheDocument();
	});

	it('shows correct icon for friends permission', () => {
		const item = createTestItem({ permissionLevel: 'friends' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('👥')).toBeInTheDocument();
	});

	it('shows correct icon for friends-of-friends permission', () => {
		const item = createTestItem({ permissionLevel: 'friends-of-friends' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('🔗')).toBeInTheDocument();
	});

	it('shows correct icon for neighbors permission', () => {
		const item = createTestItem({ permissionLevel: 'neighbors' });
		render(ItemCard, { props: { item } });

		expect(screen.getByText('🏘️')).toBeInTheDocument();
	});
});

describe('ItemCard conditions', () => {
	beforeEach(() => {
		appStore.replaceState(createTestState());
	});

	const conditions: Array<'excellent' | 'good' | 'fair' | 'poor'> = ['excellent', 'good', 'fair', 'poor'];

	conditions.forEach(condition => {
		it(`displays ${condition} condition`, () => {
			const item = createTestItem({ condition });
			render(ItemCard, { props: { item } });

			expect(screen.getByText(condition)).toBeInTheDocument();
		});
	});
});
