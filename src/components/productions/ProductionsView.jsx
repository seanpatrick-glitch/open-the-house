import React, { useState, useEffect } from 'react'
import { collection, collectionGroup, query, where, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import CreatePlaceForm from './CreatePlaceForm'
import CreateProductionForm from './CreateProductionForm'

export default function ProductionsView() {
  const { userProfile } = useAuth()
  const { orgId } = userProfile

  const [places,         setPlaces]         = useState([])
  const [placesLoading,  setPlacesLoading]  = useState(true)
  const [hasProductions, setHasProductions] = useState(false)
  const [showPlaceForm,  setShowPlaceForm]  = useState(false)
  const [showProdForm,   setShowProdForm]   = useState(false)

  // Real-time listener for all places in this org
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'places'),
      (snap) => {
        setPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setPlacesLoading(false)
      },
      (err) => {
        console.error('ProductionsView places listener:', err)
        setPlacesLoading(false)
      }
    )
    return unsub
  }, [orgId])

  // Check whether any productions exist under this org using a collection group query.
  // Productions store orgId so this query can be scoped without needing to enumerate places.
  useEffect(() => {
    if (placesLoading || places.length === 0) {
      setHasProductions(false)
      return
    }
    const q = query(
      collectionGroup(db, 'productions'),
      where('orgId', '==', orgId),
      limit(1)
    )
    const unsub = onSnapshot(q, (snap) => {
      setHasProductions(!snap.empty)
    })
    return unsub
  }, [orgId, places, placesLoading])

  if (placesLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  // ── No places exist yet ───────────────────────────────────────────────────
  if (places.length === 0) {
    return (
      <div className="space-y-6 max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900">Productions</h1>

        {showPlaceForm ? (
          <CreatePlaceForm
            onSuccess={() => setShowPlaceForm(false)}
            onCancel={() => setShowPlaceForm(false)}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
            <p className="text-gray-500 text-sm mb-4">No places added yet.</p>
            <button
              onClick={() => setShowPlaceForm(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Add a Place
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Places exist ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Productions</h1>
        {!showProdForm && (
          <button
            onClick={() => setShowProdForm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            + Create Production
          </button>
        )}
      </div>

      {/* Inline create-production form */}
      {showProdForm && (
        <CreateProductionForm
          places={places}
          onSuccess={() => setShowProdForm(false)}
          onCancel={() => setShowProdForm(false)}
        />
      )}

      {/* Empty state — shown when no form is open and no productions exist yet */}
      {!showProdForm && !hasProductions && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-gray-500 text-sm mb-4">No productions yet.</p>
          <button
            onClick={() => setShowProdForm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Create Production
          </button>
        </div>
      )}

    </div>
  )
}
