import React, { useState, useEffect } from 'react'
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const HARDCODED_ROLE = 'collaborator'

function formatDate(timestamp) {
  if (!timestamp) return '—'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function InviteCollaborator() {
  const { userProfile } = useAuth()

  const [email,         setEmail]         = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [invites,       setInvites]       = useState([])
  const [loadingList,   setLoadingList]   = useState(true)

  // Live query of all invites for this venue, filtered client-side to collaborators
  useEffect(() => {
    if (!userProfile?.venueId) return

    const q = query(
      collection(db, 'invites'),
      where('venueId', '==', userProfile.venueId)
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.role === HARDCODED_ROLE)
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setInvites(docs)
      setLoadingList(false)
    })

    return unsubscribe
  }, [userProfile?.venueId])

  async function handleCreateInvite(e) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter an email address.')
      return
    }

    setSubmitting(true)
    setGeneratedLink('')

    try {
      const venueSnap = await getDoc(doc(db, 'venues', userProfile.venueId))
      if (!venueSnap.exists()) {
        toast.error('Could not read venue information. Please try again.')
        setSubmitting(false)
        return
      }
      const venueName = venueSnap.data().name

      const token     = crypto.randomUUID()
      const now       = Timestamp.now()
      const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)

      await setDoc(doc(db, 'invites', token), {
        token,
        email:     email.trim(),
        role:      HARDCODED_ROLE,
        venueId:   userProfile.venueId,
        venueName,
        createdBy: userProfile.uid,
        createdAt: serverTimestamp(),
        expiresAt,
        status:    'pending',
      })

      const link = window.location.origin + '/invite/' + token
      setGeneratedLink(link)
      setEmail('')
      toast.success('Invite created.')
    } catch (err) {
      toast.error('Could not create invite. Please try again.')
      console.error(err)
    }

    setSubmitting(false)
  }

  async function handleRevoke(token) {
    try {
      await deleteDoc(doc(db, 'invites', token))
      toast.success('Invite revoked.')
      if (generatedLink.includes(token)) setGeneratedLink('')
    } catch (err) {
      toast.error('Could not revoke invite. Please try again.')
      console.error(err)
    }
  }

  function handleCopyLink(token) {
    const link = window.location.origin + '/invite/' + token
    navigator.clipboard.writeText(link)
    toast.success('Link copied to clipboard.')
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite a collaborator</h1>
        <p className="text-gray-500 text-sm mt-1">
          Generate an invite link to share with a collaborator.
        </p>
      </div>

      {/* Create invite form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Create invite</h2>
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="collaborator@email.com"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Generating…' : 'Generate invite link'}
          </button>
        </form>

        {/* Generated link */}
        {generatedLink && (
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invite link
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 text-sm bg-gray-50 focus:outline-none"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink)
                  toast.success('Link copied to clipboard.')
                }}
                className="shrink-0 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sent invites list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sent invites</h2>

        {loadingList ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-gray-400 text-sm">No invites sent yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {invites.map((invite) => (
              <li
                key={invite.token}
                className="py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                      Collaborator
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      invite.status === 'accepted'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(invite.createdAt)}</p>
                </div>

                {invite.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyLink(invite.token)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Copy link
                    </button>
                    <button
                      onClick={() => handleRevoke(invite.token)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
