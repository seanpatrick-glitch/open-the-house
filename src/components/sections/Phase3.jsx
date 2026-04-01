// Phase3.jsx — 2 Weeks Out

import React from 'react'

const CHECKLIST = [
  'Order concessions and drink supplies',
  'Order showgram or specialty items',
  'Finalize signage designs',
  'Finalize drink recipes',
  'Shop or order remaining needs',
]

function Checkbox({ label, checked, onChange, readOnly }) {
  return (
    <label className={`flex items-start gap-3 py-2.5 select-none ${readOnly ? 'cursor-default' : 'cursor-pointer group'}`}>
      <input type="checkbox" checked={checked || false}
        onChange={(e) => !readOnly && onChange(e.target.checked)}
        disabled={readOnly}
        className="mt-0.5 w-5 h-5 accent-amber-500 cursor-pointer flex-shrink-0 disabled:opacity-60" />
      <span className={`text-sm leading-relaxed ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {label}
      </span>
    </label>
  )
}

export default function Phase3({ show, save, readOnly }) {
  const checklist = show.phase3Checklist || {}

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">Phase 3</span>
        <h2 className="text-xl font-bold text-gray-900">2 Weeks Out — Ordering and Finalizing</h2>
      </div>

      <div className="divide-y divide-gray-50">
        {CHECKLIST.map((item, i) => (
          <Checkbox key={i} label={item} checked={checklist[`item${i}`]}
            onChange={(v) => save(`phase3Checklist.item${i}`, v)} readOnly={readOnly} />
        ))}
      </div>
    </div>
  )
}
