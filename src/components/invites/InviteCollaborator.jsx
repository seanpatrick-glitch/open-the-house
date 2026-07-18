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
import { sendSignInLinkToEmail } from 'firebase/auth'
import { db, auth } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const HARDCODED_ROLE = 'collaborator'

function getActionCodeSettings(orgId, inviteId) {
  return {
    url: `${window.location.origin}/join?orgId=${orgId}&inviteId=${inviteId}`,
    handleCodeInApp: true,
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '—'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function InviteCollaborator() {
  const { userProfile } = useAuth()

  const [email,       setEmail]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [invites,     setInvites]     = useState([])
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    if (!userProfile?.orgId) return

    const q = query(
      collection(db, 'organizations', userProfile.orgId, 'pendingInvites'),
      where('role', '==', HARDCODED_ROLE)
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setInvites(docs)
      setLoadingList(false)
    })

    return unsubscribe
  }, [userProfile?.orgId])

  async function handleCreateInvite(e) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter an email address.')
      return
    }

    setSubmitting(true)

    try {
      const orgSnap = await getDoc(doc(db, 'organizations', userProfile.orgId))
      if (!orgSnap.exists()) {
        toast.error('Could not read organization information. Please try again.')
        setSubmitting(false)
        return
      }
      const orgName = orgSnap.data().name

      const inviteId  = crypto.randomUUID()
      const now       = Timestamp.now()
      const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)

      await setDoc(
        doc(db, 'organizations', userProfile.orgId, 'pendingInvites', inviteId),
        {
          inviteId,
          email:     email.trim(),
          role:      HARDCODED_ROLE,
          level:     'organization',
          scopeId:   userProfile.orgId,
          orgId:     userProfile.orgId,
          orgName,
          createdBy: userProfile.uid,
          createdAt: serverTimestamp(),
          expiresAt,
          status:    'pending',
        }
      )

      await sendSignInLinkToEmail(auth, email.trim(), getActionCodeSettings(userProfile.orgId, inviteId))
      window.localStorage.setItem('emailForSignIn', email.trim())

      setEmail('')
      toast.success('Invite sent to ' + email.trim())
    } catch (err) {
      toast.error('Could not send invite. Please try again.')
      console.error(err)
    }

    setSubmitting(false)
  }

  async function handleRevoke(inviteId) {
    try {
      await deleteDoc(doc(db, 'organizations', userProfile.orgId, 'pendingInvites', inviteId))
      toast.success('Invite revoked.')
    } catch (err) {
      toast.error('Could not revoke invite. Please try again.')
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite a collaborator</h1>
        <p className="text-gray-500 text-sm mt-1">
          Send an email invite. The person will receive a secure sign-in link.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Send invite</h2>
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
            {submitting ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sent invites</h2>

        {loadingList ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-gray-400 text-sm">No invites sent yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {invites.map((invite) => (
              <li key={invite.inviteId} className="py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                  <button
                    onClick={() => handleRevoke(invite.inviteId)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
