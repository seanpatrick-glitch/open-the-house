// People Coordination — data model reference
// Canonical collection paths and document shapes for the People module.
// All paths use organizations/{orgId} to match existing app structure.

export const PERSON_STATUS = {
  APPLIED:     'applied',
  WAITLISTED:  'waitlisted',
  ACTIVE:      'active',
  INACTIVE:    'inactive',
};

export const ACCOUNT_STATUS = {
  NO_ACCOUNT: 'no_account',
  INVITED:    'invited',
  ACTIVE:     'active',
};

// Taxonomy Group: who someone is to the org. Set by an Admin on the People
// record. Never derived from Role and never used for access or routing.
export const PERSON_GROUP = {
  YOUR_PEOPLE:   'yourPeople',     // leads who carry decisions through the org
  COMPANY:       'company',        // year-round: board, staff, returning volunteers
  COLLABORATORS: 'collaborators',  // tied to a production: guest artists, cast, contractors
};

// On-screen names for each Group, in the order the People page lists them.
export const PERSON_GROUP_LABELS = {
  [PERSON_GROUP.YOUR_PEOPLE]:   'Your People',
  [PERSON_GROUP.COMPANY]:       'Company',
  [PERSON_GROUP.COLLABORATORS]: 'Collaborators',
};

export const PERSON_GROUP_ORDER = [
  PERSON_GROUP.YOUR_PEOPLE,
  PERSON_GROUP.COMPANY,
  PERSON_GROUP.COLLABORATORS,
];

export const FIELD_TYPES = {
  TEXT:          'text',
  DATE:          'date',
  SELECT:        'select',
  MULTISELECT:   'multiselect',
  CHECKBOX_GROUP: 'checkboxGroup',
  FILE_UPLOAD:   'fileUpload',
};

/*
COLLECTION: organizations/{orgId}/personTypes/{typeId}
{
  label: string,                  // "Lighting Designer", "Board Member", etc. Renamable:
                                  // people keep the id and their typeLabel follows
  description: string,            // optional
  orgId: string,
  defaultGroup: 'yourPeople' | 'company' | 'collaborators' | null,
  defaultSystemRole: 'admin' | 'departmentHead' | 'base' | null,
                                  // both only pre-fill person forms and grant
                                  // nothing (models/personTypes.js). Null on types
                                  // made before Phase 4 item 4.
  departmentHeadId: string | null, // uid of assigned DH — required for DH write-scoping
  departmentId: string | null,    // optional, if Departments module is active
  createdBy: string,              // uid
  createdAt: Timestamp,
  active: boolean,
  universalFields: {              // always present, not configurable
    name: true,
    email: true,
    phone: true,
    emergencyContact: true,
  },
  toggleableFields: {             // admin turns on or off
    address: boolean,
    dateOfBirth: boolean,
    tShirtSize: boolean,
    dietaryRestrictions: boolean,
    accessibilityNeeds: boolean,
  },
  customFields: [                 // admin-defined
    {
      fieldId: string,            // generated uuid
      label: string,
      type: 'text' | 'date' | 'select' | 'multiselect' | 'checkboxGroup' | 'fileUpload',
      options: string[],          // for select, multiselect, checkboxGroup only
      required: boolean,
      order: number,
    }
  ]
}

COLLECTION: organizations/{orgId}/people/{personId}
{
  orgId: string,
  typeId: string | null,          // reference to personTypes/{typeId}. Optional on Add
                                  // Person; cleared when the type is deleted
  typeLabel: string | null,       // denormalized for display
  displayName: string | null,     // optional, defaults to fieldValues.name if unset
  group: 'yourPeople' | 'company' | 'collaborators' | null,
                                  // taxonomy Group (PERSON_GROUP). Required by Add
                                  // Person, editable on the person's page. CSV
                                  // import takes the type's default; self-signup
                                  // and onboarding don't set it yet.
  intendedRole: 'admin' | 'departmentHead' | 'base' | null,
                                  // system role picked on Add Person, pre-filled
                                  // from the type. Display only: it grants nothing.
                                  // A login's real role lives on users/{uid} and is
                                  // set in Settings > Access.
  status: 'applied' | 'waitlisted' | 'active' | 'inactive',
  staff: boolean,                 // default false. Active persons only. Set by admin or DH.
  accountUid: string | null,      // Firebase Auth uid, written on invite acceptance
  accountStatus: 'no_account' | 'invited' | 'active',
  createdBy: string,              // uid or 'self-signup'
  createdAt: Timestamp,
  approvedBy: string | null,      // uid, set when status moves pending → active
  approvedAt: Timestamp | null,
  assignments: [                  // array of objects
    {
      type: 'production' | 'place',
      refId: string,
      label: string,              // denormalized name
      assignedBy: string,         // uid
      assignedAt: Timestamp,
    }
  ],
  totalHours: number,             // denormalized running total
  fieldValues: {                  // keys are fieldIds, values are submitted data
    name: string,
    email: string,
    phone: string,
    emergencyContact: string,
    [fieldId]: any,
  }
}

SUBCOLLECTION: organizations/{orgId}/people/{personId}/internalData/notes
{
  tags: string[],
  notes: string,
  lastUpdatedBy: string,          // uid
  lastUpdatedAt: Timestamp,
}

SUBCOLLECTION: organizations/{orgId}/people/{personId}/hours/{entryId}
{
  hours: number,
  date: Timestamp,
  productionId: string | null,
  venueId: string | null,
  notes: string,
  loggedBy: string,               // uid
  loggedAt: Timestamp,
}

COLLECTION: organizations/{orgId}/signupTokens/{tokenId}
{
  orgId: string,
  typeId: string,
  typeLabel: string,              // denormalized
  createdBy: string,              // uid
  createdAt: Timestamp,
  expiresAt: Timestamp | null,
  active: boolean,
}
*/
