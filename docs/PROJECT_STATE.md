# Places People! — Project State
> Single source of truth for all Claude sessions. Read this first on every sync.
> Last updated: 2026-06-07
> Updated by: Claude Code

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

**Overall:** Four foundational steps complete. App live at open-the-house.web.app.

**Complete:**
- Organization creation flow
- Role-based auth router
- Invite flow
- Dashboard shell
- Departments module (Steps 1 through 5 complete including Settings toggle, list view, inline creation form, department head assignment)
- Planning Timeline Steps 1 through 7 committed
- Planning Timeline Step 8 Part A committed (task creation form with visibleToAll toggle, CalendarGrid day offset bug fix)

**In progress:**
- Planning Timeline Step 8 Part B (next step TBD)

**Blocked:**
- Productions build cannot proceed until Feature Roadmap planning session completes the Productions spec

**Next build step:**
- Complete and commit Planning Timeline Step 8, then post-timeline cleanup items

**Known cleanup items:**
- Rename sidebar header from Open the House to Places People!
- Fix department dropdowns to respect the departmentsEnabled toggle on the org document

**Firebase:**
- Project: open-the-house (not show-prep-app)
- Composite index confirmed resolved: tasks collection, orgId ascending, dueDate ascending

---

## SECTION 3: DATA ARCHITECTURE

**Hierarchy (locked):**
Organization → Department (optional) → Venue → Production

**Department:** Optional tier. Activated by larger orgs. Invisible to smaller orgs. Can be activated later without a rebuild.

**Venue:** Real container, not a tag. People can be assigned to a production, a venue, or both.

**Role types (6):**
- Admin (org-wide, title configurable)
- Secondary Admin
- Department Head
- Org Collaborator (oversight, board/executive level)
- Production Collaborator (scoped to one production)
- Person (configurable label: volunteer, artist, staff, technician, etc.)

**People coordination module:**
Three-layer intake schema. Universal fields always present. Toggleable common fields admin turns on or off. Admin-defined custom fields. Supported types: text, date, select, multiselect, checkbox groups, file upload.

**Nav structure (locked):**
Home, Productions, Departments, Volunteers, Lobby, Bar Program, Inventory and Ordering (submenu: Beverages, Concessions and Snacks, Merch), Promo, Collaborators (submenu: Collaborator List, Invite Collaborator), Settings

---

## SECTION 4: VALIDATION STATUS

**Phase 1 status:** Complete
**Calls completed:** 3
**Strong Yes signals:** 3
**Scope confirmed:** Broader live event operations (not FOH-specific)

**Confirmed contacts:**
- Tempestt H — Orlando Fringe (Strong Yes, broader event ops scope)
- Melissa F — Orlando Fringe (Strong Yes, broader event ops scope)
- Sarah Catherine B — Theatre Winter Haven (Strong Yes, offered full season beta, first organic pricing signal)

**Pending contacts:**
- Amber — Orlando Fringe volunteer coordinator (potential beta user, not confirmed)
- Dan — Theatre Winter Haven producing director (validation call pending)
- Jen T — validation call scheduled

**Phase 2:** App-forward outreach. Not yet started. Pending demo-ready build.

**Beta targets:**
- Orlando Fringe (Tempestt, Amber) — first org
- Theatre Winter Haven (Sarah Catherine) — second org

**Beta success threshold (Amber):**
- Minimum: logs in and adds 5 or more records without texting Sean for help
- Meaningful: enters full roster without a walkthrough
- Strong signal: invites a team member without being asked

---

## SECTION 5: BRAND STATUS

**Name:** Places People!
**Tagline:** There's more to the show than just the stage.
**Brand hold:** LIFTED. Scope confirmed. Branding can proceed.

**Visual identity direction:** Two finalists pending final selection.
- Direction 1 (Opera Aesthetic): Playfair Display and DM Sans, crimson italic exclamation point, deep near-black with atmospheric crimson gradient
- Direction 4 (Stage Call): Caveat wordmark, custom stage light SVG exclamation mark, electric blue action color, amber exclamation mark

**Final direction:** Not yet locked. Pending fixture legibility confirmation at small lockup sizes.

**Hard brand rules:**
- No dashes ever anywhere in copy
- No exclamation points on feature descriptions
- No generic SaaS language
- Never use the word users
- Tone is confident, peer to peer, built from the inside
- The lobby is always a production element

---

## SECTION 6: ACTIVE HOLDS

**Visual identity final direction:** On hold pending fixture legibility confirmation at small sizes.

**Phase 2 outreach:** On hold pending demo-ready build.

**Landing page:** On hold pending visual identity lock.

---

## SECTION 7: OPEN DECISIONS

- Which visual identity direction: Direction 1 Opera Aesthetic or Direction 4 Stage Call?
- Feature Roadmap planning session for Productions section not yet scheduled.
- App Architecture chat needs updating to reflect Department as optional tier and Venue as real container.

---

## SECTION 8: RECENT CHANGES

- 2026-06-07: Planning Timeline Step 8 Part A committed — task creation form with visibleToAll toggle, CalendarGrid day offset bug fixed
- 2026-06-07: PROJECT_STATE.md and PROMPT_LIBRARY.md added to docs folder in repo
- 2026-06-03: Living Record chat established and initialized
- 2026-05-27: Phase 1 validation confirmed complete. Three Strong Yes signals. Scope locked as broader live event operations.
- 2026-05-26: Places People! name and tagline locked. Brand hold lifted.
- 2026-05-20: Department confirmed as optional fourth tier. Communication layer designed in two phases.

---

## SECTION 9: KEY FILE IDS

| Document | fileId |
|---|---|
| Validation Tracker | 1pVnHj_bqpc3tJn-DbajNt8mR0ce4yR2mXuvGT-dlub0 |
| Master Log | 1nMIRAXX-usCkUam-LsKK_9qu4WNYnMNlkgZ3iMSy6vc |
| Brand Voice Guide v2 | 1p6sCqfFge6GqEDvuKwWl_HnkiESH6XPYemUGSas7i6k |
| Call Guide v2 | 1CaCu_iUHMvyn6uRw8PBfwMLYXlnadjmtirDiVz5ao6E |

---

## SECTION 10: HOW CLAUDE CODE UPDATES THIS FILE

At the end of any build session where something meaningful changed:

1. Edit the relevant section directly
2. Add a one-line dated entry at the top of Section 8
3. Update the Last updated date at the top of the file
4. Commit and push with message format: state: [what changed in one short phrase]

What counts as worth committing: a build step completed and tested, a decision that affects architecture, a blocker identified or resolved, a cleanup item completed.

What does not need a commit: debugging that did not resolve, exploration without a decision, minor wording changes.

Never delete content from this file. Only update what changed and add to Section 8.

---

*Places People! | PROJECT_STATE.md | Sean Philbin | Orlando, FL | 2026*
*Read live at: https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md*
