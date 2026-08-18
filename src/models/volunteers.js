// Volunteer shifts — data model reference
// Top-level, org-scoped collection, structured like events and tasks:
// a flat `production` reference field rather than a subcollection nested
// under organizations/{orgId}/places/{placeId}/productions/{productionId},
// so queries and rules stay consistent with the rest of the app.
// Collection is created on first write. This file is the canonical reference.
//
// Deliberately simple v1 (per the Aug 17 build brief): a shift has a flat
// slot count and a plain array of assigned person ids. No waitlists, no
// per-slot named positions, no shift-swapping, no notifications.

/*
COLLECTION: volunteerShifts/{shiftId}
{
  orgId: string,
  production: string,           // productionId this shift belongs to
  name: string,                 // e.g. "Ushers - Matinee", "Load-in"
  date: Timestamp,
  startTime: string | null,     // 'HH:mm', optional
  endTime: string | null,       // 'HH:mm', optional
  slots: number,                // total volunteer slots for this shift
  assignedPersonIds: string[],  // organizations/{orgId}/people/{personId} ids, default []
  createdBy: string,            // uid
  createdAt: Timestamp,
}
*/
