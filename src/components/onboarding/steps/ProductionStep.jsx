// ProductionStep.jsx — Onboarding wizard Step 3 (Production). Reuses
// CreateProductionForm.jsx directly for its required fields (name, place,
// scope, start/end date) and its existing dual-field write pattern
// (startDate/endDate plus the legacy openDate/closeDate/venueId fields,
// unchanged by this step). On save, sets the org's activeProdId
// ("{placeId}/{productionId}", matching models/org.js's composite format)
// so the dashboard picks up the new production once the wizard finishes.
// Places must already exist by the time this step is reached — Step 2
// requires at least one before Next is enabled, and CreateProductionForm
// itself cannot function with zero places.

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import CreateProductionForm from '../../productions/CreateProductionForm';

export default function ProductionStep({ orgId, onNext, onBack }) {
  const [places, setPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    getDocs(collection(db, 'organizations', orgId, 'places'))
      .then(snap => {
        if (cancelled) return;
        setPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
      .catch(err => {
        console.error('ProductionStep load places error:', err);
        if (!cancelled) setError('Could not load your places. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPlaces(false);
      });

    return () => { cancelled = true; };
  }, [orgId]);

  async function handleProductionCreated({ id, placeId }) {
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        activeProdId: `${placeId}/${id}`,
      });
    } catch (err) {
      console.error('ProductionStep set activeProdId error:', err);
      // Production itself was already created successfully — don't block
      // the wizard on this secondary write, just surface it before moving on.
      setError('Production created, but could not be set as active. You can set this in Settings later.');
    }
    onNext();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Set up your production</h2>
      <p className="text-gray-500 text-sm mb-6">
        Your first production, season, or festival. You can add more later.
      </p>

      {loadingPlaces ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : places.length === 0 ? (
        <p className="text-sm text-red-600">
          No places found. Go back and add at least one place first.
        </p>
      ) : (
        <CreateProductionForm places={places} onSuccess={handleProductionCreated} onCancel={onBack} />
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
