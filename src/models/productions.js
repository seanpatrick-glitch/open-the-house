// Productions — data model reference

export const PRODUCTION_SCOPE = {
  SINGLE:   'single',
  SEASON:   'season',
  FESTIVAL: 'festival',
};

/*
COLLECTION: organizations/{orgId}/places/{placeId}/productions/{productionId}
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
}

Note: scope is captured and stored only. It is not yet wired into timeline
generation — the template/offsetDays system in Planning Timeline treats all
productions identically regardless of scope. Needs an App Architecture
decision on how season/festival scope should change the smart default
timeline before that logic gets built.
*/
