import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import MessagingView from '../components/messaging/MessagingView';

export default function MessageView() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const [orgUsers, setOrgUsers] = useState([]);

  useEffect(() => {
    if (!orgId) return;
    getDocs(collection(db, 'users'))
      .then(snap => {
        const filtered = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => Object.keys(u.organizations ?? {}).includes(orgId));
        setOrgUsers(filtered);
      });
  }, [orgId]);

  return (
    <div className="p-6 max-w-6xl h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Messages</h1>
        <p className="text-sm text-gray-500">Conversations with your team.</p>
      </div>
      <MessagingView orgUsers={orgUsers} />
    </div>
  );
}
