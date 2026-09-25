// Role values and the access level each one grants — the single list the
// client routes on.
//
// Role is access only: it decides which dashboard someone lands on and what
// they can do. It is never derived from, and never used to derive, a
// person's taxonomy Group (Company / Your People / Collaborators). See
// "People taxonomy and access separation" in docs/PROJECT_STATE.md Section 3.
//
// The canonical role lives at users/{uid}.organizations[orgId].role and is
// written only by Cloud Functions (acceptInvite, setMemberRole,
// revokeMember). functions/roles.js mirrors this list for the server — keep
// the two in sync.

export const ACCESS = {
  ADMIN:           'admin',
  DEPARTMENT_HEAD: 'departmentHead',
  BASE:            'base',
}

export const ROLE_ACCESS = {
  admin:                  ACCESS.ADMIN,
  secondaryAdmin:         ACCESS.ADMIN,
  venueManager:           ACCESS.ADMIN,
  departmentHead:         ACCESS.DEPARTMENT_HEAD,
  orgCollaborator:        ACCESS.BASE,
  productionCollaborator: ACCESS.BASE,
  collaborator:           ACCESS.BASE,
  person:                 ACCESS.BASE,
  volunteer:              ACCESS.BASE,
}

// Base-level roles that still land on PersonView rather than
// CollaboratorView. Goes away when the two base-level dashboards merge.
export const PERSON_DASHBOARD_ROLES = new Set(['person', 'volunteer'])

export function accessLevel(role) {
  return ROLE_ACCESS[role] ?? null
}
