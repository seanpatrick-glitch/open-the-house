import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FIELD_TYPES } from '../../models/people';

const TOGGLEABLE_FIELDS = [
  { key: 'address',              label: 'Address' },
  { key: 'dateOfBirth',          label: 'Date of Birth' },
  { key: 'tShirtSize',           label: 'T-Shirt Size' },
  { key: 'dietaryRestrictions',  label: 'Dietary Restrictions' },
  { key: 'accessibilityNeeds',   label: 'Accessibility Needs' },
];

const CUSTOM_FIELD_TYPES = [
  { value: FIELD_TYPES.TEXT,           label: 'Text' },
  { value: FIELD_TYPES.DATE,           label: 'Date' },
  { value: FIELD_TYPES.SELECT,         label: 'Select' },
  { value: FIELD_TYPES.MULTISELECT,    label: 'Multiselect' },
  { value: FIELD_TYPES.CHECKBOX_GROUP, label: 'Checkbox group' },
];

const OPTION_TYPES = [FIELD_TYPES.SELECT, FIELD_TYPES.MULTISELECT, FIELD_TYPES.CHECKBOX_GROUP];
const needsOptions = type => OPTION_TYPES.includes(type);

export default function CreatePersonTypeForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [label, setLabel]             = useState('');
  const [description, setDescription] = useState('');
  const [toggledFields, setToggledFields] = useState({});
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const [departmentsEnabled, setDepartmentsEnabled] = useState(false);
  const [departments, setDepartments]               = useState([]);
  const [departmentId, setDepartmentId]              = useState('');

  const [customFields, setCustomFields] = useState([]);
  const [optionInputs, setOptionInputs] = useState({});
  const nextOrderRef = useRef(0);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        const enabled = orgSnap.exists() ? (orgSnap.data().departmentsEnabled ?? false) : false;
        setDepartmentsEnabled(enabled);
        if (enabled) {
          const snap = await getDocs(query(collection(db, 'departments'), where('orgId', '==', orgId)));
          setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error('CreatePersonTypeForm loadDepartments error:', err);
      }
    })();
  }, [orgId]);

  function toggleField(key) {
    setToggledFields(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function addCustomField() {
    setCustomFields(prev => [...prev, {
      fieldId:  crypto.randomUUID(),
      label:    '',
      type:     FIELD_TYPES.TEXT,
      options:  [],
      required: false,
      order:    nextOrderRef.current++,
    }]);
  }

  function removeCustomField(fieldId) {
    setCustomFields(prev => prev.filter(f => f.fieldId !== fieldId));
  }

  function updateCustomFieldLabel(fieldId, value) {
    setCustomFields(prev => prev.map(f => f.fieldId === fieldId ? { ...f, label: value } : f));
  }

  function updateCustomFieldType(fieldId, value) {
    setCustomFields(prev => prev.map(f => f.fieldId === fieldId ? { ...f, type: value } : f));
  }

  function toggleCustomFieldRequired(fieldId) {
    setCustomFields(prev => prev.map(f => f.fieldId === fieldId ? { ...f, required: !f.required } : f));
  }

  function addCustomFieldOption(fieldId) {
    const value = (optionInputs[fieldId] || '').trim();
    if (!value) return;
    setCustomFields(prev => prev.map(f =>
      f.fieldId === fieldId && !f.options.includes(value)
        ? { ...f, options: [...f.options, value] }
        : f
    ));
    setOptionInputs(prev => ({ ...prev, [fieldId]: '' }));
  }

  function removeCustomFieldOption(fieldId, option) {
    setCustomFields(prev => prev.map(f =>
      f.fieldId === fieldId ? { ...f, options: f.options.filter(o => o !== option) } : f
    ));
  }

  async function handleSave() {
    if (!label.trim()) {
      setError('A label is required.');
      return;
    }
    if (departmentsEnabled && !departmentId) {
      setError('A department is required.');
      return;
    }
    for (const field of customFields) {
      if (!field.label.trim()) {
        setError('Each custom field needs a name.');
        return;
      }
      if (needsOptions(field.type) && field.options.length === 0) {
        setError(`${field.label.trim()} needs at least one choice.`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const toggleableFields = {};
      TOGGLEABLE_FIELDS.forEach(f => {
        toggleableFields[f.key] = toggledFields[f.key] ?? false;
      });

      await addDoc(
        collection(db, 'organizations', orgId, 'personTypes'),
        {
          label:           label.trim(),
          description:     description.trim(),
          orgId,
          departmentHeadId: null,
          departmentId:    departmentsEnabled ? departmentId : null,
          createdBy:       uid,
          createdAt:       serverTimestamp(),
          active:          true,
          universalFields: {
            name:             true,
            email:            true,
            phone:            true,
            emergencyContact: true,
          },
          toggleableFields,
          customFields: customFields.map(f => ({
            fieldId:  f.fieldId,
            label:    f.label.trim(),
            type:     f.type,
            options:  needsOptions(f.type) ? f.options : [],
            required: f.required,
            order:    f.order,
          })),
        }
      );
      onSuccess();
    } catch (err) {
      console.error('CreatePersonTypeForm error:', err);
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-5">New Person Type</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Artist, Volunteer, Staff"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {departmentsEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a department</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional. What is this type of person?"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Universal Fields</p>
          <p className="text-xs text-gray-400 mb-2">Always collected. Cannot be turned off.</p>
          <div className="flex flex-wrap gap-2">
            {['Name', 'Email', 'Phone', 'Emergency Contact'].map(f => (
              <span key={f} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Optional Fields</p>
          <p className="text-xs text-gray-400 mb-3">Turn on the fields you want to collect for this type.</p>
          <div className="space-y-2">
            {TOGGLEABLE_FIELDS.map(field => (
              <div key={field.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-700">{field.label}</span>
                <button
                  type="button"
                  onClick={() => toggleField(field.key)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    toggledFields[field.key] ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={toggledFields[field.key] ?? false}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    toggledFields[field.key] ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Custom Fields</p>
          <p className="text-xs text-gray-400 mb-3">Add fields specific to this person type.</p>
          <div className="space-y-3">
            {customFields.map(field => (
              <div key={field.fieldId} className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => updateCustomFieldLabel(field.fieldId, e.target.value)}
                    placeholder="Field name"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.fieldId)}
                    className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <select
                  value={field.type}
                  onChange={e => updateCustomFieldType(field.fieldId, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CUSTOM_FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                {needsOptions(field.type) && (
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {field.options.map(opt => (
                        <span key={opt} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {opt}
                          <button
                            type="button"
                            onClick={() => removeCustomFieldOption(field.fieldId, opt)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={optionInputs[field.fieldId] || ''}
                        onChange={e => setOptionInputs(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomFieldOption(field.fieldId); } }}
                        placeholder="Add a choice"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomFieldOption(field.fieldId)}
                        disabled={!(optionInputs[field.fieldId] || '').trim()}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">Required</span>
                  <button
                    type="button"
                    onClick={() => toggleCustomFieldRequired(field.fieldId)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      field.required ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={field.required}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      field.required ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCustomField}
            className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Add Field
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving || !label.trim() || (departmentsEnabled && !departmentId)}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Person Type'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
