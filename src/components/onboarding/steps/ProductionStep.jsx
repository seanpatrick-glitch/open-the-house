// ProductionStep.jsx — Onboarding wizard Step 3 (Production). Placeholder
// shell built in Unit 1; real content (CreateProductionForm reuse) built in Unit 4.

import React from 'react'

export default function ProductionStep({ onNext, onBack }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Set up your production</h2>
      <p className="text-gray-500 text-sm mb-6">Coming soon.</p>
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
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Next
        </button>
      </div>
    </div>
  )
}
