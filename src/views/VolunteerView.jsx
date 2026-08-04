import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getOrCreateDHThread } from '../utils/messaging';
import { getDisplayName } from '../utils/displayName';
import toast from 'react-hot-toast';

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

  const [dhThreadId, setDhThreadId]     = useState(null);
  const [dhThread, setDhThread]         = useState(null);
  const [dhMessages, setDhMessages]     = useState([]);
  const [dhNewMessage, setDhNewMessage] = useState('');
  const [dhLoading, setDhLoading]       = useState(false);
  const [dhSending, setDhSending]       = useState(false);
  const [dhError, setDhError]           = useState('');

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');
  const [savingName, setSavingName]   = useState(false);

  async function handleSaveName() {
    if (!uid || !orgId) return;
    setSavingName(true);
    const displayName = nameInput.trim() || userProfile.name || userProfile.email;
    try {
      await updateDoc(doc(db, 'users', uid), { displayName });
      await updateDoc(doc(db, 'organizations', orgId, 'members', uid), { displayName });
      if (personRecord?.id) {
        await updateDoc(doc(db, 'organizations', orgId, 'people', personRecord.id), { displayName });
      }
      setEditingName(false);
    } catch (err) {
      console.error('Save display name error:', err);
      toast.error('Could not save your name. Please try again.');
    } finally {
      setSavingName(false);
    }
  }

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
        toast.error('Could not load your profile. Please refresh and try again.');
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
      toast.error('Could not confirm assignment. Please try again.');
    }
  }

  async function handleOpenMessages() {
    setShowMessages(true);
    if (dhThreadId) return;
    setDhError('');
    setDhLoading(true);
    try {
      const threadId = await getOrCreateDHThread(orgId, uid, personRecord?.typeId);
      setDhThreadId(threadId);
    } catch (err) {
      console.error('Open DH thread error:', err);
      setDhError(err.message || 'Could not open messages.');
    } finally {
      setDhLoading(false);
    }
  }

  useEffect(() => {
    if (!dhThreadId || !orgId) return;

    const threadRef = doc(db, 'organizations', orgId, 'threads', dhThreadId);
    const unsubThread = onSnapshot(threadRef, snap => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() };
      setDhThread(data);
      const myReadField = data.participantA === uid ? 'participantARead' : 'participantBRead';
      if (data[myReadField] === false) {
        updateDoc(threadRef, { [myReadField]: true }).catch(err => {
          console.error('Mark thread read error:', err);
          toast.error('Could not update message read status.');
        });
      }
    });

    const qMessages = query(
      collection(db, 'organizations', orgId, 'threads', dhThreadId, 'messages'),
      orderBy('sentAt', 'asc')
    );
    const unsubMessages = onSnapshot(qMessages, snap => {
      setDhMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubThread(); unsubMessages(); };
  }, [dhThreadId, orgId, uid]);

  async function handleSendDHMessage() {
    if (!dhNewMessage.trim() || !dhThreadId || !dhThread) return;
    setDhSending(true);
    const body = dhNewMessage.trim();
    setDhNewMessage('');
    try {
      await addDoc(
        collection(db, 'organizations', orgId, 'threads', dhThreadId, 'messages'),
        { senderUid: uid, body, sentAt: serverTimestamp(), readAt: null }
      );
      const otherRead = dhThread.participantA === uid ? 'participantBRead' : 'participantARead';
      const myRead    = dhThread.participantA === uid ? 'participantARead' : 'participantBRead';
      await updateDoc(doc(db, 'organizations', orgId, 'threads', dhThreadId), {
        lastMessageAt:      serverTimestamp(),
        lastMessagePreview: body.slice(0, 80),
        [otherRead]:        false,
        [myRead]:           true,
      });
    } catch (err) {
      console.error('Send DH message error:', err);
      toast.error('Could not send your message. Please try again.');
    } finally {
      setDhSending(false);
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

  if (showMessages) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setShowMessages(false)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
              ← Back
            </button>
            <h1 className="text-base font-semibold text-gray-900">Messages</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col px-4 py-4 min-h-0">
          {dhLoading ? (
            <p className="text-sm text-gray-400 text-center mt-6">Loading...</p>
          ) : dhError ? (
            <p className="text-sm text-red-600 text-center mt-6">{dhError}</p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {dhMessages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center mt-6">No messages yet. Say hello!</p>
                ) : (
                  dhMessages.map(msg => {
                    const isMine = msg.senderUid === uid;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                          isMine ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-900'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <input
                  type="text"
                  value={dhNewMessage}
                  onChange={e => setDhNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDHMessage(); }}}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleSendDHMessage} disabled={dhSending || !dhNewMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
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
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder={userProfile?.email}
                  autoFocus
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button onClick={handleSaveName} disabled={savingName}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors">
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingName(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setNameInput(userProfile?.displayName || ''); setEditingName(true); }}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                title="Click to edit display name"
              >
                {getDisplayName(userProfile)}
              </button>
            )}
            <button onClick={logout}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </div>
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
            onClick={handleOpenMessages}
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
