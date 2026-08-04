import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import MessagingView from '../components/messaging/MessagingView';
import BroadcastForm from '../components/messaging/BroadcastForm';

export default function MessageView({ navState }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const [orgUsers, setOrgUsers] = useState([]);
  const [showBroadcast, setShowBroadcast] = useState(false);
  // Only pre-fill BroadcastForm's scope when the broadcast panel was opened
  // via a quick action — a manual "Send to Group" click shouldn't inherit a
  // stale scope from an earlier navigation.
  const [broadcastPrefill, setBroadcastPrefill] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    getDocs(collection(db, 'organizations', orgId, 'members'))
      .then(snap => {
        const filtered = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }));
        setOrgUsers(filtered);
      });
  }, [orgId]);

  useEffect(() => {
    if (navState?.action === 'broadcast') {
      setShowBroadcast(true);
      setBroadcastPrefill({ scope: navState.scope, departmentId: navState.departmentId });
    }
  }, [navState]);

  function toggleBroadcast() {
    setBroadcastPrefill(null)
    setShowBroadcast(b => !b)
  }

  return (
    <div className="p-6 max-w-6xl h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Messages</h1>
          <p className="text-sm text-gray-500">Conversations with your team.</p>
        </div>
        <button
          onClick={toggleBroadcast}
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
        <BroadcastForm
          onClose={() => setShowBroadcast(false)}
          initialScope={broadcastPrefill?.scope}
          initialDepartmentId={broadcastPrefill?.departmentId}
        />
      ) : (
        <MessagingView orgUsers={orgUsers} />
      )}
    </div>
  );
}
