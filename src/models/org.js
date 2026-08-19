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

  + onboardingCompleted (boolean) — controls whether the org's original admin
      (ownerId match) is routed into the first-run guided setup wizard instead
      of straight to AdminDashboardView. Written explicitly as false at org
      creation (SignupStep3.jsx) as of 2026-08-18. AuthRouter.jsx reads this
      alongside ownerId to decide whether to show OnboardingWizard.jsx; only
      the matching ownerId sees it, so a secondary admin invited later into
      the same org (no ownerId match) never sees the wizard regardless of
      this field's value. Orgs created before this change have no field at
      all — AuthRouter.jsx treats a missing value as `true` (already onboarded)
      via `?? true`, not `false`, since a false default would retroactively
      surface the wizard for every pre-existing org's admin on next login.

  + logoUrl (string | null, optional) — Storage download URL for the org's
      logo, written by src/components/shared/OrgLogoUpload.jsx (Settings'
      Organization card and the onboarding wizard's Org step both use this
      same component) after an upload to organizations/{orgId}/logo/{filename}
      in Storage (see storage.rules). Nullable/absent for orgs that haven't
      set a logo yet — every read site must treat a missing field as "no
      logo", not an error.
*/

export const DASHBOARD_STATES = {
  PLANNING:        'planning',
  FINAL_COUNTDOWN: 'finalCountdown',
  LIVE:            'live',
  POSTMORTEM:      'postmortem',
};
