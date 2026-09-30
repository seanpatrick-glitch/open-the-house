// Productions — data model reference

export const PRODUCTION_SCOPE = {
  SINGLE:   'single',
  SEASON:   'season',
  FESTIVAL: 'festival',
};

// The two person lists on a production record, by field name. Always
// separate lists; the same person may appear on both.
export const PRODUCTION_LIST = {
  TEAM: 'productionTeam',
  CAST: 'cast',
};

/*
COLLECTION: organizations/{orgId}/productions/{productionId}
Top-level under the org, not nested under a Place (moved 2026-09-28, Phase 1
of the data model migration; see docs/DATA_MODEL_AUDIT_2026-09-26.md). The
Place is referenced by placeId only. Record shape unchanged by the move.
{
  name:          string,
  displayLabel:  string,           // defaults to 'Production' if left blank
  placeId:       string,
  venueId:       string,           // same value as placeId
  orgId:         string,
  scope:         'single' | 'season' | 'festival',
  status:        'planning' | 'in-progress' | 'open' | 'closed',
  startDate:     Timestamp,
  endDate:       Timestamp,
  openDate:      Timestamp,        // same value as startDate, read by dashboard state logic
  closeDate:     Timestamp,        // same value as endDate, read by dashboard state logic
  activeModules: {
    volunteerScheduling: boolean,
    // fohPrep, lobbyInstall, barProgram, inventory, promo: DEPRECATED
    // (2.4 cleanup). No longer written on new productions and no longer
    // read anywhere in the app. Some pre-cleanup production documents still
    // carry one or more of these set true (e.g. "the tempestt" in the test
    // org) — every read site now derives its module list from a fixed
    // known-key list (ProductionDashboard.jsx's MODULE_KEYS,
    // ProductionsView.jsx's MODULE_LABELS) rather than from whatever keys
    // exist on the document, so a stale true value is silently ignored, not
    // migrated or deleted.
  },
  createdBy: string,               // uid
  createdAt: Timestamp,
  productionTeam: TeamCastEntry[], // operational and crew people (director, stage manager, designers)
  cast:           TeamCastEntry[], // performers (actors, singers, dancers)
}

TeamCastEntry (one row on productionTeam or cast; added 2026-09-28, Phase 3 item 1):
{
  personId:       string | null,   // organizations/{orgId}/people/{personId}; null for a login with no People record yet
  accountUid:     string | null,   // the person's login uid, when they have one
  displayName:    string,          // denormalized at add time; rows show the current name when the record still exists
  productionRole: string,          // free text, specific to this production ("Stage Manager", "Elphaba")
  group:          'yourPeople' | 'company' | 'collaborators' | null,
                                   // carried over from the People record at add time
  addedBy:        string,          // uid
  addedAt:        Timestamp,       // client time: serverTimestamp() isn't allowed inside an array
}

Team and Cast notes:
- Written as [] on new productions. Older productions have neither field;
  every reader treats a missing list as empty.
- No position field. Rows display in add order (array order).
- A person may be on both lists, but only once per list: to give someone
  a second role on the same list, edit their role text.
- Every change runs in a transaction that re-reads the array (see
  src/utils/teamAndCast.js), so concurrent edits don't overwrite each other.
  Only admin/secondaryAdmin can write, per the productions update rule.
- Not yet the source for check-in rosters, MemberView's assignments, or the
  Roster section, which all still read people.assignments[] (open decision,
  PROJECT_STATE.md Section 7).

Note: scope is captured and stored only. It is not yet wired into timeline
generation — the template/offsetDays system in Planning Timeline treats all
productions identically regardless of scope. Needs an App Architecture
decision on how season/festival scope should change the smart default
timeline before that logic gets built.
*/
