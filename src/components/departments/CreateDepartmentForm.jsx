import React, { useState, useEffect } from 'react'
import { collection, doc, getDocs, serverTimestamp, writeBatch, Timestamp, getDoc } from 'firebase/firestore'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { db, auth } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { getDisplayName } from '../../utils/displayName'
import { getInviteActionCodeSettings } from '../../utils/invites'
import toast from 'react-hot-toast'

export default function CreateDepartmentForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth()
  const { orgId, uid } = userProfile

  const [name,              setName]              = useState('')
  const [description,       setDescription]       = useState('')
  const [colorCode,         setColorCode]         = useState('#f59e0b')
  const [departmentHeadUid, setDepartmentHeadUid] = useState('')
  const [headEmail,         setHeadEmail]         = useState('')
  const [orgUsers,          setOrgUsers]          = useState([])
  const [usersLoading,      setUsersLoading]      = useState(true)
  const [loading,           setLoading]           = useState(false)
  const [error,             setError]             = useState('')
  const [success,           setSuccess]           = useState(false)
  const [showHeadConfirm,   setShowHeadConfirm]   = useState(false)

  // Fetch all users that belong to this org (client-side filter on organizations map)
  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'organizations', orgId, 'members'))
        const filtered = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
        setOrgUsers(filtered)
      } catch (err) {
        console.error('CreateDepartmentForm fetchUsers:', err)
        toast.error('Could not load members. Please refresh and try again.')
      } finally {
        setUsersLoading(false)
      }
    }
    fetchUsers()
  }, [orgId])

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return

    // Assigning an existing member directly is a real promotion, not just a
    // label — confirm before it fires rather than firing on the same click
    // that also creates the department.
    if (!headEmail.trim() && departmentHeadUid) {
      setShowHeadConfirm(true)
      return
    }

    createDepartment()
  }

  async function createDepartment() {
    setShowHeadConfirm(false)
    setLoading(true)
    setError('')

    const trimmedEmail = headEmail.trim()

    try {
      const deptRef = doc(collection(db, 'departments'))
      const batch = writeBatch(db)

      batch.set(deptRef, {
        name:                name.trim(),
        description:         description.trim(),
        colorCode,
        // An email invite takes precedence over picking an existing member directly.
        departmentHeadUid:   trimmedEmail ? null : (departmentHeadUid || null),
        departmentHeadEmail: trimmedEmail || null,
        orgId,
        active:              true,
        createdAt:           serverTimestamp(),
        createdBy:           uid,
      })

      // Assigning an existing member directly promotes them to Department Head —
      // update their member doc and their canonical role (users/{uid}, what
      // AuthRouter and firestore.rules actually key routing/permissions off of)
      // in the same batch, so the assignment takes effect immediately rather
      // than leaving the member doc looking right while routing stays broken.
      if (!trimmedEmail && departmentHeadUid) {
        batch.update(doc(db, 'organizations', orgId, 'members', departmentHeadUid), {
          role:         'departmentHead',
          departmentId: deptRef.id,
        })
        batch.update(doc(db, 'users', departmentHeadUid), {
          [`organizations.${orgId}.role`]: 'departmentHead',
        })
      }

      if (trimmedEmail) {
        const orgSnap = await getDoc(doc(db, 'organizations', orgId))
        const orgName = orgSnap.exists() ? orgSnap.data().name : ''

        const now       = Timestamp.now()
        const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)

        // Department Head invites use the department's own id as the pendingInvites
        // doc id, so firestore.rules can look it up deterministically when the
        // incoming head writes departmentHeadUid back onto the department doc.
        batch.set(doc(db, 'organizations', orgId, 'pendingInvites', deptRef.id), {
          inviteId:     deptRef.id,
          email:        trimmedEmail,
          role:         'departmentHead',
          departmentId: deptRef.id,
          level:        'department',
          scopeId:      deptRef.id,
          orgId,
          orgName,
          createdBy:    uid,
          createdAt:    serverTimestamp(),
          expiresAt,
          status:       'pending',
        })
      }

      await batch.commit()

      if (trimmedEmail) {
        await sendSignInLinkToEmail(auth, trimmedEmail, getInviteActionCodeSettings(orgId, deptRef.id))
        window.localStorage.setItem('emailForSignIn', trimmedEmail)
      }

      setSuccess(true)
      setName('')
      setDescription('')
      setColorCode('#f59e0b')
      setDepartmentHeadUid('')
      setHeadEmail('')

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

  const selectedHead = orgUsers.find(u => u.uid === departmentHeadUid)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Create Department</h2>

      {showHeadConfirm && selectedHead && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-sm text-gray-900 mb-6">
              Make {getDisplayName(selectedHead)} the Department Head for {name.trim()}? This changes their access and dashboard.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={createDepartment}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setShowHeadConfirm(false)}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Department Head — assign an existing member now, or invite someone by email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department Head (optional)
          </label>
          {usersLoading ? (
            <p className="text-sm text-gray-400">Loading members…</p>
          ) : orgUsers.length === 0 ? (
            <p className="text-sm text-gray-400">No existing members to assign yet.</p>
          ) : (
            <select
              value={departmentHeadUid}
              onChange={e => setDepartmentHeadUid(e.target.value)}
              disabled={!!headEmail.trim()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">Assign later</option>
              {orgUsers.map(u => (
                <option key={u.uid} value={u.uid}>{getDisplayName(u)}</option>
              ))}
            </select>
          )}
        </div>

        {/* Invite a new Department Head by email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department Head email (optional). We'll send them an invite.
          </label>
          <input
            type="email"
            value={headEmail}
            onChange={e => setHeadEmail(e.target.value)}
            placeholder="head@email.com"
            autoComplete="off"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading || !name.trim() || usersLoading}
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
