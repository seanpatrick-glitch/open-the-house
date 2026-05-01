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
      const venueRef = await addDoc(collection(db, 'venues'), {
        name:      venueName.trim(),
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.uid,
        status:    'active',
      })

      await setDoc(doc(db, 'venues', venueRef.id, 'users', firebaseUser.uid), {
        uid:      firebaseUser.uid,
        email:    firebaseUser.email,
        role:     'admin',
        joinedAt: serverTimestamp(),
      })

      await setDoc(doc(db, 'userVenues', firebaseUser.uid), {
        venueId:   venueRef.id,
        role:      'admin',
        updatedAt: serverTimestamp(),
      })

      navigate('/dashboard')
    } catch (err) {
      toast.error('Could not create venue. Please try again.')
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-3xl font-bold text-gray-900">Open the House</h1>
          <p className="text-gray-500 mt-2 text-sm">Set up your venue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What is the name of your venue?
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
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Creating venue…' : 'Create venue'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">Step 3 of 3</p>
      </div>
    </div>
  )
}
