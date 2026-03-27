// Phase1.jsx — 4-6 Weeks Out

import React, { useState, useEffect } from 'react'

const CHECKLIST = [
  'Review special projects and lobby elements',
  'Gather creative direction and set design vibe',
  'Outline overall lobby concept',
  'Tie lobby needs into volunteer planning',
  'Post volunteer sign-ups',
  'Watch for reusable materials',
]

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer group select-none">
      <input
        type="checkbox"
        checked={checked || false}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 accent-amber-500 cursor-pointer flex-shrink-0"
      />
      <span className={`text-sm leading-relaxed transition-colors ${
        checked ? 'line-through text-gray-400' : 'text-gray-700 group-hover:text-gray-900'
      }`}>
        {label}
      </span>
    </label>
  )
}

function TextArea({ label, fieldPath, initialValue, save }) {
  const [value, setValue] = useState(initialValue || '')
  useEffect(() => { setValue(initialValue || '') }, [initialValue])
  function handleChange(e) { setValue(e.target.value); save(fieldPath, e.target.value) }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={value} onChange={handleChange} rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y" />
    </div>
  )
}

export default function Phase1({ show, save }) {
  const checklist = show.phase1Checklist || {}
  const fields    = show.phase1Fields    || {}

  function updateChecklist(index, val) {
    save(`phase1Checklist.item${index}`, val)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">Phase 1</span>
        <h2 className="text-xl font-bold text-gray-900">4–6 Weeks Out — Planning and Alignment</h2>
      </div>

      {/* Checklist */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Checklist</h3>
        <div className="divide-y divide-gray-50">
          {CHECKLIST.map((item, i) => (
            <Checkbox key={i} label={item} checked={checklist[`item${i}`]} onChange={(v) => updateChecklist(i, v)} />
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextArea label="Lobby Concept / Theme"              fieldPath="phase1Fields.lobbyConcept"       initialValue={fields.lobbyConcept}       save={save} />
        <TextArea label="Interactive Elements / Photo Op Ideas" fieldPath="phase1Fields.interactiveElements" initialValue={fields.interactiveElements} save={save} />
        <TextArea label="Build Materials to Watch For"       fieldPath="phase1Fields.buildMaterials"     initialValue={fields.buildMaterials}     save={save} />
        <TextArea label="Volunteer Needs Notes"              fieldPath="phase1Fields.volunteerNotes"     initialValue={fields.volunteerNotes}     save={save} />
      </div>
    </div>
  )
}
