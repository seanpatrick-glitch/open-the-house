import { PERSON_GROUP_LABELS } from '../../models/people';

// Taxonomy Group as a small badge. Renders nothing when no Group is on file.
export default function GroupBadge({ group }) {
  const label = PERSON_GROUP_LABELS[group];
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stage-navy/5 text-stage-navy border border-stage-navy/10 flex-shrink-0">
      {label}
    </span>
  );
}
