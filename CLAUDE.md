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

### State Management Pattern

The app uses a centralized Svelte store (`src/lib/store.ts`) with localStorage persistence:

- **Single source of truth**: `appStore` contains all application state (`AppState` type)
- **Derived stores**: Computed values like `currentUser`, `currentUserItems`, `visibleItems`, `incomingRequests`, `approvedLoans`, `activeLoans`, etc.
- **Action methods**: All state mutations go through store methods (e.g., `createBorrowRequest`, `updateItem`, `addToWishlist`). The raw writable `set`/`update` are intentionally not exported; tests use `appStore.replaceState()` to inject fixtures.
- **ActionResult**: Lifecycle methods that can be rejected (`createBorrowRequest`, `approveRequest`, `denyRequest`, `markPickedUp`, `completeBorrow`, `nudgeRequest`) return `{ ok: true } | { ok: false; error }` so the UI can show the reason.
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

The `canUserViewItem()` helper function in `store.ts` implements this logic. The `visibleItems` derived store filters all items through this permission check.

### Core Data Relationships

- **Users** can be friends or close friends (stored in `friendIds` and `closeFriendIds` arrays)
- **Items** belong to lenders, have categories, tags, and permission levels
- **BorrowRequests** track the borrowing lifecycle: pending → approved (lender approves; item becomes unavailable) → active (lender marks picked up) → completed (lender marks returned; moves to history)
- **BorrowHistory** stores completed borrows with ratings and condition tracking
- **Tags** are user-created collections that reference item IDs (many-to-many)
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
- **Test files**: Use `.test.ts` or `.spec.ts` extension in the `src/` directory

### Route Structure

SvelteKit file-based routing:

- `/` - Browse page (home) with search, filters, and item grid
- `/items/[id]` - Item detail page with calendar, reviews, and borrow request form
- `/dashboard` - Owner dashboard for managing requests and active loans
- `/my-items` - User's item library
- `/wishlist` - User's wishlist with availability notifications
- `/network` - Friend management (tiers, promote/demote close friends, send/accept/decline friend requests)
- `/tags` - Tag collections management
- `/profile/[id]` - User profile pages
- `/notifications` - Notifications center

Layout: `src/routes/+layout.svelte` contains the navigation bar and wraps all pages.

### Toast Notifications

The `src/lib/useToast.svelte.ts` module exports a `useToast()` factory. Keep the returned object intact — `const toaster = useToast()`, then `toaster.showToast(...)` and `{#if toaster.toast}` in the template. Do NOT destructure `toast` from it: that reads the reactive getter once and permanently disconnects it. Render with the shared `Toast.svelte` component, passing `onClose={toaster.clearToast}`.

### Date Handling

Dates in app state are `'YYYY-MM-DD'` strings meaning a local calendar day. Always use the helpers in `src/lib/dates.ts` (`toLocalISODate`, `parseLocalDate`, `todayLocalISO`, `formatDisplayDate`, `rangesOverlap`) — never `Date.prototype.toISOString()` or `new Date('YYYY-MM-DD')`, both of which shift the day for users outside UTC.

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

- **ItemCard.svelte**: Reusable card for displaying items in grids/lists (has comprehensive tests in `ItemCard.test.ts`)
- **DateRangeCalendar.svelte**: Calendar widget for date selection with visual availability display
- **FallbackImage.svelte**: Image component with error handling and fallback states
- **Toast.svelte**: Toast notification component

## Working with the Codebase

When modifying the app:

1. **State changes**: Always use store action methods, never mutate state directly
2. **New features**: Consider permission levels and how they affect visibility
3. **Notifications**: Create notifications for relevant user actions in store methods
4. **Types**: All types are defined in `src/lib/types.ts`
5. **Testing**: Write tests for components and store actions, especially for complex logic
6. **Svelte 5**: Use runes syntax for new components
