import React, { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreatePlaceForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth()
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const ref = await addDoc(
        collection(db, 'organizations', userProfile.orgId, 'places'),
        {
          name:      name.trim(),
          orgId:     userProfile.orgId,
          createdAt: serverTimestamp(),
          createdBy: userProfile.uid,
        }
      )
      onSuccess({ id: ref.id, name: name.trim() })
    } catch (err) {
      console.error('CreatePlaceForm submit:', err)
      setError('Failed to create place. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-md">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Add a Place</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Place name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Main Stage, Black Box Theatre"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Save Place'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
