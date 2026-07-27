// Messaging utilities shared across Person/DH/Admin messaging flows.

import {
  collection, doc, getDoc, getDocs, addDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// Finds (or creates) the direct thread between a Person account and their
// department head, falling back to the org's primary admin when the
// person's type has no department head assigned.
export async function getOrCreateDHThread(orgId, personAccountUid, personTypeId) {
  let targetUid = null;

  if (personTypeId) {
    const typeSnap = await getDoc(doc(db, 'organizations', orgId, 'personTypes', personTypeId));
    if (typeSnap.exists() && typeSnap.data().departmentHeadId) {
      targetUid = typeSnap.data().departmentHeadId;
    }
  }

  if (!targetUid) {
    const adminSnap = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'members'),
        where('role', '==', 'admin')
      )
    );
    if (!adminSnap.empty) {
      targetUid = adminSnap.docs[0].id;
    }
  }

  if (!targetUid) {
    throw new Error('No department head or admin is available to message.');
  }

  const threadsRef = collection(db, 'organizations', orgId, 'threads');
  const [asA, asB] = await Promise.all([
    getDocs(query(threadsRef,
      where('participantA', '==', personAccountUid),
      where('participantB', '==', targetUid)
    )),
    getDocs(query(threadsRef,
      where('participantA', '==', targetUid),
      where('participantB', '==', personAccountUid)
    )),
  ]);

  const existing = asA.docs[0] || asB.docs[0];
  if (existing) return existing.id;

  const threadRef = await addDoc(threadsRef, {
    orgId,
    participantA:       personAccountUid,
    participantB:       targetUid,
    subject:             'Direct Message',
    createdAt:           serverTimestamp(),
    lastMessageAt:       serverTimestamp(),
    lastMessagePreview:  '',
    broadcastId:         null,
    participantARead:    true,
    participantBRead:    false,
  });

  return threadRef.id;
}
