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

export type ItemCondition = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * The lender's assessment of how the borrow went, captured when they confirm
 * the return. It rates the *borrower* (and feeds their reputation), not the
 * item.
 */
export interface LenderReturnFeedback {
  rating?: number;
  review?: string;
  /** New item condition, only when the lender says it changed. */
  condition?: ItemCondition;
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
  /**
   * Two-sided handoff: user ids that have confirmed the pickup / return. The
   * loan only advances once both the borrower and the lender are present.
   * Requests persisted by older versions may lack these — read with `?? []`.
   */
  pickupConfirmedBy?: string[];
  returnConfirmedBy?: string[];
  /** Stashed when the lender confirms the return before the borrower does. */
  lenderReturnFeedback?: LenderReturnFeedback;
}

export interface BorrowHistory {
  id: string;
  itemId: string;
  borrowerId: string;
  lenderId: string;
  startDate: string;
  endDate: string;
  actualReturnDate?: string;
  /**
   * The borrower's review of the *item*. `reviewerId` is set (to the
   * borrower's id) once the review is written, so display code never has to
   * guess who wrote it. These drive `Item.rating`.
   */
  rating?: number;
  review?: string;
  reviewerId?: string;
  reviewedAt?: string;
  /**
   * The lender's rating of the *borrower*, written at return time. These
   * drive the borrower's `User.rating`.
   */
  borrowerRating?: number;
  borrowerReview?: string;
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
  type:
    | 'borrow-request'
    | 'request-approved'
    | 'request-denied'
    | 'request-cancelled'
    | 'return-reminder'
    | 'item-returned'
    | 'pickup-confirmed'
    | 'return-confirmed'
    | 'review-request'
    | 'item-reviewed'
    | 'friend-request'
    | 'friend-request-accepted'
    | 'friend-request-declined'
    | 'request-nudge'
    | 'wishlist-available';
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
