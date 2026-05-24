import React from 'react'

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

// Explicit key order so the grid is always consistent regardless of
// Firestore document field order.
const MODULE_KEYS = [
  'fohPrep',
  'lobbyInstall',
  'barProgram',
  'volunteerScheduling',
  'inventory',
  'promo',
]

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

// ── ProductionDashboard ───────────────────────────────────────────────────────

export default function ProductionDashboard({ production, places, onBack }) {
  const placeMap  = Object.fromEntries(places.map(p => [p.id, p.name]))
  const placeName = placeMap[production.placeId] ?? '—'

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Productions
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{production.name}</h1>
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
              STATUS_STYLES[production.status] ?? STATUS_STYLES['planning']
            }`}
          >
            {STATUS_LABELS[production.status] ?? production.status}
          </span>
        </div>
        <p className="text-sm text-gray-400">{production.displayLabel}</p>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <span>📍</span>
          <span>{placeName}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span>📅</span>
          <span>{formatDate(production.startDate)} – {formatDate(production.endDate)}</span>
        </span>
      </div>

      {/* Active Modules */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Active Modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MODULE_KEYS.map(key => {
            const isActive = production.activeModules?.[key] ?? false
            return (
              <div
                key={key}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                  isActive
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* Active / inactive indicator dot */}
                <span
                  className={`flex-shrink-0 w-2 h-2 rounded-full ${
                    isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    isActive ? 'text-amber-800' : 'text-gray-400'
                  }`}
                >
                  {MODULE_LABELS[key]}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Placeholder content area */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-16 text-center">
        <p className="text-sm text-gray-400">Production dashboard content coming soon.</p>
      </div>

    </div>
  )
}
