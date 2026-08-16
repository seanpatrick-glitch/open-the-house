// Events — data model reference
// Top-level, org-scoped collection, structured the same way as tasks
// (see src/models/timeline.js). Collection is created on first write.
// This file is the canonical reference.

export const EVENT_SCOPE = {
  ORG:        'org',
  DEPARTMENT: 'department',
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
  scope: 'org' | 'department',
  departmentId: string | null,          // required when scope is 'department', null when 'org'
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
