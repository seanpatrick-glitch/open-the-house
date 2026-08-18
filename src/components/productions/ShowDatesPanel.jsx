import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { EVENT_SCOPE } from '../../models/events'
import CreateEventForm from '../events/CreateEventForm'
import CheckInView from '../checkin/CheckInView'

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// Show dates are events scoped to this specific production (EVENT_SCOPE.PRODUCTION,
// added 2026-08-18 — see models/events.js) — this is how a Check-In-able performance
// date is distinguished from a general org/department event, reusing the same
// events collection and CreateEventForm rather than a new collection or form.
// Only admin/secondaryAdmin can create one (matches firestore.rules, which has
// no Department Head clause for scope 'production'), but any org member can view
// the list and open Check-In for a date, same read/check-in access level as before.
export default function ShowDatesPanel({ production }) {
  const { userProfile } = useAuth()
  const orgId = userProfile.orgId
  const canManage = userProfile.role === 'admin' || userProfile.role === 'secondaryAdmin'

  const [showDates, setShowDates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [selectedShowDate, setSelectedShowDate] = useState(null)

  // Reuses the events(orgId, startDate) composite index already deployed for
  // TimelineView's org-wide query (2026-08-16) — filtered client-side to this
  // production, the same "avoid a new composite index" pattern already used
  // for this production's Tasks and Roster sections just above this panel.
  useEffect(() => {
    if (!orgId) return
    const q = query(collection(db, 'events'), where('orgId', '==', orgId), orderBy('startDate', 'asc'))
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setShowDates(all.filter(e => e.scope === EVENT_SCOPE.PRODUCTION && e.production === production.id))
      setLoading(false)
    }, err => {
      console.error('ShowDatesPanel listener error:', err)
      setLoading(false)
    })
    return unsub
  }, [orgId, production.id])

  if (selectedShowDate) {
    return (
      <CheckInView
        production={production}
        event={selectedShowDate}
        onBack={() => setSelectedShowDate(null)}
      />
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Show Dates</h2>
        {canManage && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            + Add Show Date
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4">
          <CreateEventForm
            production={production}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading show dates…</p>
      ) : showDates.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-gray-400">
            {canManage ? 'No show dates yet. Add one to open Check-In for it.' : 'No show dates yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {showDates.map(event => (
            <button
              key={event.id}
              onClick={() => setSelectedShowDate(event)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                <p className="text-xs text-gray-400">
                  {formatDate(event.startDate)}
                  {event.startTime && ` · ${event.startTime}`}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs font-medium text-indigo-600">Check-In →</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
