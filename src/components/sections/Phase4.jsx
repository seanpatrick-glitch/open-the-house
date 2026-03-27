// Phase4.jsx — 1 Week Out / Install Week

import React, { useState, useEffect } from 'react'

const CHECKLIST = [
  'Lobby setup complete',
  'Signage printed and placed',
  'Drink station ready',
  'Volunteer assignments confirmed',
  'Concessions ready',
]

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer group select-none">
      <input type="checkbox" checked={checked || false} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 accent-amber-500 cursor-pointer flex-shrink-0" />
      <span className={`text-sm leading-relaxed ${checked ? 'line-through text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}`}>
        {label}
      </span>
    </label>
  )
}

function SavedField({ label, note, fieldPath, initialValue, save, multiline = false }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  const cls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {note && <span className="text-gray-400 font-normal text-xs">({note})</span>}
      </label>
      {multiline
        ? <textarea value={val} rows={4} onChange={(e) => { setVal(e.target.value); save(fieldPath, e.target.value) }} className={cls + ' resize-y'} />
        : <input    value={val}          onChange={(e) => { setVal(e.target.value); save(fieldPath, e.target.value) }} className={cls} />
      }
    </div>
  )
}

export default function Phase4({ show, save }) {
  const checklist = show.phase4Checklist || {}
  const fields    = show.phase4Fields    || {}

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">Phase 4</span>
        <h2 className="text-xl font-bold text-gray-900">1 Week Out — Install Week</h2>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Checklist</h3>
        <div className="divide-y divide-gray-50">
          {CHECKLIST.map((item, i) => (
            <Checkbox key={i} label={item} checked={checklist[`item${i}`]}
              onChange={(v) => save(`phase4Checklist.item${i}`, v)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SavedField
          label="Install Days"
          note="Mon/Tues ideal — between classes and rehearsals"
          fieldPath="phase4Fields.installDays"
          initialValue={fields.installDays}
          save={save}
        />
        <SavedField
          label="Install Notes"
          fieldPath="phase4Fields.installNotes"
          initialValue={fields.installNotes}
          save={save}
          multiline
        />
      </div>
    </div>
  )
}
