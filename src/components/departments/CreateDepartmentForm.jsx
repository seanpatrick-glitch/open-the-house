import React, { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreateDepartmentForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth()
  const { orgId, uid } = userProfile

  const [name,              setName]              = useState('')
  const [description,       setDescription]       = useState('')
  const [colorCode,         setColorCode]         = useState('#f59e0b')
  const [departmentHeadUid, setDepartmentHeadUid] = useState('')
  const [orgUsers,          setOrgUsers]          = useState([])
  const [usersLoading,      setUsersLoading]      = useState(true)
  const [loading,           setLoading]           = useState(false)
  const [error,             setError]             = useState('')
  const [success,           setSuccess]           = useState(false)

  // Fetch all users that belong to this org (client-side filter on organizations map)
  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        const filtered = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => Object.keys(u.organizations ?? {}).includes(orgId))
        setOrgUsers(filtered)
        if (filtered.length > 0) setDepartmentHeadUid(filtered[0].uid)
      } catch (err) {
        console.error('CreateDepartmentForm fetchUsers:', err)
      } finally {
        setUsersLoading(false)
      }
    }
    fetchUsers()
  }, [orgId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !departmentHeadUid) return
    setLoading(true)
    setError('')

    try {
      await addDoc(
        collection(db, 'departments'),
        {
          name:              name.trim(),
          description:       description.trim(),
          colorCode,
          departmentHeadUid,
          orgId,
          active:            true,
          createdAt:         serverTimestamp(),
          createdBy:         uid,
        }
      )

      setSuccess(true)
      setName('')
      setDescription('')
      setColorCode('#f59e0b')
      setDepartmentHeadUid(orgUsers[0]?.uid ?? '')

      setTimeout(() => {
        setSuccess(false)
        onSuccess()
      }, 1500)
    } catch (err) {
      console.error('CreateDepartmentForm submit:', err)
      setError('Failed to create department. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Create Department</h2>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-700 font-medium">Department created successfully.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Front of House"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Color code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Color <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorCode}
              onChange={e => setColorCode(e.target.value)}
              required
              className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
            />
            <span className="text-sm text-gray-500 font-mono">{colorCode}</span>
          </div>
        </div>

        {/* Department Head */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department Head <span className="text-red-500">*</span>
          </label>
          {usersLoading ? (
            <p className="text-sm text-gray-400">Loading users…</p>
          ) : orgUsers.length === 0 ? (
            <p className="text-sm text-gray-400">No users found in this organization.</p>
          ) : (
            <select
              value={departmentHeadUid}
              onChange={e => setDepartmentHeadUid(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              {orgUsers.map(u => (
                <option key={u.uid} value={u.uid}>{u.email}</option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading || !name.trim() || !departmentHeadUid || usersLoading}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Creating…' : 'Create Department'}
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
