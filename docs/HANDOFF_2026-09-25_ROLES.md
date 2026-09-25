# Handoff: DH routing fix, role system rebuild, merged base-level dashboard (2026-09-25)

Written by a Claude Code cloud session for the next Claude Code session, most likely a local one with access to `G:\My Drive\Places People\`. Everything below is merged to `main` and deployed unless it says otherwise.

---

## 1. What the next session needs to do

1. **Pull `main`.** It includes this file and the updated `docs/PROJECT_STATE.md`.
2. **Sync the Drive copy of PROJECT_STATE.md** (Section 10 of that file requires it). The cloud session could not write to `G:`.
   - Compare `G:\My Drive\Places People\PROJECT_STATE.md` with the repo's `docs/PROJECT_STATE.md`.
   - Expected result: Drive matches `main` as of `7a843ec` (Sean's size cleanup), and the repo has moved ahead with this session's edits. If that's the case, copy the repo version to Drive.
   - If Drive has content the repo lacks, **merge; never pick one side.** Commit the merged file (`state: reconcile Drive and repo copies`) and record the reconciliation in Section 8.
   - The Changelog Archive was **not** touched this session. Just confirm the Drive and repo copies still match.
3. **Section 8 has 9 entries.** The next new entry makes 10, which triggers the archive-in-batches-of-5 rule in Section 10.
4. **After Sean runs `docs/LIVE_CHECK_ROLES_2026-09-25.md`:**
   - If it passes, change the two Section 2 items from **FIXED AND DEPLOYED** to **RESOLVED** with the date.
   - If a step fails, fix it. Run `npm run test:roles` before pushing any change to roles, invites or rules (see `CLAUDE.md`).
5. **Raise the open item in section 5 below (owner has no member record) with Sean.** It's the one known gap that will show up in normal use.

---

## 2. Why this work happened

Sean reported that some Department Head accounts landed on the Collaborator dashboard after a new-message email. An Aug 9 fix had already covered one cause, and it still held. Diagnosis found three more live causes, plus a security hole:

| | Cause |
|---|---|
| B | Promoting an **existing member** to DH by email failed. The rules rejected their invite acceptance, so their role never changed. |
| C | Accepting an invite into a **second org erased the first**. `JoinPage` overwrote the whole `organizations` map. |
| D | `AuthContext` picked `Object.keys(organizations)[0]`, which is **arbitrary** for anyone in more than one org. |
| Security | The `users` self-update rule had no field limits, so **any user could set their own role to `admin`**. |

`emailOnNewMessage` was never a cause. Its link is just when people noticed.

---

## 3. Decisions Sean made this session (all logged in PROJECT_STATE.md)

- All current data is test/demo data being wiped, so there is **no data migration**. Fix the code only.
- **Multi-org is certain.** Build the foundation now; the org switcher UI comes later.
- **Beta has three dashboards, by Role:** Admin, Department Head, and everyone else. Read-only access counts as base-level.
- **People taxonomy vs. access (locked):**
  - **Group** (Company / Your People / Collaborators) and **Role** (Admin / DH / base-level) are separate fields. Never merge them, and never derive one from the other.
  - **Storage (confirmed):** Group goes on the per-org People record. Role goes on `users/{uid}.organizations[orgId].role` and is written only by server functions. Every login gets a People record (to be built with the taxonomy layer).
- **Base-level dashboard:** CollaboratorView as the base, plus My Tasks and My Schedule.
- **Labels:** the People group's sub-items are **Company** and **Your People** (was "Collaborators"). The Company page header says "Company".
- **The regression test** is kept in the repo but run **manually only**, not in CI.

---

## 4. What was built (PR #3, merged as `01f1ccd`, deployed 2026-09-25 20:17 UTC)

### Server: `functions/index.js`
These are the only code that writes roles or memberships:
- `acceptInvite`:
  - accepts a `/join` invite or a `/person-join` token
  - **adds** the org and never overwrites
  - works for existing accounts
  - linking a People record never changes an existing member's role
  - refuses to change the org owner
- `setMemberRole`:
  - admin-only direct role change, including DH of a department
  - keeps `departmentHeadUid` in sync
  - marks older pending invites to that email superseded
  - refuses owner and self
- `revokeMember`: admin-only; removes **one** org only.
- `confirmAssignment`: a member confirms their own assignment. The old client write had always been rejected by the rules.
- `emailOnNewMessage` links now carry `?org=`.

### Rules: `firestore.rules`
- `users`:
  - self-update is limited to `displayName` and `preferredTimelineView`
  - self-create only at signup (one admin membership, in an org you own)
  - the admin promote/revoke clauses are gone
- Invitees can't edit their own invites.
- Members can't self-create.
- The "any signed-in user can link themselves to any People record" clause is removed.
- New `isBaseLevel()` helper: every base-level role can message and flag. Any member can rename their own linked People record, and nothing else on it.

### Client
- `src/models/roles.js`: role → access level. Mirrored by `functions/roles.js`, and `isBaseLevel()` in the rules lists the base roles; **keep all three in sync.** `AuthRouter` and `DashboardShell` route from it.
- `src/utils/activeOrg.js`: the active org is chosen in this order:
  1. an org requested via `?org=` or by JoinPage
  2. else the last-used org
  3. else the most recently joined
- `JoinPage` / `PersonJoinPage` call `acceptInvite`. A password is asked for only on accounts never set up, and set only after the join succeeds.
- `InviteCollaborator`: an existing member's email offers **Change access** (`setMemberRole`) instead of emailing an invite.
- `CreateDepartmentForm`: an existing member as head (from the dropdown or a typed email) goes through `setMemberRole`.
- `CollaboratorRoster` "Remove access" → `revokeMember`.
- `src/views/MemberView.jsx` is the dashboard for every base-level role. It was renamed from CollaboratorView, and adds Next up, Confirm your assignments, My Tasks and My Schedule. `PersonView.jsx` and `utils/messaging.js` were removed.
- New `src/utils/callableError.js` shows a function's own error message.

### Labels (display only)
- "Collaborators" → "Your People".
- "Don't need to sign in" copy removed.
- "No account" badge → "Not invited yet".
- Company page header matches its nav item.

### Tooling and docs
- `CLAUDE.md` (repo root): the locked rules. It loads only in Claude Code sessions on this repo.
- `tests/emulator/role-flows.test.mjs`: run with `npm run test:roles`. It needs Java 11+ and `npm install` in the root and `functions/`. **34/34 pass.** Every deny case was also confirmed failing against the old rules.
- `firebase.json`: gained an `emulators` block (deploys ignore it). Emulator logs are gitignored.
- `docs/LIVE_CHECK_ROLES_2026-09-25.md`: post-deploy checklist, **not yet run**.
- `docs/PROJECT_STATE.md`: Sections 2, 3, 7 and 8 updated. Main's size cleanup was merged in, keeping main's locked taxonomy paragraph as canonical, with implementation notes under it.

### Commits (oldest first)
`16a2ec1` labels · `7fc4697` state · `7c26233` Company header · `538295b` role list · `0b72fd7` role functions · `3e4efc5` active org · `c4593a7` client flows · `70e5e44` rules lockdown · `2ee2c01` password-step fix · `1cfab2b` toast duration · `ad37112` state · `3ec0a50` emulator test · `082ebaa` CLAUDE.md · `af75418` base-level rules + confirmAssignment · `199d2f8` MemberView · `2e1f0cd` state · `68f66e6` checklist fix · merge `01f1ccd` · then a follow-up PR with the deploy record and this handoff.

**Deploy (CI run #196): success.**
- Rules released.
- `acceptInvite`, `setMemberRole`, `revokeMember` and `confirmAssignment` created.
- Other functions updated.

---

## 5. Open items and follow-ups

| Priority | Item | Notes |
|---|---|---|
| **Fix before or with the live check** | **The org owner has no `members` doc.** | `SignupStep3.jsx` writes only `users/{uid}`; older orgs were backfilled once by `scripts/migrate-org-members.js`. In every fresh org after the wipe, the owner is missing from Your People, missing from the **Messages → New** list (base-level members can't start a message to them), and their sidebar display-name edit shows an error. **Proposed fix:** signup creates the owner's members doc server-side (or right after the users doc), plus an emulator test case. Pre-existing, not caused by PR #3. **Waiting on Sean's go-ahead.** |
| Planned (post-beta) | Taxonomy layer (the Group field) | Constraint and storage are in PROJECT_STATE Section 3. Also resolves the "known conflicts" list there. |
| Planned | Org switcher UI | Today the active org only changes via `?org=` links. |
| Known conflict | People-record invites always grant role `person` | The admin can't choose access. Logged in Section 3; fix it with the taxonomy layer. |
| Pre-existing observation | `venueManager` routes to the Admin dashboard, but the rules give it no admin write access | Not touched. Decide whether venueManager should stay admin-level. |
| Optional | "Message my Department Head" shortcut on MemberView | Person logins used to have a one-tap button. Now they use Messages → New. |
| Housekeeping | CI warnings | `firebase-functions` outdated; Node 20 actions deprecated; 4 Firestore indexes exist in the project but not in `firestore.indexes.json` (all pre-existing). |
