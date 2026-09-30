import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { PRODUCTION_LIST } from '../../models/productions'
import {
  buildCandidates, makeDirectory, resolveEntry, entryKey, updateRoleOnList, removeFromList, LIST_ERROR,
} from '../../utils/teamAndCast'
import GroupBadge from '../people/GroupBadge'
import AddToListForm from './AddToListForm'
import toast from 'react-hot-toast'

// Copy and accent color per list. Class names are written out in full so
// Tailwind's content scan picks them up.
const LISTS = [
  {
    field:       PRODUCTION_LIST.TEAM,
    title:       'Production Team',
    addLabel:    '+ Add Team Member',
    formTitle:   'Add Team Member',
    empty:       'No team members added yet.',
    placeholder: 'e.g. Stage Manager, Set Designer, House Manager',
    submit:      'Add to Production Team',
    headerClass: 'bg-places-blue/5',
    dotClass:    'bg-places-blue',
  },
  {
    field:       PRODUCTION_LIST.CAST,
    title:       'Cast',
    addLabel:    '+ Add Cast Member',
    formTitle:   'Add Cast Member',
    empty:       'No cast members added yet.',
    placeholder: 'e.g. Elphaba, Ensemble, Featured Vocalist',
    submit:      'Add to Cast',
    headerClass: 'bg-haze/10',
    dotClass:    'bg-haze',
  },
]

// Production Team and Cast: the fourth and fifth sections of a production's
// detail view, after its identity, dates and place. Two separate panels,
// both always visible; the same person may be on both. Admin and secondary
// admin add, edit and remove rows (the productions update rule allows no
// one else); anyone else who opens the production sees them read-only.
// people and members are the org's People records and member accounts,
// already loaded by ProductionDashboard.
export default function TeamCastPanels({ production, people, members, peopleLoading }) {
  const { userProfile } = useAuth()
  const orgId = userProfile.orgId
  const canManage = userProfile.role === 'admin' || userProfile.role === 'secondaryAdmin'

  // The production prop is a snapshot from when it was opened, so the lists
  // get their own listener on the production doc.
  const [lists, setLists] = useState(() => ({
    [PRODUCTION_LIST.TEAM]: production.productionTeam ?? [],
    [PRODUCTION_LIST.CAST]: production.cast ?? [],
  }))

  useEffect(() => {
    if (!orgId) return
    return onSnapshot(
      doc(db, 'organizations', orgId, 'productions', production.id),
      snap => {
        if (!snap.exists()) return
        const data = snap.data()
        setLists({
          [PRODUCTION_LIST.TEAM]: data.productionTeam ?? [],
          [PRODUCTION_LIST.CAST]: data.cast ?? [],
        })
      },
      err => {
        console.error('TeamCastPanels production listener error:', err)
        toast.error('Could not load the Production Team and Cast.')
      }
    )
  }, [orgId, production.id])

  const candidates = useMemo(() => buildCandidates(people, members), [people, members])
  const directory  = useMemo(() => makeDirectory(people, members), [people, members])

  return LISTS.map((list, i) => {
    const other = LISTS[1 - i]
    return (
      <ListPanel
        key={list.field}
        list={list}
        otherTitle={other.title}
        entries={lists[list.field]}
        otherEntries={lists[other.field]}
        candidates={candidates}
        directory={directory}
        peopleLoading={peopleLoading}
        canManage={canManage}
        orgId={orgId}
        productionId={production.id}
      />
    )
  })
}

function ListPanel({
  list, otherTitle, entries, otherEntries, candidates, directory, peopleLoading, canManage, orgId, productionId,
}) {
  const [adding, setAdding] = useState(false)

  return (
    // No overflow-hidden: it would clip the add flow's search dropdown. The
    // tinted strips round their own corners instead.
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 rounded-t-xl ${list.headerClass}`}>
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <span className={`w-2 h-2 rounded-full ${list.dotClass}`} aria-hidden="true" />
          {list.title}
        </h2>
        {canManage && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-places-blue hover:text-places-blue/90 transition-colors"
          >
            {list.addLabel}
          </button>
        )}
      </div>

      {adding && (
        <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 last:border-b-0 last:rounded-b-xl">
          <AddToListForm
            field={list.field}
            copy={list}
            otherTitle={otherTitle}
            entries={entries}
            otherEntries={otherEntries}
            candidates={candidates}
            peopleLoading={peopleLoading}
            productionId={productionId}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {entries.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {entries.map(entry => (
            <EntryRow
              key={entryKey(entry)}
              entry={entry}
              list={list}
              directory={directory}
              canManage={canManage}
              orgId={orgId}
              productionId={productionId}
            />
          ))}
        </ul>
      ) : !adding && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-gray-400">{list.empty}</p>
          {canManage && (
            <button
              onClick={() => setAdding(true)}
              className="mt-3 text-sm font-medium text-places-blue hover:text-places-blue/90 transition-colors"
            >
              {list.addLabel}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function EntryRow({ entry, list, directory, canManage, orgId, productionId }) {
  const { name, group } = resolveEntry(entry, directory)
  const shownName = name || 'No name'

  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [busy,    setBusy]    = useState(false)

  function startEdit() {
    setDraft(entry.productionRole ?? '')
    setEditing(true)
  }

  async function saveRole() {
    const next = draft.trim()
    if (!next || busy) return
    if (next === entry.productionRole) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await updateRoleOnList(orgId, productionId, list.field, entry, next)
      setEditing(false)
    } catch (err) {
      console.error('TeamCastPanels role update error:', err)
      toast.error(err.code === LIST_ERROR.ROW_MISSING
        ? `${shownName} is no longer on ${list.title}.`
        : 'Could not save that role. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await removeFromList(orgId, productionId, list.field, entry)
      // The row leaves on the next snapshot.
    } catch (err) {
      console.error('TeamCastPanels remove error:', err)
      toast.error(`Could not remove ${shownName}. Please try again.`)
      setBusy(false)
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate min-w-0">{shownName}</p>
            <GroupBadge group={group} />
          </div>
          {editing ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveRole() }
                  if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
                }}
                autoFocus
                aria-label={`Role in this production for ${shownName}`}
                placeholder={list.placeholder}
                className="flex-1 min-w-[12rem] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue"
              />
              <button
                onClick={saveRole}
                disabled={busy || !draft.trim()}
                className="bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {busy ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={busy}
                className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600 mt-0.5 break-words">
              {entry.productionRole || <span className="text-gray-400">No role set</span>}
            </p>
          )}
        </div>

        {canManage && !editing && (
          <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
            <button
              onClick={startEdit}
              disabled={busy}
              aria-label={`Edit role for ${shownName}`}
              className="text-xs font-medium text-places-blue hover:text-places-blue/90 disabled:opacity-50 transition-colors"
            >
              Edit role
            </button>
            <button
              onClick={remove}
              disabled={busy}
              aria-label={`Remove ${shownName} from ${list.title}`}
              className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Removing...' : 'Remove'}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
