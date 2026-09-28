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
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { sendCollaboratorInvite } from '../../utils/collaboratorInvites'
import { getDisplayName } from '../../utils/displayName'
import { callableErrorMessage } from '../../utils/callableError'
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
  const [existingMember, setExistingMember] = useState(null) // member doc when the email already has access

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

  function resetForm() {
    setEmail('')
    setRole('orgCollaborator')
    setDepartmentId('')
    setExistingMember(null)
  }

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
    const trimmedEmail = email.trim()

    try {
      // Someone who already has access gets their access changed directly
      // (handleChangeAccess) instead of an invite: accepting an invite as an
      // existing member used to fail, and an old invite could later undo a
      // newer change.
      const membersSnap = await getDocs(collection(db, 'organizations', userProfile.orgId, 'members'))
      const match = membersSnap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .find((m) => (m.email || '').trim().toLowerCase() === trimmedEmail.toLowerCase())

      if (match) {
        if (match.uid === userProfile.uid) {
          toast.error("That's your own email address.")
        } else if (match.role === role && (role !== 'departmentHead' || match.departmentId === departmentId)) {
          toast(`${getDisplayName(match) || match.email} already has that access.`)
        } else {
          setExistingMember(match)
        }
        setSubmitting(false)
        return
      }

      await sendCollaboratorInvite({
        orgId: userProfile.orgId,
        uid: userProfile.uid,
        email: trimmedEmail,
        role,
        departmentId: role === 'departmentHead' ? departmentId : null,
      })

      resetForm()
      toast.success('Invite sent to ' + trimmedEmail)
    } catch (err) {
      toast.error('Could not send invite. Please try again.')
      console.error(err)
    }

    setSubmitting(false)
  }

  async function handleChangeAccess() {
    if (!existingMember) return
    setSubmitting(true)
    try {
      const setMemberRole = httpsCallable(functions, 'setMemberRole')
      await setMemberRole({
        orgId: userProfile.orgId,
        uid: existingMember.uid,
        role,
        departmentId: role === 'departmentHead' ? departmentId : null,
      })
      toast.success(`${getDisplayName(existingMember) || existingMember.email} now has ${ROLE_LABELS[role] || role} access.`)
      resetForm()
    } catch (err) {
      console.error('InviteCollaborator setMemberRole:', err)
      toast.error(callableErrorMessage(err, 'Could not change access. Please try again.'))
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
              onChange={(e) => { setEmail(e.target.value); setExistingMember(null) }}
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
              onChange={(e) => { setRole(e.target.value); setExistingMember(null) }}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base bg-white"
            >
              {ROLE_OPTIONS.map((r) => {
                // A Department Head needs a department to head. The reason is
                // in the option label itself, since a disabled option can't be
                // selected to reveal the hint below.
                const needsDepartment = r.value === 'departmentHead' && !deptsLoading && departments.length === 0
                return (
                  <option key={r.value} value={r.value} disabled={needsDepartment}>
                    {needsDepartment ? `${r.label} (create a department first)` : r.label}
                  </option>
                )
              })}
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
                onChange={(e) => { setDepartmentId(e.target.value); setExistingMember(null) }}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base bg-white"
              >
                <option value="">Select a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {existingMember ? (
            <div className="rounded-lg border border-places-blue/20 bg-places-blue/5 p-4 space-y-3">
              <p className="text-sm text-gray-900">
                {getDisplayName(existingMember) || existingMember.email} already has access
                as {ROLE_LABELS[existingMember.role] || existingMember.role}. Change their access
                to {ROLE_LABELS[role] || role}
                {role === 'departmentHead' && departments.find((d) => d.id === departmentId)
                  ? ` for ${departments.find((d) => d.id === departmentId).name}`
                  : ''}? No invite email is sent.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleChangeAccess}
                  disabled={submitting}
                  className="bg-spotlight hover:bg-spotlight/90 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {submitting ? 'Saving…' : 'Change access'}
                </button>
                <button
                  type="button"
                  onClick={() => setExistingMember(null)}
                  disabled={submitting}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-spotlight hover:bg-spotlight/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : 'Send invite'}
            </button>
          )}
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
