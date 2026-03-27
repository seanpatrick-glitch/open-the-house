// useAutoSave.js — handles debounced auto-saving to Firestore
// "Debounced" means: wait 700ms after the user stops typing, then save.
// This prevents saving on every single keystroke, which would be wasteful.

import { useState, useCallback, useRef } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function useAutoSave(showId) {
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'pending' | 'saving' | 'error'
  const timers = useRef({}) // one timer per field path

  // Call save(fieldPath, value) whenever a field changes.
  // fieldPath supports dot notation, e.g. 'phase1Fields.lobbyConcept'
  const save = useCallback((fieldPath, value) => {
    setSaveStatus('pending')

    // Clear any existing timer for this specific field
    if (timers.current[fieldPath]) {
      clearTimeout(timers.current[fieldPath])
    }

    // Set a new timer — fires 700ms after the last keystroke
    timers.current[fieldPath] = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await updateDoc(doc(db, 'shows', showId), {
          [fieldPath]: value,
          updatedAt: serverTimestamp(),
        })
        setSaveStatus('saved')
      } catch (err) {
        console.error('Auto-save error:', err)
        setSaveStatus('error')
      }
    }, 700)
  }, [showId])

  return { save, saveStatus }
}
