// Events — data model reference
// Top-level, org-scoped collection, structured the same way as tasks
// (see src/models/timeline.js). Collection is created on first write.
// This file is the canonical reference.

export const EVENT_SCOPE = {
  ORG:        'org',
  DEPARTMENT: 'department',
  // 'production' scope (2026-08-18) is how a show date / performance is
  // distinguished from a general org or department event: it's the same
  // events collection and document shape, just tagged with a production
  // reference instead of a department one. Created via CreateEventForm's
  // production-locked mode, listed and opened into Check-In from
  // ProductionDashboard's Show Dates section — see src/components/
  // productions/ShowDatesPanel.jsx and Section 3 of PROJECT_STATE.md.
  PRODUCTION: 'production',
};

export const RECURRENCE_FREQUENCY = {
  WEEKLY:  'weekly',
  MONTHLY: 'monthly',
};

// Recurring events are materialized as real documents, one per occurrence,
// not resolved virtually at read time. This caps how many a single
// recurrence rule can generate (104 = weekly for 2 years) so a mistaken
// far-future end date can't silently write thousands of documents.
export const MAX_RECURRENCE_OCCURRENCES = 104;

/*
COLLECTION: events/{eventId}
{
  orgId: string,
  title: string,
  description: string | null,
  startDate: Timestamp,                 // single-day events: startDate == endDate
  endDate: Timestamp,                   // multi-day events (e.g. a festival run) span further
  startTime: string | null,             // 'HH:mm', optional
  endTime: string | null,               // 'HH:mm', optional
  location: string | null,
  scope: 'org' | 'department' | 'production',
  departmentId: string | null,          // required when scope is 'department', null otherwise
  production: string | null,            // productionId, required when scope is 'production', null otherwise
  productionName: string | null,        // denormalized production name, set alongside production
                                         // (same flat-reference pattern tasks.production/productionName
                                         // and volunteerShifts.production already use — see timeline.js
                                         // and volunteers.js)
  recurrence: {
    enabled: boolean,                   // default false
    frequency: 'weekly' | 'monthly' | null,  // null when recurrence.enabled is false
    endDate: Timestamp | null,          // last date the recurrence rule may generate an occurrence on
  },
  recurrenceGroupId: string | null,     // set only on instances generated from a recurring event,
                                         // so all occurrences in one series share this id. null on
                                         // one-off, non-recurring events.
  createdBy: string,                    // uid
  createdAt: Timestamp,
}
*/
