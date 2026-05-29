// Planning Timeline — data model reference
// These are the Firestore document shapes used across the timeline module.
// Collections are created on first write. This file is the canonical reference.

export const TIMELINE_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  OVERDUE: 'overdue',
};

export const TIMELINE_VIEWS = {
  LIST: 'list',
  CALENDAR: 'calendar',
  TIMELINE: 'timeline',
};

export const ACCESS_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
};

/*
COLLECTION: timelines/{timelineId}
{
  orgId: string,
  name: string,
  anchorDate: Timestamp,
  anchorLabel: string,
  createdFromTemplate: string | null,   // templateId reference
  defaultView: 'timeline' | 'calendar' | 'list',
  createdBy: string,                    // uid
  createdAt: Timestamp,
}

COLLECTION: tasks/{taskId}
{
  orgId: string,
  timelineId: string,
  title: string,
  description: string,
  assignedTo: string | null,            // uid or department id
  assignedToDepartment: string | null,  // departmentId
  dueDate: Timestamp,
  startDate: Timestamp | null,
  status: 'not_started' | 'in_progress' | 'complete' | 'overdue',
  department: string | null,            // departmentId
  production: string | null,            // productionId
  visibleToAll: boolean,                // default false
  visibleToDepartments: string[],       // array of departmentIds
  dependsOn: string[],                  // array of taskIds
  notifyOnComplete: string[],           // array of uids
  notifyOnOverdue: string[],            // array of uids
  createdBy: string,                    // uid
  completedAt: Timestamp | null,
  createdAt: Timestamp,
}

SUBCOLLECTIONS on tasks/{taskId}:
  comments/{commentId}   — { text, createdBy, createdAt }
  clarificationFlags/{flagId} — { note, createdBy, createdAt, resolved, resolvedAt }
  accessRequests/{requestId} — {
    requestedBy: string,           // uid of Department Head
    requestedForDepartment: string,
    status: 'pending' | 'approved' | 'denied',
    requestedAt: Timestamp,
    resolvedAt: Timestamp | null,
    resolvedBy: string | null,
  }

COLLECTION: timelineTemplates/{templateId}
{
  name: string,
  description: string,
  orgId: string,
  anchorLabel: string,
  createdBy: string,
  lastUsed: Timestamp | null,
  createdAt: Timestamp,
}

SUBCOLLECTION on timelineTemplates/{templateId}:
  templateTasks/{templateTaskId} — {
    title: string,
    description: string,
    offsetDays: number,            // negative = before anchor date
    department: string | null,     // departmentId
    assignedRole: string | null,   // role type string
    notifyOnComplete: boolean,
    dependsOn: string[],           // array of templateTask ids
  }

USER DOCUMENT ADDITIONS:
  preferredTimelineView: 'timeline' | 'calendar' | 'list' | null

ORG DOCUMENT ADDITIONS:
  defaultView: 'timeline' | 'calendar' | 'list'
*/
