// Volunteers.jsx — volunteer tracking table

import React from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

export default function Volunteers({ show, readOnly }) {
  const volunteers = show.volunteers || []

  async function saveVolunteers(updated) {
    await updateDoc(doc(db, 'shows', show.id), {
      volunteers: updated,
      updatedAt:  serverTimestamp(),
    })
  }

  function updateRow(index, key, value) {
    if (readOnly) return
    const updated = volunteers.map((v, i) => i === index ? { ...v, [key]: value } : v)
    saveVolunteers(updated)
  }

  function addRow() {
    if (readOnly) return
    saveVolunteers([...volunteers, { shift: '', needed: 5, filled: 0, notes: '' }])
  }

  function removeRow(index) {
    if (readOnly) return
    if (!window.confirm('Remove this row?')) return
    saveVolunteers(volunteers.filter((_, i) => i !== index))
  }

  const inputCls = (extra = '') =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
      readOnly
        ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'
        : 'border-gray-200 focus:ring-1 focus:ring-amber-400'
    } ${extra}`

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Volunteers
      </h2>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[520px] px-2">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="pb-2 pl-2 pr-3">Shift</th>
              <th className="pb-2 px-3 text-center w-20">Needed</th>
              <th className="pb-2 px-3 text-center w-20">Filled</th>
              <th className="pb-2 px-3">Notes</th>
              {!readOnly && <th className="pb-2 pl-3 w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {volunteers.map((v, i) => (
              <tr key={i} className="group">
                <td className="py-2 pl-2 pr-3">
                  <input type="text" value={v.shift || ''} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'shift', e.target.value)}
                    placeholder="Shift name"
                    className={inputCls()} />
                </td>
                <td className="py-2 px-3">
                  <input type="number" min="0" value={v.needed ?? 5} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'needed', parseInt(e.target.value) || 0)}
                    className={inputCls('text-center')} />
                </td>
                <td className="py-2 px-3">
                  <input type="number" min="0" value={v.filled ?? 0} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'filled', parseInt(e.target.value) || 0)}
                    className={`w-full border rounded-lg px-2 py-2 text-sm text-center focus:outline-none ${
                      readOnly
                        ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'
                        : `focus:ring-1 focus:ring-amber-400 ${(v.filled || 0) >= (v.needed || 5) ? 'border-green-300 bg-green-50' : 'border-gray-200'}`
                    }`} />
                </td>
                <td className="py-2 px-3">
                  <input type="text" value={v.notes || ''} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'notes', e.target.value)}
                    placeholder="Notes"
                    className={inputCls()} />
                </td>
                {!readOnly && (
                  <td className="py-2 pl-3">
                    <button onClick={() => removeRow(i)} title="Remove row"
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {volunteers.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No volunteer shifts yet.</p>
      )}

      {!readOnly && (
        <button onClick={addRow}
          className="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">
          + Add Row
        </button>
      )}
    </div>
  )
}
