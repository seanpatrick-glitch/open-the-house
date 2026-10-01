import { withFieldError } from '../shared/FormField';
import { ACCESS_LABELS, ACCESS_ORDER } from './RoleBadge';

// Picks an access level (Admin / Department Head / Member). Used for a person
// type's default and a People record's intendedRole. Neither grants access;
// a login's role is only ever set by the Cloud Functions.
export default function SystemRoleSelect({ value, onChange, hasError = false, disabled = false, id }) {
  return (
    <select
      id={id}
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      disabled={disabled}
      className={withFieldError('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-places-blue disabled:opacity-50', hasError)}
    >
      <option value="">Select a role...</option>
      {ACCESS_ORDER.map(access => (
        <option key={access} value={access}>{ACCESS_LABELS[access]}</option>
      ))}
    </select>
  );
}
