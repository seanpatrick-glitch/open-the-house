// Check-in — data model reference
// Canonical collection paths and document shapes for the check-in module.

/*
COLLECTION: organizations/{orgId}/checkins/{checkinId}
{
  personId:    string,           // reference to people/{personId}
  orgId:       string,
  assignmentId: string,          // required — no null, no date-only mode
  date:        Timestamp,        // matches or confirmed against the assignment date
  present:     boolean,
  checkedInBy: string,           // uid or 'self'
  recordedAt:  Timestamp,        // server timestamp
  tokenId:     string | null,    // present only for QR self-check-in
}

COMPOSITE INDEXES NEEDED (flag for Firestore console on first query):
  checkins: orgId ascending, date ascending
  checkins: personId ascending, date ascending

COLLECTION: organizations/{orgId}/checkinTokens/{tokenId}
{
  orgId:        string,
  assignmentId: string,
  date:         Timestamp,
  createdBy:    string,          // uid
  validFrom:    Timestamp,
  validUntil:   Timestamp,       // hard stop — no writes accepted after this
  active:       boolean,
}
*/
