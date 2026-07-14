import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return Timestamp.fromDate(new Date(year, month - 1, day, 12, 0, 0));
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HoursPanel({ person }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const [hours, setHours]   = useState('');
  const [date, setDate]     = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes]   = useState('');

  useEffect(() => {
    if (!orgId || !person?.id) return;
    const q = query(
      collection(db, 'organizations', orgId, 'people', person.id, 'hours'),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [orgId, person?.id]);

  async function handleLog() {
    const h = parseFloat(hours);
    if (!h || h <= 0) {
      setError('Enter a valid number of hours.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(
        collection(db, 'organizations', orgId, 'people', person.id, 'hours'),
        {
          hours:    h,
          date:     parseLocalDate(date),
          notes:    notes.trim(),
          loggedBy: uid,
          loggedAt: serverTimestamp(),
        }
      );
      await updateDoc(
        doc(db, 'organizations', orgId, 'people', person.id),
        { totalHours: increment(h) }
      );
      setHours('');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
      setShowForm(false);
    } catch (err) {
      console.error('HoursPanel log error:', err);
      setError('Failed to log hours. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {person.totalHours ?? 0} total hours
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
            Log Hours
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Hours <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={handleLog} disabled={saving || !hours}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              {saving ? 'Saving...' : 'Log'}
            </button>
            <button onClick={() => { setShowForm(false); setError(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No hours logged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900">{entry.hours}h</span>
                {entry.notes && (
                  <span className="text-sm text-gray-500 ml-2">{entry.notes}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(entry.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
