import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function BroadcastForm({ onClose, initialScope, initialDepartmentId }) {
  const { userProfile } = useAuth();
  const uid   = userProfile?.uid;
  const orgId = userProfile?.orgId;

  const [subject, setSubject]           = useState('');
  const [body, setBody]                 = useState('');
  const [scopeType, setScopeType]       = useState(initialScope || 'all');
  const [departmentId, setDepartmentId] = useState(initialDepartmentId || '');
  const [departments, setDepartments]   = useState([]);
  const [members, setMembers]           = useState([]);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (!orgId) return;
    getDocs(collection(db, 'departments')).then(snap => {
      setDepartments(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.orgId === orgId));
    });
    getDocs(collection(db, 'organizations', orgId, 'members')).then(snap => {
      setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
  }, [orgId]);

  function getRecipients() {
    let pool = members.filter(m => m.uid !== uid);
    if (scopeType === 'department' && departmentId) {
      pool = pool.filter(m => m.departmentId === departmentId);
    }
    return pool;
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.');
      return;
    }
    if (scopeType === 'department' && !departmentId) {
      setError('Select a department.');
      return;
    }
    const recipients = getRecipients();
    if (recipients.length === 0) {
      setError('No recipients found for the selected scope.');
      return;
    }

    setSending(true);
    setError('');

    try {
      // Create broadcast document
      const broadcastRef = await addDoc(
        collection(db, 'organizations', orgId, 'broadcasts'),
        {
          sentBy:   uid,
          subject:  subject.trim(),
          body:     body.trim(),
          recipientScope: {
            type:         scopeType,
            departmentId: scopeType === 'department' ? departmentId : null,
          },
          sentAt:         serverTimestamp(),
          threadIds:      [],
          recipientCount: recipients.length,
          readCount:      0,
        }
      );

      // Fan out — create one thread + one message per recipient in batches of 400
      const threadIds = [];
      const BATCH_SIZE = 400;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = recipients.slice(i, i + BATCH_SIZE);

        for (const recipient of chunk) {
          const threadRef = doc(collection(db, 'organizations', orgId, 'threads'));
          threadIds.push(threadRef.id);

          batch.set(threadRef, {
            orgId,
            participantA:       uid,
            participantB:       recipient.uid,
            subject:            subject.trim(),
            createdAt:          serverTimestamp(),
            lastMessageAt:      serverTimestamp(),
            lastMessagePreview: body.trim().slice(0, 80),
            broadcastId:        broadcastRef.id,
            participantARead:   true,
            participantBRead:   false,
          });

          const messageRef = doc(collection(db, 'organizations', orgId, 'threads', threadRef.id, 'messages'));
          batch.set(messageRef, {
            senderUid: uid,
            body:      body.trim(),
            sentAt:    serverTimestamp(),
            readAt:    null,
          });
        }
        await batch.commit();
      }

      // Update broadcast with thread IDs
      await updateDoc(broadcastRef, { threadIds });

      onClose();
    } catch (err) {
      console.error('BroadcastForm error:', err);
      setError('Failed to send broadcast. Please try again.');
      setSending(false);
    }
  }

  const recipients = getRecipients();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Send to Group</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Send to</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all',        label: 'Everyone' },
              { key: 'department', label: 'Department' },
            ].map(opt => (
              <button key={opt.key} type="button"
                onClick={() => { setScopeType(opt.key); setDepartmentId(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scopeType === opt.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {scopeType === 'department' && departments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select department...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Tech week schedule update"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Your message..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>

        <p className="text-xs text-gray-400">
          {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} will each receive this as an individual conversation.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={handleSend}
          disabled={sending || !subject.trim() || !body.trim() || (scopeType === 'department' && !departmentId)}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {sending ? 'Sending...' : `Send to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`}
        </button>
        <button onClick={onClose}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
