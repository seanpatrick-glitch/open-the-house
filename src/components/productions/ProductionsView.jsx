import React, { useState, useEffect } from 'react'
import { collection, collectionGroup, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import CreatePlaceForm from './CreatePlaceForm'
import CreateProductionForm from './CreateProductionForm'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  'planning':    'bg-gray-100 text-gray-600',
  'in-progress': 'bg-amber-100 text-amber-700',
  'open':        'bg-green-100 text-green-700',
  'closed':      'bg-gray-100 text-gray-500',
}

const STATUS_LABELS = {
  'planning':    'Planning',
  'in-progress': 'In Progress',
  'open':        'Open',
  'closed':      'Closed',
}

const MODULE_LABELS = {
  fohPrep:             'FOH Prep',
  lobbyInstall:        'Lobby Install',
  barProgram:          'Bar Program',
  volunteerScheduling: 'Volunteers',
  inventory:           'Inventory',
  promo:               'Promo',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day:   'numeric',
    year:  'numeric',
  })
}

// ── ProductionCard ────────────────────────────────────────────────────────────

function ProductionCard({ prod, placeName, onOpen }) {
  const activeModuleKeys = prod.activeModules
    ? Object.entries(prod.activeModules)
        .filter(([, active]) => active)
        .map(([key]) => key)
    : []

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">

        {/* Left: all metadata */}
        <div className="flex-1 min-w-0">

          {/* Name + status badge */}
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900 truncate">{prod.name}</p>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                STATUS_STYLES[prod.status] ?? STATUS_STYLES['planning']
              }`}
            >
              {STATUS_LABELS[prod.status] ?? prod.status}
            </span>
          </div>

          {/* Display label */}
          <p className="text-xs text-gray-400 mb-3">{prod.displayLabel}</p>

          {/* Place + date range */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500 mb-3">
            <span className="flex items-center gap-1">
              <span>📍</span>
              <span>{placeName}</span>
            </span>
            <span className="flex items-center gap-1">
              <span>📅</span>
              <span>{formatDate(prod.startDate)} – {formatDate(prod.endDate)}</span>
            </span>
          </div>

          {/* Active module pills — only rendered when at least one module is on */}
          {activeModuleKeys.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeModuleKeys.map(key => (
                <span
                  key={key}
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                >
                  {MODULE_LABELS[key] ?? key}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Right: Open button */}
        <button
          onClick={onOpen}
          className="flex-shrink-0 self-center text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors whitespace-nowrap"
        >
          Open →
        </button>

      </div>
    </div>
  )
}

// ── ProductionsView ───────────────────────────────────────────────────────────

export default function ProductionsView() {
  const { userProfile } = useAuth()
  const { orgId } = userProfile

  const [places,             setPlaces]             = useState([])
  const [placesLoading,      setPlacesLoading]      = useState(true)
  const [productions,        setProductions]        = useState([])
  const [productionsLoading, setProductionsLoading] = useState(true)
  const [showPlaceForm,      setShowPlaceForm]      = useState(false)
  const [showProdForm,       setShowProdForm]       = useState(false)
  const [toast,              setToast]              = useState('')

  function fireToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

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

  // Real-time listener for all productions in this org.
  // Waits until places have settled so the placeMap is ready for card rendering.
  // Productions store orgId, so the query is scoped without enumerating places.
  useEffect(() => {
    if (placesLoading) return
    const q = query(
      collectionGroup(db, 'productions'),
      where('orgId', '==', orgId)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProductions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setProductionsLoading(false)
      },
      (err) => {
        console.error('ProductionsView productions listener:', err)
        setProductionsLoading(false)
      }
    )
    return unsub
  }, [orgId, placesLoading])

  // placeId → place name lookup map for card rendering
  const placeMap = Object.fromEntries(places.map(p => [p.id, p.name]))

  // ── Full-page loading ───────────────────────────────────────────────────────
  if (placesLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  // ── No places exist yet ─────────────────────────────────────────────────────
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

  // ── Places exist ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6 max-w-4xl">

        {/* Header — Create Production always visible when places exist */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Productions</h1>
          <button
            onClick={() => setShowProdForm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            + Create Production
          </button>
        </div>

        {/* Inline create-production form */}
        {showProdForm && (
          <CreateProductionForm
            places={places}
            onSuccess={() => setShowProdForm(false)}
            onCancel={() => setShowProdForm(false)}
          />
        )}

        {/* Productions list / loading / empty state */}
        {productionsLoading ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-sm text-gray-400">Loading productions…</p>
          </div>
        ) : productions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
            <p className="text-gray-500 text-sm">No productions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {productions.map(prod => (
              <ProductionCard
                key={prod.id}
                prod={prod}
                placeName={placeMap[prod.placeId] ?? '—'}
                onOpen={() => fireToast('Production dashboard coming in Step 3.')}
              />
            ))}
          </div>
        )}

      </div>

      {/* Toast — fixed bottom-right, auto-dismisses after 3 s */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
