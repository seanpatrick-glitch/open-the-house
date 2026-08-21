import React, { useState } from 'react'
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { PRODUCTION_SCOPE } from '../../models/productions'
import { withFieldError, FieldError } from '../shared/FormField'

const STATUS_OPTIONS = [
  { value: 'planning',    label: 'Planning' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'open',        label: 'Open' },
  { value: 'closed',      label: 'Closed' },
]

const SCOPE_OPTIONS = [
  { value: PRODUCTION_SCOPE.SINGLE,   label: 'Single production' },
  { value: PRODUCTION_SCOPE.SEASON,   label: 'Season' },
  { value: PRODUCTION_SCOPE.FESTIVAL, label: 'Festival' },
]

function localDateToTimestamp(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return Timestamp.fromDate(new Date(year, month - 1, day))
}

export default function CreateProductionForm({ places, onSuccess, onCancel }) {
  const { userProfile } = useAuth()

  const [name,         setName]         = useState('')
  const [displayLabel, setDisplayLabel] = useState('')
  const [placeId,      setPlaceId]      = useState(places[0]?.id ?? '')
  const [scope,        setScope]        = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [status,       setStatus]       = useState('planning')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)
  const [fieldErrors,  setFieldErrors]  = useState({})

  function getFieldErrors() {
    const errors = {}
    if (!name.trim()) errors.name = 'Production name is required.'
    if (!placeId)     errors.placeId = 'Place is required.'
    if (!scope)        errors.scope = 'Scope is required.'
    if (!startDate)    errors.startDate = 'Start date is required.'
    if (!endDate)      errors.endDate = 'End date is required.'
    return errors
  }

  function clearFieldError(key) {
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = getFieldErrors()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setLoading(true)
    setError('')

    try {
      const ref = await addDoc(
        collection(db, 'organizations', userProfile.orgId, 'places', placeId, 'productions'),
        {
          name:         name.trim(),
          displayLabel: displayLabel.trim() || 'Production',
          placeId,
          orgId:        userProfile.orgId,
          scope,
          startDate:    localDateToTimestamp(startDate),
          endDate:      localDateToTimestamp(endDate),
          status,
          activeModules: {
            volunteerScheduling: false,
          },
          createdAt: serverTimestamp(),
          createdBy: userProfile.uid,
          openDate:  localDateToTimestamp(startDate),
          closeDate: localDateToTimestamp(endDate),
          venueId:   placeId,
        }
      )

      setSuccess(true)
      setLoading(false)
      setName('')
      setDisplayLabel('')
      setPlaceId(places[0]?.id ?? '')
      setScope('')
      setStartDate('')
      setEndDate('')
      setStatus('planning')
      setFieldErrors({})

      setTimeout(() => {
        setSuccess(false)
        // id/placeId passed for callers that need to reference the just-created
        // production (e.g. the onboarding wizard setting activeProdId); existing
        // callers that call onSuccess() with no args are unaffected.
        onSuccess({ id: ref.id, placeId })
      }, 1500)
    } catch (err) {
      console.error('CreateProductionForm submit:', err)
      setError('Failed to create production. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Create Production</h2>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-700 font-medium">Production created successfully.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>

        {/* Production name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Production name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); clearFieldError('name') }}
            placeholder="e.g. The Tempest"
            className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent', !!fieldErrors.name)}
          />
          <FieldError message={fieldErrors.name} />
        </div>

        {/* Display label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display label
          </label>
          <input
            type="text"
            value={displayLabel}
            onChange={e => setDisplayLabel(e.target.value)}
            placeholder="e.g. Show, Event, Festival. Defaults to Production if left blank"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent"
          />
        </div>

        {/* Place */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Place <span className="text-red-500">*</span>
          </label>
          <select
            value={placeId}
            onChange={e => { setPlaceId(e.target.value); clearFieldError('placeId') }}
            className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent', !!fieldErrors.placeId)}
          >
            {places.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <FieldError message={fieldErrors.placeId} />
        </div>

        {/* Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scope <span className="text-red-500">*</span>
          </label>
          <select
            value={scope}
            onChange={e => { setScope(e.target.value); clearFieldError('scope') }}
            className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent', !!fieldErrors.scope)}
          >
            <option value="">Select scope...</option>
            {SCOPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <FieldError message={fieldErrors.scope} />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); clearFieldError('startDate') }}
              className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent', !!fieldErrors.startDate)}
            />
            <FieldError message={fieldErrors.startDate} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); clearFieldError('endDate') }}
              className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent', !!fieldErrors.endDate)}
            />
            <FieldError message={fieldErrors.endDate} />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
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

      </form>
    </div>
  )
}
