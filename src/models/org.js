// Org document — schema reference
// Fields added to the organizations/{orgId} document for dashboard state.

/*
organizations/{orgId}
  + activeProdId (string | null) — set when admin designates a production as active.
      The path to the active production is:
      organizations/{orgId}/places/{placeId}/productions/{activeProdId}
      Since productions are nested under places, the dashboard state reader
      also needs the placeId. Store activeProdId as a composite string:
      "{placeId}/{productionId}" so a single field lookup gives both.

  + dashboardStateOverride (string | null) — manual override for dashboard state.
      Enum: 'planning' | 'finalCountdown' | 'live' | 'postmortem' | null
      null means auto-calculate from production dates.
      Settings UI for this field comes in a later step.

  + departmentsEnabled (boolean) — controls the Departments nav item and module.
      Written explicitly as true at org creation (SignupStep3.jsx) as of 2026-08-16.
      Every read site falls back with `?? false` when the field is absent, so
      orgs created before this change (no field written) still read as false —
      that fallback is intentional and must not become `?? true`, or every
      pre-existing org with the field unset would silently flip on.
*/

export const DASHBOARD_STATES = {
  PLANNING:        'planning',
  FINAL_COUNTDOWN: 'finalCountdown',
  LIVE:            'live',
  POSTMORTEM:      'postmortem',
};
