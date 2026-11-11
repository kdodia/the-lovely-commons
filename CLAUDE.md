# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Library of Things" is a SvelteKit-based prototype for a distributed library platform where users can share underutilized items with friends, friends-of-friends, and neighbors. The app demonstrates a complete lending/borrowing workflow with a sophisticated permission system, calendar-based availability, and social features.

## Development Commands

This project uses [Bun](https://bun.sh) as its package manager and runtime.

```bash
# Install dependencies
bun install                 # Install all dependencies (creates bun.lock)

# Development server
bun run dev                 # Start dev server at http://localhost:5173

# Type checking
bun run check              # Run svelte-check once
bun run check:watch        # Run svelte-check in watch mode

# Testing
bun run test               # Run all tests once
bun run test:watch         # Run tests in watch mode
bun run test:coverage      # Run tests with coverage report
bun run test:ui            # Run tests with Vitest UI

# Build
bun run build              # Build for production
bun run preview            # Preview production build

# Git hooks
bun run prepare            # Setup husky git hooks (runs automatically after install)
```

## Architecture

**Read `ARCHITECTURE.md` first.** It describes the three layers, the loan lifecycle, how to make each common kind of change, and the known gaps. In short:

- `src/lib/domain/` is the rulebook: one file per topic (`requests.ts`, `handoff.ts`, `overdue.ts`, `permissions.ts`, ...), plain TypeScript with no Svelte or browser dependencies. Every action is a function of the current state that returns the next state. Each file opens with a comment stating its rules in plain words; keep that comment true.
- `src/lib/store/` is plumbing: `appStore.ts` (one one-line method per action), `persistence.ts` (localStorage, cross-tab sync, `migrateState()`), `derived.ts` (derived stores for the current user). Pages import everything from `'$lib/store'`.
- `src/routes/` are the screens. A `+page.svelte` is an outline; its sections are components beside it in the same folder. `src/lib/components/` holds only pieces shared by more than one page.

### State Management Pattern

- **Single source of truth**: `appStore` contains all application state (`AppState` type)
- **Derived stores**: Computed values like `currentUser`, `currentUserItems`, `visibleItems`, `incomingRequests`, `approvedLoans`, `activeLoans`, etc. (`src/lib/store/derived.ts`)
- **Action methods**: All state mutations go through store methods (e.g., `createBorrowRequest`, `updateItem`, `addToWishlist`), each of which applies one rule from `src/lib/domain/`. The raw writable `set`/`update` are intentionally not exported; tests use `appStore.replaceState()` to inject fixtures.
- **Rules are transitions**: a rule returns `accept(nextState)` or `reject(state, 'reason for the user')` (`src/lib/domain/transition.ts`). A rejection returns the same state object, so nothing is saved. Never mutate state; use spreads and `patchById`.
- **ActionResult**: Methods that can be rejected (`createBorrowRequest`, `approveRequest`, `denyRequest`, `cancelRequest`, `confirmPickup`, `confirmReturn`, `submitItemReview`, `nudgeRequest`, `sendReturnReminder`, `sendRequestMessage`, `deleteItem`, `deleteTag`) return `{ ok: true } | { ok: false; error }` so the UI can show the reason. The acting user is always `state.currentUserId`. Not every rule checks the actor yet; see "Known gaps" in `ARCHITECTURE.md`.
- **Schema migration**: `migrateState()` in `src/lib/store/persistence.ts` runs on every load and upgrades older persisted state (defaults the handoff arrays, moves legacy lender-written `rating`/`review` into `borrowerRating`/`borrowerReview`). Add a step there whenever a stored shape changes; prefer optional fields read with `??`.
- **Automatic persistence**: State automatically syncs to localStorage on every change
- **Cross-tab sync**: Uses storage events to sync state across browser tabs
- **Reset mechanism**: `appStore.reset()` or clear localStorage key `distributed-library-app-state`

### Permission System

Items have a `permissionLevel` field that controls visibility and borrowing access:

1. **specific-users**: Only users in `allowedUserIds` array
2. **close-friends**: Users in the lender's `closeFriendIds` array
3. **friends**: Users in the lender's `friendIds` array
4. **friends-of-friends**: Friends + friends of the lender's friends
5. **neighbors**: All users in the same city

The `canUserViewItem()` function in `src/lib/domain/permissions.ts` implements this logic. The `visibleItems` derived store filters all items through this permission check.

### Core Data Relationships

- **Users** can be friends or close friends (stored in `friendIds` and `closeFriendIds` arrays)
- **Items** belong to lenders, have categories, tags, and permission levels
- **BorrowRequests** track the borrowing lifecycle: pending → approved (lender approves; item becomes unavailable) → active (both parties `confirmPickup`) → completed (both parties `confirmReturn`; moves to history). The borrower can `cancelRequest` while pending or approved; the lender can while approved. `pickupConfirmedBy` / `returnConfirmedBy` record who has confirmed each handoff; read them with `?? []`.
- **BorrowHistory** stores completed borrows. Two separate ratings live on each entry: `borrowerRating`/`borrowerReview` are the lender's rating of the borrower (captured in the lender's return modal, folded into `User.rating`), and `rating`/`review`/`reviewerId` are the borrower's review of the item (written later via `submitItemReview`, averaged into `Item.rating`). Only entries with `reviewerId` are displayed as item reviews.
- **Overdue loans**: an `active` request whose `endDate` is before today (`isOverdue`, `daysOverdue`; `overdueLentLoans` / `overdueBorrowedLoans` derived stores). The lender can `sendReturnReminder` once per `RETURN_REMINDER_COOLDOWN_DAYS` calendar days (`lastRemindedAt`). `notifyOverdueLoans()` is an idempotent sweep the layout runs on mount and on `visibilitychange`; it notifies both people once per loan (`overdueNotifiedAt`). `sortOverdueFirst` orders the dashboard lists.
- **Request messages**: `BorrowRequest.messages` (read with `?? []`) holds the two-person thread; the original `message` is shown as its opening entry and is not copied in. `sendRequestMessage` is allowed for the borrower or lender while the request is pending, approved or active (`canSendRequestMessage`).
- **Borrower feedback visibility**: lender notes about a borrower (`getBorrowerFeedback`) are shown on their profile only when `canViewBorrowerFeedback` allows: the owner, their friends, and lenders with a pending/approved/active request from them.
- **Tags** are user-created collections that reference item IDs (many-to-many); `deleteItem` scrubs the item from every tag and wishlist and declines its pending requests
- **Wishlist** allows users to subscribe to unavailable items with notifications
- **Categories** are hierarchical with optional parent IDs

### Svelte 5 Runes

This project uses Svelte 5 with the new runes syntax:

- `$state()` for reactive local state
- `$derived()` for computed values
- `$effect()` for side effects
- `$props()` for component props
- Component files that use runes should have `.svelte.ts` extension (e.g., `useToast.svelte.ts`)

### Test Infrastructure

- **Framework**: Vitest with jsdom environment
- **Test utilities**: @testing-library/svelte and @testing-library/jest-dom
- **Setup**: `src/test/setup.ts` mocks localStorage
- **Mocks**: `src/test/mocks/` contains mocks for `$app/environment`, `$app/stores`, `$app/navigation`
- **Configuration**: `vite.config.ts` includes test aliases and ensures browser build for Svelte 5
- **Test files**: `.test.ts` beside the file they test (`src/lib/domain/requests.test.ts`, `src/routes/dashboard/ReturnModal.test.ts`). Shared state builders are in `src/test/fixtures.ts`
- **What tests miss**: unit tests do not catch Svelte runtime binding errors or layout overflow. After interface changes, look at the page in a browser at 390px and at desktop width

### Route Structure

SvelteKit file-based routing:

- `/` - Browse page (home) with search, filters, and item grid
- `/items/[id]` - Item detail page with calendar, reviews, and borrow request form
- `/dashboard` - Incoming requests, my requests, Lending (items I've lent out) and Borrowing (items I'm holding) tabs with two-sided pickup/return confirmation, an overdue banner, and `?tab=` deep links
- `/my-items` - User's item library
- `/wishlist` - User's wishlist with availability notifications
- `/network` - Friend management (tiers, promote/demote close friends, send/accept/decline friend requests)
- `/tags` - Tag collections management
- `/profile/[id]` - User profile pages
- `/notifications` - Notifications center

Layout: `src/routes/+layout.svelte` contains the navigation bar and wraps all pages. At 640px and below the primary links become a fixed bottom tab bar.

### Toast Notifications

The `src/lib/useToast.svelte.ts` module exports a `useToast()` factory. Keep the returned object intact — `const toaster = useToast()`, then `toaster.showToast(...)` and `{#if toaster.toast}` in the template. Do NOT destructure `toast` from it: that reads the reactive getter once and permanently disconnects it. Render with the shared `Toast.svelte` component, passing `onClose={toaster.clearToast}`.

### Date Handling

Dates in app state are `'YYYY-MM-DD'` strings meaning a local calendar day. Always use the helpers in `src/lib/dates.ts` (`toLocalISODate`, `parseLocalDate`, `todayLocalISO`, `formatDisplayDate`, `rangesOverlap`, `addDays`, `daysBetween`) — never `Date.prototype.toISOString()` or `new Date('YYYY-MM-DD')`, both of which shift the day for users outside UTC.

## Data Persistence

All user actions persist via localStorage:
- Creating/updating/deleting items
- Sending/approving/denying borrow requests
- Creating tags and adding items to tags
- Friend requests and relationships
- Notifications and read status
- Wishlist subscriptions

To reset during development:
```javascript
localStorage.removeItem('distributed-library-app-state')
// Then refresh the page
```

Or use the reset button (🔄) in the navbar.

## Pre-commit Hooks

Husky runs `lint-staged` on pre-commit, which executes `svelte-check` on staged `.ts` and `.svelte` files. This ensures type safety before commits.

## Mock Data

The app initializes with pre-populated data in `src/lib/mockData.ts`:
- 4 users (Sarah Chen, Marcus Johnson, Emily Rodriguez, Alex Kim)
- 15+ items across multiple categories
- Pre-existing friend relationships
- Sample borrow history with reviews

This mock data is loaded into the store on first run if localStorage is empty.

## Key Components

Shared components in `src/lib/components/` (a piece moves here only when a second page needs it):

- **Modal.svelte**: The one modal dialog (`size` `md` | `sm` | `form`); handles Escape, backdrop click, focus trap and focus restore
- **Tabs.svelte**, **PageHeader.svelte**, **EmptyState.svelte**: Page furniture used across routes
- **StarRating.svelte**, **StarRatingInput.svelte**, **RatingScore.svelte**: Read-only stars, the rating input, and the inline "⭐ 4.5"
- **Avatar.svelte**, **UserChip.svelte**: A user's picture, and picture plus name linking to their profile
- **ItemCard.svelte**: Reusable card for displaying items in grids/lists
- **ItemForm.svelte**: The item form shared by add-item and edit-item
- **DateRangeCalendar.svelte**: Calendar widget for date selection with visual availability display
- **FallbackImage.svelte**: Image component with error handling and fallback states
- **Toast.svelte**: Toast notification component
- **LoanCard.svelte**: A loan from either perspective (`lender` | `borrower`) with the handoff state ("waiting for X" vs "confirm on your side") and confirm/cancel actions
- **RequestThread.svelte**: Collapsible message thread for a borrow request with a compose box; read-only once the request is closed. Used on every dashboard request and loan card
- **FriendPicker.svelte**: Checkbox list of the current user's friends, used by `ItemForm` to fill `allowedUserIds` for `specific-users` items

Page sections live beside their page, e.g. `src/routes/dashboard/` has `IncomingRequestsTab`, `OutgoingRequestsTab`, `LoansTab`, `RequestCard`, `OverdueBanner`, `ReturnModal` and `loanActions.ts` (the dashboard's actions with their toast wording).

## Working with the Codebase

When modifying the app:

1. **Rules**: Change or add them in `src/lib/domain/<topic>.ts`, with the header comment and the tests beside it. Pages ask the domain whether something is allowed; they do not decide it themselves
2. **State changes**: Always use store action methods, never mutate state directly
3. **New features**: Consider permission levels and how they affect visibility
4. **Notifications**: Create notifications for relevant user actions in the domain rule
5. **Types**: All types are defined in `src/lib/types.ts`
6. **Screens**: Keep `+page.svelte` an outline; put a new section in a component beside it, with its styles
7. **Testing**: Write tests for rules and for components with real logic. Run `bun run check`, `bun run test` and `TZ=Pacific/Auckland bun run test`
8. **Svelte 5**: Use runes syntax for new components
