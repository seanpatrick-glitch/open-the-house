import { useState, useMemo, useId } from 'react'
import CreatePlaceForm from './CreatePlaceForm'

const INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent'

// Choose Places for a production: search the org's Places, pick one to add
// it as a chip, and the search stays open for the next. A place that isn't
// in the org's records yet can be created inline without leaving the page;
// it's then added straight away. Shared by CreateProductionForm (which keeps
// the picks in form state) and ProductionPlacesPanel (which writes each pick).
//
// places:      the org's Places ({ id, name })
// selectedIds: IDs currently picked, in display order
// onAdd:       called with { id, name } for a picked or just-created place
// onRemove:    called with a place ID
// hint:        quiet line shown while nothing is picked
// Renders a <form> while a new place is being created, so never put it
// inside another <form>.
export default function PlacePicker({ places, selectedIds, onAdd, onRemove, hint, disabled = false }) {
  const [term,        setTerm]        = useState('')
  const [open,        setOpen]        = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [creating,    setCreating]    = useState(false)
  // Places created here, until the caller's places list catches up (it may
  // be a one-time load that never will).
  const [created,     setCreated]     = useState([])

  const baseId    = useId()
  const searchId  = `${baseId}-search`
  const listboxId = `${baseId}-listbox`

  const allPlaces = useMemo(() => {
    const known = new Set(places.map(p => p.id))
    return [...places, ...created.filter(p => !known.has(p.id))]
  }, [places, created])
  const nameById = useMemo(() => Object.fromEntries(allPlaces.map(p => [p.id, p.name])), [allPlaces])

  const needle  = term.trim().toLowerCase()
  const options = needle
    ? allPlaces
        .filter(p => !selectedIds.includes(p.id) && (p.name ?? '').toLowerCase().includes(needle))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    : []
  const showListbox = open && needle !== ''

  function updateTerm(value) {
    setTerm(value)
    setOpen(true)
    setActiveIndex(0)
  }

  function choose(place) {
    if (!place) return
    onAdd({ id: place.id, name: place.name })
    setTerm('')
    setActiveIndex(0)
    // The listbox stays closed until the next keystroke; focus stays in the
    // input so a second place can be searched straight away.
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showListbox) { setOpen(true); return }
      setActiveIndex(i => (options.length ? Math.min(i + 1, options.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted place; it never submits a form.
      e.preventDefault()
      if (showListbox) choose(options[activeIndex])
    } else if (e.key === 'Escape' && showListbox) {
      e.preventDefault()
      setOpen(false)
    }
  }

  function handlePlaceCreated(place) {
    setCreated(prev => [...prev, place])
    onAdd(place)
    setTerm('')
    setCreating(false)
  }

  const addNewLink = (
    <button type="button" onClick={() => setCreating(true)} disabled={disabled}
      className="font-medium text-places-blue hover:text-places-blue/90 disabled:opacity-50 transition-colors">
      Add a new place
    </button>
  )

  return (
    <div>
      {selectedIds.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2">
          {selectedIds.map(id => (
            <li key={id}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-spotlight/10 border border-spotlight/25 text-sm text-stage-navy">
              <span>{nameById[id] ?? 'Unknown place'}</span>
              <button
                type="button"
                onClick={() => onRemove(id)}
                disabled={disabled}
                aria-label={`Remove ${nameById[id] ?? 'this place'}`}
                className="w-5 h-5 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-spotlight/20 disabled:opacity-50 transition-colors"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <div className="mt-1">
          <CreatePlaceForm
            initialName={term.trim()}
            onSuccess={handlePlaceCreated}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              id={searchId}
              type="text"
              role="combobox"
              aria-label="Search your places"
              aria-autocomplete="list"
              aria-expanded={showListbox}
              aria-controls={listboxId}
              aria-activedescendant={showListbox && options[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
              autoComplete="off"
              value={term}
              onChange={e => updateTerm(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="Search your places"
              className={INPUT_CLASS}
            />
            {showListbox && (
              // An overlay, so closing it never shifts what's below mid-click.
              // mousedown is swallowed so picking a row doesn't blur the input first.
              <div onMouseDown={e => e.preventDefault()}
                className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                <ul id={listboxId} role="listbox" className="max-h-60 overflow-y-auto py-1">
                  {options.map((place, i) => (
                    <li
                      key={place.id}
                      id={`${listboxId}-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => choose(place)}
                      className={`px-3 py-2 text-sm text-gray-900 cursor-pointer ${i === activeIndex ? 'bg-spotlight/10' : ''}`}
                    >
                      {place.name}
                    </li>
                  ))}
                  {options.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-400">No places match "{term.trim()}".</li>
                  )}
                </ul>
                {/* The same action as the link under the field, which this
                    overlay covers. Mouse only: Tab reaches that link. */}
                <div aria-hidden="true" className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                  Not seeing it?{' '}
                  <button type="button" tabIndex={-1} onClick={() => setCreating(true)}
                    className="font-medium text-places-blue hover:text-places-blue/90 transition-colors">
                    Add a new place
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">Not seeing it? {addNewLink}</p>
        </>
      )}

      {selectedIds.length === 0 && hint && !creating && (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  )
}
