// ShowTracker.jsx — the main show prep page. One long scrollable page.

import React, { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useParams } from 'react-router-dom'
import Navbar from './Navbar'
import { useAutoSave } from '../hooks/useAutoSave'
import { useAuth } from '../contexts/AuthContext'
import SectionNotes from './SectionNotes'

import ShowInfo        from './sections/ShowInfo'
import PhaseTracker    from './sections/PhaseTracker'
import Phase1          from './sections/Phase1'
import Phase2          from './sections/Phase2'
import Phase3          from './sections/Phase3'
import Phase4          from './sections/Phase4'
import Volunteers      from './sections/Volunteers'
import ApprovalsTracker from './sections/ApprovalsTracker'
import OrdersTracker   from './sections/OrdersTracker'
import FileUploads     from './sections/FileUploads'
import PostShowNotes   from './sections/PostShowNotes'

// Jump-nav links for quick scrolling to any section
const NAV_LINKS = [
  ['#show-info',   'Show Info'],
  ['#timeline',    'Timeline'],
  ['#phase1',      'Phase 1'],
  ['#phase2',      'Phase 2'],
  ['#phase3',      'Phase 3'],
  ['#phase4',      'Phase 4'],
  ['#volunteers',  'Volunteers'],
  ['#approvals',   'Approvals'],
  ['#orders',      'Orders'],
  ['#files',       'Files'],
  ['#post-show',   'Post-Show'],
]

export default function ShowTracker() {
  const { showId } = useParams()
  const [show,    setShow]    = useState(null)
  const [loading, setLoading] = useState(true)
  const { save, saveStatus }  = useAutoSave(showId)
  const { isAdmin } = useAuth()

  const readOnly = !isAdmin()

  // onSnapshot = real-time listener. Fires whenever Firestore data changes.
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'shows', showId), (snap) => {
      if (snap.exists()) {
        setShow({ id: snap.id, ...snap.data() })
      }
      setLoading(false)
    })
    return unsubscribe
  }, [showId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        Loading show…
      </div>
    )
  }
  if (!show) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        Show not found.
      </div>
    )
  }

  const statusBar = {
    saved:   { text: '✓ All changes saved',              color: 'text-green-400' },
    saving:  { text: 'Saving…',                          color: 'text-yellow-400' },
    pending: { text: '● Unsaved changes…',               color: 'text-gray-400' },
    error:   { text: '⚠ Save failed — check connection', color: 'text-red-400' },
  }[saveStatus] || { text: '', color: '' }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navbar */}
      <Navbar title={show.title || 'Show Tracker'} backTo="/dashboard" />

      {/* Auto-save status bar (only meaningful for admin) */}
      {!readOnly && (
        <div className="bg-gray-800 text-center py-1.5">
          <span className={`text-xs font-medium ${statusBar.color}`}>
            {statusBar.text}
          </span>
        </div>
      )}

      {/* Read-only banner for collaborators */}
      {readOnly && (
        <div className="bg-blue-700 text-center py-1.5">
          <span className="text-xs font-medium text-blue-100">
            View-only — use the Notes section below each area to leave comments
          </span>
        </div>
      )}

      {/* Sticky jump navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-[52px] z-10 overflow-x-auto">
        <div className="max-w-5xl mx-auto px-4 flex gap-0.5 py-2 whitespace-nowrap">
          {NAV_LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-md hover:bg-amber-50 hover:text-amber-700 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Page content — all sections in one scroll */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-16">

        <section id="show-info">
          <ShowInfo show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="show-info" />
        </section>

        <section id="timeline">
          <PhaseTracker show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="timeline" />
        </section>

        <section id="phase1">
          <Phase1 show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="phase1" />
        </section>

        <section id="phase2">
          <Phase2 show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="phase2" />
        </section>

        <section id="phase3">
          <Phase3 show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="phase3" />
        </section>

        <section id="phase4">
          <Phase4 show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="phase4" />
        </section>

        <section id="volunteers">
          <Volunteers show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="volunteers" />
        </section>

        <section id="approvals">
          <ApprovalsTracker show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="approvals" />
        </section>

        <section id="orders">
          <OrdersTracker show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="orders" />
        </section>

        <section id="files">
          <FileUploads showId={showId} readOnly={readOnly} />
          <SectionNotes showId={showId} section="files" />
        </section>

        <section id="post-show">
          <PostShowNotes show={show} save={save} readOnly={readOnly} />
          <SectionNotes showId={showId} section="post-show" />
        </section>

      </main>
    </div>
  )
}
