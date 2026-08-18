import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import CreatePlaceForm from '../components/productions/CreatePlaceForm';
import ProductionDashboard from '../components/productions/ProductionDashboard';
import toast from 'react-hot-toast';

export default function PlacesView() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;

  const [places, setPlaces]             = useState([]);
  const [prodCounts, setProdCounts]     = useState({});
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [productions, setProductions]   = useState([]);
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showAddPlace, setShowAddPlace] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    const loadPlaces = async () => {
      try {
        const placesSnap = await getDocs(
          collection(db, 'organizations', orgId, 'places')
        );
        const loadedPlaces = placesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPlaces(loadedPlaces);

        // Load production counts per place
        const counts = {};
        await Promise.all(loadedPlaces.map(async place => {
          const prodsSnap = await getDocs(
            collection(db, 'organizations', orgId, 'places', place.id, 'productions')
          );
          counts[place.id] = prodsSnap.size;
        }));
        setProdCounts(counts);
      } catch (err) {
        console.error('PlacesView load error:', err);
        toast.error('Could not load places. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    loadPlaces();
  }, [orgId]);

  async function handleSelectPlace(place) {
    setSelectedPlace(place);
    try {
      const prodsSnap = await getDocs(
        collection(db, 'organizations', orgId, 'places', place.id, 'productions')
      );
      setProductions(prodsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('PlacesView load productions error:', err);
      toast.error('Could not load productions for this place.');
    }
  }

  function handlePlaceAdded(newPlace) {
    setPlaces(prev => [...prev, newPlace]);
    setProdCounts(prev => ({ ...prev, [newPlace.id]: 0 }));
    setShowAddPlace(false);
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading places...</div>;
  }

  // Production workspace — drilled into from a place's production list below.
  // Same component ProductionsView.jsx opens; Check-In for a specific show
  // date now lives inside it (see ShowDatesPanel), which is the reason this
  // view needed a real click-through into a production at all (2026-08-18).
  if (selectedProduction) {
    return (
      <ProductionDashboard
        production={selectedProduction}
        places={places}
        onBack={() => setSelectedProduction(null)}
        backLabel={selectedPlace?.name ?? 'Places'}
      />
    );
  }

  // Place detail view
  if (selectedPlace) {
    return (
      <div className="p-6 max-w-3xl">
        <button
          onClick={() => { setSelectedPlace(null); setProductions([]); }}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
        >
          ← Back to Places
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{selectedPlace.name}</h1>
            <p className="text-sm text-gray-500">
              {productions.length} production{productions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {productions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-500 text-sm mb-1">No productions at this place yet.</p>
            <p className="text-gray-400 text-sm">Add a production from the Productions section.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {productions.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => setSelectedProduction(prod)}
                  className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{prod.name}</p>
                      {prod.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{prod.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {prod.openDate && (
                        <p className="text-xs text-gray-500">Opens {formatDate(prod.openDate)}</p>
                      )}
                      {prod.closeDate && (
                        <p className="text-xs text-gray-400">Closes {formatDate(prod.closeDate)}</p>
                      )}
                    </div>
                  </div>

                  {/* Active modules */}
                  {prod.activeModules && Object.keys(prod.activeModules).some(k => prod.activeModules[k]) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(prod.activeModules)
                        .filter(([, v]) => v)
                        .map(([k]) => (
                          <span key={k} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-600 capitalize">
                            {k}
                          </span>
                        ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Place list view
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Places</h1>
          <p className="text-sm text-gray-500">Your venues and the productions happening in them.</p>
        </div>
        <button
          onClick={() => setShowAddPlace(s => !s)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Add a Place
        </button>
      </div>

      {showAddPlace && (
        <div className="mb-6">
          <CreatePlaceForm
            onSuccess={handlePlaceAdded}
            onCancel={() => setShowAddPlace(false)}
          />
        </div>
      )}

      {places.length === 0 && !showAddPlace ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-1">No places yet.</p>
          <p className="text-gray-400 text-sm">Add your first venue to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {places.map(place => {
            const count = prodCounts[place.id] ?? 0;
            return (
              <button
                key={place.id}
                onClick={() => handleSelectPlace(place)}
                className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-semibold text-gray-900 mb-1">{place.name}</p>
                <p className="text-xs text-gray-400">
                  {count} production{count !== 1 ? 's' : ''}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
