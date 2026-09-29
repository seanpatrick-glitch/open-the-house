import { useState, useMemo, useRef, useEffect, useId } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  searchCandidates, isSamePerson, candidateFromPerson, makeEntry, addToList, LIST_ERROR,
} from '../../utils/teamAndCast'
import CreatePersonForm from '../people/CreatePersonForm'
import GroupBadge from '../people/GroupBadge'
import { withFieldError, FieldError } from '../shared/FormField'

const INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-places-blue'

// The add flow shared by Production Team and Cast: pick a person from the
// org's People records and member accounts (or add a new person to the org
// first), then type their role in this production.
export default function AddToListForm({
  field, copy, otherTitle, entries, otherEntries, candidates, peopleLoading, productionId, onDone, onCancel,
}) {
  const { userProfile } = useAuth()
  const { orgId, uid } = userProfile

  const [creatingPerson, setCreatingPerson] = useState(false)
  const [term, setTerm]               = useState('')
  const [open, setOpen]               = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selected, setSelected]       = useState(null)
  const [role, setRole]               = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  const searchRef = useRef(null)
  const roleRef   = useRef(null)
  const baseId    = useId()
  const searchId  = `${baseId}-search`
  const listboxId = `${baseId}-listbox`
  const roleId    = `${baseId}-role`

  const { matches, more } = useMemo(() => searchCandidates(candidates, term), [candidates, term])
  // Someone already on this list can't be added twice (edit their role
  // instead). Being on the other list is only a note; it never blocks.
  const options = matches.map(c => ({
    ...c,
    onThisList:  entries.some(e => isSamePerson(e, c)),
    onOtherList: otherEntries.some(e => isSamePerson(e, c)),
  }))
  const showListbox = open && term.trim() !== ''
  const selectedOnOther = selected && otherEntries.some(e => isSamePerson(e, selected))

  // Focus follows the flow: search until someone is picked, then their role.
  useEffect(() => {
    if (creatingPerson) return
    if (selected) roleRef.current?.focus()
    else searchRef.current?.focus()
  }, [selected, creatingPerson])

  function updateTerm(value) {
    setTerm(value)
    setOpen(true)
    setActiveIndex(0)
  }

  function choose(option) {
    if (!option || option.onThisList) return
    setSelected(option)
    setTerm('')
    setOpen(false)
    setFieldErrors(prev => ({ ...prev, person: undefined }))
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showListbox) { setOpen(true); return }
      setActiveIndex(i => (options.length ? Math.min(i + 1, options.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted person; it never submits from here.
      e.preventDefault()
      if (showListbox) choose(options[activeIndex])
    } else if (e.key === 'Escape' && showListbox) {
      e.preventDefault()
      setOpen(false)
    }
  }

  function handlePersonCreated(person) {
    setSelected(candidateFromPerson(person))
    setTerm('')
    setOpen(false)
    setFieldErrors(prev => ({ ...prev, person: undefined }))
    setCreatingPerson(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!selected) errors.person = 'Choose a person to add.'
    if (!role.trim()) errors.role = 'Enter their role in this production.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setError('')
    setSaving(true)
    try {
      await addToList(orgId, productionId, field, makeEntry(selected, role, uid))
      onDone()
    } catch (err) {
      console.error('AddToListForm error:', err)
      if (err.code === LIST_ERROR.ALREADY_ON_LIST) {
        setFieldErrors({
          person: `${selected.displayName || 'This person'} is already on ${copy.title}. Edit the role on their row instead.`,
        })
      } else {
        setError('Could not save. Please try again.')
      }
      setSaving(false)
    }
  }

  if (creatingPerson) {
    return (
      <div>
        <button type="button" onClick={() => setCreatingPerson(false)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
          ← Back to {copy.formTitle}
        </button>
        <CreatePersonForm onSuccess={handlePersonCreated} onCancel={() => setCreatingPerson(false)} />
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-5">{copy.formTitle}</h3>

      <div className="space-y-4">

        {/* Part 1: the person */}
        <div>
          <label htmlFor={searchId} className="block text-sm font-medium text-gray-700 mb-1">
            Person <span className="text-red-500">*</span>
          </label>

          {selected ? (
            <div className={withFieldError('flex items-center justify-between gap-3 border border-gray-300 rounded-lg px-3 py-2 bg-white', !!fieldErrors.person)}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate min-w-0">{selected.displayName || 'No name'}</span>
                  <GroupBadge group={selected.group} />
                  {selectedOnOther && <span className="text-xs text-gray-500">(already on {otherTitle})</span>}
                </div>
                {selected.email && selected.email !== selected.displayName && (
                  <p className="text-xs text-gray-400 truncate">{selected.email}</p>
                )}
              </div>
              <button type="button" onClick={() => setSelected(null)}
                className="text-xs font-medium text-places-blue hover:text-places-blue/90 transition-colors flex-shrink-0">
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                id={searchId}
                ref={searchRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showListbox}
                aria-controls={listboxId}
                aria-activedescendant={showListbox && options[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
                autoComplete="off"
                value={term}
                onChange={e => updateTerm(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name or email"
                className={withFieldError(INPUT_CLASS, !!fieldErrors.person)}
              />
              {showListbox && (
                // An overlay, so closing it never shifts what's below mid-click.
                // mousedown is swallowed so picking a row doesn't blur the input first.
                <div onMouseDown={e => e.preventDefault()}
                  className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                  <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-1">
                    {options.map((opt, i) => (
                      <li
                        key={opt.key}
                        id={`${listboxId}-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        aria-disabled={opt.onThisList || undefined}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => choose(opt)}
                        className={`px-3 py-2 ${opt.onThisList ? 'cursor-default opacity-60' : 'cursor-pointer'} ${i === activeIndex && !opt.onThisList ? 'bg-places-blue/10' : ''}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{opt.displayName || 'No name'}</span>
                          <GroupBadge group={opt.group} />
                          {opt.onThisList
                            ? <span className="text-xs text-gray-500">(already on {copy.title})</span>
                            : opt.onOtherList && <span className="text-xs text-gray-500">(already on {otherTitle})</span>}
                        </div>
                        {opt.email && opt.email !== opt.displayName && (
                          <p className="text-xs text-gray-400 truncate">{opt.email}</p>
                        )}
                      </li>
                    ))}
                    {options.length === 0 && (
                      <li className="px-3 py-2 text-sm text-gray-400">
                        {peopleLoading ? 'Loading people…' : `No one matches "${term.trim()}".`}
                      </li>
                    )}
                    {more > 0 && (
                      <li className="px-3 py-2 text-xs text-gray-400">{more} more. Keep typing to narrow the list.</li>
                    )}
                  </ul>
                  {/* The same action as the link under the field, which this
                      overlay covers. Mouse only: Tab reaches that link. */}
                  <div aria-hidden="true" className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                    Can't find them?{' '}
                    <button type="button" tabIndex={-1} onClick={() => setCreatingPerson(true)}
                      className="font-medium text-places-blue hover:text-places-blue/90 transition-colors">
                      Add a new person to the org
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <FieldError message={fieldErrors.person} />

          {!selected && (
            <p className="mt-2 text-xs text-gray-500">
              Can't find them?{' '}
              <button type="button" onClick={() => setCreatingPerson(true)}
                className="font-medium text-places-blue hover:text-places-blue/90 transition-colors">
                Add a new person to the org
              </button>
            </p>
          )}
        </div>

        {/* Part 2: their role in this production */}
        <div>
          <label htmlFor={roleId} className="block text-sm font-medium text-gray-700 mb-1">
            Their role in this production <span className="text-red-500">*</span>
          </label>
          <input
            id={roleId}
            ref={roleRef}
            type="text"
            value={role}
            onChange={e => {
              setRole(e.target.value)
              if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: undefined }))
            }}
            placeholder={copy.placeholder}
            className={withFieldError(INPUT_CLASS, !!fieldErrors.role)}
          />
          <FieldError message={fieldErrors.role} />
        </div>

      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button type="submit" disabled={saving}
          className="bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {saving ? 'Adding...' : copy.submit}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
