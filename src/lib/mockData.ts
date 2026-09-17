import type { User, Item, Category, Tag, BorrowRequest, BorrowHistory, FriendRequest, Notification, AppState } from './types';
import { addDays, toLocalISODate } from './dates';

// Mock dates are generated relative to today so a fresh install always shows
// a live-looking app (pending requests, an active loan, recent history)
// instead of everything appearing months overdue.
const daysFromNow = (days: number): string => toLocalISODate(addDays(new Date(), days));
const timestampDaysAgo = (days: number, hour = 10): string => {
  const d = addDays(new Date(), -days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// Mock users
export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=1',
    bio: 'Love sharing and borrowing! Avid camper and home chef.',
    address: {
      lat: 37.7749,
      lng: -122.4194,
      city: 'San Francisco'
    },
    friendIds: ['user2', 'user3', 'user4'],
    closeFriendIds: ['user2', 'user3'],
    rating: 4.8,
    totalBorrows: 23,
    totalLends: 31
  },
  {
    id: 'user2',
    name: 'Marcus Johnson',
    email: 'marcus@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=2',
    bio: 'DIY enthusiast and tool collector. Happy to lend!',
    address: {
      lat: 37.7849,
      lng: -122.4094,
      city: 'San Francisco'
    },
    friendIds: ['user1', 'user3', 'user5'],
    closeFriendIds: ['user1'],
    rating: 4.9,
    totalBorrows: 15,
    totalLends: 42
  },
  {
    id: 'user3',
    name: 'Emily Rodriguez',
    email: 'emily@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=3',
    bio: 'Movie buff and board game collector. Always up for sharing!',
    address: {
      lat: 37.7649,
      lng: -122.4294,
      city: 'San Francisco'
    },
    friendIds: ['user1', 'user2', 'user4', 'user5'],
    closeFriendIds: ['user1'],
    rating: 4.7,
    totalBorrows: 28,
    totalLends: 19
  },
  {
    id: 'user4',
    name: 'Alex Kim',
    email: 'alex@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=4',
    bio: 'Outdoor adventure lover. Camping gear for days!',
    address: {
      lat: 37.7549,
      lng: -122.4394,
      city: 'San Francisco'
    },
    friendIds: ['user1', 'user3', 'user7'],
    closeFriendIds: [],
    rating: 4.6,
    totalBorrows: 19,
    totalLends: 25
  },
  {
    id: 'user5',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=5',
    bio: 'Coffee enthusiast and bookworm. Love kitchen gadgets!',
    address: {
      lat: 37.7749,
      lng: -122.4094,
      city: 'San Francisco'
    },
    friendIds: ['user2', 'user3'],
    closeFriendIds: [],
    rating: 4.5,
    totalBorrows: 12,
    totalLends: 18
  },
  {
    id: 'user6',
    name: 'Taylor Martinez',
    email: 'taylor@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=6',
    bio: 'New to the neighborhood! Excited to share and borrow.',
    address: {
      lat: 37.7649,
      lng: -122.4194,
      city: 'San Francisco'
    },
    friendIds: [],
    closeFriendIds: [],
    rating: 4.8,
    totalBorrows: 5,
    totalLends: 8
  },
  {
    id: 'user7',
    name: 'Casey Williams',
    email: 'casey@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=7',
    bio: 'Fitness junkie and weekend warrior. Always borrowing sports gear!',
    address: {
      lat: 37.7849,
      lng: -122.4294,
      city: 'San Francisco'
    },
    friendIds: ['user4'],
    closeFriendIds: [],
    rating: 4.7,
    totalBorrows: 16,
    totalLends: 11
  }
];

// Hierarchical categories
export const mockCategories: Category[] = [
  // Top level
  { id: 'cat1', name: 'Kitchen', icon: '🍳' },
  { id: 'cat2', name: 'Tools', icon: '🔧' },
  { id: 'cat3', name: 'Outdoor & Camping', icon: '⛺' },
  { id: 'cat4', name: 'Entertainment', icon: '🎮' },
  { id: 'cat5', name: 'Sports & Fitness', icon: '⚽' },

  // Kitchen subcategories
  { id: 'cat1-1', name: 'Small Appliances', parentId: 'cat1', icon: '☕' },
  { id: 'cat1-2', name: 'Cookware', parentId: 'cat1', icon: '🍲' },
  { id: 'cat1-3', name: 'Bakeware', parentId: 'cat1', icon: '🧁' },

  // Tools subcategories
  { id: 'cat2-1', name: 'Power Tools', parentId: 'cat2', icon: '⚡' },
  { id: 'cat2-2', name: 'Hand Tools', parentId: 'cat2', icon: '🔨' },
  { id: 'cat2-3', name: 'Outdoor Tools', parentId: 'cat2', icon: '🌳' },

  // Outdoor subcategories
  { id: 'cat3-1', name: 'Camping Gear', parentId: 'cat3', icon: '🏕️' },
  { id: 'cat3-2', name: 'Bikes & Accessories', parentId: 'cat3', icon: '🚴' },

  // Entertainment subcategories
  { id: 'cat4-1', name: 'Gaming', parentId: 'cat4', icon: '🎮' },
  { id: 'cat4-2', name: 'Movies & TV', parentId: 'cat4', icon: '📺' },
  { id: 'cat4-3', name: 'Board Games', parentId: 'cat4', icon: '🎲' },
];

// Custom tags
export const mockTags: Tag[] = [
  { id: 'tag1', name: 'Camping Essentials', createdBy: 'user4', itemIds: ['item6', 'item7', 'item8'] },
  { id: 'tag2', name: "Emily's Favorite Movies", createdBy: 'user3', itemIds: ['item12', 'item13'] },
  { id: 'tag3', name: 'Weekend Projects', createdBy: 'user2', itemIds: ['item4', 'item5'] },
  { id: 'tag4', name: 'Party Must-Haves', createdBy: 'user1', itemIds: ['item11', 'item14'] },
];

// Mock items
export const mockItems: Item[] = [
  {
    id: 'item1',
    name: 'Instant Pot Duo 8Qt',
    description: 'Large 8-quart Instant Pot, perfect for meal prep and family dinners. Barely used, works great!',
    categoryId: 'cat1-1',
    lenderId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400',
    condition: 'excellent',
    permissionLevel: 'friends',
    tagIds: [],
    rating: 4.9,
    totalBorrows: 8,
    available: true,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 'item2',
    name: 'Bread Maker Machine',
    description: 'Automatic bread maker with 12 settings. Makes amazing sourdough!',
    categoryId: 'cat1-1',
    lenderId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
    condition: 'good',
    permissionLevel: 'close-friends',
    tagIds: [],
    rating: 4.5,
    totalBorrows: 5,
    available: true,
    createdAt: '2024-02-10T10:00:00Z'
  },
  {
    id: 'item3',
    name: 'KitchenAid Food Processor',
    description: '12-cup food processor with multiple blade attachments. Great for meal prep!',
    categoryId: 'cat1-1',
    lenderId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=400',
    condition: 'excellent',
    permissionLevel: 'friends',
    tagIds: [],
    rating: 5.0,
    totalBorrows: 12,
    available: false,
    createdAt: '2024-01-20T10:00:00Z'
  },
  {
    id: 'item4',
    name: 'Cordless Drill Set',
    description: 'DeWalt 20V cordless drill with battery pack and various drill bits.',
    categoryId: 'cat2-1',
    lenderId: 'user2',
    imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400',
    condition: 'good',
    permissionLevel: 'friends',
    tagIds: ['tag3'],
    rating: 4.8,
    totalBorrows: 15,
    available: true,
    createdAt: '2024-01-05T10:00:00Z'
  },
  {
    id: 'item5',
    name: '24ft Extension Ladder',
    description: 'Aluminum extension ladder, perfect for gutters and roofing work.',
    categoryId: 'cat2-2',
    lenderId: 'user2',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    condition: 'good',
    permissionLevel: 'friends-of-friends',
    tagIds: ['tag3'],
    rating: 4.7,
    totalBorrows: 9,
    available: true,
    createdAt: '2024-02-01T10:00:00Z'
  },
  {
    id: 'item6',
    name: 'Coleman 4-Person Tent',
    description: 'Easy setup camping tent with rainfly. Great for weekend trips!',
    categoryId: 'cat3-1',
    lenderId: 'user4',
    imageUrl: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400',
    condition: 'good',
    permissionLevel: 'friends',
    tagIds: ['tag1'],
    rating: 4.6,
    totalBorrows: 7,
    available: true,
    createdAt: '2024-03-01T10:00:00Z'
  },
  {
    id: 'item7',
    name: 'Yeti 45 Cooler',
    description: 'Heavy-duty cooler that keeps ice for days. Perfect for camping!',
    categoryId: 'cat3-1',
    lenderId: 'user4',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    condition: 'excellent',
    permissionLevel: 'close-friends',
    tagIds: ['tag1'],
    rating: 5.0,
    totalBorrows: 11,
    available: true,
    createdAt: '2024-03-05T10:00:00Z'
  },
  {
    id: 'item8',
    name: 'Thule Bike Rack (4-bike)',
    description: 'Hitch-mounted bike rack that fits 4 bikes. Very sturdy!',
    categoryId: 'cat3-2',
    lenderId: 'user4',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    condition: 'good',
    permissionLevel: 'friends',
    tagIds: ['tag1'],
    rating: 4.8,
    totalBorrows: 6,
    available: true,
    createdAt: '2024-02-20T10:00:00Z'
  },
  {
    id: 'item9',
    name: 'Electric Pressure Washer',
    description: '2000 PSI pressure washer. Great for decks, driveways, and siding.',
    categoryId: 'cat2-3',
    lenderId: 'user2',
    imageUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400',
    condition: 'excellent',
    permissionLevel: 'friends',
    tagIds: [],
    rating: 4.9,
    totalBorrows: 13,
    available: true,
    createdAt: '2024-01-10T10:00:00Z'
  },
  {
    id: 'item10',
    name: 'Epson Home Projector',
    description: '1080p projector with 3000 lumens. Perfect for movie nights!',
    categoryId: 'cat4-2',
    lenderId: 'user3',
    imageUrl: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400',
    condition: 'excellent',
    permissionLevel: 'friends',
    tagIds: [],
    rating: 5.0,
    totalBorrows: 14,
    available: true,
    createdAt: '2024-02-15T10:00:00Z'
  },
  {
    id: 'item11',
    name: 'Wingspan Board Game',
    description: 'Award-winning bird collection game. So much fun!',
    categoryId: 'cat4-3',
    lenderId: 'user3',
    imageUrl: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=400',
    condition: 'excellent',
    permissionLevel: 'friends',
    tagIds: ['tag4'],
    rating: 4.9,
    totalBorrows: 8,
    available: true,
    createdAt: '2024-03-10T10:00:00Z'
  },
  {
    id: 'item12',
    name: 'Criterion Blu-ray Collection',
    description: '20+ Criterion Collection films including Wes Anderson favorites.',
    categoryId: 'cat4-2',
    lenderId: 'user3',
    imageUrl: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400',
    condition: 'excellent',
    permissionLevel: 'close-friends',
    tagIds: ['tag2'],
    rating: 5.0,
    totalBorrows: 4,
    available: true,
    createdAt: '2024-01-25T10:00:00Z'
  },
  {
    id: 'item13',
    name: 'Studio Ghibli Box Set',
    description: 'Complete Studio Ghibli collection on Blu-ray.',
    categoryId: 'cat4-2',
    lenderId: 'user3',
    imageUrl: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400',
    condition: 'good',
    permissionLevel: 'close-friends',
    tagIds: ['tag2'],
    rating: 5.0,
    totalBorrows: 6,
    available: true,
    createdAt: '2024-02-05T10:00:00Z'
  },
  {
    id: 'item14',
    name: 'Karaoke Machine',
    description: 'Bluetooth karaoke system with two wireless mics. Party time!',
    categoryId: 'cat4',
    lenderId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400',
    condition: 'good',
    permissionLevel: 'friends',
    tagIds: ['tag4'],
    rating: 4.7,
    totalBorrows: 10,
    available: true,
    createdAt: '2024-03-01T10:00:00Z'
  },
  {
    id: 'item15',
    name: 'Canopy Tent 10x10',
    description: 'Pop-up canopy tent for outdoor events and shade.',
    categoryId: 'cat3',
    lenderId: 'user2',
    imageUrl: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=400',
    condition: 'good',
    permissionLevel: 'friends-of-friends',
    tagIds: [],
    rating: 4.5,
    totalBorrows: 8,
    available: true,
    createdAt: '2024-02-28T10:00:00Z'
  },
  {
    id: 'item16',
    name: 'Sewing Machine',
    description: 'Brother sewing machine with accessories. Great for repairs and small projects.',
    categoryId: 'cat2-2',
    lenderId: 'user6',
    imageUrl: 'https://images.unsplash.com/photo-1605117882932-f9e32b03fea9?w=400',
    condition: 'excellent',
    permissionLevel: 'neighbors',
    tagIds: [],
    rating: 4.8,
    totalBorrows: 3,
    available: true,
    createdAt: '2024-03-15T10:00:00Z'
  },
  {
    id: 'item17',
    name: 'Celestron Telescope',
    description: 'NexStar 6SE computerized telescope. Handle with care — shared with trusted friends only.',
    categoryId: 'cat4',
    lenderId: 'user2',
    imageUrl: 'https://images.unsplash.com/photo-1522124624696-7ea32eb9592c?w=400',
    condition: 'excellent',
    permissionLevel: 'specific-users',
    allowedUserIds: ['user1', 'user3'],
    tagIds: [],
    rating: 5.0,
    totalBorrows: 2,
    available: true,
    createdAt: '2024-03-20T10:00:00Z'
  }
];

// Mock borrow requests
export const mockBorrowRequests: BorrowRequest[] = [
  {
    id: 'req1',
    itemId: 'item4',
    borrowerId: 'user1',
    lenderId: 'user2',
    startDate: daysFromNow(3),
    endDate: daysFromNow(5),
    status: 'pending',
    message: 'Need to hang some shelves this weekend!',
    createdAt: timestampDaysAgo(2, 14)
  },
  {
    id: 'req2',
    itemId: 'item10',
    borrowerId: 'user2',
    lenderId: 'user3',
    startDate: daysFromNow(8),
    endDate: daysFromNow(9),
    status: 'pending',
    message: 'Planning a movie night for my birthday!',
    createdAt: timestampDaysAgo(1, 16)
  },
  {
    id: 'req3',
    itemId: 'item3',
    borrowerId: 'user2',
    lenderId: 'user1',
    startDate: daysFromNow(-4),
    endDate: daysFromNow(3),
    status: 'active',
    message: 'Making a big batch of pesto for a party!',
    createdAt: timestampDaysAgo(6)
  },
  {
    id: 'req4',
    itemId: 'item1',
    borrowerId: 'user3',
    lenderId: 'user1',
    startDate: daysFromNow(4),
    endDate: daysFromNow(6),
    status: 'pending',
    message: 'Meal prepping for the week — would this weekend work?',
    createdAt: timestampDaysAgo(1, 9)
  }
];

// Mock borrow history.
// Note: in the current flow the lender writes the rating/review when marking
// an item returned, so these are written in the lender's voice.
export const mockBorrowHistory: BorrowHistory[] = [
  {
    id: 'hist1',
    itemId: 'item1',
    borrowerId: 'user2',
    lenderId: 'user1',
    startDate: daysFromNow(-45),
    endDate: daysFromNow(-41),
    actualReturnDate: daysFromNow(-41),
    rating: 5,
    review: 'Marcus returned it spotless and right on time. Happy to lend again!'
  },
  {
    id: 'hist2',
    itemId: 'item4',
    borrowerId: 'user3',
    lenderId: 'user2',
    startDate: daysFromNow(-38),
    endDate: daysFromNow(-36),
    actualReturnDate: daysFromNow(-36),
    rating: 5,
    review: 'Smooth handoff, drill came back with every bit accounted for.'
  },
  {
    id: 'hist3',
    itemId: 'item10',
    borrowerId: 'user1',
    lenderId: 'user3',
    startDate: daysFromNow(-60),
    endDate: daysFromNow(-59),
    actualReturnDate: daysFromNow(-59),
    rating: 5,
    review: 'Sarah took great care of the projector. Easy lend!'
  },
  {
    id: 'hist4',
    itemId: 'item6',
    borrowerId: 'user1',
    lenderId: 'user4',
    startDate: daysFromNow(-85),
    endDate: daysFromNow(-82),
    actualReturnDate: daysFromNow(-82),
    rating: 4,
    review: 'Tent came back clean, just a little late on the return.'
  },
  {
    id: 'hist5',
    itemId: 'item9',
    borrowerId: 'user4',
    lenderId: 'user2',
    startDate: daysFromNow(-70),
    endDate: daysFromNow(-69),
    actualReturnDate: daysFromNow(-69),
    rating: 5,
    review: 'Alex even topped off the detergent tank. Model borrower!'
  }
];

// Mock friend requests
export const mockFriendRequests: FriendRequest[] = [
  {
    id: 'freq1',
    fromUserId: 'user5',
    toUserId: 'user1',
    status: 'pending',
    message: 'Hey Sarah! I love your camping gear collection. Would love to connect!',
    createdAt: timestampDaysAgo(2, 14)
  },
  {
    id: 'freq2',
    fromUserId: 'user6',
    toUserId: 'user1',
    status: 'pending',
    message: 'Hi! Just moved to the neighborhood and saw you have some great kitchen items.',
    createdAt: timestampDaysAgo(1, 9)
  }
];

// Seed notifications matching the pending activity above, so the bell badge
// agrees with what the dashboard and network pages show on first load.
export const mockNotifications: Notification[] = [
  {
    id: 'notif-seed-1',
    userId: 'user1',
    type: 'borrow-request',
    title: 'New Borrow Request',
    message: 'Emily Rodriguez wants to borrow your Instant Pot Duo 8Qt',
    read: false,
    createdAt: timestampDaysAgo(1, 9),
    relatedId: 'req4'
  },
  {
    id: 'notif-seed-2',
    userId: 'user1',
    type: 'friend-request',
    title: 'New Friend Request',
    message: 'Jordan Lee sent you a friend request',
    read: false,
    createdAt: timestampDaysAgo(2, 14),
    relatedId: 'freq1'
  },
  {
    id: 'notif-seed-3',
    userId: 'user1',
    type: 'friend-request',
    title: 'New Friend Request',
    message: 'Taylor Martinez sent you a friend request',
    read: false,
    createdAt: timestampDaysAgo(1, 9),
    relatedId: 'freq2'
  },
  {
    id: 'notif-seed-4',
    userId: 'user2',
    type: 'borrow-request',
    title: 'New Borrow Request',
    message: 'Sarah Chen wants to borrow your Cordless Drill Set',
    read: false,
    createdAt: timestampDaysAgo(2, 14),
    relatedId: 'req1'
  },
  {
    id: 'notif-seed-5',
    userId: 'user3',
    type: 'borrow-request',
    title: 'New Borrow Request',
    message: 'Marcus Johnson wants to borrow your Epson Home Projector',
    read: false,
    createdAt: timestampDaysAgo(1, 16),
    relatedId: 'req2'
  }
];

// Initial app state
export const initialAppState: AppState = {
  currentUserId: 'user1', // Default logged-in user is Sarah
  users: mockUsers,
  items: mockItems,
  categories: mockCategories,
  tags: mockTags,
  borrowRequests: mockBorrowRequests,
  borrowHistory: mockBorrowHistory,
  friendRequests: mockFriendRequests,
  notifications: mockNotifications,
  wishlist: []
};
