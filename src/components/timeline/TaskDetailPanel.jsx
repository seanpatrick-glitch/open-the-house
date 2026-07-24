import { useState, useEffect } from 'react';
import { doc, collection, addDoc, updateDoc, writeBatch, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  complete:     'bg-green-100 text-green-700',
  overdue:      'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress:  'In progress',
  complete:     'Complete',
  overdue:      'Overdue',
};

export default function TaskDetailPanel({ task, orgUsers, departments, onClose }) {
  const { userProfile } = useAuth();
  const uid   = userProfile?.uid;
  const orgId = userProfile?.orgId;

  const [handoffs, setHandoffs]         = useState([]);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffToUid, setHandoffToUid] = useState('');
  const [handoffNote, setHandoffNote]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');

  const isPrimaryAssignee = task.currentAssigneeUid === uid;
  const isAdmin           = userProfile?.role === 'admin' || userProfile?.role === 'secondaryAdmin';

  const pendingHandoff = handoffs.find(h => h.status === 'pending' && h.toUid === uid);

  useEffect(() => {
    if (!task?.id) return;
    const unsub = onSnapshot(
      collection(db, 'tasks', task.id, 'handoffs'),
      snap => setHandoffs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [task?.id]);

  async function handleInitiateHandoff() {
    if (!handoffToUid) return;
    setSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'tasks', task.id, 'handoffs'), {
        fromUid:      uid,
        toUid:        handoffToUid,
        initiatedAt:  serverTimestamp(),
        status:       'pending',
        handoffNote:  handoffNote.trim(),
        responseNote: null,
        resolvedAt:   null,
      });
      await updateDoc(doc(db, 'tasks', task.id), { handoffPending: true });
      setShowHandoffForm(false);
      setHandoffToUid('');
      setHandoffNote('');
    } catch (err) {
      console.error('Handoff initiate error:', err);
      setError('Failed to initiate handoff. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespondToHandoff(handoff, accept) {
    setSubmitting(true);
    try {
      const batch = writeBatch(db);

      // Update handoff document
      batch.update(doc(db, 'tasks', task.id, 'handoffs', handoff.id), {
        status:       accept ? 'accepted' : 'returned',
        responseNote: null,
        resolvedAt:   serverTimestamp(),
      });

      // Update task document
      if (accept) {
        batch.update(doc(db, 'tasks', task.id), {
          currentAssigneeUid: uid,
          handoffPending:     false,
        });
      } else {
        batch.update(doc(db, 'tasks', task.id), {
          handoffPending: false,
        });
      }

      // Write history entry
      const historyRef = doc(collection(db, 'tasks', task.id, 'history'));
      batch.set(historyRef, {
        type:      accept ? 'handoffAccepted' : 'handoffReturned',
        actorUid:  uid,
        targetUid: handoff.fromUid,
        note:      null,
        timestamp: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      console.error('Handoff response error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const dept         = (task.departmentId || task.department) ? departments[task.departmentId || task.department] : null;
  const assigneeUser = orgUsers.find(u => u.uid === task.currentAssigneeUid);
  const handoffCandidates = orgUsers.filter(u => u.uid !== uid);

  return (
    <div className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl p-5 overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Due</p>
          <p className="text-gray-700">{formatDate(task.dueDate)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-0.5">Status</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[task.status] || STATUS_STYLES.not_started}`}>
            {STATUS_LABELS[task.status] || 'Not started'}
          </span>
        </div>

        {dept && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Department</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.colorCode || '#6366f1' }} />
              <span className="text-gray-700">{dept.name}</span>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-400 mb-0.5">Assigned to</p>
          <p className="text-gray-700">{assigneeUser?.email || 'Unassigned'}</p>
        </div>

        {task.contributorUids?.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Contributors</p>
            <div className="space-y-0.5">
              {task.contributorUids.map(cuid => {
                const u = orgUsers.find(u => u.uid === cuid);
                return <p key={cuid} className="text-gray-600 text-xs">{u?.email || cuid}</p>;
              })}
            </div>
          </div>
        )}

        {task.description && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Description</p>
            <p className="text-gray-700 leading-relaxed">{task.description}</p>
          </div>
        )}
      </div>

      {/* Pending handoff for recipient */}
      {pendingHandoff && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-800 mb-2">Handoff request</p>
          <p className="text-xs text-amber-700 mb-3">
            {orgUsers.find(u => u.uid === pendingHandoff.fromUid)?.email || 'Someone'} is handing this task to you.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleRespondToHandoff(pendingHandoff, true)} disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
              Accept
            </button>
            <button onClick={() => handleRespondToHandoff(pendingHandoff, false)} disabled={submitting}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium py-1.5 rounded-lg transition-colors">
              Return
            </button>
          </div>
        </div>
      )}

      {/* Handoff initiation */}
      {(isPrimaryAssignee || isAdmin) && !task.handoffPending && !pendingHandoff && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {!showHandoffForm ? (
            <button onClick={() => setShowHandoffForm(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
              Hand off task
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700">Hand off to</p>
              <select value={handoffToUid} onChange={e => setHandoffToUid(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select someone...</option>
                {handoffCandidates.map(u => (
                  <option key={u.uid} value={u.uid}>{u.email}</option>
                ))}
              </select>
              <textarea value={handoffNote} onChange={e => setHandoffNote(e.target.value)}
                placeholder="Optional note..." rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleInitiateHandoff} disabled={submitting || !handoffToUid}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
                  {submitting ? 'Sending...' : 'Send Handoff'}
                </button>
                <button onClick={() => setShowHandoffForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {task.handoffPending && !pendingHandoff && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-amber-600">Handoff pending — waiting for response.</p>
        </div>
      )}
    </div>
  );
}
