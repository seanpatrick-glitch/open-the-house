import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { getDisplayName } from '../../utils/displayName'
import InviteCollaborator from './InviteCollaborator'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  admin:                  'Admin',
  secondaryAdmin:         'Secondary Admin',
  departmentHead:         'Department Head',
  orgCollaborator:        'Org Collaborator',
  venueManager:           'Venue Manager',
  productionCollaborator: 'Production Collaborator',
  collaborator:           'Collaborator',
  person:                 'Person (platform account)',
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

export default function CollaboratorRoster() {
  const { userProfile } = useAuth()
  const orgId = userProfile?.orgId
  const uid   = userProfile?.uid
  const canRevoke = userProfile?.role === 'admin' || userProfile?.role === 'secondaryAdmin'

  const [members, setMembers]               = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [invites, setInvites]               = useState([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [confirmTarget, setConfirmTarget]   = useState(null) // member row pending revoke confirmation
  const [revoking, setRevoking]             = useState(new Set())

  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'members'),
      snap => {
        setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setMembersLoading(false)
      },
      err => {
        console.error('CollaboratorRoster members listener error:', err)
        toast.error('Could not load platform accounts.')
        setMembersLoading(false)
      }
    )
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'pendingInvites'),
      snap => {
        setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status === 'pending'))
        setInvitesLoading(false)
      },
      err => {
        console.error('CollaboratorRoster invites listener error:', err)
        toast.error('Could not load pending invites.')
        setInvitesLoading(false)
      }
    )
    return unsub
  }, [orgId])

  // Accepted invites already have a members doc — only pending ones are
  // shown here, so no one appears twice.
  const rows = [
    ...members.map(m => ({
      key:    `member-${m.id}`,
      kind:   'member',
      uid:    m.id,
      name:   getDisplayName(m) || m.email,
      email:  m.email,
      role:   m.role,
      status: 'active',
    })),
    ...invites.map(i => ({
      key:       `invite-${i.id}`,
      kind:      'invite',
      inviteId:  i.inviteId || i.id,
      name:      null,
      email:     i.email,
      role:      i.role,
      status:    'invited',
    })),
  ]

  const loading = membersLoading || invitesLoading

  async function handleRevokeInvite(inviteId) {
    setRevoking(prev => new Set([...prev, inviteId]))
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'pendingInvites', inviteId))
      toast.success('Invite revoked.')
    } catch (err) {
      console.error('Revoke invite error:', err)
      toast.error('Could not revoke invite. Please try again.')
    } finally {
      setRevoking(prev => { const next = new Set(prev); next.delete(inviteId); return next })
    }
  }

  async function handleRevokeMember(row) {
    setRevoking(prev => new Set([...prev, row.uid]))
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'organizations', orgId, 'members', row.uid))
      batch.update(doc(db, 'users', row.uid), { organizations: {} })
      await batch.commit()
      toast.success(`Removed ${row.name}'s access.`)
      setConfirmTarget(null)
    } catch (err) {
      console.error('Revoke member error:', err)
      toast.error('Could not remove access. Please try again.')
    } finally {
      setRevoking(prev => { const next = new Set(prev); next.delete(row.uid); return next })
    }
  }

  if (showInviteForm) {
    return (
      <div className="space-y-4">
        <button onClick={() => setShowInviteForm(false)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← Back to Collaborators
        </button>
        <InviteCollaborator />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collaborators</h1>
          <p className="text-gray-500 text-sm mt-1">
            Everyone with platform access to this organization. Collaborators sign in and use the app directly,
            unlike People, who are org contacts your team coordinates without needing a login.
          </p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          + Invite Collaborator
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-sm p-6">No one has platform access yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map(row => {
              const isSelf     = row.kind === 'member' && row.uid === uid
              const isRevoking = revoking.has(row.kind === 'member' ? row.uid : row.inviteId)
              const isConfirming = confirmTarget?.key === row.key

              return (
                <li key={row.key} className="px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {row.name || row.email}
                    </p>
                    {row.name && <p className="text-xs text-gray-400 truncate">{row.email}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                        {roleLabel(row.role)}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        row.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status === 'active' ? 'Active' : 'Invited'}
                      </span>
                      {isSelf && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                  </div>

                  {canRevoke && !isSelf && (
                    isConfirming ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500">Remove access for {row.name || row.email}?</span>
                        <button
                          onClick={() => handleRevokeMember(row)}
                          disabled={isRevoking}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors"
                        >
                          {isRevoking ? 'Removing…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmTarget(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => row.kind === 'member' ? setConfirmTarget(row) : handleRevokeInvite(row.inviteId)}
                        disabled={isRevoking}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors shrink-0"
                      >
                        {isRevoking ? 'Revoking…' : row.kind === 'member' ? 'Remove access' : 'Revoke invite'}
                      </button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
