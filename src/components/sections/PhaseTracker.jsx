// PhaseTracker.jsx — the four-phase visual step indicator

import React from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

const PHASES = [
  { num: 1, label: 'Planning & Alignment',     sub: '4–6 Weeks Out' },
  { num: 2, label: 'Resource & Concept',        sub: '3 Weeks Out' },
  { num: 3, label: 'Ordering & Finalizing',     sub: '2 Weeks Out' },
  { num: 4, label: 'Install Week',              sub: '1 Week Out' },
]

export default function PhaseTracker({ show, save }) {
  const current    = show.currentPhase   || 1
  const startDates = show.phaseStartDates || {}

  async function setPhase(num) {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
    // Record start date the first time each phase is activated
    const newDates = { ...startDates }
    if (!newDates[num]) newDates[num] = today

    // Save both fields immediately (no debounce needed for phase clicks)
    await updateDoc(doc(db, 'shows', show.id), {
      currentPhase:    num,
      phaseStartDates: newDates,
      updatedAt:       serverTimestamp(),
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Timeline Phase Tracker
      </h2>

      <div className="flex flex-col sm:flex-row gap-3">
        {PHASES.map((phase) => {
          const isPast    = current > phase.num
          const isCurrent = current === phase.num
          const isFuture  = current < phase.num

          return (
            <button
              key={phase.num}
              onClick={() => setPhase(phase.num)}
              className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
                isCurrent ? 'border-amber-500 bg-amber-50 shadow-sm'
                : isPast  ? 'border-green-300 bg-green-50'
                :            'border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/30'
              }`}
            >
              {/* Phase number bubble */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isCurrent ? 'bg-amber-500 text-white'
                  : isPast  ? 'bg-green-400 text-white'
                  :            'bg-gray-200 text-gray-500'
                }`}>
                  {isPast ? '✓' : phase.num}
                </span>
                {isCurrent && (
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Active</span>
                )}
              </div>

              <div className="text-sm font-semibold text-gray-900">{phase.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{phase.sub}</div>

              {startDates[phase.num] && (
                <div className="text-xs text-amber-600 mt-1.5 font-medium">
                  Started {startDates[phase.num]}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Click any phase to mark it active. Start dates are recorded automatically.
      </p>
    </div>
  )
}
