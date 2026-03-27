// PostShowNotes.jsx — wrap-up notes after the show closes

import React, { useState, useEffect } from 'react'

function SavedTextArea({ label, fieldPath, initialValue, save }) {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => { setVal(initialValue || '') }, [initialValue])
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={val} rows={6} onChange={(e) => { setVal(e.target.value); save(fieldPath, e.target.value) }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y" />
    </div>
  )
}

export default function PostShowNotes({ show, save }) {
  const p = show.postShow || {}

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Post-Show Notes
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SavedTextArea label="Things That Worked"  fieldPath="postShow.worked"          initialValue={p.worked}          save={save} />
        <SavedTextArea label="Things to Improve"   fieldPath="postShow.improve"         initialValue={p.improve}         save={save} />
        <SavedTextArea label="Materials to Save"   fieldPath="postShow.materialsToSave" initialValue={p.materialsToSave} save={save} />
      </div>
    </div>
  )
}
