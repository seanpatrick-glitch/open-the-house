import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import PersonFieldsEditor, { validatePersonFields, cleanFieldValues } from './PersonFieldsEditor';
import GroupPicker from './GroupPicker';
import PersonTypePicker from './PersonTypePicker';
import SystemRoleSelect from './SystemRoleSelect';
import { FieldError } from '../shared/FormField';

const UNIVERSAL_KEYS = ['name', 'email', 'phone', 'emergencyContact'];

export default function CreatePersonForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid, role: viewerRole } = userProfile;
  // A Department Head may only create people of a type they head
  // (firestore.rules), so for them a type stays required.
  const typeRequired = !['admin', 'secondaryAdmin'].includes(viewerRole);

  const [personTypes, setPersonTypes]     = useState([]);
  const [selectedType, setSelectedType]   = useState(null);
  const [group, setGroup]                 = useState(null);
  const [intendedRole, setIntendedRole]   = useState(null);
  const [fieldValues, setFieldValues]     = useState({});
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [fieldErrors, setFieldErrors]     = useState({});

  const clearFieldError = key =>
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));

  // Type suggests, it doesn't set: picking one pre-fills Group and system
  // role with its defaults, and both stay editable. Clearing the type leaves
  // whatever is already chosen.
  function handleTypeChange(type) {
    setSelectedType(type);
    clearFieldError('personType');
    // The previous type's own fields go; what's typed in the always-shown
    // fields (name, email, phone, emergency contact) stays.
    setFieldValues(prev => Object.fromEntries(
      Object.entries(prev).filter(([k]) => UNIVERSAL_KEYS.includes(k))
    ));
    if (type?.defaultGroup) { setGroup(type.defaultGroup); clearFieldError('group'); }
    if (type?.defaultSystemRole) { setIntendedRole(type.defaultSystemRole); clearFieldError('role'); }
  }

  useEffect(() => {
    if (!orgId) return;
    getDocs(query(
      collection(db, 'organizations', orgId, 'personTypes'),
      where('active', '==', true)
    )).then(snap => {
      const types = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPersonTypes(types);
      if (types.length === 1) handleTypeChange(types[0]);
    });
  }, [orgId]);

  function setField(key, value) {
    setFieldValues(prev => ({ ...prev, [key]: value }));
    if (key === 'name') clearFieldError('name');
  }

  async function handleSave() {
    const errors = {};
    if (typeRequired && !selectedType) errors.personType = 'Choose a person type.';
    if (!group) errors.group = 'Choose a group.';
    if (!intendedRole) errors.role = 'Choose a system role.';
    const nameError = validatePersonFields(fieldValues);
    if (nameError) errors.name = nameError;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError('');
    try {
      const person = {
        orgId,
        typeId:      selectedType?.id ?? null,
        typeLabel:   selectedType?.label ?? null,
        uid:         null,
        group,
        intendedRole,
        status:      'active',
        createdBy:   uid,
        createdAt:   serverTimestamp(),
        approvedBy:  uid,
        approvedAt:  serverTimestamp(),
        assignments: [],
        totalHours:  0,
        accountUid:    null,
        accountStatus: 'no_account',
        staff:         false,
        fieldValues: cleanFieldValues(fieldValues),
      };
      const ref = await addDoc(collection(db, 'organizations', orgId, 'people'), person);
      // The new record goes back to callers that pick up right where they
      // left off (the Production Team and Cast add flow pre-selects it).
      // Callers that call onSuccess() with no args are unaffected.
      onSuccess({ id: ref.id, ...person });
    } catch (err) {
      console.error('CreatePersonForm error:', err);
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Add Person</h3>

      <div className="space-y-4">

        <div>
          <label htmlFor="add-person-type" className="block text-sm font-medium text-gray-700 mb-1">
            Person type {typeRequired && <span className="text-red-500">*</span>}
          </label>
          <PersonTypePicker
            id="add-person-type"
            types={personTypes}
            value={selectedType?.id ?? null}
            onChange={handleTypeChange}
            hasError={!!fieldErrors.personType}
          />
          <FieldError message={fieldErrors.personType} />
          <p className="text-xs text-gray-500 mt-1">
            Selecting a type pre-fills group and access defaults. You can adjust them before saving.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Group <span className="text-red-500">*</span>
          </label>
          <GroupPicker
            value={group}
            onChange={g => { setGroup(g); clearFieldError('group'); }}
            hasError={!!fieldErrors.group}
          />
          <FieldError message={fieldErrors.group} />
        </div>

        <div>
          <label htmlFor="add-person-role" className="block text-sm font-medium text-gray-700 mb-1">
            System role <span className="text-red-500">*</span>
          </label>
          <SystemRoleSelect
            id="add-person-role"
            value={intendedRole}
            onChange={r => { setIntendedRole(r); clearFieldError('role'); }}
            hasError={!!fieldErrors.role}
          />
          <FieldError message={fieldErrors.role} />
          <p className="text-xs text-gray-500 mt-1">
            For reference. If this person gets a login, its access is set in Settings &gt; Access.
          </p>
        </div>

        <PersonFieldsEditor personType={selectedType} fieldValues={fieldValues} setField={setField} nameError={fieldErrors.name} />
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={handleSave}
          disabled={saving}
          className="bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {saving ? 'Saving...' : 'Save Person'}
        </button>
        <button onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
