import React, { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'

// ── PlaceholderCard ───────────────────────────────────────────────────────────

function PlaceholderCard({ title }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
      <h2 className="text-base font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-400">Coming soon.</p>
    </div>
  )
}

// ── DepartmentDetail ──────────────────────────────────────────────────────────

export default function DepartmentDetail({ department, onBack }) {
  const [headEmail,   setHeadEmail]   = useState(null)
  const [headLoading, setHeadLoading] = useState(true)

  // Look up the department head's email from users/{departmentHeadUid}
  useEffect(() => {
    async function fetchHead() {
      try {
        const snap = await getDoc(doc(db, 'users', department.departmentHeadUid))
        setHeadEmail(snap.exists() ? snap.data().email : null)
      } catch (err) {
        console.error('DepartmentDetail fetchHead:', err)
        setHeadEmail(null)
      } finally {
        setHeadLoading(false)
      }
    }

    if (department.departmentHeadUid) {
      fetchHead()
    } else {
      setHeadLoading(false)
    }
  }, [department.departmentHeadUid])

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Departments
      </button>

      {/* Header card — colored left border accent */}
      <div
        className="bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm px-6 py-5"
        style={{ borderLeftColor: department.colorCode ?? '#f59e0b' }}
      >
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          {department.name}
        </h1>
        {department.description && (
          <p className="text-sm text-gray-500 mt-1">{department.description}</p>
        )}
      </div>

      {/* Info row */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">

          {/* Department head */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Department Head
            </span>
            <span className="text-sm text-gray-900">
              {headLoading ? 'Loading…' : (headEmail ?? 'Unknown')}
            </span>
          </div>

          {/* Active status badge */}
          {department.active ? (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              Active
            </span>
          ) : (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
              Inactive
            </span>
          )}

        </div>
      </div>

      {/* Placeholder sections */}
      <PlaceholderCard title="Places" />
      <PlaceholderCard title="People" />
      <PlaceholderCard title="Timeline" />

    </div>
  )
}
