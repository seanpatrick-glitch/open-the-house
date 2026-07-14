# Places People! — Project State
> Single source of truth for all Claude sessions. Read this first on every sync.
> Last updated: 2026-07-14
> Updated by: Claude Code (Code Interpreter and App Build session sync)

---

## SECTION 1: PRODUCT IDENTITY

**Platform name:** Places People! (no comma)
**Tagline:** There's more to the show than just the stage.
**Descriptor:** Live event operations software to get your people through production, from planning to places.
**App URL:** open-the-house.web.app (domain update pending)
**GitHub:** github.com/seanpatrick-glitch/open-the-house
**Beta access code:** OTH2026
**Stack:** React, Vite, Firebase (Auth + Firestore), GitHub Actions CI/CD
**Scope:** Broader live event operations. Not FOH-specific. Community theaters, fringe festivals, regional theaters, immersive companies, nonprofit event organizations.

---

## SECTION 2: BUILD STATUS

**Overall:** Planning Timeline complete through Step 8a. Post-timeline cleanup done. App live at open-the-house.web.app.

**Complete:**
- Organization creation flow
- Role-based auth router
- Invite flow
- Dashboard shell
- Productions section (all four steps)
- Departments module (all five steps including Settings toggle, list view, inline creation form, department head assignment)
- Planning Timeline Steps 1–8a:
  - Step 1: Firestore data model, security rules deployed
  - Step 2: Task list view (confirmed active, composite index resolved)
  - Step 3: Calendar view with department filter and detail panel
  - Step 4: Gantt view with department color coding, today marker, click-to-detail
  - Step 5: View switcher with persisted preference on user document
  - Step 6: Template creation and use-template flow with anchor date and live due date preview
  - Step 7: In-app notification banner (overdue, due-soon, handoff-ready)
  - Step 8a: Task creation form with visibleToAll toggle
- Post-timeline cleanup pass (sidebar renamed to Places People!, stale files deleted)
- Firebase project misconfiguration fixed (.firebaserc now points to open-the-house not show-prep-app)
- Composite index resolved (tasks collection, orgId ascending, dueDate ascending)
- People Coordination module complete (Steps 1 through 9, July 14): person type configuration, roster view, manual record creation, CSV bulk import, person profile with internal tags, assignments panel, hour tracking, self-signup flow with token generation and public signup page. personType Firestore rule updated to allow unauthenticated get for the public signup form while keeping list restricted to staff.
- Add a Place silent fail fixed (July 14): Places and productions Firestore rules added, including a collectionGroup rule for the productions query.
- AuthRouter updated (July 14) to correctly route all seven canonical role values to their views — secondaryAdmin, departmentHead, orgCollaborator, venueManager, productionCollaborator, and person were previously all falling through to "Account not configured."

**Deferred:**
- Planning Timeline Step 8 Part B (access request and admin approval flow, aka Step 8b) deferred until Department Head role users exist in org for testing

**In progress:**
- Nothing currently active

**Post-timeline cleanup completed:**
- Sidebar header renamed from "Open the House" to "Places People!" in both desktop and mobile headers
- Sidebar stripped to built modules only: Home, Timeline, Departments, Places, Productions, Collaborators, People, Settings
- Old src/components/departments/DepartmentsView.jsx deleted
- TimelineView loadDepartments updated to respect departmentsEnabled toggle on org document

**Known open bugs:**
- Email invite generation fail

**Firebase:**
- Project: open-the-house (not show-prep-app)
- Composite index confirmed resolved: tasks collection, orgId ascending, dueDate ascending

**Next build priority:**
- PlacesView (nav item currently routes to a placeholder, view not yet built).
- Email invite generation bug fix.
- People module cleanup: unused onNavigate prop in PeopleView. Department assignment and staff toggle for the People module sent to Feature Roadmap for spec.
- Check-in feature: the only People Coordination piece not yet specced or built. Needs a Feature Roadmap spec session before Code Interpreter builds it.
- Beta Phase 0 setup for Tempest can now begin — People Coordination module confirmed functional as of July 14.

---

## SECTION 3: DATA ARCHITECTURE

**Hierarchy (locked):**
Organization → Department (optional) → Venue → Production

**Department:** Optional tier. Activated by larger orgs (fringe festivals, multi-department organizations). Invisible to smaller orgs. Can be activated later without a rebuild.

**Venue:** Real container, not a tag. People can be assigned to a production, a venue, or both.

**Role types:**
- Admin (org-wide, title configurable)
- Secondary Admin
- Department Head
- Org Collaborator (oversight, board/executive level)
- Venue Manager (optional, site-specific)
- Production Collaborator (scoped to one production)
- Person (configurable label: volunteer, artist, staff, technician, etc.)

RESOLVED July 12 in App Architecture session: these seven are the confirmed canonical role values (admin, secondaryAdmin, departmentHead, orgCollaborator, venueManager, productionCollaborator, person). Provisional Admin is not an eighth role — it is a state flag (`provisionalAdmin: boolean`, `accountState: provisional | confirmed`) on the user document, cleared once ownership is confirmed or the signup user's real role is set.

**People coordination module:**
Three-layer intake schema. Universal fields always present. Toggleable common fields admin turns on or off. Admin-defined custom fields. Supported types: text, date, select, multiselect, checkbox groups, file upload.

**Planning Timeline architecture (spec locked):**
- View switcher: three views (timeline, calendar, list), org default plus per-person override
- Recurring timelines: template-based using offsetDays from anchor date
- Task visibility: visibleToAll boolean
- Cross-department access requests: restricted to Department Heads only
- Org Collaborators: view-only with clarification flag capability
- Notifications (Phase 1): in-app plus email, three triggers (overdue, due-soon, handoff-ready)
- Production-timeline relationship: Scenario C, built in two stages

**Nav structure (locked):**
Home, Productions, Departments, Volunteers, Lobby, Bar Program, Inventory and Ordering (submenu: Beverages, Concessions and Snacks, Merch), Promo, Collaborators (submenu: Collaborator List, Invite Collaborator), Settings

---

## SECTION 4: VALIDATION STATUS

**Phase 1 status:** Complete
**Calls completed:** 4
**Strong Yes signals:** 4
**Scope confirmed:** Broader live event operations (not FOH-specific)

**Confirmed contacts:**
- Tempestt H — Orlando Fringe (Strong Yes, broader event ops scope)
- Melissa F — Orlando Fringe (Strong Yes, broader event ops scope)
- Sarah Catherine B — Theatre Winter Haven (Strong Yes, offered full season beta, first organic pricing signal)
- Danielle — Central Florida Vocal Arts, production manager (Strong Yes, broader event ops scope)

**Key language bank additions from Danielle:**
- "A system that houses all the information and gives a timeline and checklist of items that should be done"
- "I don't even know that I know all the things I do, because I just do them" — trainability framing, platform as handoff system

**Pending contacts:**
- Amber — Orlando Fringe volunteer coordinator (Facebook outreach sent, no response. Further outreach on hold until Sean has a direct conversation with her.)
- Dan Chesnik — Theatre Winter Haven producing director (validation call pending)
- Jen T — call was scheduled for late May, follow-up status unknown as of July 12

**Phase 2:** App-forward outreach. Not yet started. Pending demo-ready build. Open decision as of July 12: whether to continue Phase 1 validation outreach (Dan Chesnik, Jen T) or begin Phase 2 infrastructure planning now that the 4 of 4 Strong Yes threshold is met.

**Beta targets:**
- Orlando Fringe — Tempest (artist management, Winter Minifest) is primary target as of July 12. Amber (volunteer coordination) is a secondary consideration pending direct outreach.
- Theatre Winter Haven (Sarah Catherine) — second org

**Beta success threshold (Tempest, primary target as of July 12):**
- Minimum: logs in and adds 5+ artists without texting Sean for help
- Meaningful: enters full artist roster and names something missing
- Strong signal: invites a team member without being asked

**Beta framework (locked July 12):** Phase 0 pre-login setup — Sean configures org, venues, person-type fields, and example records before Tempest ever logs in, so she sees her festival, not a blank system. First beta task scoped to artist roster entry only. Feedback collection is conversational, two questions only (what felt easy, what felt missing or wrong), no survey or form. Invite framing is peer-to-peer, asking her to find what is wrong rather than adopt a tool.

---

## SECTION 5: BRAND STATUS

**Name:** Places People!
**Tagline:** There's more to the show than just the stage.
**Brand hold:** LIFTED. Scope confirmed. Branding can proceed.

**Visual identity direction:** LOCKED as Direction 4 (Stage Call), July 12.
- Direction 4 (Stage Call, chosen): Canvas-generated brush script wordmark, Places in white over People in electric blue, bristle texture with blue shadow offset. Exclamation point is a real PAR/Fresnel fixture photo, presented as a diagonal fixture with a second grounded fixture below. Tagline typeface is serif (Playfair Display territory, exact font pending confirmation). Deep blue atmosphere with theatrical haze, dual fixture photographic composition, dark by design. Isolated P brushstroke confirmed as standalone icon asset for favicon and app icon.
- Direction 1 (Opera Aesthetic, not chosen): Playfair Display + DM Sans, crimson italic exclamation point, deep near-black with atmospheric crimson gradient. Full rebuild deferred now that Direction 4 is locked. Brand board retained at pp-brand-boards.html for reference.

**Final direction:** LOCKED as Direction 4 (Stage Call). Remaining open question: is the Direction 4 Canvas brush script a licensable font or fully image-generated lettering with no underlying font file. Production implications pending. Direction 4 brand board rebuild needed to reflect the fully locked system. Favicon and app icon small-scale test for the isolated P mark not yet done.

**Hard brand rules:**
- No dashes ever anywhere in copy
- No exclamation points on feature descriptions
- No generic SaaS language
- Never use the word users
- Tone is confident, peer to peer, built from the inside
- The lobby is always a production element

---

## SECTION 6: ACTIVE HOLDS

**Direction 4 font/licensing question:** On hold pending confirmation of whether the Canvas brush script is a licensable font or image-generated lettering with no underlying font file. Sean makes the final call. Direction 4 brand board rebuild and favicon/app icon small-scale test also pending on this.

**Phase 2 outreach:** On hold pending demo-ready build. Update July 14: app is now functionally demo-ready for Productions, Departments, Timeline, and People Coordination — Sean to confirm whether this satisfies the hold condition.

**Landing page:** Copy drafted July 12 in Brand Voice and Messaging chat (hero, subhero, problem statement, six feature modules, who it's for, origin story, CTA placeholder, footer). Visual/design implementation on hold pending Direction 4 brand board rebuild. CTA mechanics on hold pending access flow build. Page format (long-form vs. tight single-page) not yet decided.

**People Coordination module build:** RESOLVED July 14. Build complete (Steps 1 through 9) — person type configuration, roster view, manual record creation, CSV bulk import, person profile with internal tags, assignments panel, hour tracking, and self-signup flow with token generation and public signup page, all functional. Firestore rules deployed. Remaining open: check-in feature not yet specced or built; department assignment and staff toggle for the module sent to Feature Roadmap for spec; minor cleanup (unused onNavigate prop in PeopleView). Beta Phase 0 setup for Tempest can now begin.

---

## SECTION 7: OPEN DECISIONS

- RESOLVED July 12: Visual identity direction locked as Direction 4 (Stage Call).
- Is the Direction 4 Canvas brush script a real licensable font or image-generated lettering?
- RESOLVED July 12: Feature Roadmap planning session held (Production tier, role inference, Provisional Admin, hybrid onboarding locked). RESOLVED July 14: assignments, self-signup, and hour tracking are now fully specced and built as part of the completed People Coordination module. Check-in remains unspecced and unbuilt — the only piece not yet scheduled.
- RESOLVED July 12 (partial): App Architecture chat addressed Provisional Admin and ownership invite flow in full. Still open: whether Department as optional tier, Venue as real container, and Production as optional tier below Venue need re-confirmation in App Architecture chat.
- RESOLVED July 12: Current State document and other legacy project docs confirmed retired by Sean. PROJECT_STATE.md is the sole source of truth; no further sync needed against Current State.
- Approval flow data architecture decision needed before build: item level, phase level, or production level structure must be locked before Code Interpreter builds the in-platform approval flow.
- Opening night readiness view formal spec needed before build.
- Decision needed on whether to continue Phase 1 validation outreach (Dan Chesnik, Jen T) or begin Phase 2 infrastructure planning, now that the 4 of 4 Strong Yes threshold is met.
- RESOLVED July 12: Role types list in Section 3 confirmed in App Architecture session as seven canonical values, with Provisional Admin clarified as a state flag rather than a role.
- App Architecture chat may need a follow-on session to confirm Provisional Admin and ownership invite flow with the UX chat before Code Interpreter builds the signup and handoff screens.

---

## SECTION 8: RECENT CHANGES

> Most recent first. Last 5 significant changes.

- 2026-07-14: Code Interpreter and App Build session — People Coordination Steps 1 through 9 all complete: person type configuration, roster view, manual record creation, CSV bulk import, person profile with internal tags, assignments panel, hour tracking, and self-signup flow with token generation and public signup page. Places and productions Firestore rules added, resolving the known Add a Place silent fail bug, including a collectionGroup rule for the productions query. AuthRouter updated to route all seven canonical role values to correct views (secondaryAdmin, departmentHead, orgCollaborator, venueManager, productionCollaborator, and person were all previously falling through to "Account not configured"). personType Firestore rule updated to allow unauthenticated get for the public signup form while keeping list restricted to staff. Firestore rules deployed throughout the session to the open-the-house project. Open: email invite generation bug still unresolved, PlacesView not yet built (nav item routes to a placeholder), People module cleanup (unused onNavigate prop in PeopleView; department assignment and staff toggle sent to Feature Roadmap for spec). Beta Phase 0 setup can now begin — People Coordination is functional enough for pre-beta org configuration. On hold: Timeline Step 8 Part B still deferred until Department Head users exist for testing; Phase 2 outreach on hold pending demo-ready confirmation — app is now functionally demo-ready for Productions, Departments, Timeline, and People Coordination.
- 2026-07-12: App Architecture and Technical Decisions session — Provisional Admin confirmed as state flag (provisionalAdmin boolean, accountState enum) on the user document, not a role value. Seven canonical role values locked: admin, secondaryAdmin, departmentHead, orgCollaborator, venueManager, productionCollaborator, person. Provisional Admin has full onboarding access from signup with no gates. Ownership transfer available any time from Settings. Incoming Admin sees read-only config summary screen before accepting ownership, with option to flag for adjustment. Ownership invite document needs four new fields: originalUserSelectedRole, configSummaryAcknowledged, configFlagged, flagNote. People Coordination module fully specced: person types at orgs/{orgId}/personTypes/{typeId} with departmentHeadId and departmentId fields, person records at orgs/{orgId}/people/{personId} with typeId, typeLabel, status, assignments array, totalHours, fieldValues map, internal tags in separate subcollection at internalData/notes (Person class excluded by rules), self-signup tokens at orgs/{orgId}/signupTokens/{tokenId}, hours subcollection at orgs/{orgId}/people/{personId}/hours/{entryId}. Full security rules spec produced. Flag for Code Interpreter: departmentHeadId and departmentId must be written to personType document when DH is assigned in Settings. Build order confirmed: Steps 1 through 5 first (type config, roster, manual creation, CSV import, profile view with internal tags), Steps 6 through 8 after those are stable.
- 2026-07-12: People Coordination module fully specced in Feature Roadmap chat. Eight build steps locked. Key decisions: multi-type at launch, approval-gated self-signup with admin or Department Head approval authority, Department Head as primary record creation owner, emergency contact elevated to always-on, CSV bulk import added as Step 3b with column mapping UI, internal tags confirmed as admin and Department Head-only with an Internal label in the UI, beta framework unchanged with Sean as admin and Tempest as Department Head, check-in deferred to a separate spec session. App Architecture briefing written and ready to paste. Next step is an App Architecture session to design the Firestore data model and security rules before Code Interpreter builds anything.
- 2026-07-12: Full sync pass — Drive and repo copies of PROJECT_STATE.md had drifted independently in both directions (repo held extra Section 2 build detail, a Firebase note, and older Section 8 history from May–June that Drive lacked; Drive held newer Section 8 entries and extra Section 9 file IDs that repo lacked). Merged into one authoritative version written identically to both files, per Sean's request that the two match exactly. No content deleted: all unique history entries from both copies preserved and reordered chronologically. Section 3 role types reconciled as a union (was two different 5/6-role lists) and flagged in Section 7 for confirmation in an App Architecture session. Section 10 merged to include the repo copy's "never delete content" instruction, which Drive was missing.
- 2026-07-12: Competitive Landscape session — competitive map confirmed: real competition is Google Sheets, Docs, and group texts, not software, and Places People! has no competitor in the high theater specificity / high operational depth quadrant. Operational depth axis defined as moving from "holds information" to "drives decisions and actions," with opening night readiness view, volunteer gap detection, phase completion gates, and collaborator-configured updates named as the features that make that move. Opening night readiness view confirmed as the single highest-value pre-launch feature, demonstrable in the Loom demo. Collaborator-configured update preferences spec'd: collaborators set their own notification preferences at the point of joining a production, phase completions and key milestones only, not task-level noise. In-platform approval flows spec'd: purchase links, budget line items, and uploaded files submitted for approval with Pending, Approved, and Flagged for Discussion states, timestamped, attached to the production, serving as a governance record for board members and executive directors — confirmed as top of the Phase 2 build list. Open: approval flow data architecture decision needed before build (item level vs. phase level vs. production level), opening night readiness view formal spec needed before build. Current State document conflict flagged: its Section 4 lists Productions spec as the active blocker, but the actual active blocker is the Timeline spec in the Feature Roadmap chat.
- 2026-07-12: Backfilled Section 3 with Planning Timeline architecture details from an earlier spec session that had never been recorded there, surfaced during today's full-project update pass. Most of that update's content — Planning Timeline built through Step 8a, Productions and Departments complete, Firestore data model deployed — was already completed and recorded in Section 8 as of June 2026, so it was not re-logged. New to the record: production-timeline relationship confirmed as Scenario C built in two stages, cross-department access requests restricted to Department Heads only, Org Collaborators confirmed view-only with clarification flag capability, Phase 1 notification spec confirmed as in-app plus email with three triggers (overdue, due-soon, handoff-ready), view switcher spec (three views — timeline, calendar, list — with org default plus per-person override), and recurring timeline templates using offsetDays from anchor date.
- 2026-07-12: Reconciliation pass across today's session updates. Two conflicts checked with Sean and resolved: (1) Visual identity direction locked as Direction 4 (Stage Call) — Section 5/6/7 updated accordingly, Direction 1 marked as not chosen. (2) Feature Roadmap planning session for People Coordination marked as held July 12 (Production tier, role inference, Provisional Admin, hybrid onboarding locked) — remaining open item narrowed to the dedicated module spec session for assignments, self-signup, hour tracking, and check-in. Also updated without conflict: beta target recentered to Tempest (Amber demoted to secondary, pending direct outreach) across Section 4; Jen T status downgraded from "scheduled" to "follow-up status unknown"; Landing page hold updated to reflect copy drafted while visual implementation remains on hold; People Coordination build hold updated to include unconfirmed build state as a blocker; new open items added to Section 7 for the stale Current State document and the Phase 1 vs Phase 2 outreach decision. Section 4 in the repo copy was also brought up to parity with Drive (call count, Danielle, language bank) since it had drifted out of sync with the repo's own Section 8 history.
- 2026-07-12: Command Center session close — PROJECT_STATE.md workflow confirmed working via Google Drive for Desktop sync. Command Center system prompt identified as needing update to reflect current state. People Coordination module confirmed as next build priority pending Feature Roadmap session. Four validation calls confirmed complete in Project State (Tempestt, Melissa, Sarah Catherine, Danielle). Visual identity confirmed as Direction 4 with font question still open. Open: Command Center system prompt update needed, People Coordination module Feature Roadmap planning session not yet scheduled, visual identity final direction call pending font question resolution, two known bugs open (Add a Place silent fail, email invite generation fail).
- 2026-07-12: Feature Roadmap session — Production confirmed as internal name for optional configurable container below Venue, display label configurable per org, some orgs never use this tier. Production tier is optional: festival orgs create one or two Productions per year at event level, artist shows are Person records assigned to venues, not Productions. Role inference logic defined for people intake: three sequential questions infer role from plain language, Admin versus Secondary Admin defaults to Admin. Provisional Admin established as default state for first signup, with two paths: confirm as Admin, or select real role and send platform ownership invite to intended Admin, full access throughout. New invite type needed alongside standard collaborator invite. Hybrid onboarding confirmed: self-serve templates plus premium white glove add-on, AI-assisted onboarding is Phase 3. First-run experience spec v2 confirmed as UX build target. Open: People coordination module spec session needed (assignments, self-signup, hour tracking, check-in), Provisional Admin and ownership invite need App Architecture and UX briefings, Current State document is stale and needs updating to reflect Productions, Departments, and Timeline Steps 1 through 8a all complete.
- 2026-07-12: Beta and Onboarding Management session — beta target recentered from Amber (volunteer coordination) to Tempest (artist management, Orlando Fringe Winter Minifest). Amber deferred as secondary consideration pending direct outreach. Beta framework designed and locked: Phase 0 pre-login setup principle (Sean configures org, venues, person-type fields, and example records before Tempest ever logs in, so she sees her festival, not a blank system). First beta task scoped to artist roster entry only, no other features in session one. Feedback collection locked as conversational two-question format (what felt easy, what felt missing or wrong), no survey or form. Three-tier success definition locked: minimum is logs in and adds five or more artists without help, meaningful is full roster entry plus names something missing, strong signal is invites a team member without being asked. Invite framing locked as peer-to-peer, asking her to find what is wrong rather than adopt a tool. Core adoption insight carried in from validation calls: the risk is not technical failure, it is that the tab closes and never reopens. Active blocker: people coordination module build state unconfirmed — whether person-types, custom field configuration, and record creation are functional determines whether Phase 0 setup can begin now or Code Interpreter must move first. Amber outreach on hold until Sean has a direct conversation with her.
- 2026-07-12: Brand Voice and Messaging chat reopened as a fresh session following retirement of the previous chat. Prompt 3 run successfully. Brand Voice Guide v2 and Current State both confirmed readable from Drive, no conflicts found. First draft and revised landing page copy produced covering hero, subhero, problem statement, six feature module descriptions, who it is for, origin story, CTA placeholder, and footer. Feature headers rewritten from nav-label style to value-forward copy. "Who It Is For" restructured to lead with the person. Open: CTA mechanics (pending access flow build), page format not yet decided (long-form vs. tight single-page). Prompt 6 Outside Eyes review not yet run.
- 2026-07-12: Brand and Visual Identity session — Direction 4 wordmark typeface changed from Caveat to Canvas-generated brush script (white Places over blue People, bristle texture, blue shadow offset). Direction 4 logotype color split locked: Places in white, People in electric blue. Direction 4 tagline typeface updated to serif (Playfair Display territory, exact font pending confirmation). Exclamation point locked as real PAR/Fresnel fixture photo, presented as diagonal fixture with second grounded fixture below. Direction 4 atmosphere confirmed: deep blue with theatrical haze, dual fixture composition, dark by design. Isolated P brushstroke confirmed as standalone icon asset for favicon and app icon use. Typo flagged in Canvas output: fromplanning missing a space. Tagline confirmed locked: There's more to the show than just the stage. Both brand boards (Direction 4 Stage Call and Direction 1 Opera Aesthetic) delivered as pp-brand-boards.html. Open: font identification for Direction 4 brush script (licensed font vs image-generated lettering), Direction 4 brand board rebuild needed to reflect locked system, decision needed on whether Direction 1 is still live in parallel or Direction 4 has been chosen, favicon and app icon small-scale test for isolated P mark not yet done. Direction 1 full rebuild deferred pending parallel vs. chosen decision.
- 2026-07-12: Validation call 4 completed with Danielle, production manager at Central Florida Vocal Arts — Strong Yes, broader event ops scope. Full debrief completed (Q1 through Q3 in her exact words). Three new Language Bank entries added, including trainability named as a new signal angle ("I don't even know that I know all the things I do, because I just do them"). Validation Tracker rebuilt as new xlsx with three tabs: Phase 1 Contacts (all four calls logged), Language Bank (all quotes), Phase 2 App Demos (placeholder, on hold). Phase 1 threshold status: 4 of 4 Strong Yes signals across four different org types. Open: Jen T follow-up status unknown (call was scheduled late May), Amber Facebook outreach no response, decision needed on continuing Phase 1 vs beginning Phase 2 infrastructure planning. Phase 2 app-forward outreach remains on hold pending demo-ready build.
- 2026-07-12: UX session — first-run experience fully mapped in PP_FirstRun_Experience.md v2. Logo animation into timeline header locked. Founding philosophy confirmed as onboarding frame. Conversational intake sequence confirmed. Visual org chart with animated access tiles confirmed. Four onboarding tasks locked. Scope question and open/close dates added to first production creation. Four dashboard states named (Planning, Final Countdown, Live, Postmortem) with content hierarchy mapped for each. Invite review screen with editable email template locked. Inline role assignment with plain language chips and animated access tiles locked. Stage light timeline visual tentative, routed to Brand and Visual Identity. Personality quiz for non-admin onboarding flagged for Feature Roadmap. Minimum proof-of-concept moment confirmed: create production, two dates, timeline generates, assign task, notify person. Live dashboard deep dive and non-admin first experience remain open for next session.
- 2026-07-12: Prompt Library updated to v8. Living Record chat retired. Sync system simplified: all chats read PROJECT_STATE.md from Drive via fileId 1GpItz6boWZFTyjVZoZN4h7FRJFsTuDHp. Claude Code writes via local file path. Weekly Master Log scheduler added as automated Claude Code workflow. Prompts 9 and 13 merged into single session-close prompt. Google Doc version of PROJECT_STATE.md deleted. MD file is now canonical.
- 2026-07-12: New machine setup complete. Repo cloned, dependencies installed, app running at localhost:5173. Claude Code installed and authenticated. Google Drive for Desktop configured at G:\My Drive.
- 2026-06-23: Phase 1 validation confirmed complete with four Strong Yes signals. Danielle at CFVA added as fourth contact. Trainability framing added to language bank.
- 2026-06-08: Planning Timeline Steps 1–8a complete and committed. Post-timeline cleanup complete. Sidebar renamed, old departments file deleted, department dropdown respects departmentsEnabled toggle.
- 2026-06-08: Firestore composite index (tasks: orgId ascending, dueDate ascending) confirmed active. Timeline Step 2 confirmed complete.
- 2026-06-08: Firebase project misconfiguration resolved. .firebaserc was pointing to show-prep-app instead of open-the-house. Firebase CLI re-authenticated. Rules now deploy to correct project.
- 2026-06-08: Recurring timezone bug fixed across multiple components. Date input strings were parsing as UTC midnight causing day-offset errors. Fix: local date construction using new Date(year, month - 1, day) throughout.
- 2026-06-07: Planning Timeline Step 8 Part A committed — task creation form with visibleToAll toggle, CalendarGrid day offset bug fixed.
- 2026-06-07: PROJECT_STATE.md and PROMPT_LIBRARY.md added to docs folder in repo.
- 2026-06-03: Living Record chat established and initialized.
- 2026-05-27: Phase 1 validation confirmed complete. Three Strong Yes signals. Scope locked as broader live event operations.
- 2026-05-26: Places People! name and tagline locked. Brand hold lifted.
- 2026-05-20: Department confirmed as optional fourth tier. Communication layer designed in two phases.

---

## SECTION 9: KEY FILE IDS

| Document | fileId |
|---|---|
| PP Project State (Google Drive MD file) | 1GpItz6boWZFTyjVZoZN4h7FRJFsTuDHp |
| PP Prompt Library | 1MwVx3OtbVDSV2eiPoDY-nSqqG3ifHNcN |
| PP Master Log | 1nMIRAXX-usCkUam-LsKK_9qu4WNYnMNlkgZ3iMSy6vc |
| Validation Tracker | 1pVnHj_bqpc3tJn-DbajNt8mR0ce4yR2mXuvGT-dlub0 |
| Brand Voice Guide v2 | 1p6sCqfFge6GqEDvuKwWl_HnkiESH6XPYemUGSas7i6k |
| Call Guide v2 | 1CaCu_iUHMvyn6uRw8PBfwMLYXlnadjmtirDiVz5ao6E |

---

## SECTION 10: HOW CLAUDE CODE UPDATES THIS FILE

When a build session produces a meaningful change, Claude Code should:

1. Edit this file under the relevant section
2. Update Section 8 (Recent Changes) with a one-line dated entry at the top
3. Update the Last Updated date at the top of the file
4. Write the updated file to `G:\My Drive\Places People\PROJECT_STATE.md`
5. Also write to repo at `C:\Users\seanp\open-the-house\docs\PROJECT_STATE.md`
6. Stage, commit, and push with a descriptive commit message formatted as:
   `state: [what changed in one short phrase]`

**What counts as a meaningful change worth committing:**
- A build step is completed and tested
- A decision is made that affects architecture or data model
- A known cleanup item is resolved
- A new blocker is identified
- A section of the nav or data model changes

**What does not need a state commit:**
- Debugging sessions that end without a resolution
- Exploratory conversations that do not produce a decision
- Minor wording changes in copy

**Never delete content from this file.** Only update what changed and add to Section 8; when an open item is resolved, mark it RESOLVED with a date rather than removing it. The Drive copy and repo copy must always match exactly — if they drift, reconcile by merging (never by picking one and discarding the other's unique content) and record the reconciliation in Section 8.

---

*Places People! | PROJECT_STATE.md | Sean Philbin | Orlando, FL | 2026*
*Primary read path: Google Drive fileId 1GpItz6boWZFTyjVZoZN4h7FRJFsTuDHp*
*Repo copy: https://github.com/seanpatrick-glitch/open-the-house/blob/main/docs/PROJECT_STATE.md*
*Local path: G:\My Drive\Places People\PROJECT_STATE.md*
*Read live at: https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md*
