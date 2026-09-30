// ProductionStep.jsx — Onboarding wizard Step 3 (Production). Reuses
// CreateProductionForm.jsx directly: only the title is required, and places
// and dates are optional. On save, sets the org's activeProdId (the
// productionId, per models/org.js) so the dashboard picks up the new
// production once the wizard finishes.
// The org's places are loaded so the form can search them; the form works
// with none, and a new place can be added from inside it.

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

  async function handleProductionCreated({ id }) {
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        activeProdId: id,
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
      ) : (
        <CreateProductionForm places={places} onSuccess={handleProductionCreated} onCancel={onBack} />
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
