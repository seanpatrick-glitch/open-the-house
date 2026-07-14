// People Coordination — data model reference
// Canonical collection paths and document shapes for the People module.
// All paths use organizations/{orgId} to match existing app structure.

export const PERSON_STATUS = {
  PENDING:  'pending',
  ACTIVE:   'active',
  INACTIVE: 'inactive',
};

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
  label: string,                  // "Artist", "Volunteer", "Staff", etc.
  description: string,            // optional
  orgId: string,
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
  typeId: string,                 // reference to personTypes/{typeId}
  typeLabel: string,              // denormalized for display
  uid: string | null,             // Firebase Auth uid, null until account created
  status: 'pending' | 'active' | 'inactive',
  createdBy: string,              // uid or 'self-signup'
  createdAt: Timestamp,
  approvedBy: string | null,      // uid, set when status moves pending → active
  approvedAt: Timestamp | null,
  assignments: [                  // array of objects
    {
      type: 'production' | 'venue',
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
