// ShowInfo.jsx — Show Information section

import React, { useState, useEffect, useRef } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
import toast from 'react-hot-toast'
import {
  loadGIS,
  requestAccessToken,
  calcPhaseDates,
  syncShowToCalendar,
  pullCalendarDates,
} from '../../utils/googleCalendar'

// Reusable text input that saves on its own
function Field({ label, fieldPath, initialValue, save, type = 'text', multiline = false, colSpan = '', readOnly = false }) {
  const [value, setValue] = useState(initialValue || '')

  useEffect(() => { setValue(initialValue || '') }, [initialValue])

  function handleChange(e) {
    if (readOnly) return
    setValue(e.target.value)
    save(fieldPath, e.target.value)
  }

  const inputClass = `w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none transition-shadow ${
    readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : 'focus:ring-2 focus:ring-amber-400'
  }`

  return (
    <div className={colSpan}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={handleChange} rows={3} readOnly={readOnly} className={inputClass + ' resize-y'} />
      ) : (
        <input type={type} value={value} onChange={handleChange} readOnly={readOnly} className={inputClass} />
      )}
    </div>
  )
}

// ── Logo Upload ───────────────────────────────────────────────────────────────

function LogoUpload({ show }) {
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const fileInputRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    const storagePath = `shows/${show.id}/logo_${Date.now()}_${file.name}`
    const storageRef  = ref(storage, storagePath)
    const uploadTask  = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (err) => {
        console.error(err)
        toast.error('Logo upload failed.')
        setUploading(false)
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
        await updateDoc(doc(db, 'shows', show.id), {
          logoUrl:  downloadUrl,
          logoPath: storagePath,
          updatedAt: serverTimestamp(),
        })
        toast.success('Show logo uploaded!')
        setUploading(false)
        setProgress(0)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    )
  }

  return (
    <div className="mb-6 pb-5 border-b border-gray-100">
      <label className="block text-sm font-medium text-gray-700 mb-3">Show Logo</label>
      <div className="flex items-center gap-5">
        {/* Preview or placeholder */}
        {show.logoUrl ? (
          <div className="relative flex-shrink-0">
            <img
              src={show.logoUrl}
              alt="Show logo"
              className="h-24 w-24 object-contain rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
            />
            <label
              htmlFor="logo-upload"
              className="absolute -bottom-2 -right-2 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center cursor-pointer shadow transition-colors"
              title="Replace logo"
            >
              ✎
            </label>
          </div>
        ) : (
          <label
            htmlFor="logo-upload"
            className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all flex-shrink-0"
          >
            {uploading ? (
              <div className="text-center px-2">
                <div className="text-xs text-gray-500 font-medium">{progress}%</div>
                <div className="w-12 bg-gray-200 rounded-full h-1 mt-1 mx-auto">
                  <div className="bg-amber-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <span className="text-2xl">🖼️</span>
                <span className="text-xs text-gray-400 mt-1 text-center leading-tight">Upload<br/>Logo</span>
              </>
            )}
          </label>
        )}

        <div className="text-sm text-gray-500">
          {show.logoUrl ? (
            <>
              <p className="font-medium text-gray-700">Logo uploaded</p>
              <p className="text-xs text-gray-400 mt-0.5">Displays on the dashboard show card.</p>
              <label htmlFor="logo-upload"
                className="text-xs text-amber-600 hover:underline cursor-pointer mt-1 inline-block">
                Replace logo
              </label>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-700">No logo yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Upload a show logo — it will appear on the dashboard card for this show.</p>
            </>
          )}
        </div>

        <input
          id="logo-upload"
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
    </div>
  )
}

// ── Calendar Sync ─────────────────────────────────────────────────────────────

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

function CalendarSync({ show }) {
  const [syncing,  setSyncing]  = useState(false)
  const [pulling,  setPulling]  = useState(false)
  const [calDates, setCalDates] = useState(null)

  const eventIds   = show.calendarEventIds || {}
  const isSynced   = Object.keys(eventIds).length > 0
  const syncedAt   = show.calendarSyncedAt
  const phaseDates = show.openingDate ? calcPhaseDates(show.openingDate) : null

  async function handleSync() {
    if (!show.openingDate) { toast.error('Set an opening date first.'); return }
    setSyncing(true)
    try {
      await loadGIS()
      const token       = await requestAccessToken()
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
      const token = await requestAccessToken()
      const dates = await pullCalendarDates(token, eventIds)
      setCalDates(dates)
      toast.success('Dates refreshed from Google Calendar.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Could not pull from calendar.')
    }
    setPulling(false)
  }

  const displayDates = calDates || phaseDates

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-800">Google Calendar</span>
          {isSynced && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Synced</span>
          )}
        </div>
        <div className="flex gap-2">
          {isSynced && (
            <button onClick={handlePull} disabled={pulling}
              className="text-xs border border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {pulling ? 'Refreshing…' : 'Refresh from Calendar'}
            </button>
          )}
          <button onClick={handleSync} disabled={syncing || !show.openingDate}
            title={!show.openingDate ? 'Set an opening date above first' : ''}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {syncing ? 'Syncing…' : isSynced ? 'Re-sync to Calendar' : 'Sync to Calendar'}
          </button>
        </div>
      </div>

      {!show.openingDate ? (
        <p className="text-xs text-gray-400">Set an opening date above to enable calendar sync.</p>
      ) : (
        <>
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
                    <td className="px-4 py-2.5 text-gray-600">{formatDate(displayDates?.[key])}</td>
                    {isSynced && (
                      <td className="px-4 py-2.5">
                        {eventIds[key] && (
                          <a href={`https://calendar.google.com/calendar/r/eventedit/${eventIds[key]}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-amber-600 hover:underline">
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
            <p className="text-xs text-gray-400 mt-2">Last synced {new Date(syncedAt).toLocaleString()}</p>
          )}
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ShowInfo({ show, save, readOnly }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        Show Information
      </h2>

      {/* Logo upload at the top (admin only) */}
      {!readOnly && <LogoUpload show={show} />}
      {readOnly && show.logoUrl && (
        <div className="mb-6 pb-5 border-b border-gray-100 flex items-center gap-4">
          <img src={show.logoUrl} alt="Show logo"
            className="h-20 w-20 object-contain rounded-xl border border-gray-200 bg-gray-50 shadow-sm" />
          <span className="text-sm text-gray-500">Show Logo</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Show Title"               fieldPath="title"           initialValue={show.title}          save={save} readOnly={readOnly} />
        <Field label="Opening Date"             fieldPath="openingDate"     initialValue={show.openingDate}    save={save} type="date" readOnly={readOnly} />
        <Field label="Run Dates"                fieldPath="runDates"        initialValue={show.runDates}       save={save} readOnly={readOnly} />
        <Field label="Director / Creative Lead" fieldPath="director"        initialValue={show.director}       save={save} readOnly={readOnly} />
        <Field label="Creative Vibe / Set Design Notes"
               fieldPath="creativeVibe" initialValue={show.creativeVibe} save={save} multiline colSpan="md:col-span-2" readOnly={readOnly} />
        <Field label="Special Projects (guest spellers, interactive lobby, showgrams)"
               fieldPath="specialProjects" initialValue={show.specialProjects} save={save} multiline colSpan="md:col-span-2" readOnly={readOnly} />
      </div>

      {!readOnly && <CalendarSync show={show} />}
    </div>
  )
}
