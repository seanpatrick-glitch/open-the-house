// Which org a signed-in user is working in. Every screen reads
// userProfile.orgId from AuthContext, so this is the one place that choice
// is made. Until there's an org switcher, the active org only changes when
// a link asks for it (?org= on an email link, or JoinPage after accepting an
// invite); otherwise the last-used org is kept.

const REQUESTED_KEY = 'requestedOrgId'
// A request that hasn't matched a membership within this window is dropped,
// so a stray ?org= link can't switch orgs much later.
const REQUEST_TTL_MS = 30 * 60 * 1000

function lastUsedKey(uid) {
  return `activeOrgId:${uid}`
}

// localStorage can throw (private windows, blocked site data) — every access
// is best-effort and the app falls back to picking an org on its own.
function read(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function readRequest() {
  try {
    const { orgId, at } = JSON.parse(read(REQUESTED_KEY) || 'null') || {}
    if (!orgId || Date.now() - at > REQUEST_TTL_MS) return null
    return orgId
  } catch {
    return null
  }
}

// Ask for an org to become active the next time the profile resolves.
export function requestActiveOrg(orgId) {
  if (orgId) write(REQUESTED_KEY, JSON.stringify({ orgId, at: Date.now() }))
}

// Captures ?org= from the URL the app was opened with. Runs once at load,
// before a sign-in redirect can drop the query string.
export function captureOrgParam() {
  try {
    const orgId = new URLSearchParams(window.location.search).get('org')
    if (orgId) requestActiveOrg(orgId)
  } catch {
    // ignore
  }
}

function joinedMillis(membership) {
  return membership?.joinedAt?.toMillis?.() ?? 0
}

// Picks the active org from a user's organizations map: a requested org they
// belong to, else the one they last used, else the one they joined most
// recently.
export function pickActiveOrg(uid, orgs) {
  const ids = Object.keys(orgs)
  let orgId = null

  const requested = readRequest()
  if (requested && ids.includes(requested)) {
    orgId = requested
    write(REQUESTED_KEY, null)
  } else {
    const lastUsed = read(lastUsedKey(uid))
    if (lastUsed && ids.includes(lastUsed)) orgId = lastUsed
  }

  if (!orgId) {
    orgId = ids.reduce(
      (best, id) => (joinedMillis(orgs[id]) > joinedMillis(orgs[best]) ? id : best),
      ids[0]
    )
  }

  write(lastUsedKey(uid), orgId)
  return orgId
}
