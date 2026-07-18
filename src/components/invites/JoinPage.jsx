import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../../firebase'

export default function JoinPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [error,  setError]  = useState('')

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

        await setDoc(doc(db, 'users', uid), {
          name:      email,
          email,
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

        await updateDoc(inviteDoc.ref, { status: 'accepted' })

        navigate('/dashboard')
      } catch (err) {
        console.error('JoinPage error:', err)
        setError('Something went wrong. Please try again or contact your admin.')
        setStatus('error')
      }
    }

    completeSignIn()
  }, [navigate])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-base">Setting up your account…</p>
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
