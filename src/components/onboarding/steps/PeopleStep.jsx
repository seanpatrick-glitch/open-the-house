// PeopleStep.jsx — Onboarding wizard Step 1 (People). Placeholder shell built
// in Unit 1; real content (roster entry, personType seeding) built in Unit 2.

import React from 'react'

export default function PeopleStep({ onNext }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Add your people</h2>
      <p className="text-gray-500 text-sm mb-6">Coming soon.</p>
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
      >
        Next
      </button>
    </div>
  )
}
