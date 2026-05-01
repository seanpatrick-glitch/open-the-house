import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../firebase'
import toast from 'react-hot-toast'

export default function AcceptInvite() {
  const { token }  = useParams()
  const navigate   = useNavigate()

  const [invite,   setInvite]   = useState(null)
  const [status,   setStatus]   = useState('loading') // loading | invalid | accepted | expired | valid
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadInvite() {
      try {
        const snap = await getDoc(doc(db, 'invites', token))

        if (!snap.exists()) {
          setStatus('invalid')
          return
        }

        const data = snap.data()

        if (data.status === 'accepted') {
          setStatus('accepted')
          return
        }

        const now       = Date.now()
        const expiresAt = data.expiresAt?.toMillis?.() ?? 0
        if (now > expiresAt) {
          setStatus('expired')
          return
        }

        setInvite(data)
        setEmail(data.email)
        setStatus('valid')
      } catch (err) {
        setStatus('invalid')
        console.error(err)
      }
    }

    loadInvite()
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()

    if (!email.trim() || !password || !confirm) {
      toast.error('Please fill in all fields.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      const credential = await createUserWithEmailAndPassword(
        auth, email.trim(), password
      )
      const uid = credential.user.uid

      await setDoc(doc(db, 'userVenues', uid), {
        venueId:   invite.venueId,
        role:      invite.role,
        updatedAt: serverTimestamp(),
      })

      await setDoc(doc(db, 'venues', invite.venueId, 'users', uid), {
        uid,
        email:    email.trim(),
        role:     invite.role,
        joinedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'invites', token), {
        status: 'accepted',
      })

      await new Promise(resolve => setTimeout(resolve, 1500))
      navigate('/dashboard')
    } catch (err) {
      console.error('AcceptInvite error:', err.code, err.message)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists.')
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address.')
      } else {
        toast.error('Could not create account. Please try again.')
      }
      setSubmitting(false)
    }
  }

  // ── States ────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-base">Loading…</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🎭</div>
          <p className="text-gray-800 font-medium">This invite link is not valid.</p>
        </div>
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🎭</div>
          <p className="text-gray-800 font-medium">This invite has already been used.</p>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🎭</div>
          <p className="text-gray-800 font-medium">This invite link has expired.</p>
        </div>
      </div>
    )
  }

  // ── Valid invite — show signup form ───────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-2xl font-bold text-gray-900">
            You have been invited to join {invite.venueName}
          </h1>
          <p className="text-gray-500 mt-2 text-sm capitalize">
            You are joining as {invite.role}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? 'Setting up your account…' : 'Create account and join'}
          </button>
        </form>
      </div>
    </div>
  )
}
