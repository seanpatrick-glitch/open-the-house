# Places People! — Remediation Plan
> Companion to: [docs/UI_AUDIT_2026-08-02.md](./UI_AUDIT_2026-08-02.md)
> Date: 2026-08-02
> Status: Planning only. No fixes have been implemented. This is a read-only companion document.

---

## How to read this plan

The audit report groups findings by severity (BLOCKS BETA / SHOULD FIX / POLISH). This plan regroups the same findings by **dependency and sequencing** — what has to happen before what, what can run in parallel, and what should be batched together because it touches the same code. A severity bucket tells you how bad something is; it doesn't tell you what order to fix things in. Several SHOULD-FIX items turn out to be prerequisites or free bundling opportunities for BLOCKS-BETA items, and one BLOCKS-BETA item (the beta-stable sync) is actually the *last* step, not the first, because merging broken code to the beta site earlier just ships the bugs sooner.

**Risk labeling used throughout:**
- 🟢 **Isolated patch** — touches one or two files, additive or narrowly-scoped, low chance of breaking anything else.
- 🟡 **Shared file, contained change** — touches a file many things import (Sidebar, DashboardShell, App.jsx routing) but the change itself is additive/subtractive and narrow. Blast radius is *potential*, not likely, if reviewed normally.
- 🔴 **Shared/security-sensitive, real ripple risk** — touches `firestore.rules`, cross-role navigation state, or auth-critical-path logic. Needs deliberate testing, ideally against a disposable test org (per standing practice), before it ships.
- ⚙️ **Ops/deploy action, not a code change.**

---

## TIER 0 — Verify before touching anything — ✅ COMPLETE (2026-08-02)

**0.1 — Empirically confirm the Department Head people-write bug.** 🔴 (verification, not a fix) — **✅ CONFIRMED LIVE**
Reproduced against a disposable test org with a real Department Head test account: People → Add Person → Save fails consistently, every attempt — matching the predicted cause exactly (the `firestore.rules` `resource.data.typeId` bug plus the missing `departmentHeadId` assignment). No longer just a static-analysis finding; Tier 1 is confirmed necessary as scoped.

**0.2 — (Surfaced during 0.1, not originally scoped) Empirically confirm the passwordless-lockout bug.** 🔴 — **✅ CONFIRMED LIVE**
While running 0.1, Sean signed out of the newly-created test account and found no way back in — matching the predicted cause exactly (no password ever set at invite acceptance via `JoinPage.jsx`/`PersonJoinPage.jsx`, no recovery option on `Login.jsx`). This confirms Tier 1B is necessary as scoped, in addition to Tier 1.

*Why this tier came first:* both Tier 1 and Tier 1B are now confirmed by direct reproduction, not just by reading the code — the empirical check surfaced a second real bug beyond the one it originally set out to verify, which is exactly why verifying before writing fix code is worth the time.

---

## TIER 1 — Foundational fix: unblock Department Head person creation

Nothing else in this plan matters if this doesn't work — it's the exact task the beta exists to validate. The two root causes are independent bugs that both have to be fixed for either to matter, so they ship as one atomic unit, not two separate tickets.

**1.1 — Fix the Firestore rule.** 🔴 shared/security-sensitive
Change `resource.data.typeId` to `request.resource.data.typeId` on the Department Head `people` write clause (or split it into an explicit `allow create` mirroring the pattern already used correctly two blocks above it for `tasks`). This is a one-line change in a single shared file, but `firestore.rules` governs every read/write in the app — deploy it with `firebase deploy --only firestore:rules` as its own step, separate from any app-code deploy, so it can be rolled back independently if something's wrong. Test against the Tier 0 scratch org before deploying to the real project.

**1.2 — Add the missing UI to set `personTypes.departmentHeadId`.** 🟢 isolated patch
`CreateDepartmentForm.jsx` already has a working "assign an existing member or invite by email" pattern for the department-level `departmentHeadUid` field — adapt that same pattern into `SettingsView.jsx`'s Person Types section (or `CreatePersonTypeForm.jsx`) to write the personType-level `departmentHeadId`. This is additive (a new control on an existing screen) and doesn't touch any existing write path for other fields, so it's low risk despite being "new work" rather than a bugfix.

*Why paired, not sequential:* 1.1 without 1.2 still leaves every personType's `departmentHeadId` permanently `null`, so the rule still never matches. 1.2 without 1.1 still 403s on `create` regardless of what `departmentHeadId` says. Ship both in the same PR/session and verify together against Tier 0's scratch org.

**1.3 — Filter the DH's Task Level selector to hide "Org."** 🟢 isolated patch
While in this same mental model (rules vs. what the UI offers), fix `CreateTaskForm.jsx` so a Department Head never sees "Org" as a level option — her write rule can only ever satisfy `level == 'department'`, so the option is currently a guaranteed dead end that surfaces as the same generic "Failed to create task" error. Trivial conditional on an existing dropdown; bundle it here since it's the same category of bug (UI offering an action the rules can't grant) and you're already reasoning about DH permissions.

---

## TIER 1B — Foundational fix: passwordless accounts have no way back in

**Found live during Sean's own Tier 0 verification (2026-08-02), not by the original static audit.** This is a second, independent foundational bug — unrelated to the Tier 1 rules issue, but equally "nothing else matters until this works," because it can undo a successful onboarding at *any later point*, for *any role*, not just at the first-task step. Every role except the founding Admin signs in via a passwordless email link and is never asked to set a password. `Login.jsx` (the only sign-in screen) requires email+password with no recovery option; the original invite link is single-use at both the Firebase and app-data layers; "Create account" dead-ends on `auth/email-already-in-use`. One tap of "Sign out" and the only way back in is Sean manually sending a brand-new invite — every time, for everyone.

**1B.1 — Add a "set a password" step to the existing invite-acceptance screen.** 🔴 auth-critical-path, but additive
`JoinPage.jsx` and `PersonJoinPage.jsx` both already have an "Almost there" step that captures display name before finishing signup — add a password field to that same step, calling Firebase's `updatePassword` on the account that was just created. This is the same screen already being touched in Tier 2.1 for the `window.prompt()` fix — **do these two together, in the same session**, since they're the same files, the same step in the flow, and both are auth-critical-path changes worth testing as one unit rather than two separate passes through the same screen.

**1B.2 — Add "Forgot password?" to `Login.jsx`, wired to `sendPasswordResetEmail`.** 🟢 isolated patch
This exact Firebase function is already used once elsewhere in this codebase (`UserManagement.jsx`, the dead legacy admin panel) — the pattern is proven, it just needs to move to a live, reachable screen. Cheap, additive, no dependency on 1B.1 (this is a safety net for anyone who skips or forgets a password set in 1B.1), but do it in the same batch since it's the same underlying problem.

*Why this ranks above even Tier 1 in real-world severity, despite being listed second in this plan:* Tier 1 blocks Tempest's very first task. This bug can lock her out **after** she's already succeeded — the first time she closes her phone browser, taps Sign out out of habit, or switches devices. Sequenced as 1B (after Tier 1) rather than folded into Tier 1 itself only because the two are independent root causes touching different code (Firestore rules vs. auth/sign-in screens) — they don't need to ship in the same commit, but both must land before Tier 4's beta-stable sync, same as Tier 1.

---

## TIER 2 — Fix the rest of the Tempest onboarding path

These don't depend on Tier 1 and can be worked in parallel by a separate stream, but all of them sit on the exact five-minute path Tempest walks on first login, so none of them should be deferred past the beta-stable sync (Tier 4).

**2.1 — Replace `window.prompt()` with a branded confirm-email screen.** 🔴 auth-critical-path, but additive
Both `JoinPage.jsx:33` and `PersonJoinPage.jsx:28` fall back to an identical raw native `window.prompt()` when `localStorage` doesn't have the inviter's cached email (the normal case for anyone opening an invite on a different device — i.e., every phone user). Add one styled screen, matching the existing card shell already used elsewhere in both files, that asks for the email in-app instead of dropping into browser chrome. This is additive UI in front of the existing `signInWithEmailLink` call — the underlying auth logic doesn't change, only what happens immediately before it — but because it's in the sign-in path, test it explicitly against the cross-device scenario (clear localStorage, or open the link in a different browser) before shipping, not just a happy-path check.

*Why one fix, two files:* identical pattern in both files — build the shared screen/component once, use it in both places, rather than patching each file separately (which would leave them free to drift out of sync later).

*Bundle with 1B.1:* this touches the exact same two files at the exact same step in the flow as Tier 1B's "set a password" addition. Do both in one pass through `JoinPage.jsx`/`PersonJoinPage.jsx` rather than two separate sessions touching the same screen twice.

**2.2 — Fix "Collaborator List" dead nav item.** 🟡 shared file, contained change
`DashboardShell.jsx`'s `SectionContent` has no case for `collaborator-list` (only `invite-collaborator`), so a currently-visible, currently-clickable sidebar item lands on a bare "Coming soon." Either wire it to a real collaborator-list view or — cheaper — repoint the nav item at the existing "Sent invites" list already rendered inside `InviteCollaborator.jsx`, which covers the same information. `DashboardShell.jsx` is imported everywhere, so review the diff carefully even though the change itself is a one-line addition to an existing switch.

**2.3 — Add a forward-pointing "Add people" action to `DHDashboardView`'s Planning state.** 🟢 isolated patch
A cheap, narrow version of this: add a button/link next to "Add a department task" that navigates straight to the People section (it does not need to auto-open the Add Person form yet — see 5.2 for the fuller fix). This alone removes the "no CTA on first landing" gap without waiting on the larger systemic quick-action refactor in Tier 5.

**2.4 — Surface the org's actual person-type label in nav/page copy.** 🟢 isolated patch, small design call needed
Change the sidebar "People" label and/or the `PeopleView.jsx` page header to reflect the org's configured person-type label (e.g. "Artists") when only one type is active — the data already exists in `personTypes`, this just needs a read + conditional render in `Sidebar.jsx` and `PeopleView.jsx`. Needs a one-line design decision from Sean (nav label swap vs. a subtitle under the existing "People" label) before implementation — flagging as a decision point, not blocked on anything else.

*Why Tier 2, not Tier 5:* every item above sits directly on Tempest's first-five-minutes path (Section B of the audit). Bundling them together, worked in parallel with Tier 1, means both tracks can land on `main` around the same time and go into the beta-stable sync together in one pass, rather than staggering multiple redeploys.

---

## TIER 3 — Close the live security/hygiene side door

**3.1 — Remove `/users`, `/dashboard-legacy`, `/show/:showId` route registrations from `App.jsx`, and delete `UserManagement.jsx`, `Navbar.jsx`, `SectionNotes.jsx`, `Dashboard.jsx`, `ShowTracker.jsx` and the `src/components/sections/*` legacy tree they depend on.** 🟡 shared file (App.jsx), but subtractive
Unlike the other dead-code findings, this one is not just inert weight — it's a live, unguarded admin panel with real write access to a disconnected legacy `shows`/`users` schema, reachable by anyone who types or bookmarks the URL. Confirmed via grep (cross-checked by two independent passes) that nothing in the live `Sidebar`/`DashboardShell`/`AuthRouter`/`views/` tree references any of these files, so removal is a subtractive, low-logic-risk change. The only care needed: `App.jsx` is the app's central router, so review the diff for accidental removal of an adjacent live route, and do a final grep pass immediately before deleting to catch anything introduced since this audit.

**3.2 — Delete the other confirmed-dead files: `HomeView.jsx`, `DepartmentDetail.jsx`, `InviteVolunteer.jsx`, `InviteManager.jsx`, `AcceptInvite.jsx`, and the orphaned `/invites` route.** 🟢 isolated patch
Same grep-verified dead-code status as 3.1, but these were never reachable by a guessable/bookmarkable URL the way `/users` was (they're either unrouted entirely or, for the invite trio, generate broken links that 404 before ever reaching live code), so they're lower urgency — no live write-access exposure, just orphaned weight. Bundle with 3.1 since you're already doing a dead-code sweep, but this half of it is genuinely optional to rush.

*Why before the beta-stable sync, not after:* removing a real, unguarded write surface to a legacy schema is cheap and has essentially no chance of breaking a live flow (everything here is confirmed unreachable from the current build). There's no reason to ship one more redeploy cycle with that door still open when it can go out in the same batch as Tiers 1–2.

---

## TIER 4 — Sync beta-stable to main, then verify live

**4.1 — Merge `main` into `beta-stable` and push.** ⚙️ ops action
Do this *after* Tiers 1–3 land on `main`, not before — `beta-stable` is currently 24 commits stale, and merging it up before the fixes exist would just ship Tempest the exact bugs this plan exists to fix, one redeploy early. This is also the only point where the branch-staleness problem itself gets resolved — no code change fixes it, only the merge does.

**4.2 — Confirm the GitHub Actions deploy to `placespeople-beta-testing.web.app` succeeds and reflects the new commit.** ⚙️ ops action
Check the Action run, then load the live beta URL and confirm (via version string, a visible feature that's new since 2026-07-26, or dev tools) that it's actually serving the new build — don't assume the push alone means the CDN/hosting cache is current.

**4.3 — Do one live, real-account walkthrough of the Tempest trace on the actual deployed beta site.** 🔴 the audit's own recommended next step
This is the live browser/credential testing this audit explicitly deferred (per standing practice — data-layer verification during development, live click-through as a dedicated pre-launch pass). Use a real or realistic test Department Head account, on the actual `placespeople-beta-testing.web.app` URL, and walk: invite email → sign-in link → confirm-email screen → dashboard → People → Add Person → Save. This is the only step in the entire plan that actually proves Tier 1 and Tier 2 work together correctly in production, as opposed to in isolation.

*Why this is the gate, not step one:* every fix upstream of this tier changes what the live walkthrough would even be testing. Doing 4.3 before Tiers 1–3 land would just re-confirm bugs already known from static analysis; doing it after is the actual go/no-go check before Tempest gets an invite.

---

## TIER 5 — Should-fix items that don't block Tempest's specific task

Nothing here prevents Tempest from completing her first task once Tiers 1–4 are done. These matter for overall beta quality — for Sean's own ongoing use of the app, and for whatever a second beta org or a less-fortunate first session surfaces — but can reasonably follow the beta launch as a fast-follow rather than gate it, consistent with the project's own beta philosophy (peer-to-peer, "find what's wrong," iterate from real feedback rather than trying to pre-solve everything).

**5.1 — Fix department card tap to actually filter the timeline.** 🟡 shared-ish (TimelineView is used by every role)
`DepartmentsView.jsx` already passes the right data (`departmentFilter: dept.id`); `TimelineView.jsx` just needs its filter predicate extended to check `task.departmentId`, not only the generic level pill. Contained to two files, but `TimelineView.jsx` is high-traffic across roles, so test the existing org-level filter still works correctly after the change, not just the new department-level path.

**5.2 — The full "quick actions open the right form/thread" refactor.** 🔴 shared code, real ripple risk — do as one coordinated pass, not incrementally
This is explicitly the larger version of the cheap interim fix already shipped in 2.3. Threading an `action`/target-form flag through the same `navState` mechanism `TimelineView.jsx` already uses for department filtering touches `TimelineView.jsx`, `MessageView.jsx`, `AdminDashboardView.jsx`, and `DHDashboardView.jsx` simultaneously. Doing this file-by-file risks leaving some quick actions "fixed" and others not, an inconsistent half-migrated state that's arguably worse than the current uniformly-unhelpful behavior. Schedule as one dedicated session touching all four files together, with a full regression pass over every quick action afterward (including the department-filter behavior from 5.1, since it shares the same mechanism — worth doing 5.1 and 5.2 in the same pass rather than two separate passes through the same function).

**5.3 — Systemic silent-write-failure → `toast.error` consistency pass.** 🟢 individually, but batch the ~35 sites into one pass
Each individual change is mechanical and low-risk — the codebase already has a proven `toast.error` pattern used correctly in ~15 places (`Login.jsx`, `InviteCollaborator.jsx`, `BroadcastForm.jsx`, etc.), so this is applying an existing pattern more consistently, not inventing new UI. The risk isn't logic risk, it's review-surface: touching ~35 files is easy to do sloppily. Recommend one deliberate pass, done *after* Tier 3's dead-code deletion so the file list doesn't include anything about to be removed (e.g. don't bother toasting errors in `DepartmentDetail.jsx`), and explicitly including the two fully-silent empty `.catch(() => {})` blocks (`MessagingView.jsx:88-90`, `VolunteerView.jsx:154-156`) alongside the console-only ones.

**5.4 — Mobile-responsive pass on the People roster table and `PersonProfileView.jsx`.** 🟢 isolated, but needs real device/viewport testing
CSS/layout-only change to two files — replace the raw `<table>` in `PeopleView.jsx` with a responsive card layout below a breakpoint, and loosen the fixed `w-36` label column in `PersonProfileView.jsx`. Low logic risk, but this is one of the few items that genuinely benefits from live testing (actual viewport behavior, actual tap-target sizing) rather than static reasoning — worth checking on a real phone, not just a resized browser window.

**5.5 — Make CSV import discoverable on touchscreens.** 🟢 isolated patch
Swap the hover-triggered dropdown on the "Import CSV" button (`PeopleView.jsx`) for a click/tap-triggered one. One component, no shared-state risk.

---

## TIER 6 — Polish (no dependencies, ship anytime, essentially zero risk)

Do these whenever convenient — none of them gate anything upstream, and doing them earlier only helps if bundled with a file you're already touching for another reason (e.g. fix the brand-voice em dash in `TaskDetailPanel.jsx` while you're in that file for something else, rather than as its own pass).

- **6.1** Brand-voice em-dash/word sweep across the "live code" list in Section H of the audit. 🟢 Do this *after* Tier 3's dead-code deletion, so the fix list doesn't include files that are about to disappear (the legacy-file violations in Section H don't need fixing if those files are deleted instead).
- **6.2** `package.json`'s `"name"` field, still `"show-prep-app"`. 🟢
- **6.3** Leftover AI-authoring comment in `AdminDashboardView.jsx:9-10`. 🟢
- **6.4** `assignments[].type` model-doc drift (`'venue'` in the comment vs. `'place'` in actual code) — doc-only fix, the code already defensively handles both values. 🟢
- **6.5** `VolunteerView.jsx` → rename to something reflecting "Person" as the canonical role name. 🟡 touches `AuthRouter.jsx`'s import — cosmetic only, defer indefinitely, do only opportunistically alongside a larger change already touching that file.

---

## Explicitly out of scope for this plan

These are real, confirmed findings but are non-blocking per the audit and per PROJECT_STATE.md itself — no need to schedule them relative to the beta launch:
- Venue Manager / Production Collaborator dedicated views (not part of Tempest's beta scope; PROJECT_STATE already tracks these as not-yet-designed).
- Production scope (single/season/festival) wiring into timeline generation (explicitly non-blocking festival/season work).
- Places detail fields (address/capacity/contact) — needs a Feature Roadmap spec session before any code, not just an implementation pass.
- Staff toggle enforcement (data model exists, nothing reads it at either layer) — no current feature depends on it yet.
- "Messaging routes to Collaborator dashboard" bug — not reproducible from the messaging code itself; needs its own investigation (recommend starting from `AuthContext.jsx`'s org/role resolution, per the audit) before it can even enter a remediation plan.

---

## Summary: what has to be true before Tempest gets an invite

1. **Tier 0** verified the bug empirically.
2. **Tier 1** shipped (rules fix + departmentHeadId UI + DH task-level filter) — she can actually save a person record.
3. **Tier 1B** shipped (password set at invite acceptance + forgot-password recovery) — she can't permanently lock herself out the moment she signs out.
4. **Tier 2** shipped (confirm-email screen, dead nav fix, dashboard CTA, nav vocabulary) — she isn't dropped into a native browser prompt or a dead end on the way there.
5. **Tier 3** shipped (legacy route/side-door removal) — bundled in because it's cheap and already grep-verified safe.
6. **Tier 4** completed — `beta-stable` actually reflects all of the above, confirmed live, and walked end-to-end on the real deployed site with a real test account, **including deliberately signing out and back in** to confirm Tier 1B actually closed the lockout gap.

Tiers 5 and 6 can follow beta launch as a fast-follow, informed by what Tempest herself actually hits — which is the point of a beta.
