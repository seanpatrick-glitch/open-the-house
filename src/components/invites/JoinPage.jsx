import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../../firebase'

export default function JoinPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [error,  setError]  = useState('')
  const [pending, setPending] = useState(null) // { uid, email, invite, inviteRef }
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function completeSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setStatus('invalid')
        return
      }

      let email = window.localStorage.getItem('emailForSignIn')
      if (!email) {
        email = window.prompt('Please enter your email to confirm your identity.')
      }
      if (!email) {
        setStatus('invalid')
        return
      }

      const params   = new URLSearchParams(window.location.search)
      const orgId    = params.get('orgId')    || window.localStorage.getItem('orgIdForSignIn')
      const inviteId = params.get('inviteId') || window.localStorage.getItem('inviteIdForSignIn')

      try {
        const credential = await signInWithEmailLink(auth, email, window.location.href)
        window.localStorage.removeItem('emailForSignIn')
        const uid = credential.user.uid

        let inviteDoc  = null
        let invite     = null

        if (orgId && inviteId) {
          const ref  = doc(db, 'organizations', orgId, 'pendingInvites', inviteId)
          const snap = await getDoc(ref)
          if (snap.exists() && snap.data().status === 'pending') {
            inviteDoc = snap
            invite    = snap.data()
          }
        }

        if (!invite) {
          setError('No pending invite found for this email.')
          setStatus('error')
          return
        }

        const now       = Date.now()
        const expiresAt = invite.expiresAt?.toMillis?.() ?? 0
        if (now > expiresAt) {
          setError('This invite has expired. Ask your admin to send a new one.')
          setStatus('error')
          return
        }

        setPending({ uid, email, invite, inviteRef: inviteDoc.ref })
        setStatus('form')
      } catch (err) {
        console.error('JoinPage error:', err)
        setError('Something went wrong. Please try again or contact your admin.')
        setStatus('error')
      }
    }

    completeSignIn()
  }, [navigate])

  async function handleContinue() {
    if (!pending) return
    setSubmitting(true)
    const { uid, email, invite, inviteRef } = pending
    const displayName = displayNameInput.trim() || email

    try {
      const batch = writeBatch(db)

      batch.set(doc(db, 'users', uid), {
        name:      email,
        email,
        displayName,
        createdAt: serverTimestamp(),
        organizations: {
          [invite.orgId]: {
            role:     invite.role,
            level:    invite.level,
            scopeId:  invite.scopeId,
            joinedAt: serverTimestamp(),
          },
        },
      })

      batch.set(
        doc(db, 'organizations', invite.orgId, 'members', uid),
        {
          uid,
          email,
          displayName,
          role:            invite.role,
          provisionalAdmin: false,
          departmentId:    invite.departmentId ?? null,
          joinedAt:        serverTimestamp(),
          invitedBy:       null,
          accountStatus:   'confirmed',
        }
      )

      await batch.commit()
      await updateDoc(inviteRef, { status: 'accepted', acceptedByUid: uid })

      // Department Head invites: complete the department's head assignment now
      // that the invite doc shows this uid as the accepted acceptor (firestore.rules
      // scopes this write to that exact pendingInvite record).
      if (invite.role === 'departmentHead' && invite.departmentId) {
        await updateDoc(doc(db, 'departments', invite.departmentId), {
          departmentHeadUid:   uid,
          departmentHeadEmail: null,
        })
      }

      navigate('/dashboard')
    } catch (err) {
      console.error('JoinPage submit error:', err)
      setError('Something went wrong. Please try again or contact your admin.')
      setStatus('error')
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-base">Setting up your account…</p>
      </div>
    )
  }

  if (status === 'form') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🎭</div>
            <h1 className="text-xl font-bold text-gray-900">Almost there</h1>
            <p className="text-gray-500 mt-2 text-sm">You're joining as {pending.email}.</p>
          </div>

          <div className="space-y-1 mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Display name (optional — defaults to your name)
            </label>
            <input
              type="text"
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              placeholder={pending.email}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              autoFocus
            />
          </div>

          <button
            onClick={handleContinue}
            disabled={submitting}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
          >
            {submitting ? 'Setting up your account…' : 'Continue'}
          </button>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🎭</div>
          <p className="text-gray-800 font-medium">This link is not valid.</p>
          <p className="text-gray-500 text-sm mt-2">Ask your admin to send a new invite.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🎭</div>
          <p className="text-gray-800 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return null
}
