// OrdersTracker.jsx — track orders for each show

import React from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

export default function OrdersTracker({ show, readOnly }) {
  const orders = show.orders || []

  async function saveOrders(updated) {
    await updateDoc(doc(db, 'shows', show.id), {
      orders:    updated,
      updatedAt: serverTimestamp(),
    })
  }

  function updateRow(index, key, value) {
    if (readOnly) return
    saveOrders(orders.map((o, i) => i === index ? { ...o, [key]: value } : o))
  }

  function addRow() {
    if (readOnly) return
    saveOrders([...orders, { item: '', vendor: '', cost: '', ordered: false, arrived: false }])
  }

  function removeRow(index) {
    if (readOnly) return
    if (!window.confirm('Remove this row?')) return
    saveOrders(orders.filter((_, i) => i !== index))
  }

  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
    readOnly
      ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'
      : 'border-gray-200 focus:ring-1 focus:ring-amber-400'
  }`

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Orders Tracker
      </h2>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[620px] px-2">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="pb-2 pl-2 pr-2">Item</th>
              <th className="pb-2 px-2">Vendor</th>
              <th className="pb-2 px-2 w-24">Cost</th>
              <th className="pb-2 px-2 text-center w-20">Ordered</th>
              <th className="pb-2 px-2 text-center w-20">Arrived</th>
              {!readOnly && <th className="pb-2 pl-2 w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o, i) => (
              <tr key={i}>
                <td className="py-2 pl-2 pr-2">
                  <input type="text" value={o.item || ''} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'item', e.target.value)}
                    placeholder="Item" className={inputCls} />
                </td>
                <td className="py-2 px-2">
                  <input type="text" value={o.vendor || ''} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'vendor', e.target.value)}
                    placeholder="Vendor" className={inputCls} />
                </td>
                <td className="py-2 px-2">
                  <input type="text" value={o.cost || ''} readOnly={readOnly}
                    onChange={(e) => updateRow(i, 'cost', e.target.value)}
                    placeholder="$0.00" className={inputCls} />
                </td>
                <td className="py-2 px-2 text-center">
                  <input type="checkbox" checked={o.ordered || false} disabled={readOnly}
                    onChange={(e) => updateRow(i, 'ordered', e.target.checked)}
                    className="w-5 h-5 accent-amber-500 cursor-pointer disabled:opacity-60 disabled:cursor-default" />
                </td>
                <td className="py-2 px-2 text-center">
                  <input type="checkbox" checked={o.arrived || false} disabled={readOnly}
                    onChange={(e) => updateRow(i, 'arrived', e.target.checked)}
                    className="w-5 h-5 accent-green-500 cursor-pointer disabled:opacity-60 disabled:cursor-default" />
                </td>
                {!readOnly && (
                  <td className="py-2 pl-2">
                    <button onClick={() => removeRow(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No orders yet.</p>
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
