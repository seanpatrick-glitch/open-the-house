# Data Model Audit: Projects, Productions, Places, People, Events (2026-09-26)
> Date: 2026-09-26
> Status: Audit only. No code or schema was changed.
> Prompted by: Sean's "Architectural End State: Data Model Constraints" prompt, which asked for a search of the codebase for anything that conflicts with the target data model. Written as a chat reply to Sean, so it speaks to "you" and "your doc".
> Code references (file:line) are as of commit 2ac9a7a. Line numbers drift as files change. The docs/PROJECT_STATE.md line numbers in section 8 below changed in the same commit that added this file.
> Decided after this audit, on 2026-09-26, and recorded in PROJECT_STATE.md Sections 3 and 7, which win wherever they differ from this doc: roles are cut to three stored values, admin, departmentHead and base (shown as "Member"). Project types are production, festival, season and series; series replaces singleEvent, so question 2 in section 9 no longer applies. Events keep one type and one name, and an Event's productionId may be null (question 3). The Volunteers module becomes the Shifts module, which will break during the Places migration and be rebuilt after it (part of question 7). A festival holds each show as its own Production (question 8). The docs-only commit suggested at the end of this audit is the commit that added this file.

---

Confirmed. In one line: a typed **Project** container holds a fixed-shape **Production** record. That record points to org-level **Places** and **People** by ID. **Group** (who someone is) and **Role** (what they can do) are separate fields. **Events**, **Deadlines** and **Tasks** are three separate types.

Nothing was changed or committed. This is a code-only audit: this container has no Firebase credentials, so I couldn't read your live Firestore data (it's test data due to be wiped anyway).

Labels used below: **Structural** means the data shape or storage paths must change. **Label** means on-screen text only. **Missing** means it doesn't exist yet.

## Bottom line (biggest first)
1. **Productions are stored inside a Place.** The path is `organizations/{orgId}/places/{placeId}/productions/{id}`. So a production can't have zero or two Places, and moving it to another Place means creating a new record. That's the reverse of your "point to Places by ID" model. Changing it touches 12 app files plus the database rules, indexes and one server function.
2. **Season and Festival are a field on a Production** (`scope`), not containers. No Project concept exists anywhere.
3. **Roles are 9 stored values, not 3.** Your doc says `admin | departmentHead | member` "remain", but that isn't the current state. The 9 values map to 3 access levels named `admin | departmentHead | base`. The invite dropdowns still offer "Org Collaborator", "Production Collaborator" and "Venue Manager".
4. **One combined Roster, no Team/Cast split, no roles.** A person's production assignment is saved on their own record, with no role like director or actor.
5. **Deadline doesn't exist.** "Script due" ends up as either an unassigned Task or an Event with no time.

## 1. Project container
| Finding | Type | Where |
|---|---|---|
| No Project concept in code, rules or indexes | Missing | — |
| A required `scope` field on the Production: single / season / festival. Values also differ from yours (`single` vs `singleEvent`, no `production`) | Structural | `src/models/productions.js:3`, `src/components/productions/CreateProductionForm.jsx:45` |
| Onboarding text: "Your first production, season, or festival." | Label | `src/components/onboarding/steps/ProductionStep.jsx:60` |
| Display label hint: "e.g. Show, Event, Festival" | Label | `src/components/productions/CreateProductionForm.jsx:150` |
| The org record already has an unused `type: 'theater'` field | Naming risk | `src/components/auth/SignupStep3.jsx:25` |

The word `'production'` already means three different things in the code: a task phase (`src/models/timeline.js:31`), an event scope (`src/models/events.js:16`) and an assignment type (`src/models/people.js:79`). A Project type of `'production'` would be a fourth. Worth picking distinct names.

## 2. Production record, field by field
| Your spec | Today | Status |
|---|---|---|
| title | called `name` | Rename |
| description | Places reads it (`src/views/PlacesView.jsx:132`), nothing writes it | Missing |
| status | planning / in-progress / open / closed | ✅ |
| firstRehearsal, previewNights | none | Missing |
| openingNight, closingNight | `openDate`/`closeDate`, filled from the same Start/End inputs as `startDate`/`endDate` (`CreateProductionForm.jsx:75-84`) | Conflict, see below |
| phases | none. A different task-level `phase` field exists | Missing + name clash |
| places | one `placeId`, a duplicate `venueId`, stored inside the Place | Structural |
| productionTeam, cast | none | Missing |

- **"All fields may be empty at creation":** today 5 fields are required (name, place, scope, start, end) at `src/components/productions/CreateProductionForm.jsx:41-49`. Onboarding won't continue until a Place exists (`src/components/onboarding/steps/PlacesStep.jsx:19`).
- **Your date range will break the dashboards.** All three dashboards pick their state (Planning, Final Countdown, Live) from the opening date. The same function is copied into `src/views/AdminDashboardView.jsx:17`, `src/views/DHDashboardView.jsx:29` and `src/views/MemberView.jsx:25`. If your range start (first rehearsal) ever feeds that logic, the dashboard will say "Tonight: {show}" on day one of rehearsal. It needs to key off `openingNight`, and should be pulled into one shared function.
- **The Roster is not Team/Cast.** `src/components/productions/ProductionDashboard.jsx:142-160` builds one list and shows each person's type (e.g. "Artist"), not their production role. The assignment has no role field (`src/models/people.js:77-85`). Check-in rosters, the member dashboard's "Confirm your assignments" and "My Schedule", and the `confirmAssignment` server function all read that same list.
- ✅ **No field depends on production type.** `scope` is stored but never used to change the form or record (`src/models/productions.js:39-43`).

## 3. Group field and "volunteer"
The Group field doesn't exist yet. Where it will live is already decided (on the org's People record). The conflicts are in the labels around it:

| Finding | Type | Where |
|---|---|---|
| The "Your People" page lists every login account of any role ("Everyone with access to this organization"). That's a taxonomy name on an access-based list. Already logged in your state doc | Structural | `src/components/invites/CollaboratorRoster.jsx:146-149` |
| The "Company" page lists every People record | Label | `src/views/PeopleView.jsx:94` |
| The internal name for the Your People page is `collaborator-list` | Naming trap | `src/components/layout/DashboardShell.jsx:28` |
| Settings text still mentions a "Collaborator dashboard", which was renamed | Label | `src/views/SettingsView.jsx:481` |

"Volunteer" appears in four forms. None of them is a Group value, since Group doesn't exist yet:

| Form | Where | Recommendation |
|---|---|---|
| Old stored role value | `src/models/roles.js:29`, `functions/roles.js:18`, `firestore.rules:58`, `tests/emulator/role-flows.test.mjs:216-232` | Remove. No invite creates it anymore |
| Unused page label "Volunteer List" | `src/components/layout/DashboardShell.jsx:27` | Remove |
| Example text in form fields | `src/components/people/CreatePersonTypeForm.jsx:185`, `src/components/timeline/CreateTaskForm.jsx:143`, `src/components/timeline/CreateTemplateForm.jsx:113` | Remove |
| The Volunteers shift-scheduling module | `src/models/volunteers.js`, `src/components/productions/ProductionDashboard.jsx:371-374` | Your call (section 9) |

**My pushback:** the shift module is a working feature, not a taxonomy label. Volunteer front-of-house staffing is core for community theater, and Orlando Fringe's volunteer coordinator is on your pending contact list. I'd keep the module and rename it "Shifts" if you want no "volunteer" wording at all.

Your `yourPeople` definition also mentions "department heads", which is a Role. If that wording ends up in on-screen help text, admins will mix up the two fields. I'd say "core operational leads" on its own.

## 4. Role field
| Finding | Type | Where |
|---|---|---|
| 9 stored values mapped to 3 access levels: `admin`, `departmentHead`, `base` | Same idea, different values | `src/models/roles.js:14-30` |
| Invite dropdowns offer 5 or 6 roles and default to `orgCollaborator` | Structural | `src/components/invites/InviteCollaborator.jsx:19-26`, `src/components/onboarding/steps/InvitesStep.jsx:17-23` |
| "Org Collaborator" and "Production Collaborator" put a Group word in an access dropdown, exactly the mix-up you're banning | Label | same files, plus `src/components/invites/CollaboratorRoster.jsx:11-20` |
| "Venue Manager" role. Separately, it sends people to the Admin dashboard, but the rules give it no admin permissions (an existing gap) | Label | same files |
| Invites sent from a People record always grant the role `person`; the admin can't choose. Already logged | Structural | `functions/index.js:360` |
| Rule checks are written against the individual role names | Structural | `firestore.rules:26-70` |

Two wording checks:
- **"Role field on a person record."** Your locked decision from Sep 25 stores Role on the login account (`users/{uid}.organizations[orgId].role`), and only the server can write it. I'm reading "person record" loosely, as "a person's role". If you meant the People record itself, that reverses the locked decision and breaks every permission rule.
- **The name `member`.** The rules' `isMember()` check and the `members` list already mean "anyone in the org, any role". A base role called `member` makes those ambiguous. I'd store `base` and show "Member" on screen.

## 5. Places audit
**What exists:**
- **One collection:** `organizations/{orgId}/places/{placeId}`. Each Place holds only a name, the org ID, and who created it and when (`src/components/productions/CreatePlaceForm.jsx:18-26`).
- **No `venues` or `locations` collections exist** anywhere in code, rules or indexes.
- **Productions are stored inside Places** (`firestore.rules:333-343`), with extra rules and indexes built around that.
- **Place-related fields elsewhere:**
  - Every production has `placeId` plus a duplicate `venueId`.
  - The org's active production is stored as `"{placeId}/{productionId}"` (`src/models/org.js:6-11`).
  - People can be assigned to a place. An old `'venue'` assignment type is still read (`src/components/people/AssignmentsPanel.jsx:100`).
  - Hours logs have a documented `venueId` that nothing ever writes (`src/models/people.js:109`).
  - An Event's location is **free text**, not a link to a Place (`src/models/events.js:40`).
- **Unused:** a productions index on `venueId`. No query uses it.

**Conflicts:**

| Finding | Type | Where |
|---|---|---|
| Productions stored inside a single Place | Structural | file list below |
| Event location is free text | Structural | `src/components/events/CreateEventForm.jsx:272-277` |
| Signup treats the org as a venue: the field is `venueName`, a blank name shows **"Please enter a venue name."**, and the example is "e.g. The Grand Theatre" | Label, plus the "home venue" assumption on the very first screen | `src/components/auth/SignupStep3.jsx:9`, `:17`, `:92` |
| "Venues" in on-screen text (six spots) | Label | `src/views/PlacesView.jsx:173`, `:195`, `src/components/onboarding/steps/PlacesStep.jsx:25`, `src/views/SettingsView.jsx:330`, `src/views/DepartmentsView.jsx:113`, `src/views/MemberView.jsx:458` |

✅ "Places" is the nav label and page title everywhere. Places are org-level, and productions store only Place IDs, not copies of Place data.

**Files to change when productions move out of Places:** `CreateProductionForm`, `ProductionDashboard`, `ProductionsView`, `PlacesView`, `AssignmentsPanel`, `CreateTaskForm`, `TimelineView`, `SettingsView`, `ProductionStep`, `AdminDashboardView`, `DHDashboardView`, `MemberView`. Plus `firestore.rules`, `firestore.indexes.json`, the org reset function (`functions/index.js:188-193`), `src/models/org.js` and `src/models/productions.js`.

## 6. Events, Deadlines, Tasks
✅ **No unified model exists.** Tasks and Events are separate collections with separate forms and rules. They only appear together on screen: the Upcoming Dates widget tags each row Task or Event (`src/components/dashboard/UpcomingDatesWidget.jsx:13-20`).

| Finding | Type | Where |
|---|---|---|
| No Deadline type anywhere | Missing | — |
| Closest thing today: task templates. You type an anchor date ("Opening Night" by default) when applying one. That date is never saved or linked to a production | Missing | `src/components/timeline/CreateTemplateForm.jsx:19`, `src/components/timeline/TemplatesPanel.jsx:100-101` |
| Only production-scoped events belong to a production. Org-wide and department events belong to none | Structural | `src/models/events.js:6-17` |
| Event start and end times are optional. An Event with no time is really a Deadline | Structural | `src/components/events/CreateEventForm.jsx:261-268` |
| Event title example "e.g. Opening Night" (now a Production date) | Label | `src/components/events/CreateEventForm.jsx:229` |
| Tasks can only be assigned to people with a login | Gap | `src/components/timeline/CreateTaskForm.jsx:109` |
| Tasks can't be attached to an Event or Deadline, only to a production or department | Missing | `src/models/timeline.js:48-77` |
| Tasks have a `phase` tag (planning / production / wrap) that drives the Postmortem dashboard | Name clash with Production phases | `src/models/timeline.js:29-33`, `src/views/AdminDashboardView.jsx:232` |
| Tasks have a due date, no scheduled time | ✅ | `src/models/timeline.js:57` |

## 7. Already aligned
- Group and Role are already locked as separate in `CLAUDE.md`, the state doc and both role files. Dashboards route on Role only.
- Only the server writes roles; the rules block the app from doing it.
- The three dashboards by access level already exist.
- Places: correct top-level label, org-level records, IDs rather than copied data.
- Events and Tasks are already separate types.
- Tasks, events and volunteer shifts already link to a production with a plain ID field. That's the right pattern for linking Places, Events and Deadlines.
- No data migration needed: per the Sep 25 decision, current data is test data being wiped.

## 8. Docs that will steer the next session wrong
`CLAUDE.md` tells every session to treat `docs/PROJECT_STATE.md` as the source of truth, and it still says:
- `docs/PROJECT_STATE.md:226-231`: **"Hierarchy (locked): Organization → Department → Venue → Production"** and "Venue: Real container".
- `docs/PROJECT_STATE.md:233-242` and `:251`: the old 7-role list, including "volunteer".
- `docs/PROJECT_STATE.md:436`: an open question about "Production below Venue". Your doc answers it.
- The changelog archive, Jul 12 entry: "artist shows are Person records assigned to venues, not Productions."

## 9. Decisions I need before the build prompt
1. **Cut roles from 9 to 3?** I'd say yes. `secondaryAdmin` becomes `admin`; the org owner is still identified separately. `venueManager` needs a decision. If you later want someone's access limited to one production, that can use the scope fields every membership already has, not a new role name.
2. **What does a `singleEvent` Project contain?** Your doc doesn't say. My read: a mostly empty Production record, so "Events live within a Production" stays true everywhere.
3. **Events with no Production:** board meetings and staff calls are real for your Company group. I'd allow Events without a Production rather than invent fake Productions to hold them.
4. **Team and Cast as lists on the Production**, replacing the assignment list on each person? One catch: the database can't search inside lists of person-and-role pairs. Answering "which productions am I on" needs a separate plain list of person IDs. "Never on both lists" has to be checked in the app, because the rules can't do it.
5. **Opening, closing and preview nights** would exist both as Production dates and as show-date Events. I'd make the Production dates the source of truth and create the performance Events from them.
6. **The task `phase` tag:** remove it and work out a task's phase from the Production's phase date ranges (my preference, since hand-tagged phases drift), or keep it under a different name?
7. **Volunteers module:** keep it, rename it "Shifts", or remove it? And which Group do volunteers belong to?
8. **Fringe model:** is each fringe show its own Production inside a Festival Project? That reverses the Jul 12 decision, and changes what Tempest's beta task ("add 5+ artists") actually creates.

These can wait for the build:
- Do Departments stay org-level? Your doc doesn't mention them.
- Should templates produce Deadlines, Tasks, or both?
- Can one person hold two roles on the same list (Director and Choreographer)?

## 10. Found along the way
- **The rules tests don't cover places, productions, events or tasks at all.** Moving productions out of Places rewrites exactly those rules, so the build should add tests for them.
- **Dead code:** `src/utils/googleCalendar.js` isn't used anywhere and has its own four-phase concept. The `timelines` collection has a model and rules, but nothing ever writes to it.
- **An easy feature to add:** "Send to Group" in Messages (`src/views/MessageView.jsx:56`) can only target Everyone or a Department. Once Group exists, admins will expect it to target Company, Your People and Collaborators.

**Suggested next step:** a docs-only commit that records your decisions in `docs/PROJECT_STATE.md` (sections 3 and 7), so the build session doesn't read "Venue → Production (locked)" and build against it. It would also save this audit as `docs/DATA_MODEL_AUDIT_2026-09-26.md`, next to the Aug 3 proposal. No code. Want me to go ahead?
