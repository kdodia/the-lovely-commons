/**
 * Who may see what.
 *
 * Items. The owner always sees their own items. Anyone else is judged by the
 * item's permission level against the lender's friend lists:
 *   - specific-users: only users listed in the item's `allowedUserIds`.
 *   - close-friends: only users in the lender's `closeFriendIds`.
 *   - friends: users in the lender's `friendIds` or `closeFriendIds` (the
 *     tiers are inclusive, so close friends count as friends).
 *   - friends-of-friends: friends as above, plus anyone whose own
 *     `friendIds` shares someone with the lender's `friendIds`.
 *   - neighbors: users whose address city equals the lender's; a user or
 *     lender without a known city never matches.
 * If the lender no longer exists, or the level is unknown, only the owner
 * sees the item.
 *
 * Borrower feedback (what lenders wrote about someone as a borrower) is not
 * public. It may be read by the person themselves, by their friends or close
 * friends, and by a lender who has a pending, approved or active request
 * from them.
 */
import type { AppState, Item, User } from '../types';

// Whether a user is at least a friend of the lender (close friends count too)
function isFriendOfLender(lender: User, userId: string): boolean {
  return lender.friendIds.includes(userId) || lender.closeFriendIds.includes(userId);
}

// Helper function to check if a user can view an item
export function canUserViewItem(item: Item, currentUserId: string, state: AppState): boolean {
  if (item.lenderId === currentUserId) return true;

  const lender = state.users.find((u) => u.id === item.lenderId);
  if (!lender) return false;

  switch (item.permissionLevel) {
    case 'specific-users': {
      return item.allowedUserIds?.includes(currentUserId) || false;
    }
    case 'close-friends': {
      return lender.closeFriendIds.includes(currentUserId);
    }
    case 'friends': {
      return isFriendOfLender(lender, currentUserId);
    }
    case 'friends-of-friends': {
      if (isFriendOfLender(lender, currentUserId)) return true;
      // Check if any of user's friends are friends with the lender
      const currentUserData = state.users.find((u) => u.id === currentUserId);
      if (!currentUserData) return false;
      return currentUserData.friendIds.some((friendId) => lender.friendIds.includes(friendId));
    }
    case 'neighbors': {
      // For simplicity, all users in same city are neighbors.
      // Both sides need a known city — missing addresses never match.
      const currentUserCity = state.users.find((u) => u.id === currentUserId)?.address?.city;
      const lenderCity = lender.address?.city;
      return !!currentUserCity && currentUserCity === lenderCity;
    }
    default:
      return false;
  }
}

/** Every item the user may see, in library order. */
export function visibleItemsFor(state: AppState, userId: string): Item[] {
  return state.items.filter((item) => canUserViewItem(item, userId, state));
}

// Lender notes about a borrower are not public: they help someone decide
// whether to lend, so only the borrower, their friends, and lenders with a
// live request from them (pending/approved/active) may read them.
export function canViewBorrowerFeedback(
  profileUserId: string,
  viewerId: string,
  state: AppState
): boolean {
  if (profileUserId === viewerId) return true;

  const profileUser = state.users.find((u) => u.id === profileUserId);
  if (profileUser && isFriendOfLender(profileUser, viewerId)) return true;

  return state.borrowRequests.some(
    (r) =>
      r.borrowerId === profileUserId &&
      r.lenderId === viewerId &&
      (r.status === 'pending' || r.status === 'approved' || r.status === 'active')
  );
}

// Helper to get permission level display info
export function getPermissionLevelInfo(permissionLevel: string): {
  label: string;
  icon: string;
  color: string;
} {
  switch (permissionLevel) {
    case 'close-friends':
      return { label: 'Close Friends', icon: '💚', color: '#10b981' };
    case 'friends':
      return { label: 'Friends', icon: '👥', color: '#3b82f6' };
    case 'friends-of-friends':
      return { label: 'Friends of Friends', icon: '🔗', color: '#8b5cf6' };
    case 'neighbors':
      return { label: 'Neighbors', icon: '🏘️', color: '#f59e0b' };
    case 'specific-users':
      return { label: 'Specific People', icon: '🔒', color: '#6b7280' };
    default:
      return { label: 'Unknown', icon: '❓', color: '#6b7280' };
  }
}
