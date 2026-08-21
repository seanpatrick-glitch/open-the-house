import React, { useState, useEffect } from 'react'
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { sendCollaboratorInvite } from '../../utils/collaboratorInvites'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = [
  { value: 'admin',                label: 'Admin' },
  { value: 'secondaryAdmin',       label: 'Secondary Admin' },
  { value: 'departmentHead',       label: 'Department Head' },
  { value: 'orgCollaborator',      label: 'Org Collaborator' },
  { value: 'venueManager',         label: 'Venue Manager' },
  { value: 'productionCollaborator', label: 'Production Collaborator' },
]

const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, r) => {
  acc[r.value] = r.label
  return acc
}, {})

function roleBadge(role) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function formatDate(timestamp) {
  if (!timestamp) return 'No date'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function InviteCollaborator() {
  const { userProfile } = useAuth()

  const [email,        setEmail]        = useState('')
  const [role,         setRole]         = useState('orgCollaborator')
  const [departmentId, setDepartmentId] = useState('')
  const [departments,  setDepartments]  = useState([])
  const [deptsLoading, setDeptsLoading] = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [invites,      setInvites]      = useState([])
  const [loadingList,  setLoadingList]  = useState(true)

  useEffect(() => {
    if (!userProfile?.orgId) return

    const q = query(
      collection(db, 'organizations', userProfile.orgId, 'pendingInvites')
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setInvites(docs)
      setLoadingList(false)
    })

    return unsubscribe
  }, [userProfile?.orgId])

  // Departments for the Department Head picker (top-level collection, filtered by orgId)
  useEffect(() => {
    if (!userProfile?.orgId) return

    async function fetchDepartments() {
      try {
        const snap = await getDocs(
          query(collection(db, 'departments'), where('orgId', '==', userProfile.orgId))
        )
        setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('InviteCollaborator fetchDepartments:', err)
        toast.error('Could not load departments. Please refresh and try again.')
      } finally {
        setDeptsLoading(false)
      }
    }
    fetchDepartments()
  }, [userProfile?.orgId])

  async function handleCreateInvite(e) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter an email address.')
      return
    }

    if (role === 'departmentHead' && !departmentId) {
      toast.error('Please select a department.')
      return
    }

    setSubmitting(true)

    try {
      await sendCollaboratorInvite({
        orgId: userProfile.orgId,
        uid: userProfile.uid,
        email: email.trim(),
        role,
        departmentId: role === 'departmentHead' ? departmentId : null,
      })

      setEmail('')
      setRole('orgCollaborator')
      setDepartmentId('')
      toast.success('Invite sent to ' + email.trim())
    } catch (err) {
      toast.error('Could not send invite. Please try again.')
      console.error(err)
    }

    setSubmitting(false)
  }

  async function handleRevoke(inviteId) {
    try {
      await deleteDoc(doc(db, 'organizations', userProfile.orgId, 'pendingInvites', inviteId))
      toast.success('Invite revoked.')
    } catch (err) {
      toast.error('Could not revoke invite. Please try again.')
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite someone</h1>
        <p className="text-gray-500 text-sm mt-1">
          Send an email invite. The person will receive a secure sign-in link.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Collaborators sign in and use the app directly. For contacts who don't need a login, add them as People instead.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Send invite</h2>
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
              placeholder="name@email.com"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base bg-white"
            >
              {ROLE_OPTIONS.map((r) => (
                <option
                  key={r.value}
                  value={r.value}
                  disabled={r.value === 'departmentHead' && !deptsLoading && departments.length === 0}
                >
                  {r.label}
                </option>
              ))}
            </select>
            {role === 'departmentHead' && !deptsLoading && departments.length === 0 && (
              <p className="text-xs text-red-600 mt-1">
                Create a department first before inviting a Department Head.
              </p>
            )}
          </div>

          {role === 'departmentHead' && departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base bg-white"
              >
                <option value="">Select a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-spotlight hover:bg-spotlight/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sent invites</h2>

        {loadingList ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-gray-400 text-sm">No invites sent yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {invites.map((invite) => (
              <li key={invite.inviteId} className="py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleBadge(invite.role)}
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      invite.status === 'accepted'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-spotlight/15 text-stage-navy'
                    }`}>
                      {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(invite.createdAt)}</p>
                </div>
                {invite.status === 'pending' && (
                  <button
                    onClick={() => handleRevoke(invite.inviteId)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
