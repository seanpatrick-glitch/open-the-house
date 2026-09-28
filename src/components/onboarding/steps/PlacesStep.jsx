// PlacesStep.jsx — Onboarding wizard Step 2 (Places). Reuses
// CreatePlaceForm.jsx's own write logic directly rather than duplicating it;
// each place is created immediately on save, matching Step 1's "add
// repeatedly, create immediately" pattern. The form is remounted (via a
// changing key) after each successful add so its internal state resets for
// the next place, the same way it's remounted in PlacesView.jsx by being
// closed and reopened.

import { useState } from 'react';
import CreatePlaceForm from '../../productions/CreatePlaceForm';

export default function PlacesStep({ onNext, onBack }) {
  const [addedPlaces, setAddedPlaces] = useState([]);

  function handlePlaceAdded(place) {
    setAddedPlaces(prev => [...prev, place]);
  }

  const canProceed = addedPlaces.length > 0;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Add your places</h2>
      <p className="text-gray-500 text-sm mb-6">
        Venues, stages, or spaces your productions happen in. Add at least one to continue.
      </p>

      <div className="mb-4">
        <CreatePlaceForm key={addedPlaces.length} onSuccess={handlePlaceAdded} onCancel={() => {}} />
      </div>

      {addedPlaces.length > 0 && (
        <ul className="space-y-1 mb-6 max-h-48 overflow-y-auto">
          {addedPlaces.map((p) => (
            <li key={p.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium">{p.name}</span>
            </li>
          ))}
        </ul>
      )}

      {!canProceed && (
        <p className="text-xs text-gray-400 mb-4">Add at least one place to continue.</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 bg-spotlight hover:bg-spotlight/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Next
        </button>
      </div>
    </div>
  );
}
