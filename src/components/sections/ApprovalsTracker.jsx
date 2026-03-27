// ApprovalsTracker.jsx — track items that need Hillary's approval

import React from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

export default function ApprovalsTracker({ show }) {
  const approvals = show.approvals || []

  async function saveApprovals(updated) {
    await updateDoc(doc(db, 'shows', show.id), {
      approvals:  updated,
      updatedAt:  serverTimestamp(),
    })
  }

  function updateRow(index, key, value) {
    saveApprovals(approvals.map((a, i) => i === index ? { ...a, [key]: value } : a))
  }

  function addRow() {
    saveApprovals([...approvals, { item: '', sentToHillary: false, approved: false, notes: '' }])
  }

  function removeRow(index) {
    if (!window.confirm('Remove this row?')) return
    saveApprovals(approvals.filter((_, i) => i !== index))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Approvals Tracker
      </h2>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[560px] px-2">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="pb-2 pl-2 pr-3">Item</th>
              <th className="pb-2 px-3 text-center w-28">Sent to Hillary</th>
              <th className="pb-2 px-3 text-center w-24">Approved</th>
              <th className="pb-2 px-3">Notes</th>
              <th className="pb-2 pl-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {approvals.map((a, i) => (
              <tr key={i}>
                <td className="py-2 pl-2 pr-3">
                  <input type="text" value={a.item || ''} onChange={(e) => updateRow(i, 'item', e.target.value)}
                    placeholder="Item"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
                </td>
                <td className="py-2 px-3 text-center">
                  <input type="checkbox" checked={a.sentToHillary || false} onChange={(e) => updateRow(i, 'sentToHillary', e.target.checked)}
                    className="w-5 h-5 accent-amber-500 cursor-pointer" />
                </td>
                <td className="py-2 px-3 text-center">
                  <input type="checkbox" checked={a.approved || false} onChange={(e) => updateRow(i, 'approved', e.target.checked)}
                    className="w-5 h-5 accent-green-500 cursor-pointer" />
                </td>
                <td className="py-2 px-3">
                  <input type="text" value={a.notes || ''} onChange={(e) => updateRow(i, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
                </td>
                <td className="py-2 pl-3">
                  <button onClick={() => removeRow(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {approvals.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No approval items yet. Add a row to get started.</p>
      )}

      <button onClick={addRow}
        className="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">
        + Add Row
      </button>
    </div>
  )
}
