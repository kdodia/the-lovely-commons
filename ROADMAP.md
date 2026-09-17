# Roadmap — Library of Things

This document is a self-contained handoff for a future implementation session.
It assumes no prior conversation context — everything needed is here or in
`CLAUDE.md`.

## Where the project stands

Two passes have landed:

1. **Hardening pass** (`claude/code-review-improvements-1inwwx`): the borrow
   lifecycle works end-to-end, permissions are enforced on deep links, dates
   are timezone-safe, toasts render everywhere, mock data is generated relative
   to today, and a navbar **user switcher** lets you experience the app as any
   mock user.
2. **Feature pass** (`claude/happy-cannon-511acm`): the three features that
   were planned here are done — see "Shipped" below. 157 tests.

## Conventions (do not regress these)

- **All state mutations go through `appStore` action methods** in
  `src/lib/store.ts`. The raw writable `set`/`update` are deliberately not
  exported; tests inject fixtures with `appStore.replaceState()`.
- **The actor is `state.currentUserId`.** Store methods check that the actor
  is allowed (owner / borrower / lender / tag creator) and reject otherwise.
- **Rejectable methods return `ActionResult`** (`{ ok: true } | { ok: false; error }`).
  New rejectable actions must follow this pattern, and callers must surface
  `result.error` in a toast.
- **Schema changes need a `migrateState()` step** (in `store.ts`). It runs on
  every load and must be idempotent. Nested fields added later are still read
  with `?? []` / `?? undefined` at use sites.
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

## Shipped

### Feature 1 — Hidden abilities exposed
- `deleteItem` returns `ActionResult`, is owner-only, is blocked while the
  item has an approved/active loan, declines pending requests (with a
  notification to each requester), and scrubs the item from tags and
  wishlists. UI: "Remove from library" danger zone on `items/[id]/edit` with a
  confirm modal.
- Tags can be renamed inline and deleted (`deleteTag`, creator-only) on `/tags`.
- `specific-users` is selectable in the add/edit forms with a
  `FriendPicker.svelte` checkbox list that fills `allowedUserIds`. The item
  page explains the tier to the owner (who it's shared with) and to a picked
  user.

### Feature 2 — Borrower-side loan view + borrower reviews
- `borrowedByMe` derived store; the dashboard has **Lending** and
  **Borrowing** tabs built on `LoanCard.svelte`.
- Reviews are split: the lender's return modal now rates the *borrower*
  (`borrowerRating`/`borrowerReview`, folded into `User.rating` as a running
  mean weighted by `totalBorrows`), and the borrower reviews the *item* via
  `submitItemReview(historyId, rating, review)` (once per borrow, attributed
  with `reviewerId`, averaged into `Item.rating`). After a return the borrower
  gets a `review-request` notification linking to the item page, where an
  inline form appears; the lender gets an `item-reviewed` notification.
- Mock history is in borrower voice; `hist4` is left unreviewed so Sarah sees
  the prompt on the Coleman tent.

### Feature 3 — Two-sided handoff
- `markPickedUp`/`completeBorrow` are gone. `confirmPickup(requestId)` and
  `confirmReturn(requestId, lenderFeedback?)` each record the caller in
  `pickupConfirmedBy` / `returnConfirmedBy`; the loan advances only when both
  parties have confirmed. The other party is notified on each confirmation.
  The lender's feedback is stashed on the request (`lenderReturnFeedback`) if
  they confirm first, so order doesn't matter.
- `cancelRequest(requestId)`: borrower cancels pending/approved, lender
  retracts an approval; releases the item and notifies wishlist subscribers.

## Next ideas (not started)

1. **Navbar overflow on phones.** At 390px the nav bar is ~460px wide (the
   icon row plus reset/bell/avatar). Collapse into a menu or hide the reset
   button below a breakpoint. Pre-existing; `src/routes/+layout.svelte`.
2. **Overdue nudges.** `return-reminder` exists as a notification type but
   nothing emits it. A derived "overdue loans" store could power a dashboard
   banner, and the lender could send a one-tap reminder (mirror `nudgeRequest`
   with its cooldown).
3. **Borrower profile shows lender feedback.** `borrowerReview` is stored but
   only the rating surfaces (via `User.rating`). Show the lender's notes on the
   borrower's profile, visible to the borrower and to lenders considering a
   request.
4. **Request-level chat.** Requests carry a single `message`. A small thread
   (`messages: { fromUserId, text, at }[]` on `BorrowRequest`) would let the
   two parties agree on pickup details without leaving the app.
5. **Route tests.** Store coverage is thorough; the routes are only smoke
   tested manually. `@testing-library/svelte` + the writable `page` mock in
   `src/test/mocks/stores.ts` make item-page and dashboard tests feasible.
