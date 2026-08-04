import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  getDocs, addDoc, updateDoc, serverTimestamp, doc, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { DASHBOARD_STATES } from '../models/org';
import { differenceInDays } from 'date-fns';
import { getDisplayName } from '../utils/displayName';

function getDashboardState(openDate, closeDate, override) {
  if (override) return override;
  const today          = new Date();
  const open           = openDate?.toDate ? openDate.toDate() : new Date(openDate);
  const close          = closeDate?.toDate ? closeDate.toDate() : new Date(closeDate);
  const daysToOpen     = differenceInDays(open, today);
  const daysSinceClose = differenceInDays(today, close);
  if (daysSinceClose > 0) return DASHBOARD_STATES.POSTMORTEM;
  if (daysToOpen <= 0 && daysSinceClose <= 0) return DASHBOARD_STATES.LIVE;
  if (daysToOpen <= 7) return DASHBOARD_STATES.FINAL_COUNTDOWN;
  return DASHBOARD_STATES.PLANNING;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CollaboratorView() {
  const { userProfile, logout } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  const [dashState, setDashState]   = useState(DASHBOARD_STATES.PLANNING);
  const [activeProd, setActiveProd] = useState(null);
  const [daysToOpen, setDaysToOpen] = useState(null);
  const [loading, setLoading]       = useState(true);

  const [peopleCount, setPeopleCount]   = useState(0);
  const [flags, setFlags]               = useState([]);
  const [tasks, setTasks]               = useState([]);

  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagNote, setFlagNote]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

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
      setEditingName(false);
    } catch (err) {
      console.error('Save display name error:', err);
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    if (!orgId) return;

    const loadState = async () => {
      try {
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        if (!orgSnap.exists()) { setLoading(false); return; }

        const orgData     = orgSnap.data();
        const override    = orgData.dashboardStateOverride ?? null;
        const compositeId = orgData.activeProdId ?? null;

        if (!compositeId) {
          setDashState(DASHBOARD_STATES.PLANNING);
          setLoading(false);
          return;
        }

        const [placeId, productionId] = compositeId.split('/');
        const prodSnap = await getDoc(
          doc(db, 'organizations', orgId, 'places', placeId, 'productions', productionId)
        );

        if (!prodSnap.exists()) {
          setDashState(DASHBOARD_STATES.PLANNING);
          setLoading(false);
          return;
        }

        const prod  = { id: prodSnap.id, ...prodSnap.data() };
        const state = getDashboardState(prod.openDate, prod.closeDate, override);
        const open  = prod.openDate?.toDate ? prod.openDate.toDate() : new Date(prod.openDate);
        setActiveProd(prod);
        setDashState(state);
        setDaysToOpen(differenceInDays(open, new Date()));

        // People count
        const peopleSnap = await getDocs(
          query(collection(db, 'organizations', orgId, 'people'), where('status', '==', 'active'))
        );
        setPeopleCount(peopleSnap.size);
      } catch (err) {
        console.error('CollaboratorView load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadState();
  }, [orgId]);

  // Flags subscription — admin-elevated only
  useEffect(() => {
    if (!orgId || loading) return;
    const q = query(
      collection(db, 'organizations', orgId, 'flags'),
      where('status', '==', 'open'),
      where('elevatedToAdmin', '==', true),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, snap => setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [orgId, loading]);

  // Tasks — org-level, not started or overdue
  useEffect(() => {
    if (!orgId || loading) return;
    const q = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      where('level', '==', 'org'),
      where('visibleToAll', '==', true),
      where('status', 'in', ['not_started', 'overdue']),
      orderBy('dueDate', 'asc')
    );
    return onSnapshot(q, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [orgId, loading]);

  async function handleSubmitFlag() {
    if (!flagNote.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'organizations', orgId, 'flags'), {
        orgId,
        note:             flagNote.trim(),
        flaggedBy:        uid,
        targetUid:        null,
        departmentId:     null,
        status:           'open',
        elevatedToAdmin:  true,
        createdAt:        serverTimestamp(),
      });
      setFlagNote('');
      setShowFlagForm(false);
    } catch (err) {
      console.error('Flag submit error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>;
  }

  const prodName = activeProd?.name || 'upcoming production';
  const stateLabels = {
    [DASHBOARD_STATES.PLANNING]:        'Planning',
    [DASHBOARD_STATES.FINAL_COUNTDOWN]: 'Final Countdown',
    [DASHBOARD_STATES.LIVE]:            'Live',
    [DASHBOARD_STATES.POSTMORTEM]:      'Postmortem',
  };
  const stateColors = {
    [DASHBOARD_STATES.PLANNING]:        'bg-gray-100 text-gray-600',
    [DASHBOARD_STATES.FINAL_COUNTDOWN]: 'bg-amber-100 text-amber-700',
    [DASHBOARD_STATES.LIVE]:            'bg-green-100 text-green-700',
    [DASHBOARD_STATES.POSTMORTEM]:      'bg-blue-100 text-blue-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-gray-900">Places People!</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stateColors[dashState]}`}>
              {stateLabels[dashState]}
            </span>
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
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Production status */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Production Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Production</p>
              <p className="text-sm font-medium text-gray-900">{prodName}</p>
            </div>
            {activeProd?.openDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">
                  {dashState === DASHBOARD_STATES.PLANNING || dashState === DASHBOARD_STATES.FINAL_COUNTDOWN
                    ? `Opens in ${daysToOpen} day${daysToOpen === 1 ? '' : 's'}`
                    : 'Opened'}
                </p>
                <p className="text-sm font-medium text-gray-900">{formatDate(activeProd.openDate)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Active people</p>
              <p className="text-2xl font-bold text-gray-900">{peopleCount}</p>
            </div>
            {tasks.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Tasks needing attention</p>
                <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tasks visible to all */}
        {tasks.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-100">
                {tasks.map(task => (
                  <div key={task.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        task.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {task.status === 'overdue' ? 'Overdue' : 'Not started'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Admin-elevated flags */}
        {flags.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Flagged for Review</h2>
            <div className="space-y-2">
              {flags.map(flag => (
                <div key={flag.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-800">{flag.note}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {flag.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flag form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Flag a note for Admin</h2>
          <p className="text-xs text-gray-400 mb-4">Anything that needs attention from the production team.</p>
          {!showFlagForm ? (
            <button
              onClick={() => setShowFlagForm(true)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
              Add a flag
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={flagNote}
                onChange={e => setFlagNote(e.target.value)}
                placeholder="What needs attention?"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitFlag}
                  disabled={submitting || !flagNote.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  {submitting ? 'Submitting...' : 'Submit Flag'}
                </button>
                <button
                  onClick={() => { setShowFlagForm(false); setFlagNote(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
