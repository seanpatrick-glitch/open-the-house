import { ACCESS, accessLevel } from '../../models/roles';

const ACCESS_LABELS = {
  [ACCESS.ADMIN]:           'Admin',
  [ACCESS.DEPARTMENT_HEAD]: 'Department Head',
  [ACCESS.BASE]:            'Member',
};

// System role (access level) as a small badge. Display only: the role shown
// comes from the members doc copy, never read for routing or permissions.
// Renders nothing for someone without a login in this org.
export default function RoleBadge({ role }) {
  const label = ACCESS_LABELS[accessLevel(role)];
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0">
      {label}
    </span>
  );
}
