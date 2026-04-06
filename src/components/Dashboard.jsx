// Dashboard.jsx — the main screen showing all your shows

import React, { useState, useEffect } from 'react'
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Navbar from './Navbar'

const PHASE_LABELS = {
  1: 'Phase 1 — 4–6 Weeks Out',
  2: 'Phase 2 — 3 Weeks Out',
  3: 'Phase 3 — 2 Weeks Out',
  4: 'Phase 4 — Install Week',
}

// Default data structure for a brand-new show
function newShowData() {
  return {
    title:        'New Show',
    openingDate:  '',
    runDates:     '',
    director:     '',
    creativeVibe: '',
    specialProjects: '',
    currentPhase: 1,
    phaseStartDates: {},

    phase1Checklist: {},
    phase1Fields: { lobbyConcept: '', interactiveElements: '', buildMaterials: '', volunteerNotes: '' },

    phase2Checklist: {},
    phase2Fields: { materialsAvailable: '', materialsNeeded: '', signageIdeas: '' },
    signage: [
      { id: 'concessions',         label: 'Concessions',       status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
      { id: 'specialty-cocktails', label: 'Specialty Cocktails', status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
      { id: 'merchandise',         label: 'Merchandise',        status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
      { id: 'keychain-design',     label: 'Key Chain Design',   status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
      { id: 'button-design',       label: 'Button Design',      status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
      { id: 'showgram-tags',       label: 'Showgram Tags',      status: '', fileUrl: '', filePath: '', fileName: '', fileType: '' },
    ],
    logoUrl:  '',
    logoPath: '',
    drinks: [
      { name: '', ingredients: '', instructions: '', menuVerbiage: '', finalized: false, drinkType: 'alcoholic' },
      { name: '', ingredients: '', instructions: '', menuVerbiage: '', finalized: false, drinkType: 'alcoholic' },
      { name: '', ingredients: '', instructions: '', menuVerbiage: '', finalized: false, drinkType: 'mocktail'  },
    ],
    showgrams:   { ideas: '', finalChoice: '', approvalNeeded: false, ordered: false, arrived: false },
    concessions: { inventoryCheck: false, itemsToOrder: '', ordered: false, arrived: false },

    phase3Checklist: {},
    phase4Checklist: {},
    phase4Fields: { installDays: '', installNotes: '' },

    volunteers: [
      { shift: 'Opening Night', needed: 5, filled: 0, notes: '' },
      { shift: 'Weekend 1',     needed: 5, filled: 0, notes: '' },
      { shift: 'Weekend 2',     needed: 5, filled: 0, notes: '' },
    ],
    approvals: [],
    orders:    [],
    postShow:  { worked: '', improve: '', materialsToSave: '' },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export default function Dashboard() {
  const [shows,   setShows]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadShows() }, [])

  async function loadShows() {
    try {
      const q    = query(collection(db, 'shows'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setShows(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
      toast.error('Could not load shows. Check your internet connection.')
    }
    setLoading(false)
  }

  async function addNewShow() {
    try {
      const docRef = await addDoc(collection(db, 'shows'), newShowData())
      navigate(`/show/${docRef.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Could not create show. Check your internet connection.')
    }
  }

  async function deleteShow(e, showId, showTitle) {
    e.stopPropagation() // prevent opening the show while clicking delete
    if (!window.confirm(`Delete "${showTitle}"? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, 'shows', showId))
      setShows(prev => prev.filter(s => s.id !== showId))
      toast.success('Show deleted.')
    } catch (err) {
      console.error(err)
      toast.error('Could not delete show.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Show Prep" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Shows</h2>
            <p className="text-gray-500 text-sm mt-1">Theatre South Playhouse · Front of House</p>
          </div>
          <button
            onClick={addNewShow}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-3 rounded-lg transition-colors text-sm shadow-sm"
          >
            + Add New Show
          </button>
        </div>

        {/* Show cards */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading your shows…</div>
        ) : shows.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎭</div>
            <p className="text-gray-500 text-lg font-medium">No shows yet.</p>
            <p className="text-gray-400 text-sm mt-1">Click the button above to create your first show.</p>
            <button
              onClick={addNewShow}
              className="mt-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Create Your First Show
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shows.map(show => (
              <div
                key={show.id}
                onClick={() => navigate(`/show/${show.id}`)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
              >
                {/* Logo + Title row */}
                <div className="flex items-center gap-3 mb-1">
                  {show.logoUrl && (
                    <img
                      src={show.logoUrl}
                      alt={show.title}
                      className="w-12 h-12 object-contain rounded-lg border border-gray-100 bg-gray-50 flex-shrink-0"
                    />
                  )}
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-amber-700 transition-colors truncate">
                    {show.title || 'Untitled Show'}
                  </h3>
                </div>

                {show.openingDate && (
                  <p className="text-gray-500 text-sm mt-1">
                    Opens: {show.openingDate}
                  </p>
                )}
                {show.runDates && (
                  <p className="text-gray-400 text-xs mt-0.5">{show.runDates}</p>
                )}

                <span className="inline-block mt-3 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {PHASE_LABELS[show.currentPhase] || 'Phase 1'}
                </span>

                <button
                  onClick={(e) => deleteShow(e, show.id, show.title)}
                  className="mt-4 text-xs text-red-400 hover:text-red-600 transition-colors block"
                >
                  Delete Show
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
