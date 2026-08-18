import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import CheckInTokenGenerator from './CheckInTokenGenerator';
import { getDisplayName } from '../../utils/displayName';
import toast from 'react-hot-toast';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// dateOnlyString: 'YYYY-MM-DD' for a given Date, in local time — matches the
// same format the old <input type="date"> picker produced, since the
// check-ins date-range query (below) is written against that string shape.
function dateOnlyString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Reached only from ShowDatesPanel now (Places > Production > show date) —
// production and event are both required, no standalone top-level route or
// production/date picker exists anymore (2026-08-18). event is the show-date
// Event document (scope 'production'); its startDate is the fixed check-in
// date for this screen.
export default function CheckInView({ production, event, onBack }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  const selectedProd = production.id;
  const selectedDate = dateOnlyString(event.startDate.toDate ? event.startDate.toDate() : new Date(event.startDate));

  const [roster, setRoster]               = useState([]);
  const [checkins, setCheckins]           = useState({});
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState({});
  const [showQR, setShowQR] = useState(false);

  // Load roster and existing check-ins for this production and show date
  useEffect(() => {
    if (!orgId || !selectedProd || !selectedDate) return;
    const loadRoster = async () => {
      setLoading(true);
      try {
        // Find people assigned to this production
        const peopleSnap = await getDocs(
          collection(db, 'organizations', orgId, 'people')
        );
        const assigned = peopleSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p =>
            p.status === 'active' &&
            (p.assignments || []).some(a => a.type === 'production' && a.refId === selectedProd)
          );
        setRoster(assigned);

        // Load existing check-ins for this production and date
        const dateStart = parseLocalDate(selectedDate);
        const dateEnd   = new Date(dateStart);
        dateEnd.setDate(dateEnd.getDate() + 1);

        const checkinsSnap = await getDocs(
          query(
            collection(db, 'organizations', orgId, 'checkins'),
            where('assignmentId', '==', selectedProd),
            where('date', '>=', Timestamp.fromDate(dateStart)),
            where('date', '<',  Timestamp.fromDate(dateEnd))
          )
        );

        const map = {};
        checkinsSnap.docs.forEach(d => {
          const data = d.data();
          map[data.personId] = { id: d.id, ...data };
        });
        setCheckins(map);
      } catch (err) {
        console.error('CheckInView load roster error:', err);
        toast.error('Could not load the roster. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    loadRoster();
  }, [orgId, selectedProd, selectedDate]);

  async function handleToggle(person) {
    const alreadyCheckedIn = !!checkins[person.id];
    if (alreadyCheckedIn) return; // no undo in Phase 1

    setSaving(prev => ({ ...prev, [person.id]: true }));
    try {
      const date = Timestamp.fromDate(parseLocalDate(selectedDate));
      await addDoc(
        collection(db, 'organizations', orgId, 'checkins'),
        {
          personId:    person.id,
          orgId,
          assignmentId: selectedProd,
          date,
          present:     true,
          checkedInBy: uid,
          recordedAt:  serverTimestamp(),
          tokenId:     null,
        }
      );
      setCheckins(prev => ({
        ...prev,
        [person.id]: { personId: person.id, present: true },
      }));
    } catch (err) {
      console.error('CheckInView toggle error:', err);
      toast.error('Could not save check-in. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [person.id]: false }));
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          ← Back to Show Dates
        </button>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Check-In — {event.title}</h1>
        <p className="text-sm text-gray-500">{production.name} · {formatDate(event.startDate)}</p>
      </div>

      {/* Roster */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">Loading roster...</p>
        </div>
      ) : roster.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-1">No active people assigned to this production.</p>
          <p className="text-gray-400 text-sm">Assign people from their profile in the People section.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {roster.length} people assigned
            </p>
            <p className="text-xs text-gray-400">
              {Object.keys(checkins).length} checked in
            </p>
            <button
              onClick={() => setShowQR(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              QR Check-In
            </button>
          </div>
          {showQR && (
            <div className="p-4 border-b border-gray-200">
              <CheckInTokenGenerator
                production={production}
                onClose={() => setShowQR(false)}
              />
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {roster.map(person => {
              const checkedIn = !!checkins[person.id];
              const isSaving  = !!saving[person.id];
              return (
                <div key={person.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {getDisplayName(person) || 'No name'}
                    </p>
                    <p className="text-xs text-gray-400">{person.typeLabel}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(person)}
                    disabled={checkedIn || isSaving}
                    className={`flex-shrink-0 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                      checkedIn
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
                    }`}
                  >
                    {isSaving ? 'Saving...' : checkedIn ? 'Present' : 'Check In'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
