import { PERSON_GROUP } from '../../models/people';

const GROUP_LABELS = {
  [PERSON_GROUP.YOUR_PEOPLE]:   'Your People',
  [PERSON_GROUP.COMPANY]:       'Company',
  [PERSON_GROUP.COLLABORATORS]: 'Collaborators',
};

// Taxonomy Group as a small badge. Renders nothing when no Group is on file,
// which is every record until the taxonomy build lands.
export default function GroupBadge({ group }) {
  const label = GROUP_LABELS[group];
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stage-navy/5 text-stage-navy border border-stage-navy/10 flex-shrink-0">
      {label}
    </span>
  );
}
