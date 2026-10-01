import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PERSON_GROUP_ORDER } from '../../models/people';
import { getPeopleOfType, getSignupLinksOfType, deletePersonType } from '../../utils/personTypes';
import { getDisplayName } from '../../utils/displayName';
import { TOGGLEABLE_LABELS } from './PersonFieldsEditor';
import GroupBadge from './GroupBadge';
import RoleBadge from './RoleBadge';
import PersonTypeForm from './PersonTypeForm';
import toast from 'react-hot-toast';

const groupRank = type => {
  const i = PERSON_GROUP_ORDER.indexOf(type.defaultGroup);
  return i === -1 ? PERSON_GROUP_ORDER.length : i;
};

function sortTypes(types) {
  return types.slice().sort((a, b) =>
    groupRank(a) - groupRank(b)
    || (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' })
  );
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

// Settings > Person Types. Types pre-fill Group and system role on person
// forms and never grant access themselves. Admin and secondary admin manage
// them (firestore.rules); everyone else sees the list read-only.
export default function PersonTypesSettings({ personTypes, canManage, departmentsEnabled, departments, departmentHeads }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;

  const [adding, setAdding]           = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [deleteCheck, setDeleteCheck] = useState(null); // { typeId, loading, people, links }
  const [deleting, setDeleting]       = useState(false);

  const formProps = { departmentsEnabled, departments, departmentHeads };
  const deptName = id => departments.find(d => d.id === id)?.name;
  const headName = uid => {
    const head = departmentHeads.find(h => h.uid === uid);
    return head ? getDisplayName(head) : null;
  };

  async function startDelete(type) {
    setEditingId(null);
    setAdding(false);
    setDeleteCheck({ typeId: type.id, loading: true, people: 0, links: 0 });
    try {
      const [people, links] = await Promise.all([
        getPeopleOfType(orgId, type.id),
        getSignupLinksOfType(orgId, type.id),
      ]);
      setDeleteCheck({ typeId: type.id, loading: false, people: people.length, links: links.length });
    } catch (err) {
      console.error('Error checking person type usage:', err);
      toast.error('Could not check who has this type. Please try again.');
      setDeleteCheck(null);
    }
  }

  async function confirmDelete(type) {
    setDeleting(true);
    try {
      await deletePersonType(orgId, type.id);
      toast.success(`${type.label} deleted.`);
      setDeleteCheck(null);
    } catch (err) {
      console.error('Error deleting person type:', err);
      toast.error('Could not delete this type. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Person Types</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define the types of people in your organization. Types pre-fill group and access defaults when you add someone new.
          </p>
        </div>
        {canManage && !adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); setDeleteCheck(null); }}
            className="flex-shrink-0 bg-places-blue hover:bg-places-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add Person Type
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4">
          <PersonTypeForm
            {...formProps}
            onSaved={() => { setAdding(false); toast.success('Person type added.'); }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {personTypes.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500 mb-0.5">No person types yet.</p>
          <p className="text-xs text-gray-400">Add a type to pre-fill group and access when you add people.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sortTypes(personTypes).map(type => {
            if (editingId === type.id) {
              return (
                <li key={type.id} className="py-3">
                  <PersonTypeForm
                    {...formProps}
                    type={type}
                    onSaved={() => { setEditingId(null); toast.success('Person type saved.'); }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              );
            }

            const extraFields = [
              ...Object.entries(type.toggleableFields || {}).filter(([, on]) => on).map(([k]) => TOGGLEABLE_LABELS[k] || k),
              ...(type.customFields || []).slice().sort((a, b) => a.order - b.order).map(f => f.label),
            ];
            const details = [
              departmentsEnabled && type.departmentId && deptName(type.departmentId),
              type.departmentHeadId && headName(type.departmentHeadId) && `Head: ${headName(type.departmentHeadId)}`,
              extraFields.length > 0 && `Collects ${extraFields.join(', ')}`,
            ].filter(Boolean);
            const check = deleteCheck?.typeId === type.id ? deleteCheck : null;

            return (
              <li key={type.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{type.label}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {type.defaultGroup
                        ? <GroupBadge group={type.defaultGroup} />
                        : <span className="text-xs text-gray-400">No default group</span>}
                      {type.defaultSystemRole
                        ? <RoleBadge access={type.defaultSystemRole} />
                        : <span className="text-xs text-gray-400">No default role</span>}
                    </div>
                    {details.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1.5">{details.join(' · ')}</p>
                    )}
                  </div>
                  {canManage && !check && (
                    <div className="flex-shrink-0 flex items-center gap-3">
                      <button
                        onClick={() => { setEditingId(type.id); setAdding(false); setDeleteCheck(null); }}
                        className="text-sm font-medium text-places-blue hover:text-places-blue/90 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => startDelete(type)}
                        className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {check && (
                  <div className="mt-3 border border-red-200 bg-red-50 rounded-lg p-4" role="alert">
                    {check.loading ? (
                      <p className="text-sm text-gray-600">Checking who has this type...</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 mb-1">Delete {type.label}?</p>
                        {check.people > 0 ? (
                          <p className="text-sm text-gray-700">
                            {check.people} {plural(check.people, 'person is', 'people are')} assigned this type.
                            They will keep their current group and access level. Their type field will be cleared.
                          </p>
                        ) : (
                          <p className="text-sm text-gray-700">No one is assigned this type.</p>
                        )}
                        {check.people > 0 && type.departmentHeadId && headName(type.departmentHeadId) && (
                          <p className="text-sm text-gray-700 mt-1">
                            {headName(type.departmentHeadId)} will no longer be able to edit them.
                          </p>
                        )}
                        {check.links > 0 && (
                          <p className="text-sm text-gray-700 mt-1">
                            {plural(check.links, 'Its signup link', `Its ${check.links} signup links`)} will stop working.
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            onClick={() => confirmDelete(type)}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                          >
                            {deleting ? 'Deleting...' : 'Delete type'}
                          </button>
                          <button
                            onClick={() => setDeleteCheck(null)}
                            disabled={deleting}
                            className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
