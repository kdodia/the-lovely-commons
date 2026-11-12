# Testing script: Library of Things

One page for the facilitator. Lines marked **Watch** are for you, not the tester.

## Before the session

- Run `bun install` once, then `bun run dev`, and open http://localhost:5173.
- **🧪 Scenario picker** (top bar): loads a ready-made situation, signs in as the right person and opens the right page. It replaces all data.
- **🔄 Reset** (top bar): back to the usual sample data, signed in as Sarah Chen.
- **User switcher** (the round picture, top right): act as anyone else. Use it when a task needs the other person to do their part.
- **Phone width**: most people will use this on a phone. Run the session at least once in the browser's device mode at 390px wide, or on a phone with `bun run dev -- --host` and the address it prints. On a phone the main links sit in a bar at the bottom.
- Everything lives in this one browser. The other "people" are you, switching users.

## Tasks

Read the task out loud as written. Do not explain buttons. If they are stuck for two minutes, ask what they expected to find.

1. **You need a tent for next weekend. Get one.**
   Load: *A blank library* (you are Casey).
   **Watch:** do they search or scroll? Do they understand why they only see three things? Do they pick dates without help, and do they know what happens after they send the request?

2. **Someone you have never met wants to borrow your food processor. Decide what to do.**
   Load: *A stranger asks to borrow* (you are Sarah).
   **Watch:** do they look at Jordan's profile and what other lenders said before deciding? Do they find the friend-of-friends link reassuring? Do they message first, approve, or decline, and why?

3. **Your request for the pressure washer was approved. You are at Marcus's door now. Take it home.**
   Load: *Your request was approved, go pick it up* (you are Sarah). Then switch to Marcus to do his side.
   **Watch:** do they understand that both people confirm? Do they find the user switcher on their own? What do they make of "waiting for Marcus Johnson" after confirming their side?

4. **You've finished with the pressure washer. Give it back.**
   Carry on from task 3 (do not reload). Both people confirm again.
   **Watch:** who do they expect to act first? Does the lender's rating of the borrower feel fair or awkward? Do they notice the request to review the item afterwards?

5. **Emily has answered your question about her projector. Reply to her.**
   Load: *Someone replied to your message* (you are Sarah).
   **Watch:** how do they find the new message: the bell, the "new" marker, or by opening requests? Is the thread where they expect it?

6. **Emily still has your karaoke machine and it was due back days ago. Sort it out.**
   Load: *You have an overdue loan* (you are Sarah).
   **Watch:** do they use the reminder, a message, or neither? How do they feel about nagging a friend through an app? Do they switch to Emily to see her side?

7. **You have a folding ladder you rarely use. Offer it, but only to people you know.**
   Load: *A blank library* (you are Casey).
   **Watch:** do they understand the sharing levels (friends, friends of friends, neighbours, specific people)? Which one do they pick, and can they say who will see the ladder?

## Debrief

1. Would you lend through this to someone you have not met? What would you want to know first?
2. Who would you actually share with, and which of your things would never go on here?
3. What felt like work, or like a step you would skip in real life?
4. Was there a moment you expected something to happen and it did not?
5. When something was late or awkward, did the app help or get in the way?
6. What would make you open this again next week?

## Known limits: don't report these

- There is no sign-in. Anyone can act as anyone with the user switcher, and the app trusts whoever is acting more than a real one would (for example, approving requests or editing items does not always check it is the owner).
- There is no server. All data lives in this browser; other people are simulated, and nothing reaches a real person.
- The time, and every "who is this", come from the browser.
- Having the app open in two tabs swaps the signed-in person in both.
- Ratings are rough: the first real review replaces an item's sample rating.
- Deleting an item leaves its past loans pointing at nothing, and its notice to requesters is filed as a declined request.
