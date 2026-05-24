import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

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
  const { userProfile } = useAuth()

  const placeMap  = Object.fromEntries(places.map(p => [p.id, p.name]))
  const placeName = placeMap[production.placeId] ?? '—'

  // Local copy of activeModules so the UI updates immediately on toggle
  // without waiting for the Firestore listener to propagate back through
  // the parent's selectedProduction snapshot.
  const [activeModules, setActiveModules] = useState(
    production.activeModules ?? {}
  )

  // Set of module keys whose Firestore write is currently in flight.
  // Prevents double-clicks on a tile while its update is pending.
  const [toggling, setToggling] = useState(new Set())

  async function toggleModule(key) {
    if (toggling.has(key)) return

    const newValue = !activeModules[key]

    // Optimistic update — flip immediately so the UI feels instant
    setActiveModules(prev => ({ ...prev, [key]: newValue }))
    setToggling(prev => new Set([...prev, key]))

    try {
      await updateDoc(
        doc(
          db,
          'organizations', userProfile.orgId,
          'places',        production.placeId,
          'productions',   production.id
        ),
        // Dot notation — only this one key is written, nothing else is touched
        { [`activeModules.${key}`]: newValue }
      )
    } catch (err) {
      console.error('ProductionDashboard toggleModule error:', err)
      // Revert the optimistic update if the write failed
      setActiveModules(prev => ({ ...prev, [key]: !newValue }))
    } finally {
      setToggling(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

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
            const isActive   = activeModules[key] ?? false
            const isToggling = toggling.has(key)
            return (
              <button
                key={key}
                onClick={() => toggleModule(key)}
                disabled={isToggling}
                className={`
                  rounded-xl border px-4 py-3 flex items-center gap-3 w-full text-left
                  transition-colors
                  ${isActive
                    ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                    : 'bg-white border-gray-200 hover:bg-gray-50'}
                  ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                `}
              >
                {/* Active / inactive indicator dot */}
                <span
                  className={`flex-shrink-0 w-2 h-2 rounded-full transition-colors ${
                    isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-amber-800' : 'text-gray-400'
                  }`}
                >
                  {MODULE_LABELS[key]}
                </span>
              </button>
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
