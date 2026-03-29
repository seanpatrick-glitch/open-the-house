// ShowInfo.jsx — Show Information section

import React, { useState, useEffect } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'
import {
  loadGIS,
  requestAccessToken,
  calcPhaseDates,
  syncShowToCalendar,
  pullCalendarDates,
} from '../../utils/googleCalendar'

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

const PHASE_LABELS = {
  phase1:  'Phase 1 — Planning & Alignment',
  phase2:  'Phase 2 — Resource & Concept',
  phase3:  'Phase 3 — Ordering & Finalizing',
  phase4:  'Phase 4 — Install Week',
  opening: 'Opening Night',
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Google Calendar sync panel
function CalendarSync({ show }) {
  const [syncing,   setSyncing]   = useState(false)
  const [pulling,   setPulling]   = useState(false)
  const [calDates,  setCalDates]  = useState(null) // dates pulled from Google Calendar

  const eventIds  = show.calendarEventIds || {}
  const isSynced  = Object.keys(eventIds).length > 0
  const syncedAt  = show.calendarSyncedAt
  const phaseDates = show.openingDate ? calcPhaseDates(show.openingDate) : null

  async function handleSync() {
    if (!show.openingDate) {
      toast.error('Set an opening date first.')
      return
    }
    setSyncing(true)
    try {
      await loadGIS()
      const token      = await requestAccessToken()
      const newEventIds = await syncShowToCalendar(token, show, show.calendarEventIds || {})
      await updateDoc(doc(db, 'shows', show.id), {
        calendarEventIds: newEventIds,
        calendarSyncedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Synced to Google Calendar!')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Calendar sync failed.')
    }
    setSyncing(false)
  }

  async function handlePull() {
    if (!isSynced) return
    setPulling(true)
    try {
      await loadGIS()
      const token  = await requestAccessToken()
      const dates  = await pullCalendarDates(token, eventIds)
      setCalDates(dates)
      toast.success('Dates refreshed from Google Calendar.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Could not pull from calendar.')
    }
    setPulling(false)
  }

  // Dates to display: pulled calendar dates take priority, then calculated from opening date
  const displayDates = calDates || phaseDates

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-800">Google Calendar</span>
          {isSynced && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
              Synced
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isSynced && (
            <button
              onClick={handlePull}
              disabled={pulling}
              className="text-xs border border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {pulling ? 'Refreshing…' : 'Refresh from Calendar'}
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || !show.openingDate}
            title={!show.openingDate ? 'Set an opening date above first' : ''}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Syncing…' : isSynced ? 'Re-sync to Calendar' : 'Sync to Calendar'}
          </button>
        </div>
      </div>

      {!show.openingDate ? (
        <p className="text-xs text-gray-400">Set an opening date above to enable calendar sync.</p>
      ) : (
        <>
          {/* Phase date table */}
          <div className="rounded-lg border border-gray-200 overflow-hidden text-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 w-1/2">Milestone</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">
                    {calDates ? 'Date (from Google Calendar)' : 'Calculated Date'}
                  </th>
                  {isSynced && <th className="px-4 py-2 text-xs font-semibold text-gray-500 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(PHASE_LABELS).map(([key, label]) => (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{label}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {formatDate(displayDates?.[key])}
                    </td>
                    {isSynced && (
                      <td className="px-4 py-2.5">
                        {eventIds[key] && (
                          <a
                            href={`https://calendar.google.com/calendar/r/eventedit/${eventIds[key]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-600 hover:underline"
                          >
                            View
                          </a>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {syncedAt && (
            <p className="text-xs text-gray-400 mt-2">
              Last synced {new Date(syncedAt).toLocaleString()}
            </p>
          )}
        </>
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

      <CalendarSync show={show} />
    </div>
  )
}
