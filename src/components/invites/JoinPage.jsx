import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../../firebase'
import ConfirmEmailScreen from './ConfirmEmailScreen'

export default function JoinPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [error,  setError]  = useState('')
  const [pending, setPending] = useState(null) // { uid, email, invite, inviteRef }
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [confirmingEmail, setConfirmingEmail] = useState(false)

  async function completeSignIn(email) {
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
      if (status === 'needs-email') {
        // Wrong email typed on the confirm-email screen — let them retry
        // instead of dropping them on the dead-end error screen.
        setEmailError('That email did not match this invite link. Please double-check and try again.')
        return
      }
      setError('Something went wrong. Please try again or contact your admin.')
      setStatus('error')
    }
  }

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus('invalid')
      return
    }

    const cachedEmail = window.localStorage.getItem('emailForSignIn')
    if (cachedEmail) {
      completeSignIn(cachedEmail)
    } else {
      setStatus('needs-email')
    }
  }, [navigate])

  async function handleConfirmEmail(email) {
    setEmailError('')
    setConfirmingEmail(true)
    await completeSignIn(email)
    setConfirmingEmail(false)
  }

  async function handleContinue() {
    if (!pending) return

    if (!passwordInput || passwordInput.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    if (passwordInput !== confirmPasswordInput) {
      setFormError('Passwords do not match.')
      return
    }

    setFormError('')
    setSubmitting(true)
    const { uid, email, invite, inviteRef } = pending
    const displayName = displayNameInput.trim() || email

    try {
      await updatePassword(auth.currentUser, passwordInput)

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
      if (err.code === 'auth/weak-password') {
        setFormError('That password is too weak. Please choose a stronger one.')
        setSubmitting(false)
        return
      }
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

  if (status === 'needs-email') {
    return (
      <ConfirmEmailScreen
        onConfirm={handleConfirmEmail}
        submitting={confirmingEmail}
        error={emailError}
        theme="amber"
        showEmoji
        containerClassName="min-h-screen bg-gray-900 flex items-center justify-center px-4"
        cardClassName="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
      />
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

          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Display name (optional, defaults to your name)
            </label>
            <input
              type="text"
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              placeholder={pending.email}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
              autoFocus
            />
          </div>

          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Set a password
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
            />
          </div>

          <div className="space-y-1 mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPasswordInput}
              onChange={e => setConfirmPasswordInput(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
            />
          </div>

          {formError && <p className="text-sm text-red-600 mb-4">{formError}</p>}

          <button
            onClick={handleContinue}
            disabled={submitting}
            className="w-full bg-spotlight hover:bg-spotlight/90 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
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
