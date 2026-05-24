import React, { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import CreateDepartmentForm from './CreateDepartmentForm'

// ── DepartmentRow ─────────────────────────────────────────────────────────────

function DepartmentRow({ dept }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <div className="flex items-center gap-4">

        {/* Colored dot */}
        <span
          className="flex-shrink-0 w-3 h-3 rounded-full"
          style={{ backgroundColor: dept.colorCode ?? '#f59e0b' }}
        />

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{dept.name}</p>
          {dept.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{dept.description}</p>
          )}
        </div>

        {/* Step 2 placeholder */}
        <span className="flex-shrink-0 text-xs text-gray-400">Coming soon.</span>

      </div>
    </div>
  )
}

// ── DepartmentsView ───────────────────────────────────────────────────────────

export default function DepartmentsView() {
  const { userProfile } = useAuth()
  const { orgId } = userProfile

  const [departments, setDepartments] = useState([])
  const [deptLoading, setDeptLoading] = useState(true)
  const [showForm,    setShowForm]    = useState(false)

  // Real-time listener for all departments in this org
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'departments'),
      (snap) => {
        setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setDeptLoading(false)
      },
      (err) => {
        console.error('DepartmentsView listener:', err)
        setDeptLoading(false)
      }
    )
    return unsub
  }, [orgId])

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (deptLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  // ── Empty state (no departments and form is not open) ───────────────────────
  if (departments.length === 0 && !showForm) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-gray-500 text-sm mb-4">No departments yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Create Department
          </button>
        </div>
      </div>
    )
  }

  // ── List (or form over an empty list) ───────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header — Create Department button always visible */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          + Create Department
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <CreateDepartmentForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Department list */}
      {departments.length > 0 && (
        <div className="space-y-3">
          {departments.map(dept => (
            <DepartmentRow key={dept.id} dept={dept} />
          ))}
        </div>
      )}

    </div>
  )
}
