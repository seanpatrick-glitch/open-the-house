// Messaging — data model reference

/*
COLLECTION: organizations/{orgId}/threads/{threadId}
{
  orgId: string,
  participantA: string,           // uid
  participantB: string,           // uid
  subject: string,
  createdAt: Timestamp,
  lastMessageAt: Timestamp,
  lastMessagePreview: string,     // truncated body of most recent message
  broadcastId: string | null,
  participantARead: boolean,
  participantBRead: boolean,
}

SUBCOLLECTION: organizations/{orgId}/threads/{threadId}/messages/{messageId}
{
  senderUid: string,              // uid
  body: string,
  sentAt: Timestamp,
  readAt: Timestamp | null,
}

COLLECTION: organizations/{orgId}/broadcasts/{broadcastId}
{
  sentBy: string,                 // uid
  subject: string,
  body: string,
  recipientScope: {
    type: 'all' | 'department' | 'personType' | 'individual',
    departmentId: string,         // if type is department
    personTypeId: string,         // if type is personType
    uids: string[],               // if type is individual
  },
  sentAt: Timestamp,
  threadIds: string[],            // array of threadId strings
  recipientCount: number,         // denormalized
  readCount: number,              // denormalized running total
}

COMPOSITE INDEXES NEEDED:
  threads: orgId ascending, participantA ascending, lastMessageAt descending
  threads: orgId ascending, participantB ascending, lastMessageAt descending
*/
