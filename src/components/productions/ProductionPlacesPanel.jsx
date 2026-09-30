import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { getPlaceIds } from '../../models/productions'
import PlacePicker from './PlacePicker'
import toast from 'react-hot-toast'

// The Places section of a production's detail view. A production can use
// more than one Place (rehearsals in one space, performances in another).
// Admin and secondary admin add and remove them here, each change written
// straight away; anyone else sees them read-only. production is the live
// record; places is the org's Places.
export default function ProductionPlacesPanel({ production, places, canManage }) {
  const { userProfile } = useAuth()
  const ids = getPlaceIds(production)
  const nameById = Object.fromEntries(places.map(p => [p.id, p.name]))
  // A record from before placeIds existed has only placeId, so its first
  // change writes the whole list rather than adding to a missing field.
  const legacy = production.placeIds === undefined

  async function write(update) {
    try {
      await updateDoc(doc(db, 'organizations', userProfile.orgId, 'productions', production.id), update)
    } catch (err) {
      console.error('ProductionPlacesPanel write error:', err)
      toast.error('Could not update the places. Please try again.')
    }
  }

  function addPlace(place) {
    if (ids.includes(place.id)) return
    write({ placeIds: legacy ? [...ids, place.id] : arrayUnion(place.id) })
  }

  function removePlace(id) {
    write({ placeIds: legacy ? ids.filter(p => p !== id) : arrayRemove(id) })
  }

  return (
    // No overflow-hidden: it would clip the picker's search dropdown.
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Places</h2>
      </div>
      <div className="px-4 py-4">
        {canManage ? (
          <PlacePicker
            places={places}
            selectedIds={ids}
            onAdd={addPlace}
            onRemove={removePlace}
            hint="No places yet. Add where this production rehearses and performs."
          />
        ) : ids.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {ids.map(id => (
              <li key={id} className="px-3 py-1 rounded-full bg-spotlight/10 border border-spotlight/25 text-sm text-stage-navy">
                {nameById[id] ?? 'Unknown place'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">No places added yet.</p>
        )}
      </div>
    </section>
  )
}
