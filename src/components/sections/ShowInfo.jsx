// ShowInfo.jsx — Show Information section

import React, { useState, useEffect } from 'react'

// Reusable text input that saves on its own
function Field({ label, fieldPath, initialValue, save, type = 'text', multiline = false, colSpan = '' }) {
  const [value, setValue] = useState(initialValue || '')

  // If the show reloads (e.g. first sync), update local value
  useEffect(() => { setValue(initialValue || '') }, [initialValue])

  function handleChange(e) {
    setValue(e.target.value)
    save(fieldPath, e.target.value)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-shadow"

  return (
    <div className={colSpan}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={handleChange} rows={3} className={inputClass + ' resize-y'} />
      ) : (
        <input type={type} value={value} onChange={handleChange} className={inputClass} />
      )}
    </div>
  )
}

export default function ShowInfo({ show, save }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Show Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Show Title"              fieldPath="title"          initialValue={show.title}          save={save} />
        <Field label="Opening Date"            fieldPath="openingDate"    initialValue={show.openingDate}    save={save} type="date" />
        <Field label="Run Dates"               fieldPath="runDates"       initialValue={show.runDates}       save={save} />
        <Field label="Director / Creative Lead" fieldPath="director"      initialValue={show.director}       save={save} />
        <Field label="Creative Vibe / Set Design Notes"
               fieldPath="creativeVibe" initialValue={show.creativeVibe} save={save} multiline colSpan="md:col-span-2" />
        <Field label="Special Projects (guest spellers, interactive lobby, showgrams)"
               fieldPath="specialProjects" initialValue={show.specialProjects} save={save} multiline colSpan="md:col-span-2" />
      </div>
    </div>
  )
}
