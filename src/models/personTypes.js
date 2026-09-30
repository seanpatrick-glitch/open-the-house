// Person types: org-managed labels ("Lighting Designer", "Board Member").
// Stored at organizations/{orgId}/personTypes (shape in models/people.js).
//
// A type suggests a default Group and a default system role. Picking a type
// on a person form pre-fills both, and the admin can change either before
// saving. Type never grants access: routing and permissions read the role on
// the person's login (users/{uid}.organizations[orgId].role) only.
//
// Known exception, pre-dating this: a type's departmentHeadId decides which
// People records a Department Head can edit (firestore.rules, people block).
// Flagged in docs/PROJECT_STATE.md for Command Center.

import { serverTimestamp } from 'firebase/firestore';
import { ACCESS } from './roles';
import { PERSON_GROUP } from './people';

// Seeded into every new org at signup (SignupStep3.jsx). After that they are
// ordinary org-owned types: renamable, editable, deletable.
export const DEFAULT_PERSON_TYPES = [
  { label: 'Production Manager',         defaultGroup: PERSON_GROUP.YOUR_PEOPLE,   defaultSystemRole: ACCESS.DEPARTMENT_HEAD },
  { label: 'Technical Director',         defaultGroup: PERSON_GROUP.YOUR_PEOPLE,   defaultSystemRole: ACCESS.DEPARTMENT_HEAD },
  { label: 'House Manager',              defaultGroup: PERSON_GROUP.YOUR_PEOPLE,   defaultSystemRole: ACCESS.DEPARTMENT_HEAD },
  { label: 'Board Member',               defaultGroup: PERSON_GROUP.COMPANY,       defaultSystemRole: ACCESS.BASE },
  { label: 'Administrative Staff',       defaultGroup: PERSON_GROUP.COMPANY,       defaultSystemRole: ACCESS.BASE },
  { label: 'Recurring Volunteer',        defaultGroup: PERSON_GROUP.COMPANY,       defaultSystemRole: ACCESS.BASE },
  { label: 'Guest Director',             defaultGroup: PERSON_GROUP.COLLABORATORS, defaultSystemRole: ACCESS.BASE },
  { label: 'Stage Manager, Contracted',  defaultGroup: PERSON_GROUP.COLLABORATORS, defaultSystemRole: ACCESS.BASE },
  { label: 'Lighting Designer',          defaultGroup: PERSON_GROUP.COLLABORATORS, defaultSystemRole: ACCESS.BASE },
  { label: 'Costume Designer',           defaultGroup: PERSON_GROUP.COLLABORATORS, defaultSystemRole: ACCESS.BASE },
  { label: 'Cast Member',                defaultGroup: PERSON_GROUP.COLLABORATORS, defaultSystemRole: ACCESS.BASE },
  { label: 'Front of House Staff',       defaultGroup: PERSON_GROUP.COLLABORATORS, defaultSystemRole: ACCESS.BASE },
];

export const NO_TOGGLEABLE_FIELDS = {
  address:             false,
  dateOfBirth:         false,
  tShirtSize:          false,
  dietaryRestrictions: false,
  accessibilityNeeds:  false,
};

// Full personTypes document for a new type. Every writer (Settings, signup
// seeding, onboarding) goes through this so the shape stays the same.
export function newPersonTypeDoc({
  orgId,
  createdBy,
  label,
  defaultGroup = null,
  defaultSystemRole = null,
  description = '',
  departmentId = null,
  departmentHeadId = null,
  toggleableFields = NO_TOGGLEABLE_FIELDS,
  customFields = [],
}) {
  return {
    label,
    description,
    orgId,
    defaultGroup,
    defaultSystemRole,
    departmentHeadId,
    departmentId,
    createdBy,
    createdAt: serverTimestamp(),
    active: true,
    universalFields: { name: true, email: true, phone: true, emergencyContact: true },
    toggleableFields,
    customFields,
  };
}
