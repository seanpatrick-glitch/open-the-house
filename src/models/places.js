// Places — data model reference

// What kind of space a Place is. Stored only; nothing reads it yet and there
// is no UI to set it (added 2026-09-29 ahead of Phase 4, so Places created
// from now on already carry the field and no backfill is needed later).
export const PLACE_TYPE = {
  VENUE:  'venue',   // performance spaces
  SPACE:  'space',   // rehearsal spaces
  OFFICE: 'office',  // work and admin spaces
};

/*
COLLECTION: organizations/{orgId}/places/{placeId}
Org-level records. Productions reference them by ID (production.placeIds)
and never embed Place data. The module label is Places.
{
  name:      string,
  orgId:     string,
  placeType: 'venue' | 'space' | 'office' | null,  // written as null; older Places have no field
  createdBy: string,               // uid
  createdAt: Timestamp,
}
*/
