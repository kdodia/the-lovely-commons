# Roadmap — Library of Things

This document is a self-contained handoff for a future implementation session.
It assumes no prior conversation context — everything needed is here or in
`CLAUDE.md`.

## Where the project stands

Seven passes have landed:

1. **Hardening pass** (`claude/code-review-improvements-1inwwx`): the borrow
   lifecycle works end-to-end, permissions are enforced on deep links, dates
   are timezone-safe, toasts render everywhere, mock data is generated relative
   to today, and a navbar **user switcher** lets you experience the app as any
   mock user.
2. **Feature pass** (`claude/happy-cannon-511acm`): the three features that
   were planned here are done — see "Shipped" below.
3. **Follow-up pass** (`claude/trusting-hypatia-0hwv0k`): overdue reminders,
   a phone-width navbar, lender feedback on borrower profiles, automatic
   overdue notices, and a message thread on each request. 222 tests.

4. **Restructure** (same branch, after PR #4): no behaviour change. The
   store became a rulebook (`src/lib/domain/`) plus plumbing
   (`src/lib/store/`); shared interface pieces were extracted; every large
   page was split into section components beside it. See `ARCHITECTURE.md`.
   361 tests.

5. **Rough edges** (before hands-on testing): the availability calendar
   takes an end date after "Request to Borrow" presets the start; the nudge
   cooldown is one rule (`nextNudgeDate`) enforced by the store; and
   `item.available` now means "here now" (false only during an active
   loan), so an approved loan no longer stops others requesting other dates.
   `createBorrowRequest` validates the request (`canRequestItem`).

6. **Second rough-edges pass**: an overdue loan holds its item through
   today (`occupiedRanges` / `occupiedUntil`, used by requests, approval,
   early pickup and the calendar); pickup before the start day is allowed
   only when the days until then are free, and then moves the loan's start
   to today (`earlyPickupRefusal`); "Request to Borrow" presets the first
   selectable day (`firstSelectableStartDate`); a lender's profile lists
   items that are out on loan; the "Messages (n)" toggle shows "N new"
   (`unreadMessageCount`, `markRequestMessagesRead`, `messagesReadAt`).
   419 tests.

7. **Tester's kit**: five loadable scenarios (`src/lib/scenarios.ts`,
   `appStore.loadScenario`, the navbar's 🧪 `ScenarioPicker`): an overdue
   loan, a stranger's request, an approved pickup, an unread reply, and a
   blank library. Each is the mock world with only its own requests and
   notifications; overdue ones arrive already announced. `TESTING.md` is the
   facilitator's one-page script. 463 tests.

## Conventions (do not regress these)

- **Rules live in `src/lib/domain/`**, one file per topic, each opening with
  its rules in plain words. They are plain functions of the state with no
  Svelte or browser dependencies. Pages do not decide rules.
- **All state mutations go through `appStore` action methods**
  (`src/lib/store/appStore.ts`), each applying one rule. The raw writable `set`/`update` are deliberately not
  exported; tests inject fixtures with `appStore.replaceState()`.
- **The actor is `state.currentUserId`.** Store methods check that the actor
  is allowed (owner / borrower / lender / tag creator) and reject otherwise.
- **Rejectable methods return `ActionResult`** (`{ ok: true } | { ok: false; error }`).
  New rejectable actions must follow this pattern, and callers must surface
  `result.error` in a toast.
- **Schema changes need a `migrateState()` step** (in
  `src/lib/store/persistence.ts`). It runs on
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
  retracts an approval. (Since the rough-edges pass, approval no longer
  marks the item unavailable, so cancelling only frees the dates.)

### Follow-up pass
- **Overdue reminders.** `isOverdue` / `daysOverdue` (an `active` loan whose
  `endDate` is before today; due today is not overdue) and the
  `overdueLentLoans` / `overdueBorrowedLoans` derived stores. The lender's
  `sendReturnReminder(requestId)` emits a `return-reminder` notification,
  limited to one per `RETURN_REMINDER_COOLDOWN_DAYS` calendar days
  (`lastRemindedAt`, `nextReturnReminderDate`), and is refused once the
  borrower has confirmed the return. `LoanCard` shows "Overdue by N days";
  the dashboard has an overdue banner and accepts `?tab=` deep links.
- **Phone navbar.** At 640px and below the primary links are a fixed bottom
  tab bar; the top bar keeps logo, reset, bell and user switcher.
  `.main-content` gets bottom padding to clear it.
- **Lender feedback on profiles.** `/profile/[id]` lists `borrowerRating` /
  `borrowerReview` entries under "What lenders say"
  (`getBorrowerFeedback`). Visibility is `canViewBorrowerFeedback`: the
  profile owner, their friends, and lenders with a pending/approved/active
  request from them. Everyone else sees no section.

- **Overdue polish.** `sortOverdueFirst` puts overdue loans at the top of
  the Lending and Borrowing tabs. `appStore.notifyOverdueLoans()` is a sweep
  (run from the layout on mount and on `visibilitychange`) that tells both
  people once per loan, tracked by `overdueNotifiedAt`: `return-reminder`
  to the borrower, `loan-overdue` to the lender. It looks at every request
  (state is shared by all mock users) and writes nothing when idle.
- **Request messages.** `BorrowRequest.messages` (`RequestMessage[]`, read
  with `?? []`) and `sendRequestMessage(requestId, text)`: borrower or lender
  only, while pending/approved/active, trimmed, at most
  `REQUEST_MESSAGE_MAX_LENGTH`. Notifies the other party with
  `request-message`, which deep-links to the tab where they see the request.
  `RequestThread.svelte` renders the thread (the original `message` is its
  opening entry) on every dashboard request and loan card, collapsed behind
  "Messages (n)".

## Next ideas (not started)

Feature work is paused: hands-on UX testing comes next, then a design spec
for a real, federated system.

1. **Left open by the overdue rule, for the spec.** A request already
   approved for the days right after a loan that then runs overdue is not
   touched: nobody is warned and nothing is rescheduled.
2. **Known gaps for the spec** are listed in `ARCHITECTURE.md` (actor
   checks, cross-tab sync, identity).
3. **Bottom-bar awareness.** Any future bottom-anchored UI (sticky footers,
   bottom toasts) must clear the phone tab bar.
4. **A real backend.** Everything is one browser's localStorage, so other
   users are simulated. The rulebook in `src/lib/domain/` is what a server
   would implement.
