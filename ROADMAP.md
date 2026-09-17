# Roadmap — Library of Things

This document is a self-contained handoff for a future implementation session
(planned: Claude Opus 5). It assumes no prior conversation context — everything
needed is here or in `CLAUDE.md`.

## Where the project stands

A full bug-fix and hardening pass landed on `claude/code-review-improvements-1inwwx`
(July 2026): the borrow lifecycle works end-to-end (`pending → approved → active
→ completed`), the permission system is enforced on deep links, dates are
timezone-safe, toasts render everywhere, mock data is generated relative to
today, and there are 117 tests. A navbar **user switcher** lets you experience
the app as any mock user — use it to verify permission behavior from both sides
of every feature below.

## Conventions (do not regress these)

- **All state mutations go through `appStore` action methods** in
  `src/lib/store.ts`. The raw writable `set`/`update` are deliberately not
  exported; tests inject fixtures with `appStore.replaceState()`.
- **Lifecycle methods return `ActionResult`** (`{ ok: true } | { ok: false; error }`).
  New rejectable actions must follow this pattern, and callers must surface
  `result.error` in a toast.
- **Dates**: app-state dates are `'YYYY-MM-DD'` local calendar days. Only use
  helpers from `src/lib/dates.ts` (`toLocalISODate`, `parseLocalDate`,
  `todayLocalISO`, `formatDisplayDate`, `rangesOverlap`, `addDays`). Never
  `toISOString()` or `new Date('YYYY-MM-DD')`.
- **Toasts**: `const toaster = useToast()` from `src/lib/useToast.svelte.ts`;
  never destructure `toast` off it (kills reactivity). Render via the shared
  `Toast.svelte` with `onClose={toaster.clearToast}`.
- **Permissions**: any new surface that shows or acts on an item must check
  `canUserViewItem(item, userId, state)`.
- **IDs**: `createId('prefix')` from the store (collision-safe).
- **Images**: use `FallbackImage.svelte`, not raw `<img>`, for user/item images.
- **Verification**: `bun run check` and `bun run test` must pass; run tests
  additionally with `TZ=Pacific/Auckland` to catch UTC-shift regressions. The
  pre-commit hook runs check + test automatically.

## Feature 1 — Expose hidden abilities

Store capabilities that exist but have no UI.

1. **Delete item** (`appStore.deleteItem` exists, unused)
   - Add a delete action on `/my-items` cards and/or `items/[id]/edit`.
   - Convert `deleteItem` to return `ActionResult` and **block deletion while
     the item has `approved`/`active` requests** (someone physically has it).
   - On delete, clean up: remove the item's id from all `tags[].itemIds`,
     remove wishlist entries for it, and deny outstanding `pending` requests
     with a notification to each requester.
   - Confirm with a modal (copy the reset-confirm modal pattern in
     `src/routes/+layout.svelte`).
2. **Tag management** (`appStore.updateTag` exists, unused)
   - `/tags`: rename (inline edit → `updateTag`) and delete (new `deleteTag`
     store method) with confirmation.
3. **`specific-users` permission editor**
   - `add-item` and `edit` forms currently omit the `specific-users` option
     entirely. Add it, plus a friend-picker (checkbox list of the current
     user's friends/close friends) that populates `allowedUserIds`.
   - Mock item `item17` (Celestron Telescope) already uses this tier for
     manual testing.

Tests: deletion blocked during active loan; deletion cleans tags/wishlist and
denies pending requests; `deleteTag` removes the tag; `specific-users` items
visible only to `allowedUserIds` (helper already covered — test the form wiring
via a store-level test on the created item).

## Feature 2 — Borrower-side loan view + borrower reviews

The dashboard is lender-centric; borrowers can't see what they're holding, and
reviews are currently written by the *lender* in the return modal (displayed
with correct attribution, but semantically these rate the borrower, not the item).

1. **Borrower view**: new derived store `borrowedByMe` (mirror of `activeLoans`
   with `borrowerId === currentUserId`, statuses `approved`/`active`). Show it
   as a dashboard section or tab: item, lender, due date, overdue flag (string
   compare vs `todayLocalISO()`).
2. **Split the review flow**:
   - Keep the lender's return-modal rating, but store it as a **borrower
     rating** (feeds `User.rating` of the borrower over time), not the item
     rating.
   - New `submitItemReview(historyId, rating, review)` store method
     (ActionResult): only the borrow's borrower may call it, once per history
     entry. Add `reviewerId` to `BorrowHistory` (or a parallel field) so
     display code needn't guess.
   - Recompute `item.rating` from borrower-written reviews only.
   - After a return, notify the borrower ("How was the item?") with a
     notification of a new type that links to the item page, where an inline
     review form appears for eligible borrows.
   - Update the reviews section in `src/routes/items/[id]/+page.svelte` to
     show borrower attribution (it currently labels reviews as lender-written,
     matching today's data flow — flip the copy when the data flow flips).
3. Update `src/lib/mockData.ts` review voice back to borrower-voice when this
   lands (there's a note in that file).

Tests: `borrowedByMe` filtering; only the borrower can review, only once;
item rating recomputed from borrower reviews; return notification created.

## Feature 3 — Two-sided handoff

Make pickup/return require confirmation from both parties, so the lifecycle
reflects physical reality.

1. **Types** (`src/lib/types.ts`): add to `BorrowRequest`:
   `pickupConfirmedBy?: string[]`, `returnConfirmedBy?: string[]`.
2. **Store**: replace `markPickedUp` with `confirmPickup(requestId)` and add
   `confirmReturn(requestId)` (both ActionResult):
   - Caller must be the request's borrower or lender; each user can confirm
     once. When *both* have confirmed pickup → status `active`. When both
     confirm return → run today's completion logic (`completeBorrow`
     availability/counter/wishlist rules) and prompt the borrower to review
     (Feature 2).
   - Notify the other party on each first confirmation ("Sarah confirmed
     pickup — confirm on your side").
   - Keep `loadState` migration-safe: old persisted requests without the new
     arrays must be treated as `[]` (the schema-merge in `loadState` handles
     missing top-level keys; these are nested, so default with `?? []` at
     read sites).
3. **UI**: dashboard (lender side) and the Feature-2 borrower view each show a
   "Confirm pickup/return" button with a "waiting for other party" state.

Tests: single-sided confirmation doesn't advance status; both-sided does;
non-parties rejected; double-confirm by same user rejected; legacy requests
without the arrays still work.

## Suggested order

Feature 1 → 2 → 3. Feature 3 builds on Feature 2's borrower view, and 2's
review flow is triggered from 3's return confirmation.
