import { useState, useEffect } from 'react';
import { collection, doc, query, where, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getDisplayName } from '../../utils/displayName';
import toast from 'react-hot-toast';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return Timestamp.fromDate(new Date(year, month - 1, day));
}

function formatShiftDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Genuinely simple v1: create a shift, assign people to it from this
// production's roster, view the list. No shift-swapping, waitlists, or
// notifications — those stay explicitly out of scope for this pass.
export default function VolunteersPanel({ production, roster }) {
  const { userProfile } = useAuth();
  const orgId = userProfile.orgId;
  const uid   = userProfile.uid;

  const [shifts, setShifts]               = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [addPersonId, setAddPersonId]     = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName]           = useState('');
  const [date, setDate]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [slots, setSlots]         = useState('1');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'volunteerShifts'),
      where('orgId', '==', orgId),
      where('production', '==', production.id),
      orderBy('date', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setShiftsLoading(false);
    }, err => {
      console.error('VolunteersPanel shifts listener error:', err);
      toast.error('Could not load volunteer shifts.');
      setShiftsLoading(false);
    });
    return unsub;
  }, [orgId, production.id]);

  async function handleCreateShift() {
    if (!name.trim() || !date || !slots) {
      setError('Shift name, date, and slots are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'volunteerShifts'), {
        orgId,
        production: production.id,
        name: name.trim(),
        date: parseLocalDate(date),
        startTime: startTime || null,
        endTime: endTime || null,
        slots: Number(slots),
        assignedPersonIds: [],
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
      setName('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setSlots('1');
      setShowCreateForm(false);
    } catch (err) {
      console.error('VolunteersPanel create shift error:', err);
      setError('Failed to create shift. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Mirrors AssignmentsPanel.jsx's select + Assign / Remove pattern.
  async function handleAssign(shift) {
    if (!addPersonId) return;
    try {
      await updateDoc(doc(db, 'volunteerShifts', shift.id), {
        assignedPersonIds: arrayUnion(addPersonId),
      });
      setAddPersonId('');
    } catch (err) {
      console.error('VolunteersPanel assign error:', err);
      toast.error('Could not assign that volunteer. Please try again.');
    }
  }

  async function handleUnassign(shift, personId) {
    try {
      await updateDoc(doc(db, 'volunteerShifts', shift.id), {
        assignedPersonIds: arrayRemove(personId),
      });
    } catch (err) {
      console.error('VolunteersPanel unassign error:', err);
      toast.error('Could not remove that volunteer. Please try again.');
    }
  }

  function personName(personId) {
    return getDisplayName(roster.find(p => p.id === personId)) || 'Unknown';
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Volunteer Shifts</h2>
        <button
          onClick={() => setShowCreateForm(s => !s)}
          className="text-xs font-medium text-places-blue hover:text-places-blue/90 transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ New Shift'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Shift Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Ushers - Matinee"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Slots</label>
              <input type="number" min="1" value={slots} onChange={e => setSlots(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time (optional)</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">End Time (optional)</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={handleCreateShift} disabled={saving || !name.trim() || !date || !slots}
            className="bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            {saving ? 'Creating...' : 'Create Shift'}
          </button>
        </div>
      )}

      {shiftsLoading ? (
        <p className="text-sm text-gray-400">Loading shifts…</p>
      ) : shifts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No volunteer shifts yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {shifts.map(shift => {
            const assignedCount    = shift.assignedPersonIds?.length || 0;
            const isExpanded       = expandedShiftId === shift.id;
            const availablePeople  = roster.filter(p => !(shift.assignedPersonIds || []).includes(p.id));

            return (
              <div key={shift.id} className="px-4 py-3">
                <button
                  onClick={() => { setExpandedShiftId(isExpanded ? null : shift.id); setAddPersonId(''); }}
                  className="w-full flex items-center justify-between gap-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{shift.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatShiftDate(shift.date)}
                      {shift.startTime && ` · ${formatTime(shift.startTime)}${shift.endTime ? ` – ${formatTime(shift.endTime)}` : ''}`}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${assignedCount >= shift.slots ? 'bg-green-100 text-green-700' : 'bg-spotlight/15 text-stage-navy'}`}>
                    {assignedCount} / {shift.slots} filled
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    {assignedCount > 0 && (
                      <div className="space-y-1.5">
                        {shift.assignedPersonIds.map(personId => (
                          <div key={personId} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-1.5">
                            <span className="text-sm text-gray-800">{personName(personId)}</span>
                            <button onClick={() => handleUnassign(shift, personId)}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {availablePeople.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        {roster.length === 0 ? "No one is on this production's roster yet." : 'Everyone on the roster is already assigned.'}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <select value={addPersonId} onChange={e => setAddPersonId(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-places-blue">
                          <option value="">Select a volunteer...</option>
                          {availablePeople.map(p => (
                            <option key={p.id} value={p.id}>{getDisplayName(p) || 'No name'}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAssign(shift)} disabled={!addPersonId}
                          className="bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                          Assign
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
