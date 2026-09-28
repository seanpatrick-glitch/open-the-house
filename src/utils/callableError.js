// User-facing message for a failed Cloud Functions call. A deliberate
// HttpsError from our functions carries a message written for people
// ("This invite has expired..."); anything else (internal errors, network
// failures) falls back to the caller's generic message.
export function callableErrorMessage(err, fallback) {
  const code = err?.code || ''
  const deliberate = code.startsWith('functions/')
    && code !== 'functions/internal'
    && code !== 'functions/unavailable'
    && code !== 'functions/unknown'
  return deliberate && err.message ? err.message : fallback
}
