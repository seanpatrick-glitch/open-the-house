// useUnreadCount — counts threads where the current user's read flag is false.
//
// Thread participants are stored as two scalar fields (participantA/participantB,
// not a `participants` array), each with its own boolean read flag
// (participantARead/participantBRead). Every other query against this collection
// in the codebase (messaging.js, MessagingView.jsx, PersonView.jsx) runs two
// parallel queries — one per participant slot — and merges client-side; this
// hook follows the same pattern.

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useUnreadCount(uid, orgId) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!uid || !orgId) {
      setUnreadCount(0);
      return;
    }

    const threadsRef = collection(db, 'organizations', orgId, 'threads');
    const qA = query(threadsRef, where('participantA', '==', uid), where('participantARead', '==', false));
    const qB = query(threadsRef, where('participantB', '==', uid), where('participantBRead', '==', false));

    const counts = { a: 0, b: 0 };
    const unsubA = onSnapshot(qA, snap => {
      counts.a = snap.size;
      setUnreadCount(counts.a + counts.b);
    });
    const unsubB = onSnapshot(qB, snap => {
      counts.b = snap.size;
      setUnreadCount(counts.a + counts.b);
    });

    return () => { unsubA(); unsubB(); };
  }, [uid, orgId]);

  return unreadCount;
}
