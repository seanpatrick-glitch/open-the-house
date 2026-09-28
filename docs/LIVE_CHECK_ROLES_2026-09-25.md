# Live check: role and membership fix (2026-09-25)

Run this once branch `claude/dreamy-davinci-gceawd` is merged to `main` and CI has deployed it. The server functions and Firestore rules already passed a 34-case end-to-end run in the Firebase emulators (`npm run test:roles`). This checklist covers what the emulators can't: the real deploy, real email links, and the actual screens.

Use test accounts. Each step says what you should see.

## 0. Deploy landed
- [ ] GitHub Actions run on `main` is green, including the Firestore/functions deploy step.
- [ ] Firebase console → Functions lists `acceptInvite`, `setMemberRole`, `revokeMember`, `confirmAssignment`. (Confirmed from the CI log on 2026-09-25.)

## 1. New org signup
- [ ] Sign up a brand-new org → lands on the Admin dashboard (onboarding wizard for a new owner).

## 2. Invite three new people
You need three test people (call them A, B and C): A and B become Department Heads in sections 4 and 5, and C stays base-level for section 10.
- [ ] Your People → Invite someone → A's email, Org Collaborator → Send. Repeat for B and C.
- [ ] Each opens their email link → sets a password → lands on the everyone-else dashboard (see section 10).
- [ ] All three appear in Your People as Org Collaborator.

## 3. Create a department
Department Head can't be chosen anywhere until the org has at least one department. The Invite form labels it "Department Head (create a department first)" until then.
- [ ] Departments → Create → "Front of House". Leave the head empty → save.

## 4. Promote an existing member (the original DH bug)
- [ ] Your People → Invite someone → **A's email**, Department Head, Front of House.
- [ ] Instead of sending, it says A already has access and offers **Change access** → confirm.
- [ ] A's dashboard becomes the Department Head dashboard. It should switch on its own; if not, sign out and back in.
- [ ] Departments shows A as Front of House's head.

## 5. Department created with an existing member as head
- [ ] Departments → Create → "Lighting" → pick **B** from the head dropdown → confirm.
- [ ] B now gets the Department Head dashboard, and Lighting shows B as head.
- [ ] Departments → Create → "Sound" → this time **type B's email** in the head invite field → it offers to make B head instead of sending an email → confirm.
- [ ] B now heads Sound, and Lighting shows no head (a Department Head heads one department at a time).

## 6. Message email opens the right org
- [ ] Send A (now a DH) a message → email arrives → the link ends in `?org=…`.
- [ ] Click it (signed out is fine) → after login, lands on the DH dashboard.

## 7. Second org keeps the first
- [ ] From a **second** org's admin account, invite A.
- [ ] They open the link → **no password prompt** ("You already have a Places People account") → Continue → lands in the new org.
- [ ] Their first org is still intact: open any message email link from the first org and it lands there. There's no org switcher yet, so links are the only way to switch.

## 8. Remove access in one org only
- [ ] In the second org: Your People → Remove access for that person.
- [ ] They still get into the first org normally.

## 9. Things that should still work
- [ ] Editing your display name (sidebar) saves.
- [ ] Switching the Timeline view saves as your preference.
- [ ] "Give [name] a login" on a People record → accept → the everyone-else dashboard (section 10). For someone who already has access, accepting links the record and keeps their current dashboard.

## 10. One dashboard for everyone else (step 3)
Every account that isn't an admin or Department Head now lands on the same dashboard.
- [ ] Sign in as C (Org Collaborator) **and** as a Person-record login ("Give [name] a login"). Both see the same dashboard: Next up, My Tasks, My Schedule, Messages, Production Status, Timeline, and Flag a note for Admin.
- [ ] Assign a task to one of them (Timeline) → it shows under **My Tasks** and in the header's "Next up".
- [ ] Give the Person-record login an assignment (Company → their record → Assignments) → it appears under **Confirm your assignments** → Confirm → it moves to **My Schedule**. This button never worked before.
- [ ] As a Production Collaborator: **Flag a note for Admin** → submits; the admin sees it.
- [ ] Messages → New → message anyone in the org (Person logins could only reach their DH before).

## 11. Security spot-check (optional)
As a collaborator, in the browser devtools console, try writing your own role to `admin` on your `users` doc. It should fail with **permission denied**.

## If something fails
**Known issue, found 2026-09-26:** if an invite email link shows `API_KEY_HTTP_REFERRER_BLOCKED` for `open-the-house.firebaseapp.com`, the Firebase browser API key's website restrictions are missing that domain. Fix it in Google Cloud Console → APIs & Services → Credentials → Browser key (auto created by Firebase) → Application restrictions → Websites. Add `https://open-the-house.firebaseapp.com/*`, plus `https://open-the-house.web.app/*`, `https://placespeople-beta-testing.web.app/*`, `https://placespeople-beta-testing.firebaseapp.com/*` and `http://localhost:5173/*` if they're missing. Every emailed sign-in link goes through that domain first.

Note the step number and what you saw. For a failed function call, Firebase console → Functions → Logs has the error.
