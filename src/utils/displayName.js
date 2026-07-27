// Shared display-name resolution for user docs, org members, and person records.

export function getDisplayName(entity) {
  if (!entity) return '';
  return entity.displayName?.trim()
    || entity.fieldValues?.name?.trim()
    || entity.name?.trim()
    || entity.email
    || entity.fieldValues?.email
    || '';
}
