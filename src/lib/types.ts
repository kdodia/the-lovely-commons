// Core data types for the distributed library app

export type PermissionLevel = 'specific-users' | 'close-friends' | 'friends' | 'friends-of-friends' | 'neighbors';

export interface User {
  id: string;
  name: string;
  email: string;
  profilePic: string;
  bio: string;
  address?: {
    lat: number;
    lng: number;
    city: string;
  };
  friendIds: string[];
  closeFriendIds: string[];
  rating: number;
  totalBorrows: number;
  totalLends: number;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
}

export interface Tag {
  id: string;
  name: string;
  createdBy: string;
  itemIds: string[];
}

export interface BorrowRequest {
  id: string;
  itemId: string;
  borrowerId: string;
  lenderId: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'denied' | 'active' | 'completed' | 'cancelled';
  message?: string;
  createdAt: string;
  lastNudgedAt?: string; // When the borrower last sent a reminder to the lender
}

export type ItemCondition = 'excellent' | 'good' | 'fair' | 'poor';

export interface BorrowHistory {
  id: string;
  itemId: string;
  borrowerId: string;
  lenderId: string;
  startDate: string;
  endDate: string;
  actualReturnDate?: string;
  rating?: number;
  review?: string;
  conditionBefore?: ItemCondition;
  conditionAfter?: ItemCondition;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  lenderId: string;
  imageUrl: string;
  condition: ItemCondition;
  permissionLevel: PermissionLevel;
  allowedUserIds?: string[]; // for 'specific-users' permission level
  tagIds: string[];
  rating: number;
  totalBorrows: number;
  available: boolean;
  blockedDates?: Array<{ startDate: string; endDate: string; reason?: string }>; // dates blocked for personal use
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  itemId: string;
  notifyOnAvailable: boolean;
  addedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'borrow-request' | 'request-approved' | 'request-denied' | 'return-reminder' | 'item-returned' | 'friend-request' | 'friend-request-accepted' | 'friend-request-declined' | 'request-nudge' | 'wishlist-available';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string; // request id or item id
}

export interface AppState {
  currentUserId: string;
  users: User[];
  items: Item[];
  categories: Category[];
  tags: Tag[];
  borrowRequests: BorrowRequest[];
  borrowHistory: BorrowHistory[];
  friendRequests: FriendRequest[];
  notifications: Notification[];
  wishlist: WishlistItem[];
}
