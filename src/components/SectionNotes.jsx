// SectionNotes.jsx — lets collaborators add notes to any section.
// Admins can see all notes, reply to them, and mark them resolved.

import React, { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const SECTION_LABELS = {
  'show-info':  'Show Info',
  'timeline':   'Timeline',
  'phase1':     'Phase 1',
  'phase2':     'Phase 2',
  'phase3':     'Phase 3',
  'phase4':     'Phase 4',
  'volunteers': 'Volunteers',
  'approvals':  'Approvals',
  'orders':     'Orders',
  'files':      'Files',
  'post-show':  'Post-Show',
}

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function SectionNotes({ showId, section }) {
  const { currentUser, userProfile, isAdmin } = useAuth()
  const [notes,        setNotes]        = useState([])
  const [newText,      setNewText]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [replyingTo,   setReplyingTo]   = useState(null)  // noteId
  const [replyText,    setReplyText]    = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const notesRef = collection(db, 'shows', showId, 'notes')

  useEffect(() => {
    const q = query(notesRef, orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [showId])

  const sectionNotes = notes.filter(n => n.section === section)
  const open     = sectionNotes.filter(n => n.status !== 'resolved')
  const resolved = sectionNotes.filter(n => n.status === 'resolved')

  async function submitNote() {
    const text = newText.trim()
    if (!text) return
    setSubmitting(true)
    try {
      await addDoc(notesRef, {
        section,
        text,
        authorId:   currentUser.uid,
        authorName: userProfile?.name || currentUser.email,
        status:     'open',
        replies:    [],
        createdAt:  serverTimestamp(),
      })
      setNewText('')
    } catch (err) {
      toast.error('Could not save note.')
      console.error(err)
    }
    setSubmitting(false)
  }

  async function submitReply(noteId) {
    const text = replyText.trim()
    if (!text) return
    const noteDoc = doc(db, 'shows', showId, 'notes', noteId)
    const target = notes.find(n => n.id === noteId)
    const updatedReplies = [
      ...(target?.replies || []),
      {
        text,
        authorId:   currentUser.uid,
        authorName: userProfile?.name || currentUser.email,
        createdAt:  new Date().toISOString(),
      }
    ]
    try {
      await updateDoc(noteDoc, { replies: updatedReplies })
      setReplyingTo(null)
      setReplyText('')
    } catch (err) {
      toast.error('Could not save reply.')
    }
  }

  async function resolveNote(noteId) {
    const noteDoc = doc(db, 'shows', showId, 'notes', noteId)
    try {
      await updateDoc(noteDoc, {
        status:     'resolved',
        resolvedBy: userProfile?.name || currentUser.email,
        resolvedAt: serverTimestamp(),
      })
    } catch (err) {
      toast.error('Could not resolve note.')
    }
  }

  async function reopenNote(noteId) {
    const noteDoc = doc(db, 'shows', showId, 'notes', noteId)
    try {
      await updateDoc(noteDoc, { status: 'open', resolvedBy: null, resolvedAt: null })
    } catch (err) {
      toast.error('Could not reopen note.')
    }
  }

  async function acknowledgeNote(noteId) {
    const noteDoc = doc(db, 'shows', showId, 'notes', noteId)
    try {
      await updateDoc(noteDoc, { status: 'acknowledged' })
    } catch (err) {
      toast.error('Could not acknowledge note.')
    }
  }

  const admin = isAdmin()

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          Notes
          {open.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {open.length}
            </span>
          )}
        </h4>
        {resolved.length > 0 && (
          <button
            onClick={() => setShowResolved(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showResolved ? 'Hide resolved' : `Show ${resolved.length} resolved`}
          </button>
        )}
      </div>

      {/* Open notes */}
      {open.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-3">No open notes for this section.</p>
      )}

      <div className="space-y-3 mb-4">
        {open.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            admin={admin}
            replyingTo={replyingTo}
            replyText={replyText}
            setReplyingTo={setReplyingTo}
            setReplyText={setReplyText}
            onReply={submitReply}
            onResolve={resolveNote}
            onAcknowledge={acknowledgeNote}
          />
        ))}

        {showResolved && resolved.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            admin={admin}
            replyingTo={replyingTo}
            replyText={replyText}
            setReplyingTo={setReplyingTo}
            setReplyText={setReplyText}
            onReply={submitReply}
            onReopen={reopenNote}
            resolved
          />
        ))}
      </div>

      {/* Add note — available to everyone */}
      <div className="flex gap-2 items-start">
        <textarea
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitNote() } }}
          placeholder={`Add a note to ${SECTION_LABELS[section] || section}…`}
          rows={2}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
        <button
          onClick={submitNote}
          disabled={submitting || !newText.trim()}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function NoteCard({ note, admin, replyingTo, replyText, setReplyingTo, setReplyText, onReply, onResolve, onAcknowledge, onReopen, resolved }) {
  const statusColors = {
    open:         'bg-amber-50 border-amber-200',
    acknowledged: 'bg-blue-50 border-blue-200',
    resolved:     'bg-green-50 border-green-200',
  }

  const statusBadge = {
    open:         <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Open</span>,
    acknowledged: <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Acknowledged</span>,
    resolved:     <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Resolved</span>,
  }

  return (
    <div className={`rounded-lg border p-3 ${statusColors[note.status] || statusColors.open}`}>
      {/* Note header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">{note.authorName}</span>
          <span className="text-xs text-gray-400">{timeAgo(note.createdAt)}</span>
          {statusBadge[note.status]}
        </div>

        {/* Admin actions */}
        {admin && !resolved && (
          <div className="flex gap-1.5 flex-shrink-0">
            {note.status === 'open' && (
              <button
                onClick={() => onAcknowledge(note.id)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Acknowledge
              </button>
            )}
            <button
              onClick={() => onResolve(note.id)}
              className="text-xs text-green-600 hover:text-green-800 font-medium"
            >
              Resolve
            </button>
            <button
              onClick={() => setReplyingTo(replyingTo === note.id ? null : note.id)}
              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
            >
              Reply
            </button>
          </div>
        )}
        {admin && resolved && (
          <button
            onClick={() => onReopen(note.id)}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium flex-shrink-0"
          >
            Reopen
          </button>
        )}
      </div>

      {/* Note text */}
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>

      {/* Replies */}
      {note.replies?.length > 0 && (
        <div className="mt-2 space-y-2 pl-3 border-l-2 border-gray-200">
          {note.replies.map((r, i) => (
            <div key={i}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">{r.authorName}</span>
                <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resolved by */}
      {note.status === 'resolved' && note.resolvedBy && (
        <p className="text-xs text-green-600 mt-2">Resolved by {note.resolvedBy}</p>
      )}

      {/* Reply input (admin only) */}
      {admin && replyingTo === note.id && (
        <div className="mt-2 flex gap-2 items-start">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            autoFocus
            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onReply(note.id)}
              disabled={!replyText.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-40"
            >
              Send
            </button>
            <button
              onClick={() => { setReplyingTo(null); setReplyText('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
