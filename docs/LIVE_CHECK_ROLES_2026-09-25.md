# Live check: role and membership fix (2026-09-25)

Run this once branch `claude/dreamy-davinci-gceawd` is merged to `main` and CI has deployed it. The server functions and Firestore rules already passed a 26-case end-to-end run in the Firebase emulators. This checklist covers what the emulators can't: the real deploy, real email links, and the actual screens.

Use test accounts. Each step says what you should see.

## 0. Deploy landed
- [ ] GitHub Actions run on `main` is green, including the Firestore/functions deploy step.
- [ ] Firebase console → Functions lists `acceptInvite`, `setMemberRole`, `revokeMember`.

## 1. New org signup
- [ ] Sign up a brand-new org → lands on the Admin dashboard (onboarding wizard for a new owner).

## 2. Invite a new person
- [ ] Your People → Invite someone → new email, Org Collaborator → Send.
- [ ] Open the email link → set a password → lands on the Collaborator dashboard.
- [ ] They appear in Your People as Org Collaborator.

## 3. Promote an existing member (the original DH bug)
- [ ] Your People → Invite someone → **the same email**, Department Head, pick a department.
- [ ] Instead of sending, it says they already have access and offers **Change access** → confirm.
- [ ] Their dashboard becomes the Department Head dashboard. It should switch on its own; if not, sign out and back in.
- [ ] Departments shows them as that department's head.

## 4. Department created with an existing member as head
- [ ] Departments → Create → pick an existing member as head → confirm.
- [ ] That member now gets the Department Head dashboard.
- [ ] Repeat, but type the member's **email** in the invite field instead → same result, no email sent.

## 5. Message email opens the right org
- [ ] Send the DH a message → email arrives → the link ends in `?org=…`.
- [ ] Click it (signed out is fine) → after login, lands on the DH dashboard.

## 6. Second org keeps the first
- [ ] From a **second** org's admin account, invite the same person.
- [ ] They open the link → **no password prompt** ("You already have a Places People account") → Continue → lands in the new org.
- [ ] Their first org is still intact: open any message email link from the first org and it lands there. There's no org switcher yet, so links are the only way to switch.

## 7. Remove access in one org only
- [ ] In the second org: Your People → Remove access for that person.
- [ ] They still get into the first org normally.

## 8. Things that should still work
- [ ] Editing your display name (sidebar) saves.
- [ ] Switching the Timeline view saves as your preference.
- [ ] "Give [name] a login" on a People record → accept → Person dashboard. For someone who already has access, accepting links the record and keeps their current dashboard.

## 9. Security spot-check (optional)
As a collaborator, in the browser devtools console, try writing your own role to `admin` on your `users` doc. It should fail with **permission denied**.

## If something fails
Note the step number and what you saw. For a failed function call, Firebase console → Functions → Logs has the error.
