import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import MessagingView from '../components/messaging/MessagingView';
import BroadcastForm from '../components/messaging/BroadcastForm';

export default function MessageView() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const [orgUsers, setOrgUsers] = useState([]);
  const [showBroadcast, setShowBroadcast] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getDocs(collection(db, 'organizations', orgId, 'members'))
      .then(snap => {
        const filtered = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }));
        setOrgUsers(filtered);
      });
  }, [orgId]);

  return (
    <div className="p-6 max-w-6xl h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Messages</h1>
          <p className="text-sm text-gray-500">Conversations with your team.</p>
        </div>
        <button
          onClick={() => setShowBroadcast(b => !b)}
          className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
            showBroadcast
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'border-gray-200 text-gray-600 hover:text-gray-900'
          }`}
        >
          Send to Group
        </button>
      </div>
      {showBroadcast ? (
        <BroadcastForm onClose={() => setShowBroadcast(false)} />
      ) : (
        <MessagingView orgUsers={orgUsers} />
      )}
    </div>
  );
}
