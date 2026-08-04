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
    fohPrep:             boolean,
    lobbyInstall:        boolean,
    barProgram:          boolean,
    volunteerScheduling: boolean,
    inventory:           boolean,
    promo:               boolean,
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
