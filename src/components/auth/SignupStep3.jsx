import React, { useState } from 'react'
import { collection, doc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { seedDefaultPersonTypes } from '../../utils/personTypes'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import wordmark from '../../assets/brand/wordmark-mark.png'

export default function SignupStep3({ firebaseUser }) {
  const [orgName,   setOrgName]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()

    if (!orgName.trim()) {
      toast.error('Please enter an organization name.')
      return
    }

    setLoading(true)
    try {
      const orgRef = await addDoc(collection(db, 'organizations'), {
        name:      orgName.trim(),
        type:      'theater',
        ownerId:   firebaseUser.uid,
        createdAt: serverTimestamp(),
        departmentsEnabled: true,
        onboardingCompleted: false,
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

      // The owner is the org's admin from here, so the personTypes write rule
      // passes. A failure must not block signup: the org and login already
      // exist, and types can be added in Settings.
      try {
        await seedDefaultPersonTypes(orgRef.id, firebaseUser.uid)
      } catch (err) {
        console.error('Seeding default person types failed:', err)
      }

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
    <div className="min-h-screen bg-stage-navy flex flex-col items-center justify-center px-4">
      <img src={wordmark} alt="Places People!" className="h-14 w-auto mb-6" />
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm">Tell us about your organization.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
              placeholder="e.g. Riverside Playhouse, Summer Shakespeare Festival, The Lantern Company"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              This is how your organization will appear to your team in Places People!
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-spotlight hover:bg-spotlight/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base mt-2"
          >
            Create organization
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">Step 3 of 3</p>
      </div>
    </div>
  )
}
