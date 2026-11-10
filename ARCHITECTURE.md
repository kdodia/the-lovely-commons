# Architecture

"Library of Things" is a prototype: one browser, no server, simulated users.
It exists to show the idea, to be tested by hand, and to be the reference for
a future spec (a federated protocol for lending things between neighbours).
The code is arranged so that a rule or a screen can be found and changed
without reading the rest.

## The three layers

```
src/lib/domain/   The rulebook. What each action does and when it is refused.
src/lib/store/    Plumbing. Holds the state, applies rules, saves, derives lists.
src/routes/       Screens. Each page is an outline; its sections sit beside it.
src/lib/components/  Interface pieces shared by more than one page.
```

Dependencies point one way: routes and components use the store; the store
uses the domain; the domain uses only `types.ts`, `dates.ts` and
`constants.ts`. The domain has no Svelte, no `$app/*`, no `window` and no
`localStorage`, so a server could run the same rules.

## The rulebook: `src/lib/domain/`

One file per topic. **Each file opens with a comment stating its rules in
plain words** (who may act, from which status, what follows). Keep that
comment true when you change the code beneath it: it is the first draft of
the spec.

| File | Holds |
|---|---|
| `permissions.ts` | Who can see an item (the five permission levels); who can read lender notes about a borrower |
| `items.ts` | Add, update, delete an item; category paths |
| `requests.ts` | Create, approve, deny, cancel, nudge a borrow request; date conflicts |
| `handoff.ts` | Two-sided pickup and return confirmation; turning a finished loan into history |
| `overdue.ts` | What overdue means; the lender's reminder; the automatic overdue notice |
| `messages.ts` | The message thread on a request |
| `reviews.ts` | Item reviews, borrower ratings, rating maths |
| `friends.ts` | Friend requests, close friends |
| `tags.ts`, `wishlist.ts`, `notifications.ts`, `users.ts` | As named |
| `transition.ts`, `lists.ts`, `ids.ts` | Small shared helpers |

A rule is a function of the current state and its arguments that returns the
next state:

```ts
export function approveRequest(state: AppState, requestId: string): Transition {
  const request = state.borrowRequests.find((r) => r.id === requestId);
  if (!request) return reject(state, 'Request not found');
  if (request.status !== 'pending') return reject(state, 'Only pending requests can be approved');
  ...
  return accept({ ...state, borrowRequests: patchById(...), ... });
}
```

- `Transition` is `{ state, result }`. `reject(state, 'why')` returns the
  same state object, so nothing is saved; the message is shown to the user in
  a toast, so write it for them.
- Rules that cannot be refused just return the next state.
- The acting user is always `state.currentUserId`.
- Never mutate `state`; build the next one (`patchById`, spreads).
- Questions the screens ask ("is this loan overdue?", "may this user
  message?", "which requests are incoming for this user?") are plain exported
  functions in the same files.

### The loan lifecycle

| From | Action | Who | To |
|---|---|---|---|
| (none) | `createBorrowRequest` | borrower | pending |
| pending | `approveRequest` | lender | approved (item becomes unavailable) |
| pending | `denyRequest` | lender | denied |
| pending | `cancelRequest` | borrower | cancelled |
| approved | `cancelRequest` | borrower or lender | cancelled (item freed) |
| approved | `confirmPickup` by both | borrower and lender | active |
| active | `confirmReturn` by both | borrower and lender | completed (moves to history) |

While pending, approved or active, either person may `sendRequestMessage`.
While pending, the borrower may `nudgeRequest`. While active and past its end
date a loan is overdue: the lender may `sendReturnReminder`, and
`notifyOverdueLoans` tells both people once.

## The store: `src/lib/store/`

| File | Holds |
|---|---|
| `appStore.ts` | The Svelte store. One method per action, each a one-liner: `apply((s) => rules.approveRequest(s, id))` |
| `persistence.ts` | The localStorage key, load, save, cross-tab sync, and `migrateState()` |
| `derived.ts` | Derived stores for the current user (`incomingRequests`, `visibleItems`, ...), each a thin wrapper over a domain function |
| `index.ts` | Everything pages import, as `'$lib/store'` |

`apply` runs a rule on the current state, stores the result if it changed,
and returns the rule's `ActionResult`. Pages show `result.error` in a toast.

Persisted state is upgraded on every load by `migrateState()`. New fields
should be optional and read with `?? default`; when a stored shape truly
changes, add an idempotent step there.

## Screens: `src/routes/` and `src/lib/components/`

A page's `+page.svelte` reads as an outline: derive what it needs, hold the
page-level state (active tab, open dialog, the one `useToast()`), and lay out
its sections. Sections live beside the page as ordinary components (SvelteKit
ignores files in a route folder that do not start with `+`). Styles live with
the markup they style.

A piece moves to `src/lib/components/` only when a second page needs it.
Shared today: `Modal`, `Tabs`, `PageHeader`, `EmptyState`, `StarRating`,
`StarRatingInput`, `RatingScore`, `Avatar`, `UserChip`, `ItemCard`,
`LoanCard`, `RequestThread`, `FriendPicker`, `DateRangeCalendar`,
`FallbackImage`, `Toast`. Styles repeated verbatim across pages are in
`src/app.css`.

Pages do not decide rules. If a page needs to know whether something is
allowed, it asks a domain function (through `'$lib/store'`), so the button and
the rule cannot disagree.

## How to make a change

- **Change a rule** (who may cancel, how long a cooldown is): edit the
  function in `src/lib/domain/<topic>.ts`, its header comment, and its tests
  in `<topic>.test.ts` beside it. Constants are in `src/lib/constants.ts`.
- **Add an action**: write the rule in the domain file, export it from
  `domain/index.ts`, add the one-line method in `store/appStore.ts`, call it
  from the page and toast `result.error`.
- **Add a field**: `src/lib/types.ts`, optional, read with `??`. Add mock
  data in `src/lib/mockData.ts` so it shows on first run.
- **Change a screen**: find the section component beside the page.
- **Check your work**: `bun run check`, `bun run test`, and
  `TZ=Pacific/Auckland bun run test` (catches date-shift bugs). Then look at
  it in a browser at phone width (390px) and desktop: unit tests do not catch
  runtime errors in Svelte bindings or layout overflow.

## Known gaps (deliberate, for the spec work)

The prototype trusts its own interface. These are fine for one person
clicking through, and each must be closed in a real multi-user system:

- **Actor checks are incomplete.** `approveRequest`, `denyRequest` and
  `nudgeRequest` do not check who is acting; nor do adding/updating items,
  editing tags, accepting friend requests, or marking notifications read.
  Several friend actions take user ids as arguments instead of using the
  actor.
- **`createBorrowRequest` stores the request as given.** It does not check
  that the borrower is the actor, can see the item, differs from the lender,
  or that the lender owns the item, nor date order or the initial status. The
  item page enforces these before calling it.
- **Approval makes the whole item unavailable**, even for a loan weeks away,
  so other dates cannot be requested until it completes.
- **The nudge cooldown is counted two ways**: the item page counts calendar
  days from the request's creation or last nudge (`nextNudgeDate`); the
  store's `nudgeRequest` only limits repeat nudges, in elapsed hours.
- **Cross-tab sync replaces the state wholesale**, skipping `migrateState()`
  and switching the acting user in every open tab.
- **Ratings**: the first borrower review replaces an item's seeded rating;
  the borrower-rating mean is weighted by `totalBorrows`, which includes
  seeded borrows that were never rated.
- **Deleting an item** leaves its history entries pointing at nothing (pages
  tolerate this) and reuses the `request-denied` notification type.
- **There is no identity, no server and no clock authority.** "Who is
  acting", "what time is it" and "is this id unique" are all answered by the
  browser.
