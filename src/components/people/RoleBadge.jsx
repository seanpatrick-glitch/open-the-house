import { ACCESS, accessLevel } from '../../models/roles';

export const ACCESS_LABELS = {
  [ACCESS.ADMIN]:           'Admin',
  [ACCESS.DEPARTMENT_HEAD]: 'Department Head',
  [ACCESS.BASE]:            'Member',
};

export const ACCESS_ORDER = [ACCESS.ADMIN, ACCESS.DEPARTMENT_HEAD, ACCESS.BASE];

// System role (access level) as a small badge. Display only: the role shown
// comes from the members doc copy, never read for routing or permissions.
// Pass `role` for a stored role value, or `access` for an access level
// already resolved (a person type's default, a People record's intendedRole).
// Renders nothing when there's no role to show.
export default function RoleBadge({ role, access }) {
  const label = ACCESS_LABELS[access ?? accessLevel(role)];
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0">
      {label}
    </span>
  );
}
