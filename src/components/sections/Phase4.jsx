// Phase4.jsx — 1 Week Out / Install Week

import React, { useState, useEffect } from 'react'

const CHECKLIST = [
  'Lobby setup complete',
  'Signage printed and placed',
  'Drink station ready',
  'Volunteer assignments confirmed',
  'Concessions ready',
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

function SavedField({ label, note, fieldPath, initialValue, save, multiline = false, readOnly }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  const baseCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
  const editCls = "focus:ring-2 focus:ring-amber-400"
  const roCls   = "bg-gray-50 text-gray-600 cursor-default"
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {note && <span className="text-gray-400 font-normal text-xs">({note})</span>}
      </label>
      {multiline
        ? <textarea value={val} rows={4} readOnly={readOnly}
            onChange={(e) => { if (!readOnly) { setVal(e.target.value); save(fieldPath, e.target.value) } }}
            className={`${baseCls} resize-y ${readOnly ? roCls : editCls}`} />
        : <input value={val} readOnly={readOnly}
            onChange={(e) => { if (!readOnly) { setVal(e.target.value); save(fieldPath, e.target.value) } }}
            className={`${baseCls} ${readOnly ? roCls : editCls}`} />
      }
    </div>
  )
}

export default function Phase4({ show, save, readOnly }) {
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
              onChange={(v) => save(`phase4Checklist.item${i}`, v)} readOnly={readOnly} />
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
          readOnly={readOnly}
        />
        <SavedField
          label="Install Notes"
          fieldPath="phase4Fields.installNotes"
          initialValue={fields.installNotes}
          save={save}
          multiline
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
