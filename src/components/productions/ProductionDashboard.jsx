import React, { useState, useEffect } from 'react'
import { doc, updateDoc, collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { getDisplayName } from '../../utils/displayName'
import TaskDetailPanel from '../timeline/TaskDetailPanel'
import VolunteersPanel from './VolunteersPanel'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  'planning':    'bg-gray-100 text-gray-600',
  'in-progress': 'bg-amber-100 text-amber-700',
  'open':        'bg-green-100 text-green-700',
  'closed':      'bg-gray-100 text-gray-500',
}

const STATUS_LABELS = {
  'planning':    'Planning',
  'in-progress': 'In Progress',
  'open':        'Open',
  'closed':      'Closed',
}

// Explicit key order so the grid is always consistent regardless of
// Firestore document field order.
// FOH Prep, Lobby Install, Bar Program, Inventory, and Promo toggles were
// removed from the UI (2026-08-17) — those modules never had real content
// behind them. Their boolean fields are left alone on existing production
// documents; only the toggles themselves are gone.
const MODULE_KEYS = [
  'volunteerScheduling',
]

const MODULE_LABELS = {
  volunteerScheduling: 'Volunteers',
}

const TASK_STATUS_STYLES = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  complete:    'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
}

const TASK_STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete:    'Complete',
  overdue:     'Overdue',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return 'No date'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day:   'numeric',
    year:  'numeric',
  })
}

// ── ProductionDashboard ───────────────────────────────────────────────────────

export default function ProductionDashboard({ production, places, onBack }) {
  const { userProfile } = useAuth()
  const orgId = userProfile.orgId

  const placeMap  = Object.fromEntries(places.map(p => [p.id, p.name]))
  const placeName = placeMap[production.placeId] ?? 'No place set'

  // Local copy of activeModules so the UI updates immediately on toggle
  // without waiting for the Firestore listener to propagate back through
  // the parent's selectedProduction snapshot.
  const [activeModules, setActiveModules] = useState(
    production.activeModules ?? {}
  )

  // Set of module keys whose Firestore write is currently in flight.
  // Prevents double-clicks on a tile while its update is pending.
  const [toggling, setToggling] = useState(new Set())

  // Tasks scoped to this production, plus the supporting data TaskDetailPanel needs.
  const [tasks,        setTasks]        = useState([])
  const [tasksLoading,  setTasksLoading]  = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [orgUsers,     setOrgUsers]     = useState([])
  const [departments,  setDepartments]  = useState({})

  // Roster: people whose assignments array includes this production.
  const [roster,        setRoster]        = useState([])
  const [rosterLoading, setRosterLoading] = useState(true)

  // Members and departments are loaded once — TaskDetailPanel reads both
  // for assignee names and department color/name display.
  useEffect(() => {
    if (!orgId) return

    getDocs(collection(db, 'organizations', orgId, 'members'))
      .then(snap => setOrgUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }))))
      .catch(err => console.error('ProductionDashboard members load error:', err))

    getDocs(query(collection(db, 'departments'), where('orgId', '==', orgId)))
      .then(snap => {
        const map = {}
        snap.docs.forEach(d => { map[d.id] = d.data() })
        setDepartments(map)
      })
      .catch(err => console.error('ProductionDashboard departments load error:', err))
  }, [orgId])

  // Tasks link to a production via the existing `production` field on the
  // task document (see models/timeline.js) — reuses the same tasks(orgId,
  // dueByDate) composite index TimelineView already queries, filtering to
  // this production client-side rather than adding a new composite index.
  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      orderBy('dueByDate', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTasks(all.filter(t => t.production === production.id))
      setTasksLoading(false)
    }, err => {
      console.error('ProductionDashboard tasks listener error:', err)
      toast.error("Could not load this production's tasks.")
      setTasksLoading(false)
    })
    return unsub
  }, [orgId, production.id])

  // Roster reuses the exact assignment shape AssignmentsPanel.jsx already
  // writes (assignments[].type === 'production', refId === production id),
  // filtered client-side the same way CheckInView's roster load does.
  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'people'),
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setRoster(all.filter(p =>
          (p.assignments || []).some(a => a.type === 'production' && a.refId === production.id)
        ))
        setRosterLoading(false)
      },
      err => {
        console.error('ProductionDashboard roster listener error:', err)
        toast.error('Could not load the roster for this production.')
        setRosterLoading(false)
      }
    )
    return unsub
  }, [orgId, production.id])

  async function toggleModule(key) {
    if (toggling.has(key)) return

    const newValue = !activeModules[key]

    // Optimistic update — flip immediately so the UI feels instant
    setActiveModules(prev => ({ ...prev, [key]: newValue }))
    setToggling(prev => new Set([...prev, key]))

    try {
      await updateDoc(
        doc(
          db,
          'organizations', userProfile.orgId,
          'places',        production.placeId,
          'productions',   production.id
        ),
        // Dot notation — only this one key is written, nothing else is touched
        { [`activeModules.${key}`]: newValue }
      )
    } catch (err) {
      console.error('ProductionDashboard toggleModule error:', err)
      toast.error('Could not update that module. Please try again.')
      // Revert the optimistic update if the write failed
      setActiveModules(prev => ({ ...prev, [key]: !newValue }))
    } finally {
      setToggling(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Productions
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{production.name}</h1>
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
              STATUS_STYLES[production.status] ?? STATUS_STYLES['planning']
            }`}
          >
            {STATUS_LABELS[production.status] ?? production.status}
          </span>
        </div>
        <p className="text-sm text-gray-400">{production.displayLabel}</p>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <span>📍</span>
          <span>{placeName}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span>📅</span>
          <span>{formatDate(production.startDate)} to {formatDate(production.endDate)}</span>
        </span>
      </div>

      {/* Active Modules */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Active Modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MODULE_KEYS.map(key => {
            const isActive   = activeModules[key] ?? false
            const isToggling = toggling.has(key)
            return (
              <button
                key={key}
                onClick={() => toggleModule(key)}
                disabled={isToggling}
                className={`
                  rounded-xl border px-4 py-3 flex items-center gap-3 w-full text-left
                  transition-colors
                  ${isActive
                    ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                    : 'bg-white border-gray-200 hover:bg-gray-50'}
                  ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                `}
              >
                {/* Active / inactive indicator dot */}
                <span
                  className={`flex-shrink-0 w-2 h-2 rounded-full transition-colors ${
                    isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-amber-800' : 'text-gray-400'
                  }`}
                >
                  {MODULE_LABELS[key]}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* This Production's Tasks */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">This Production's Tasks</h2>
        {tasksLoading ? (
          <p className="text-sm text-gray-400">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-10 text-center">
            <p className="text-sm text-gray-400">No tasks linked to this production yet.</p>
          </div>
        ) : (
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Task</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Assignee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map(task => {
                    const isSelected = selectedTask?.id === task.id
                    const assignee   = orgUsers.find(u => u.uid === task.primaryAssigneeUid)
                    return (
                      <tr key={task.id}
                        onClick={() => setSelectedTask(isSelected ? null : task)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{task.title}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {task.primaryAssigneeUid
                            ? (getDisplayName(assignee) || 'Assigned')
                            : <span className="text-gray-400">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TASK_STATUS_STYLES[task.status] || TASK_STATUS_STYLES.not_started}`}>
                            {TASK_STATUS_LABELS[task.status] || 'Not started'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {selectedTask && (
              <TaskDetailPanel
                task={selectedTask}
                orgUsers={orgUsers}
                departments={departments}
                onClose={() => setSelectedTask(null)}
              />
            )}
          </div>
        )}
      </section>

      {/* Roster */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Roster</h2>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'people' } }))}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Manage in People →
          </button>
        </div>
        {rosterLoading ? (
          <p className="text-sm text-gray-400">Loading roster…</p>
        ) : roster.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-10 text-center">
            <p className="text-sm text-gray-400">No one is assigned to this production yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {roster.map(person => (
              <div key={person.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{getDisplayName(person) || 'No name'}</p>
                  <p className="text-xs text-gray-400">{person.typeLabel}</p>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-gray-500">
                  {person.fieldValues?.email && <p className="truncate max-w-[200px]">{person.fieldValues.email}</p>}
                  {person.fieldValues?.phone && <p>{person.fieldValues.phone}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Volunteer Shifts — only when the Volunteers module is active for this production */}
      {activeModules.volunteerScheduling && (
        <VolunteersPanel production={production} roster={roster} />
      )}

    </div>
  )
}
