// Shared display-name resolution for user docs, org members, and person records.

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

// A name candidate doesn't count as a real name if it's an email address —
// JoinPage/PersonJoinPage's displayName field is free-text, and real member
// data shows several accounts where someone just typed their email into it.
function looksLikeEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

// True when a real name is on file (displayName, fieldValues.name, or name,
// and not an email address). False means getDisplayName(entity) is about to
// resolve to something email-shaped — callers that render the result as a
// name should style that fallback so it doesn't read as a resolved name.
export function hasDisplayName(entity) {
  if (!entity) return false;
  const candidate = entity.displayName?.trim() || entity.fieldValues?.name?.trim() || entity.name?.trim();
  return Boolean(candidate) && !looksLikeEmail(candidate);
}

export function getDisplayName(entity) {
  if (!entity) return '';
  return entity.displayName?.trim()
    || entity.fieldValues?.name?.trim()
    || entity.name?.trim()
    || entity.email
    || entity.fieldValues?.email
    || '';
}
