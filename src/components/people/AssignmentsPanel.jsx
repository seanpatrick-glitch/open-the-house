import { useState, useEffect } from 'react';
import { doc, updateDoc, collection, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function AssignmentsPanel({ person }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  const [places, setPlaces]           = useState([]);
  const [productions, setProductions] = useState([]);
  const [assignType, setAssignType]   = useState('production');
  const [selectedId, setSelectedId]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (!orgId) return;
    const loadPlacesAndProductions = async () => {
      const placesSnap = await getDocs(
        collection(db, 'organizations', orgId, 'places')
      );
      const loadedPlaces = placesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlaces(loadedPlaces);

      const allProductions = [];
      for (const place of loadedPlaces) {
        const prodsSnap = await getDocs(
          collection(db, 'organizations', orgId, 'places', place.id, 'productions')
        );
        prodsSnap.docs.forEach(d => {
          allProductions.push({
            id:      d.id,
            placeId: place.id,
            label:   d.data().name,
            ...d.data(),
          });
        });
      }
      setProductions(allProductions);
    };
    loadPlacesAndProductions();
  }, [orgId]);

  const assignments = person.assignments || [];

  const alreadyAssignedIds = new Set(assignments.map(a => a.refId));

  const availableOptions = assignType === 'production'
    ? productions.filter(p => !alreadyAssignedIds.has(p.id))
    : places.filter(p => !alreadyAssignedIds.has(p.id));

  async function handleAssign() {
    if (!selectedId) return;
    const isProduction = assignType === 'production';
    const item = isProduction
      ? productions.find(p => p.id === selectedId)
      : places.find(p => p.id === selectedId);
    if (!item) return;

    setSaving(true);
    setError('');
    try {
      await updateDoc(
        doc(db, 'organizations', orgId, 'people', person.id),
        {
          assignments: arrayUnion({
            type:       assignType,
            refId:      selectedId,
            label:      item.label || item.name,
            assignedBy: uid,
            assignedAt: new Date().toISOString(),
          }),
        }
      );
      setSelectedId('');
    } catch (err) {
      console.error('Error assigning:', err);
      setError('Failed to save assignment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(assignment) {
    try {
      await updateDoc(
        doc(db, 'organizations', orgId, 'people', person.id),
        { assignments: arrayRemove(assignment) }
      );
    } catch (err) {
      console.error('Error removing assignment:', err);
    }
  }

  const productionAssignments = assignments.filter(a => a.type === 'production');
  const placeAssignments      = assignments.filter(a => a.type === 'venue' || a.type === 'place');

  return (
    <div>
      {/* Current assignments */}
      {assignments.length > 0 && (
        <div className="mb-5 space-y-4">
          {productionAssignments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Productions</p>
              <div className="space-y-1.5">
                {productionAssignments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800 font-medium">{a.label}</span>
                    <button onClick={() => handleRemove(a)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {placeAssignments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Places</p>
              <div className="space-y-1.5">
                {placeAssignments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800 font-medium">{a.label}</span>
                    <button onClick={() => handleRemove(a)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {assignments.length === 0 && (
        <p className="text-sm text-gray-400 mb-5">No assignments yet.</p>
      )}

      {/* Add assignment */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Add Assignment</p>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => { setAssignType('production'); setSelectedId(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              assignType === 'production'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Production
          </button>
          <button
            onClick={() => { setAssignType('place'); setSelectedId(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              assignType === 'place'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Place
          </button>
        </div>

        {availableOptions.length === 0 ? (
          <p className="text-xs text-gray-400">
            {assignType === 'production'
              ? 'No productions available to assign.'
              : 'No places available to assign.'}
          </p>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select...</option>
              {availableOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label || opt.name}</option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={!selectedId || saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Assign'}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
