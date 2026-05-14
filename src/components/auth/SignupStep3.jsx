import React, { useState } from 'react'
import { collection, doc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function SignupStep3({ firebaseUser }) {
  const [venueName, setVenueName] = useState('')
  const [loading,   setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()

    if (!venueName.trim()) {
      toast.error('Please enter a venue name.')
      return
    }

    setLoading(true)
    try {
      const orgRef = await addDoc(collection(db, 'organizations'), {
        name:      venueName.trim(),
        type:      'theater',
        ownerId:   firebaseUser.uid,
        createdAt: serverTimestamp(),
        subscription: {
          tier:   'house',
          status: 'trial',
        },
      })

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        name:      firebaseUser.email,
        email:     firebaseUser.email,
        createdAt: serverTimestamp(),
        organizations: {
          [orgRef.id]: {
            role:      'admin',
            level:     'organization',
            scopeId:   orgRef.id,
            joinedAt:  serverTimestamp(),
          },
        },
      })

      await new Promise(resolve => setTimeout(resolve, 800))
      navigate('/dashboard')
    } catch (err) {
      toast.error('Could not create organization. Please try again.')
      console.error(err)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🎭</div>
          <p className="text-white text-lg font-medium">
            Setting up your organization...
          </p>
          <p className="text-gray-400 text-sm mt-2">
            This will just take a moment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-3xl font-bold text-gray-900">Open the House</h1>
          <p className="text-gray-500 mt-2 text-sm">Set up your organization</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What is the name of your organization?
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="e.g. The Grand Theatre"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base mt-2"
          >
            Create organization
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">Step 3 of 3</p>
      </div>
    </div>
  )
}
