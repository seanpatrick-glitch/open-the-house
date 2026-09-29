import React, { useState, useId } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { dateInputToTimestamp } from '../../utils/dateInput'
import PlacePicker from './PlacePicker'

const INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent'

const DATE_FIELDS = [
  { key: 'firstRehearsal', label: 'First rehearsal', placeholder: 'First rehearsal date' },
  { key: 'openDate',       label: 'Opens',           placeholder: 'Opening date' },
  { key: 'closeDate',      label: 'Closes',          placeholder: 'Closing date' },
]

// Name something and start it: the title is the only required field. Places
// and dates are optional and can all be added later from the production's
// detail view. onSuccess receives { id } of the new production.
//
// The fields join the form through their form attribute rather than sitting
// inside it, because PlacePicker renders its own <form> (CreatePlaceForm)
// when a new place is added mid-way, and forms can't nest.
export default function CreateProductionForm({ places, onSuccess, onCancel }) {
  const { userProfile } = useAuth()
  const formId = useId()

  const [name,     setName]     = useState('')
  const [placeIds, setPlaceIds] = useState([])
  const [dates,    setDates]    = useState({ firstRehearsal: '', openDate: '', closeDate: '' })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    setError('')

    try {
      const ref = await addDoc(
        collection(db, 'organizations', userProfile.orgId, 'productions'),
        {
          name:           name.trim(),
          displayLabel:   'Production',
          placeIds:       placeIds.length > 0 ? placeIds : null,
          orgId:          userProfile.orgId,
          status:         'planning',
          firstRehearsal: dateInputToTimestamp(dates.firstRehearsal),
          openDate:       dateInputToTimestamp(dates.openDate),
          closeDate:      dateInputToTimestamp(dates.closeDate),
          activeModules: {
            volunteerScheduling: false,
          },
          productionTeam: [],
          cast:           [],
          createdAt: serverTimestamp(),
          createdBy: userProfile.uid,
        }
      )
      onSuccess({ id: ref.id })
    } catch (err) {
      console.error('CreateProductionForm submit:', err)
      setError('Failed to create production. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Create Production</h2>

      <form id={formId} onSubmit={handleSubmit} noValidate />

      <div className="space-y-6">

        {/* Title — the only required field */}
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-gray-700 mb-1">
            Production title <span className="text-red-500">*</span>
          </label>
          <input
            id={`${formId}-name`}
            form={formId}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Into the Woods, 2027 Winter Minifest, The Evening Series"
            autoFocus
            className={INPUT_CLASS}
          />
        </div>

        {/* Places */}
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">Where is this happening?</p>
          <PlacePicker
            places={places}
            selectedIds={placeIds}
            onAdd={place => setPlaceIds(prev => (prev.includes(place.id) ? prev : [...prev, place.id]))}
            onRemove={id => setPlaceIds(prev => prev.filter(p => p !== id))}
            hint="You can add or change this later."
            disabled={loading}
          />
        </div>

        {/* Dates */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DATE_FIELDS.map(f => (
              <div key={f.key}>
                <label htmlFor={`${formId}-${f.key}`} className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label}
                </label>
                <input
                  id={`${formId}-${f.key}`}
                  form={formId}
                  type="date"
                  value={dates[f.key]}
                  onChange={e => setDates(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Dates power the planning timeline. Add them when you're ready.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            form={formId}
            disabled={loading || !name.trim()}
            className="bg-spotlight hover:bg-spotlight/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Creating…' : 'Create Production'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
