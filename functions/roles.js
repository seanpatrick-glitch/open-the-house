// Server-side mirror of src/models/roles.js: every stored role value and the
// access level it grants. firestore.rules' isBaseLevel() also lists the base
// roles. Keep all three in sync.
//
// Role is access only. It is never derived from a person's taxonomy Group
// (Company / Your People / Collaborators) — see "People taxonomy and access
// separation" in docs/PROJECT_STATE.md Section 3.

const ROLE_ACCESS = {
  admin: "admin",
  secondaryAdmin: "admin",
  venueManager: "admin",
  departmentHead: "departmentHead",
  orgCollaborator: "base",
  productionCollaborator: "base",
  collaborator: "base",
  person: "base",
  volunteer: "base",
};

function isValidRole(role) {
  return typeof role === "string" && Object.prototype.hasOwnProperty.call(ROLE_ACCESS, role);
}

module.exports = { ROLE_ACCESS, isValidRole };
