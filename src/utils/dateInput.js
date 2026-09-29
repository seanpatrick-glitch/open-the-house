import { Timestamp } from 'firebase/firestore'

// Converts between an <input type="date"> value ('YYYY-MM-DD') and a
// Firestore Timestamp at local midnight. An empty input is null both ways.

export function dateInputToTimestamp(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return Timestamp.fromDate(new Date(year, month - 1, day))
}

export function timestampToDateInput(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
