// googleCalendar.js — Google Calendar API integration for Show Prep
// Uses Google Identity Services (GIS) token model for OAuth 2.0

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CALENDAR_API   = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// Load the Google Identity Services script dynamically
export function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (existing) { existing.addEventListener('load', resolve); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = resolve
    document.head.appendChild(script)
  })
}

// Request a short-lived access token via OAuth popup
export function requestAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not set. See setup instructions.'))
      return
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error_description || resp.error))
        else resolve(resp.access_token)
      },
    })
    client.requestAccessToken()
  })
}

// Calculate the start date for each phase based on the opening date (YYYY-MM-DD)
export function calcPhaseDates(openingDateStr) {
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  }
  return {
    phase1:  addDays(openingDateStr, -42), // 6 weeks out
    phase2:  addDays(openingDateStr, -21), // 3 weeks out
    phase3:  addDays(openingDateStr, -14), // 2 weeks out
    phase4:  addDays(openingDateStr, -7),  // 1 week out / install
    opening: openingDateStr,
  }
}

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function createEvent(token, body) {
  const resp = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`Failed to create event: ${resp.status}`)
  return resp.json()
}

async function updateEvent(token, eventId, body) {
  const resp = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  return resp // may be 404 if user deleted from calendar
}

// Create or update a single all-day calendar event
async function upsertEvent(token, existingId, summary, date, description) {
  const body = {
    summary,
    description,
    start: { date },
    end:   { date: nextDay(date) },
  }
  if (existingId) {
    const resp = await updateEvent(token, existingId, body)
    if (resp.ok) return resp.json()
    // Event was deleted from Google Calendar — create a new one
  }
  return createEvent(token, body)
}

// Sync all 5 timeline events for a show. Returns an object of { key: eventId }
export async function syncShowToCalendar(token, show, existingEventIds = {}) {
  const dates = calcPhaseDates(show.openingDate)
  const title = show.title || 'Show'

  const events = [
    {
      key:  'phase1',
      summary: `${title} — Phase 1: Planning & Alignment`,
      date: dates.phase1,
      description: 'Phase 1 begins (4–6 weeks before opening). Planning & Alignment.',
    },
    {
      key:  'phase2',
      summary: `${title} — Phase 2: Resource & Concept`,
      date: dates.phase2,
      description: 'Phase 2 begins (3 weeks before opening). Resource & Concept.',
    },
    {
      key:  'phase3',
      summary: `${title} — Phase 3: Ordering & Finalizing`,
      date: dates.phase3,
      description: 'Phase 3 begins (2 weeks before opening). Ordering & Finalizing.',
    },
    {
      key:  'phase4',
      summary: `${title} — Phase 4: Install Week`,
      date: dates.phase4,
      description: 'Phase 4 begins (1 week before opening). Install Week.',
    },
    {
      key:  'opening',
      summary: `${title} — Opening Night`,
      date: dates.opening,
      description: 'Opening Night!',
    },
  ]

  const newEventIds = {}
  for (const ev of events) {
    const result = await upsertEvent(token, existingEventIds[ev.key], ev.summary, ev.date, ev.description)
    newEventIds[ev.key] = result.id
  }
  return newEventIds
}

// Fetch the current dates stored on Google Calendar for each event ID
export async function pullCalendarDates(token, eventIds) {
  const dates = {}
  for (const [key, id] of Object.entries(eventIds)) {
    try {
      const resp = await fetch(`${CALENDAR_API}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) {
        const ev = await resp.json()
        dates[key] = ev.start?.date || null
      }
    } catch {
      // ignore individual failures
    }
  }
  return dates
}
