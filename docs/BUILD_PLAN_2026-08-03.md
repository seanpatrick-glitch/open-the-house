# Places People! — Consolidated Build Plan
> Date: 2026-08-03
> Status: Planning only. Nothing in this document has been implemented, merged, or deployed.
> Source documents this consolidates: [docs/UI_AUDIT_2026-08-02.md](./UI_AUDIT_2026-08-02.md), [docs/UI_AUDIT_REMEDIATION_PLAN_2026-08-02.md](./UI_AUDIT_REMEDIATION_PLAN_2026-08-02.md), [docs/UI_AUDIT_2026-08-04.md](./UI_AUDIT_2026-08-04.md), [docs/DATA_MODEL_ARCHITECTURE_PROPOSAL_2026-08-03.md](./DATA_MODEL_ARCHITECTURE_PROPOSAL_2026-08-03.md), plus two additional findings surfaced in conversation (people-visibility scoping, nav/branding fact-finding) that were never written to a doc until now.

**If you are a fresh Claude Code session picking this up with no memory of how it was produced: this document is self-contained. Each item below states what's wrong, why it's positioned where it is, and what "done" looks like. Read the linked source docs for deeper evidence/file:line citations if you need them, but you shouldn't need to in order to execute a given phase.**

---

## How to read this plan

Phases are sequenced by **dependency and beta risk**, not by how the findings were originally grouped. Do not skip ahead to a later phase before finishing the ones before it — several later items assume earlier ones are done (e.g. Phase 3's people-scoping change is easiest to reason about once Phase 1's cleanup has already reduced the number of moving nav/dashboard patterns).

**Risk labels**, same convention as the original remediation plan:
- 🟢 **Isolated patch** — one or two files, additive/narrow, low risk.
- 🟡 **Shared file, contained change** — touches a file many things import, but the change itself is narrow.
- 🔴 **Shared/security-sensitive, real ripple risk** — touches `firestore.rules`, cross-role state, or a real feature build. Needs deliberate testing.
- ⚙️ **Ops/deploy action, not a code change.**
- 🎨 **Design/spec decision needed before code** — don't start writing code until this is resolved.

---

## Already done — do not re-do, listed here only for context

These are complete and were live-verified working (not just statically reviewed) earlier in this project's history. If you're auditing state, confirm they're still intact, but they are not open work items:

- **Tier 1** (original remediation plan): Department Head can create a person record — `firestore.rules` fix (`request.resource.data.typeId` on the create clause), the `departmentHeadId`-assignment dropdown in `SettingsView.jsx`, and hiding the "Org" task-level option from Department Heads in `CreateTaskForm.jsx`.
- **Tier 1B**: Passwordless-invite lockout fixed — password is now required at invite acceptance (`JoinPage.jsx`, `PersonJoinPage.jsx`), and "Forgot password?" was added to `Login.jsx`.
- **Tier 2.1**: `window.prompt()` replaced with a shared, branded `ConfirmEmailScreen.jsx` component used by both invite-acceptance flows.
- **Tier 2.3**: DH dashboard got a forward-pointing "Add people" quick action.
- **Tier 3**: All confirmed-dead legacy code deleted outright (not just unlinked) — `Navbar.jsx`, `SectionNotes.jsx`, `UserManagement.jsx`, `Dashboard.jsx`, `ShowTracker.jsx`, `HomeView.jsx`, `DepartmentDetail.jsx`, `AcceptInvite.jsx`, `InviteManager.jsx`, `InviteVolunteer.jsx`, the whole legacy `components/sections/` tree, and their routes in `App.jsx`.
- **Tier 5.1/5.2**: Department card tap now really filters the timeline by department; dashboard quick actions now open the actual right form/thread (not just a generic section).
- **Tier 5.3** (mostly): ~35 previously-silent write-failure sites now show `toast.error`; both fully-silent empty `.catch(() => {})` blocks are gone. One small residual gap carried into Phase 1 below.
- **Tier 5.4/5.5**: People roster is mobile-responsive; CSV import is tap-triggered, not hover-only.

---

## PHASE 0 — Whatever's still required before beta

Everything here was either explicitly still open from the original plan's pre-beta scope, or was ranked BLOCKS BETA in the original audit but never actually got scheduled into a tier (a real gap in the original plan's execution, not a new finding — worth knowing that happened).

**0.1 — Finish the `beta-stable` sync.** ⚙️ ops action
`beta-stable` is currently missing exactly one commit from `main` (the most recent one, a docs-only state update). Two sync-merge commits already landed for everything before that. Merge the remaining commit and push, so `beta-stable` — the branch that actually deploys to `placespeople-beta-testing.web.app` — is fully current.

**0.2 — Do the live, deployed-site verification walkthrough.** 🔴 verification, not a code change
Everything tested so far in this project's history was tested against a local dev server. Nobody has yet walked the full Department-Head-accepts-invite-and-adds-a-person trace against the actual deployed beta URL. Do that once 0.1 is done: real invite email, real link click, sign-in, set password, land on dashboard, add a person, sign out, sign back in with the password. This is the actual go/no-go check before Tempest gets an invite — everything upstream of it has only been proven in isolation.

**0.3 — Add QR code print/download/share to `CheckInTokenGenerator.jsx`.** 🟢 isolated patch
This was ranked as a BLOCKS BETA item in the original audit (a Department Head has no way to get the check-in QR code onto anything physical — no print, download, or share affordance exists in that file at all) but was never actually assigned to a tier in the remediation plan, so it never got fixed. It doesn't block Tempest's very first login-and-add-artists task specifically, but it does block the check-in feature the moment anyone actually tries to use it at a real event, so close this out before beta moves past the artist-roster stage. Minimal version: a "Print" button that opens the browser print dialog on the QR code, or a "Download" link that saves it as an image — either is enough, don't overbuild this.

**0.4 — Re-verify the "messaging routes to Collaborator dashboard" bug live.** ⚙️ verification
This was reported as a real bug in earlier project history but was never reproducible by reading the messaging code itself (no redirect/navigate logic exists anywhere in `MessagingView.jsx`, `MessageView.jsx`, or `BroadcastForm.jsx`). A separate, unrelated fix landed in between (`c96a961`, correcting a Firestore composite-index sort direction on the threads collection) that could plausibly have been the actual root cause — a bad index sort can produce exactly this kind of "stale view after an action" symptom. Do a quick live test (send a message from a couple of different account types, confirm no unexpected redirect) rather than assuming it's fixed or still broken.

---

## PHASE 1 — Quick, safe, isolated fixes

Nothing here requires a real design project. Most are one file, all are low-risk. Do these as one batch — they're independent of each other and independent of every later phase.

**1.1 — Dedupe "Collaborator List."** 🟡 shared file, contained change
`DashboardShell.jsx`'s section router currently sends both `collaborator-list` and `invite-collaborator` to the exact same component (`InviteCollaborator`). Two sidebar menu entries, one screen — this is a literal, concrete example of the "thin nav item" pattern Sean called out. Fix: remove the redundant "Collaborator List" entry from `Sidebar.jsx`'s `NAV_ITEMS`, and the corresponding case in `DashboardShell.jsx`. Don't build a separate list view to justify keeping two entries — "Invite Collaborator" already shows the list of sent invites inline on the same screen, so there's nothing a separate screen would add.

**1.2 — Make the Departments "people count" stat tell the truth.** 🟢 isolated patch
`DepartmentsView.jsx` currently computes each department's people count by filtering `person.assignments[]` for an entry with `type === 'department'` — but nothing anywhere in the app ever creates an assignment of that type (`AssignmentsPanel.jsx` only supports `'production'` and `'place'`). The stat is not "sometimes wrong," it is structurally always zero, for every department, in every org, permanently.

Do not try to fully solve this here — the complete fix (making Person records actually track department membership) is bigger, related work that's intentionally deferred (see the note in Phase 3). The narrow, safe fix for now: change the query to count `organizations/{orgId}/members` documents where `departmentId === dept.id` instead. That field is already correctly populated for staff (Department Heads, Secondary Admins, etc.) via the existing role-based invite flow — reusing it means the stat becomes a real, if incomplete, number (it'll count staff assigned to the department, not yet the artists/volunteers who belong to it) rather than a permanent, silent lie. Note clearly in the code comment that this is a partial fix and the full picture depends on the People-Department linkage work referenced in Phase 3.

**1.3 — Soften the Production "coming soon" placeholder.** 🟢 isolated patch
`ProductionDashboard.jsx` still shows a literal "Production dashboard content coming soon." below the one real feature there (the active-modules toggle grid). Don't build out real content here — that's a bigger, undesigned effort. Just replace the placeholder text with something that doesn't read as broken (e.g., explain what IS here — the modules grid — rather than announcing what's missing).

**1.4 — Surface the org's actual person-type label in the People nav.** 🟢 isolated patch, one small decision needed first
The sidebar and the People page header still say generic "People" regardless of what the org actually calls these people (e.g. "Artists" for a festival). The data already exists (`personTypes` collection) — this just needs a read + conditional render in `Sidebar.jsx` and `PeopleView.jsx`. One decision needed before writing code: when an org has exactly one active person type, does the nav label swap to that type's name outright, or does "People" stay with a small subtitle underneath showing the type name? Either is fine — pick one and move on, don't turn this into a bigger design exercise.

**1.5 — Fix `VolunteerView.jsx`'s new toast-spam risk.** 🟢 isolated patch
The "mark thread as read" error toast added during the Tier 5.3 cleanup sits inside an `onSnapshot` callback rather than a one-time effect. If that particular write keeps failing, every subsequent change to the thread re-triggers the listener, re-attempts the write, and re-fires the toast — genuine duplicate-toast risk under sustained failure. `MessagingView.jsx` has the equivalent fix done correctly (scoped to a `useEffect` keyed on thread selection, not inside the snapshot callback) — copy that pattern.

**1.6 — Consolidate the quick-action navigation mechanism.** 🟡 shared file, contained change
Two different patterns currently coexist for the same concept: `DepartmentsView.jsx` uses a normal passed-in `onNavigate` prop; `AdminDashboardView.jsx` and `DHDashboardView.jsx` use a global `window.dispatchEvent(new CustomEvent('navigate', ...))` caught by a listener in `DashboardShell.jsx`. Root cause: `DashboardShell.jsx` renders the Home section without passing `onNavigate`/`navState` to it at all, so the two dashboards had no choice but to invent the event-based workaround. Both work correctly today — this isn't a live bug — but it's fragile: the next quick action added will have to guess which pattern to copy. Fix: pass `onNavigate`/`navState` into the Home section the same way every other section already receives it, then migrate `AdminDashboardView.jsx` and `DHDashboardView.jsx` off the `window.dispatchEvent` pattern onto the prop. Test every existing quick action afterward (there are several across both dashboards) to confirm none silently stopped working.

**1.7 — Small polish items, zero risk, bundle in whenever convenient:**
- `package.json`'s `"name"` field is still `"show-prep-app"` — update it to match the actual product name.
- `models/people.js` documents `assignments[].type` as `'production' | 'venue'`, but the actual code writes `'production' | 'place'` — fix the doc comment to match reality (the code already defensively handles both values, so this is a documentation-only fix, not a behavior change).
- `VolunteerView.jsx` is the component serving the "Person" role, a naming holdover from before "Person" was locked as the canonical role name. Optional rename to something like `PersonView.jsx` — touches its one import site in `AuthRouter.jsx`. Purely cosmetic, do this only if you're already touching this file for something else in a later phase, don't do it as a standalone task.
- The Settings screen's signup-link "Copy" button still gives no success/failure feedback (`navigator.clipboard.writeText` with no `.then`/`.catch`) — a small residual gap the Tier 5.3 toast-error pass didn't cover since it wasn't in that pass's original scope. Add a `toast.success`/`toast.error` pair, same pattern as everywhere else in `SettingsView.jsx`.

---

## PHASE 2 — Task → Production linkage

This is the architecture change from `docs/DATA_MODEL_ARCHITECTURE_PROPOSAL_2026-08-03.md`. Read that doc for the full reasoning; this is the execution summary.

**2.1 — Add an optional production link to task creation.** 🟢 isolated patch, additive only
`CreateTaskForm.jsx` currently writes `production: null` on every task, with no UI to set it to anything else — this field exists in the schema but has never actually been wired up. Add a production picker to the form (reuse the exact "place + production" composite reference pattern already used for `org.activeProdId` elsewhere in the codebase — this isn't a new pattern, it's applying a proven one to a new field). Leave it optional and default it to the org's current active production (`org.activeProdId`) when one is set, so most tasks get linked without anyone having to remember to do it, while still being one click to clear or change.

**2.2 — Confirm the existing "Production linked" badge lights up correctly.** 🟢 isolated, verification-heavy
`TimelineView.jsx` already has a `{task.production && <p>Production linked</p>}` badge sitting in the code, dead until now because the field was always empty. Once 2.1 ships, verify this actually renders for linked tasks and stays hidden for unlinked ones — no new UI needed here, just confirm the dormant code does what it was clearly built to do.

**What this phase deliberately does NOT do** (see the architecture doc for the reasoning): it does not add any production/venue field to Department or Place — those stay exactly as simple as they are today. It does not add a separate venue field to tasks — venue comes for free through whichever production a task links to, since every production already belongs to exactly one venue by construction. Do not scope-creep this into a bigger change.

---

## PHASE 3 — People-visibility scoping for Department Head

A real feature, not a bug fix — build it deliberately, test it carefully. Currently, a Department Head sees every single person in the org with zero filtering, at both the UI and data layers:

- `PeopleView.jsx`'s live query has no `where` clause at all — every role that reaches this screen sees an identical, unfiltered full list. The "Person Type" dropdown filter is a client-side convenience the user can clear, not a default scope.
- `firestore.rules`'s Department Head read rule for people is `allow read: if isDepartmentHead(orgId);` — no check against which Person Type a given record belongs to. This is a real data-access gap, not just a UI display choice.

**Target behavior** (confirmed with Sean): only Admin/Secondary Admin see everyone by default. Each Department Head's People view shows only people belonging to the Person Type(s) she heads — and a DH can head more than one Person Type, so this isn't a single-value filter, it's "any type where `personType.departmentHeadId == this DH's uid`." Org-wide reach for a DH happens only through an explicit action (the broadcast/messaging feature that already exists), never through default visibility.

**3.1 — Scope the Firestore rule first.** 🔴 shared/security-sensitive
Good news: the correct pattern for this already exists in the same rules file — the Department Head *write* rule for people already correctly checks `get(personTypes/$(resource.data.typeId)).data.departmentHeadId == request.auth.uid` (this was the Tier 1 fix). Apply the identical pattern to the *read* rule. This is lower-risk than it sounds because you're not inventing a new check, you're extending a proven one from write to read. Test against a disposable org with two Person Types, each headed by a different DH test account, and confirm each DH can only read people of her own type(s), not the other's.

**3.2 — Scope the `PeopleView.jsx` query to match.** 🟡 shared file, contained change
Once the rule is in place, the UI query needs to actually ask for the right data (an unscoped query would just come back empty/error for a DH now, not silently show everyone). Look up which Person Type(s) have `departmentHeadId` equal to the current DH's uid, then filter the people query to `typeId in [...]`. Admin/Secondary Admin keep the current unfiltered query unchanged.

**3.3 — Keep this decoupled from the deeper People↔Department gap.** 🟢 no action needed, just don't conflate
This phase only needs `personType.departmentHeadId`, which already works correctly (fixed in Tier 1). It does **not** need `personType.departmentId` or `person.assignments[].type === 'department'` — both of those are separately broken (see Phase 1.2's note and the architecture doc) and are a different, bigger problem (how a *Person*, not a *Person Type*, relates to a Department). Don't try to fix that here — it would turn a contained rules-and-query change into an open-ended one.

---

## PHASE 4 — Dashboard content + Department Head nav trim (bundle these — both are about how DH experiences the app)

**Grounding facts first, so this doesn't get built on a wrong assumption:**

- There is no earlier "good" dashboard to revert to. Every dashboard-related file's git history was checked — none of them ever shrank; they were each built once, whole, and only grew or received small fixes afterward. The one file that felt richer (`HomeView.jsx`, from the very first scaffolding step) was entirely hardcoded fake placeholder data (duplicate "The Tempest" entries, made-up progress percentages) that never read from Firestore — it was a mockup, not a working dashboard, and it was correctly deleted once the real dashboards existed. The current dashboards correctly show real, often sparse, data for a new/testing org — that's not a regression, it's what a live data-backed dashboard looks like before an org has much in it.
- What IS a real, if smaller, gap: the rebuild that replaced the mockup landed on a plainer visual language (flat lists, small status badges) than the mockup's card-grid-with-progress-bars treatment. That's a style choice made during the rebuild, not something that got stripped out of a once-richer real version.
- Department Head currently gets the exact same 11-item nav as Admin (same `Sidebar.jsx` component, same list) — the only difference is what renders in the Home section. Of those 11 items, 9 are substantive/real; 2 are thin (see Phase 1.1's dedupe and the Places module, which is real-but-minimal — just a name field per venue, no schedule view, confirmed out of scope for now per the original audit). The Person role, by contrast, has **no nav menu at all today** — it's already a single dashboard-and-inline-actions screen, and the audit found it genuinely functional. That's proof the "collapse to a dashboard hub" pattern already exists and works in this app for one role; the question for Phase 4 is whether and how to extend something like it to Department Head.

**4.1 — Two small, pre-beta-safe items, do these now regardless of the bigger project below.** 🟢 isolated patch
Improve the empty/sparse-state copy on `AdminDashboardView.jsx` and `DHDashboardView.jsx` so a new or lightly-populated org's dashboard reads as "this is correctly showing you have nothing yet" rather than "this looks broken." Nothing else dashboard-related needs to happen before beta.

**4.2 — Richer, production-stage-adaptive dashboard content.** 🎨 design/spec decision needed before any code — post-beta
This is a real design project: what should the dashboard actually show, and how should it change based on where the org is in a production's lifecycle (the four dashboard states — Planning, Final Countdown, Live, Postmortem — already exist and are correctly detected; the question is what richer content goes inside each state). Do not start building this without a dedicated spec session first. Don't treat this build plan as having decided the content — it hasn't.

**4.3 — Give Department Head her own trimmed, role-appropriate nav instead of the full Admin list.** 🎨 design/spec decision needed before any code — post-beta
Candidate items to drop for DH (not a final decision, just the obvious candidates based on what's Admin-scoped vs. not): Places, Productions, and the Collaborators group all look like Admin/org-configuration concerns rather than things a DH needs day-to-day. Candidate items to keep: Home, Messages, Timeline, People (now scoped per Phase 3), Check-In, and possibly a trimmed Settings. This needs an actual decision session, not just implementation — don't build this from the candidate list above without confirming it first, since removing access to something a DH actually needs would be worse than the current overwhelming-but-complete nav.

---

## PHASE 5 — Branding: build a real token system, then do the color pass (last, on purpose — purely cosmetic, nothing else depends on it)

**Grounding facts:**

- `tailwind.config.js` is completely stock — `theme: { extend: {} }`, no custom colors, no design tokens. `index.css` has no CSS custom properties. There is currently no central place to change "the brand color" and have it propagate — every color is a raw Tailwind utility class hardcoded into each component's `className`, file by file.
- It's not just "no system" — the colors already in use are inconsistent with each other: 16 files use `amber-600` as their primary accent, 28 use `indigo-600`. Sidebar, Login, and the invite/join flow lean amber; People, Settings, and most CRUD forms lean indigo.
- Neither of those matches the already-locked brand direction. Per `PROJECT_STATE.md` Section 5, the visual identity was locked months ago as "Direction 4 (Stage Call)" — Places in white, People in electric blue, deep blue atmosphere. Neither amber nor indigo is that color. This isn't a new decision to make — it's applying a decision that was already made in brand strategy but never reached the actual product UI.
- One real open dependency, not solved by this phase: `PROJECT_STATE.md` Section 6 notes the Direction 4 wordmark's typeface (a Canvas-generated brush script) has an unresolved question — is it a real licensable font, or image-generated lettering with no underlying font file? That question blocks finishing the *typography* side of a full brand pass. It does not block the *color* side — proceed with color tokens independently.

**5.1 — Build the token layer first.** 🟡 shared file, contained change, but foundational
Extend `tailwind.config.js`'s theme with named brand color tokens (e.g. a `brand` or `primary` color scale based on the locked electric-blue direction, plus whatever secondary/neutral tokens the app actually needs) instead of leaving `theme.extend` empty. This is the one-time setup that makes everything after it a find-and-replace instead of a judgment call file-by-file.

**5.2 — Do the sweep.** 🟢 individually, but batch it — touches ~44 files
Replace `amber-*` and `indigo-*` utility classes across the app with the new brand tokens from 5.1. Mechanical, low individual risk, but do it as one deliberate pass with visual spot-checks afterward (screenshot a handful of screens across both Admin and the roles that reach `DashboardShell`, in both light contexts you already have — Login's dark card, the standard light app shell), not scattered across unrelated commits.

**5.3 — Typography/logo, once the font-licensing question is resolved.** ⚙️ blocked on a decision outside this codebase
Not actionable until Sean confirms the Direction 4 wordmark question above. Don't start this sub-item speculatively.

---

## Summary: sequencing logic, one paragraph per phase

**Phase 0** closes out what beta launch actually still needs — an almost-finished ops sync, one live verification pass, and one BLOCKS BETA item that fell through a scheduling gap in the original plan. **Phase 1** is a free batch of independent, zero-design-decision cleanups — do it whenever, but doing it before Phase 3 reduces how many moving nav/dashboard patterns exist while you're reasoning about people-visibility. **Phase 2** is small, additive, and self-contained — no reason to wait, but it's ordered after Phase 1 since it's lower urgency than the pre-beta and quick-cleanup work. **Phase 3** is the first phase that's a real feature build with security-rule implications — deliberately sequenced after the cleanup phases so it's the only complex thing in flight at a time. **Phase 4** bundles two DH-experience questions that both need a design decision before code, and both build on Phase 3 already having scoped what a DH sees — doing this before Phase 3 would mean designing a trimmed nav and dashboard around data visibility rules that don't exist yet. **Phase 5** is last because it's the only phase with zero functional dependencies on anything else — it's pure presentation, and doing it earlier would just mean re-touching the same ~44 files again after later phases add more UI.
