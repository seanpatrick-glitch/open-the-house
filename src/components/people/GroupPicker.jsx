import { PERSON_GROUP, PERSON_GROUP_LABELS, PERSON_GROUP_ORDER } from '../../models/people';

// One line per Group: how the person is connected to the org. Nothing here
// mentions access; Group is taxonomy only and never sets a role.
const GROUP_HINTS = {
  [PERSON_GROUP.YOUR_PEOPLE]:   'Leads who carry decisions through the org.',
  [PERSON_GROUP.COMPANY]:       'Year-round: board, staff, returning volunteers.',
  [PERSON_GROUP.COLLABORATORS]: 'Here for a production: guest artists, cast, contractors.',
};

export default function GroupPicker({ value, onChange, hasError = false, disabled = false }) {
  return (
    <div
      role="radiogroup"
      aria-label="Group"
      className={`grid gap-2 ${hasError ? 'rounded-lg ring-2 ring-red-300 ring-offset-2' : ''}`}
    >
      {PERSON_GROUP_ORDER.map(group => {
        const selected = value === group;
        return (
          <button
            key={group}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(group)}
            className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
              selected
                ? 'border-places-blue bg-places-blue/10'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className={`block text-sm font-medium ${selected ? 'text-places-blue' : 'text-gray-900'}`}>
              {PERSON_GROUP_LABELS[group]}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">{GROUP_HINTS[group]}</span>
          </button>
        );
      })}
    </div>
  );
}
