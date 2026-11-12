/**
 * Ready-made situations for hands-on testing, loaded from the navbar's
 * scenario picker (`appStore.loadScenario`). These are data, not rules: each
 * `build()` returns a whole `AppState` assembled from the mock users, items,
 * categories, tags and history in `mockData.ts`, with dates relative to the
 * moment it is called, so a scenario is valid whenever it is loaded.
 *
 * Each scenario keeps only its own requests and notifications (the default
 * mock data's other requests are left out) so the start page shows one
 * clear situation. `item.available` is recomputed from the scenario's
 * requests: false only for an item with an active loan.
 *
 * Overdue loans are seeded as already announced (`overdueNotifiedAt` plus the
 * two notices the sweep would have sent the morning after the due date), so
 * the layout's overdue sweep finds nothing to do after a scenario loads.
 */
import type { AppState, BorrowRequest, Notification } from './types';
import { DATE_FORMAT_OPTIONS, REQUEST_MESSAGE_PREVIEW_LENGTH } from './constants';
import { formatDisplayDate } from './dates';
import {
  daysFromNow,
  timestampDaysAgo,
  mockUsers,
  mockItems,
  mockCategories,
  mockTags,
  mockBorrowHistory
} from './mockData';

export type ScenarioId =
  | 'overdue-loan'
  | 'stranger-request'
  | 'approved-pickup'
  | 'unread-reply'
  | 'blank-library';

export interface Scenario {
  id: ScenarioId;
  title: string;
  /** One sentence, "You are X and ...", shown in the picker. */
  description: string;
  /** Who is acting once it loads (the built state's `currentUserId`). */
  actingUserId: string;
  /** Where the app goes once it loads. */
  startPath: string;
  build: () => AppState;
}

/** The mock world with no requests, notifications, friend requests or wishlist. */
function world(actingUserId: string, parts: Partial<AppState>): AppState {
  const state: AppState = {
    currentUserId: actingUserId,
    users: structuredClone(mockUsers),
    items: structuredClone(mockItems),
    categories: structuredClone(mockCategories),
    tags: structuredClone(mockTags),
    borrowRequests: [],
    borrowHistory: structuredClone(mockBorrowHistory),
    friendRequests: [],
    notifications: [],
    wishlist: [],
    ...parts
  };
  // An item is out only while a loan of it is active.
  return {
    ...state,
    items: state.items.map((item) => ({
      ...item,
      available: !state.borrowRequests.some((r) => r.itemId === item.id && r.status === 'active')
    }))
  };
}

function notice(
  id: string,
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  createdAt: string,
  relatedId: string,
  read = false
): Notification {
  return { id, userId, type, title, message, read, createdAt, relatedId };
}

/** A message as its `request-message` notification quotes it. */
function preview(text: string): string {
  return text.length > REQUEST_MESSAGE_PREVIEW_LENGTH
    ? `${text.slice(0, REQUEST_MESSAGE_PREVIEW_LENGTH).trimEnd()}…`
    : text;
}

// 1. Sarah lent Emily the karaoke machine; it was due back four days ago.
function overdueLoan(): AppState {
  const endDate = daysFromNow(-4);
  const announcedAt = timestampDaysAgo(3, 8);
  const request: BorrowRequest = {
    id: 'req-s1',
    itemId: 'item14',
    borrowerId: 'user3',
    lenderId: 'user1',
    startDate: daysFromNow(-11),
    endDate,
    status: 'active',
    message: "Hosting a karaoke night for my sister's birthday!",
    createdAt: timestampDaysAgo(13, 18),
    pickupConfirmedBy: ['user3', 'user1'],
    returnConfirmedBy: [],
    overdueNotifiedAt: announcedAt
  };
  const due = formatDisplayDate(endDate, DATE_FORMAT_OPTIONS.short);
  return world('user1', {
    borrowRequests: [request],
    notifications: [
      notice('notif-s1-borrower', 'user3', 'return-reminder', 'Return Reminder',
        `Sarah Chen's Karaoke Machine was due back on ${due}. Please return it.`, announcedAt, request.id),
      notice('notif-s1-lender', 'user1', 'loan-overdue', 'Loan Overdue',
        'Karaoke Machine, lent to Emily Rodriguez, is now overdue.', announcedAt, request.id)
    ]
  });
}

// 2. Jordan (a friend of Sarah's friends Marcus and Emily, not of Sarah)
// asks for Sarah's food processor, which she shares with friends of friends
// in this scenario. Two past lenders have left notes about Jordan.
function strangerRequest(): AppState {
  const request: BorrowRequest = {
    id: 'req-s2',
    itemId: 'item3',
    borrowerId: 'user5',
    lenderId: 'user1',
    startDate: daysFromNow(5),
    endDate: daysFromNow(7),
    status: 'pending',
    message:
      "Hi Sarah, we haven't met. I'm a friend of Marcus and Emily. Could I borrow your food processor for a dinner I'm cooking next week?",
    createdAt: timestampDaysAgo(1, 19),
    pickupConfirmedBy: [],
    returnConfirmedBy: []
  };
  const base = world('user1', {});
  return world('user1', {
    items: base.items.map((i) =>
      i.id === 'item3' ? { ...i, permissionLevel: 'friends-of-friends' as const } : i
    ),
    borrowRequests: [request],
    borrowHistory: [
      ...base.borrowHistory,
      {
        id: 'hist-s2-1',
        itemId: 'item11',
        borrowerId: 'user5',
        lenderId: 'user3',
        startDate: daysFromNow(-30),
        endDate: daysFromNow(-27),
        actualReturnDate: daysFromNow(-27),
        rating: 5,
        review: 'Great game for four players. All the pieces were there.',
        reviewerId: 'user5',
        reviewedAt: timestampDaysAgo(26, 20),
        borrowerRating: 5,
        borrowerReview: 'Every card back in its sleeve. Would lend again.'
      },
      {
        id: 'hist-s2-2',
        itemId: 'item4',
        borrowerId: 'user5',
        lenderId: 'user2',
        startDate: daysFromNow(-52),
        endDate: daysFromNow(-50),
        actualReturnDate: daysFromNow(-49),
        rating: 4,
        review: 'Did the job. The second battery runs down quickly.',
        reviewerId: 'user5',
        reviewedAt: timestampDaysAgo(48, 9),
        borrowerRating: 4,
        borrowerReview: 'A day late, but Jordan texted ahead and the drill came back clean.'
      }
    ],
    notifications: [
      notice('notif-s2-request', 'user1', 'borrow-request', 'New Borrow Request',
        'Jordan Lee wants to borrow your KitchenAid Food Processor', request.createdAt, request.id)
    ]
  });
}

// 3. Marcus approved Sarah's request for his pressure washer, from today.
function approvedPickup(): AppState {
  const request: BorrowRequest = {
    id: 'req-s3',
    itemId: 'item9',
    borrowerId: 'user1',
    lenderId: 'user2',
    startDate: daysFromNow(0),
    endDate: daysFromNow(2),
    status: 'approved',
    message: 'The patio needs a proper clean before winter. Could I borrow it for a few days?',
    createdAt: timestampDaysAgo(3, 12),
    pickupConfirmedBy: [],
    returnConfirmedBy: [],
    messages: [
      {
        id: 'msg-s3-1',
        fromUserId: 'user2',
        text: "Approved! I'm home after 5. The hose is coiled on the side of the box.",
        at: timestampDaysAgo(1, 17)
      }
    ],
    // Sarah has seen Marcus's note; nothing is unread here.
    messagesReadAt: { user1: timestampDaysAgo(1, 18), user2: timestampDaysAgo(1, 17) }
  };
  return world('user1', {
    borrowRequests: [request],
    notifications: [
      notice('notif-s3-request', 'user2', 'borrow-request', 'New Borrow Request',
        'Sarah Chen wants to borrow your Electric Pressure Washer', request.createdAt, request.id, true),
      notice('notif-s3-approved', 'user1', 'request-approved', 'Request Approved!',
        'Marcus Johnson approved your request to borrow Electric Pressure Washer', timestampDaysAgo(1, 17), request.id)
    ]
  });
}

// 4. Sarah asked Emily for the projector and a question; Emily replied and
// Sarah has not read it yet.
function unreadReply(): AppState {
  const sentAt = timestampDaysAgo(2, 9);
  const repliedAt = timestampDaysAgo(1, 20);
  const question = 'Does it need a screen, or will a white sheet do?';
  const reply = 'A sheet works fine. Do you have an HDMI cable, or shall I put mine in the bag?';
  const request: BorrowRequest = {
    id: 'req-s4',
    itemId: 'item10',
    borrowerId: 'user1',
    lenderId: 'user3',
    startDate: daysFromNow(6),
    endDate: daysFromNow(7),
    status: 'pending',
    message: 'Outdoor movie night in the garden. Could I borrow the projector?',
    createdAt: timestampDaysAgo(2, 8),
    pickupConfirmedBy: [],
    returnConfirmedBy: [],
    messages: [
      {
        id: 'msg-s4-1',
        fromUserId: 'user1',
        text: question,
        at: sentAt
      },
      {
        id: 'msg-s4-2',
        fromUserId: 'user3',
        text: reply,
        at: repliedAt
      }
    ],
    messagesReadAt: { user1: sentAt, user3: repliedAt }
  };
  return world('user1', {
    borrowRequests: [request],
    notifications: [
      notice('notif-s4-request', 'user3', 'borrow-request', 'New Borrow Request',
        'Sarah Chen wants to borrow your Epson Home Projector', request.createdAt, request.id, true),
      notice('notif-s4-asked', 'user3', 'request-message', 'New Message',
        `Sarah Chen about Epson Home Projector: "${preview(question)}"`, sentAt, request.id, true),
      notice('notif-s4-reply', 'user1', 'request-message', 'New Message',
        `Emily Rodriguez about Epson Home Projector: "${preview(reply)}"`, repliedAt, request.id)
    ]
  });
}

// 5. Casey, new to the app: one friend (Alex), nothing owned, no activity.
// Browse shows Alex's tent and bike rack (friends) and Taylor's sewing
// machine (neighbours).
function blankLibrary(): AppState {
  const base = world('user7', {});
  return world('user7', {
    users: base.users.map((u) =>
      u.id === 'user7' ? { ...u, rating: 0, totalBorrows: 0, totalLends: 0 } : u
    )
  });
}

export const scenarios: Scenario[] = [
  {
    id: 'overdue-loan',
    title: 'You have an overdue loan',
    description:
      'You are Sarah Chen and you lent Emily your karaoke machine; it was due back four days ago and she has not returned it.',
    actingUserId: 'user1',
    startPath: '/dashboard?tab=lending',
    build: overdueLoan
  },
  {
    id: 'stranger-request',
    title: 'A stranger asks to borrow',
    description:
      "You are Sarah Chen and Jordan Lee, whom you have never met (a friend of your friends), wants to borrow your food processor.",
    actingUserId: 'user1',
    startPath: '/dashboard?tab=incoming',
    build: strangerRequest
  },
  {
    id: 'approved-pickup',
    title: 'Your request was approved, go pick it up',
    description:
      "You are Sarah Chen and Marcus approved your request for his pressure washer, starting today; nobody has confirmed the pickup yet.",
    actingUserId: 'user1',
    startPath: '/dashboard?tab=borrowing',
    build: approvedPickup
  },
  {
    id: 'unread-reply',
    title: 'Someone replied to your message',
    description:
      'You are Sarah Chen and Emily answered your question about her projector with one of her own; you have not read it yet.',
    actingUserId: 'user1',
    startPath: '/dashboard?tab=outgoing',
    build: unreadReply
  },
  {
    id: 'blank-library',
    title: 'A blank library',
    description:
      'You are Casey Williams and you have just joined: one friend (Alex), nothing of your own, and a few things nearby to browse.',
    actingUserId: 'user7',
    startPath: '/',
    build: blankLibrary
  }
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
