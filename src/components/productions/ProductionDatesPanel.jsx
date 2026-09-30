import { useState, useId } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { dateInputToTimestamp, timestampToDateInput } from '../../utils/dateInput'
import toast from 'react-hot-toast'

const INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spotlight focus:border-transparent'

const DATE_FIELDS = [
  { key: 'firstRehearsal', label: 'First rehearsal' },
  { key: 'openDate',       label: 'Opens' },
  { key: 'closeDate',      label: 'Closes' },
]

function formatDate(ts) {
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// The Dates section of a production's detail view: first rehearsal, opens
// and closes, each optional and independent. Admin and secondary admin edit
// them here (the productions update rule allows no one else); anyone else
// sees them read-only. production is the live record.
export default function ProductionDatesPanel({ production, canManage }) {
  const { userProfile } = useAuth()
  const baseId = useId()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState({})
  const [saving,  setSaving]  = useState(false)

  const hasAny = DATE_FIELDS.some(f => production[f.key])

  function startEdit() {
    setDraft(Object.fromEntries(DATE_FIELDS.map(f => [f.key, timestampToDateInput(production[f.key])])))
    setEditing(true)
  }

  async function save(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await updateDoc(
        doc(db, 'organizations', userProfile.orgId, 'productions', production.id),
        Object.fromEntries(DATE_FIELDS.map(f => [f.key, dateInputToTimestamp(draft[f.key])]))
      )
      setEditing(false)
    } catch (err) {
      console.error('ProductionDatesPanel save error:', err)
      toast.error('Could not save the dates. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Dates</h2>
        {canManage && hasAny && !editing && (
          <button onClick={startEdit}
            className="text-xs font-medium text-places-blue hover:text-places-blue/90 transition-colors">
            Edit dates
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} noValidate className="px-4 py-4 bg-gray-50 rounded-b-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DATE_FIELDS.map(f => (
              <div key={f.key}>
                <label htmlFor={`${baseId}-${f.key}`} className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  id={`${baseId}-${f.key}`}
                  type="date"
                  value={draft[f.key]}
                  onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">All optional. Clear a date to remove it.</p>
          <div className="flex items-center gap-3 mt-4">
            <button type="submit" disabled={saving}
              className="bg-spotlight hover:bg-spotlight/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Save dates'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : hasAny ? (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 py-4">
          {DATE_FIELDS.map(f => (
            <div key={f.key}>
              <dt className="text-xs font-medium text-gray-500">{f.label}</dt>
              <dd className={`text-sm mt-0.5 ${production[f.key] ? 'text-gray-900' : 'text-gray-400'}`}>
                {production[f.key] ? formatDate(production[f.key]) : 'Not set'}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No dates yet. Dates power the planning timeline.</p>
          {canManage && (
            <button onClick={startEdit}
              className="mt-3 text-sm font-medium text-places-blue hover:text-places-blue/90 transition-colors">
              + Add dates
            </button>
          )}
        </div>
      )}
    </section>
  )
}
