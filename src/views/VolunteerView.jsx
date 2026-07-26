import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function VolunteerView() {
  const { userProfile, logout } = useAuth();
  const uid   = userProfile?.uid;
  const orgId = userProfile?.orgId;

  const [tasks, setTasks]               = useState([]);
  const [assignments, setAssignments]   = useState([]);
  const [personRecord, setPersonRecord] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => {
    if (!orgId || !uid) return;

    // Find this person's person record via accountUid
    const loadPersonRecord = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'organizations', orgId, 'people'),
            where('accountUid', '==', uid)
          )
        );
        if (!snap.empty) {
          const record = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setPersonRecord(record);
          setAssignments(record.assignments || []);
        }
      } catch (err) {
        console.error('VolunteerView loadPersonRecord error:', err);
      }
    };
    loadPersonRecord();

    // Load tasks assigned to this person
    const qAssigned = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      where('currentAssigneeUid', '==', uid),
      where('status', 'in', ['not_started', 'in_progress', 'overdue']),
      orderBy('dueDate', 'asc')
    );
    const qContributor = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      where('contributorUids', 'array-contains', uid),
      where('status', 'in', ['not_started', 'in_progress', 'overdue']),
      orderBy('dueDate', 'asc')
    );

    const taskMap = {};
    const unsubA = onSnapshot(qAssigned, snap => {
      snap.docs.forEach(d => { taskMap[d.id] = { id: d.id, ...d.data() }; });
      setTasks(Object.values(taskMap).sort((a, b) =>
        (a.dueDate?.toMillis?.() ?? 0) - (b.dueDate?.toMillis?.() ?? 0)
      ));
      setLoading(false);
    });
    const unsubC = onSnapshot(qContributor, snap => {
      snap.docs.forEach(d => { taskMap[d.id] = { id: d.id, ...d.data() }; });
      setTasks(Object.values(taskMap).sort((a, b) =>
        (a.dueDate?.toMillis?.() ?? 0) - (b.dueDate?.toMillis?.() ?? 0)
      ));
    });

    return () => { unsubA(); unsubC(); };
  }, [orgId, uid]);

  async function handleConfirmAssignment(assignment) {
    if (!personRecord) return;
    try {
      const updated = personRecord.assignments.map(a =>
        a.refId === assignment.refId
          ? { ...a, confirmed: true, confirmedAt: new Date().toISOString() }
          : a
      );
      await updateDoc(
        doc(db, 'organizations', orgId, 'people', personRecord.id),
        { assignments: updated }
      );
      setAssignments(updated);
    } catch (err) {
      console.error('Confirm assignment error:', err);
    }
  }

  const unconfirmedAssignments = assignments.filter(a => !a.confirmed);
  const confirmedAssignments   = assignments.filter(a => a.confirmed);

  const nextTask = tasks[0] ?? null;

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Places People!</h1>
            {nextTask ? (
              <p className="text-xs text-gray-500 mt-0.5">
                Next up: {nextTask.title} — {formatDate(nextTask.dueDate)}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">No tasks due</p>
            )}
          </div>
          <button onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Unconfirmed assignments */}
        {unconfirmedAssignments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-3">Confirm your assignments</p>
            <div className="space-y-2">
              {unconfirmedAssignments.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-amber-700">{a.label}</p>
                  <button
                    onClick={() => handleConfirmAssignment(a)}
                    className="text-xs font-medium text-amber-700 border border-amber-300 px-3 py-1 rounded-lg hover:bg-amber-100 transition-colors flex-shrink-0">
                    Confirm
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Tasks */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">My Tasks</h2>
          {tasks.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400">No tasks assigned to you right now.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-100">
                {tasks.map(task => (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'overdue'     ? 'bg-red-100 text-red-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {task.status === 'overdue' ? 'Overdue' :
                           task.status === 'in_progress' ? 'In progress' : 'Not started'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* My Schedule */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">My Schedule</h2>
          {confirmedAssignments.length === 0 && unconfirmedAssignments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400">No productions or venues assigned yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-100">
                {confirmedAssignments.map((a, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.label}</p>
                      <p className="text-xs text-gray-400 capitalize">{a.type}</p>
                    </div>
                    <span className="text-xs font-medium text-green-600">Confirmed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'messages' }))}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors text-center">
            Messages
          </button>
          <button
            onClick={logout}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-500 hover:border-gray-300 transition-colors text-center">
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}
