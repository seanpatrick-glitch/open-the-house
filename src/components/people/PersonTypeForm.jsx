import { useState, useRef } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FIELD_TYPES, PERSON_GROUP_LABELS, PERSON_GROUP_ORDER } from '../../models/people';
import { NO_TOGGLEABLE_FIELDS, newPersonTypeDoc } from '../../models/personTypes';
import { syncTypeLabel } from '../../utils/personTypes';
import { getDisplayName } from '../../utils/displayName';
import SystemRoleSelect from './SystemRoleSelect';
import { withFieldError, FieldError } from '../shared/FormField';

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

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-places-blue';

// Inline add/edit panel for one person type (Settings > Person Types). Pass
// `type` to edit it; leave it out to add a new one. Name, default group and
// default system role are required. The fields a type collects, its
// department and its Department Head are optional.
export default function PersonTypeForm({ type = null, departmentsEnabled, departments, departmentHeads, onSaved, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;
  const isEdit = Boolean(type);

  const [label, setLabel]                   = useState(type?.label ?? '');
  const [defaultGroup, setDefaultGroup]     = useState(type?.defaultGroup ?? '');
  const [defaultSystemRole, setDefaultRole] = useState(type?.defaultSystemRole ?? null);
  const [departmentId, setDepartmentId]     = useState(type?.departmentId ?? '');
  const [departmentHeadId, setHeadId]       = useState(type?.departmentHeadId ?? '');
  const [description, setDescription]       = useState(type?.description ?? '');
  const [toggledFields, setToggledFields]   = useState({ ...NO_TOGGLEABLE_FIELDS, ...(type?.toggleableFields || {}) });
  const [customFields, setCustomFields]     = useState(
    (type?.customFields || []).slice().sort((a, b) => a.order - b.order)
  );
  const [optionInputs, setOptionInputs]     = useState({});
  const nextOrderRef = useRef(Math.max(-1, ...(type?.customFields || []).map(f => f.order ?? 0)) + 1);

  const hasExtras = Boolean(type?.description)
    || Object.values(type?.toggleableFields || {}).some(Boolean)
    || (type?.customFields || []).length > 0;
  const [showExtras, setShowExtras] = useState(hasExtras);

  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = key =>
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));

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

  function updateCustomField(fieldId, changes) {
    setCustomFields(prev => prev.map(f => f.fieldId === fieldId ? { ...f, ...changes } : f));
  }

  function removeCustomField(fieldId) {
    setCustomFields(prev => prev.filter(f => f.fieldId !== fieldId));
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
    const errors = {};
    if (!label.trim()) errors.label = 'Give the type a name.';
    if (!defaultGroup) errors.group = 'Choose a default group.';
    if (!defaultSystemRole) errors.role = 'Choose a default system role.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    for (const field of customFields) {
      if (!field.label.trim()) {
        setShowExtras(true);
        setError('Each custom field needs a name.');
        return;
      }
      if (needsOptions(field.type) && field.options.length === 0) {
        setShowExtras(true);
        setError(`${field.label.trim()} needs at least one choice.`);
        return;
      }
    }

    setSaving(true);
    setError('');
    const fields = {
      label:            label.trim(),
      description:      description.trim(),
      defaultGroup,
      defaultSystemRole,
      departmentId:     departmentsEnabled ? (departmentId || null) : (type?.departmentId ?? null),
      departmentHeadId: departmentHeadId || null,
      toggleableFields: Object.fromEntries(
        TOGGLEABLE_FIELDS.map(f => [f.key, Boolean(toggledFields[f.key])])
      ),
      customFields: customFields.map(f => ({
        fieldId:  f.fieldId,
        label:    f.label.trim(),
        type:     f.type,
        options:  needsOptions(f.type) ? f.options : [],
        required: f.required,
        order:    f.order,
      })),
    };
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'organizations', orgId, 'personTypes', type.id), fields);
        if (fields.label !== type.label) await syncTypeLabel(orgId, type.id, fields.label);
      } else {
        await addDoc(
          collection(db, 'organizations', orgId, 'personTypes'),
          newPersonTypeDoc({ ...fields, orgId, createdBy: uid })
        );
      }
      onSaved();
    } catch (err) {
      console.error('PersonTypeForm save error:', err);
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  const idPrefix = `person-type-${type?.id ?? 'new'}`;

  return (
    <div className="border border-places-blue/20 bg-places-blue/5 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {isEdit ? `Edit ${type.label}` : 'New person type'}
      </h3>

      <div className="space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-gray-700 mb-1">
            Type name <span className="text-red-500">*</span>
          </label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            value={label}
            onChange={e => { setLabel(e.target.value); clearFieldError('label'); }}
            placeholder="e.g. Lighting Designer"
            className={withFieldError(INPUT, !!fieldErrors.label)}
          />
          <FieldError message={fieldErrors.label} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-group`} className="block text-sm font-medium text-gray-700 mb-1">
              Default group <span className="text-red-500">*</span>
            </label>
            <select
              id={`${idPrefix}-group`}
              value={defaultGroup}
              onChange={e => { setDefaultGroup(e.target.value); clearFieldError('group'); }}
              className={withFieldError(INPUT, !!fieldErrors.group)}
            >
              <option value="">Select a group...</option>
              {PERSON_GROUP_ORDER.map(g => (
                <option key={g} value={g}>{PERSON_GROUP_LABELS[g]}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.group} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-role`} className="block text-sm font-medium text-gray-700 mb-1">
              Default system role <span className="text-red-500">*</span>
            </label>
            <SystemRoleSelect
              id={`${idPrefix}-role`}
              value={defaultSystemRole}
              onChange={r => { setDefaultRole(r); clearFieldError('role'); }}
              hasError={!!fieldErrors.role}
            />
            <FieldError message={fieldErrors.role} />
          </div>
        </div>

        <div className={`grid gap-4 ${departmentsEnabled ? 'sm:grid-cols-2' : ''}`}>
          {departmentsEnabled && (
            <div>
              <label htmlFor={`${idPrefix}-dept`} className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                id={`${idPrefix}-dept`}
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className={INPUT}
              >
                <option value="">None</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={`${idPrefix}-head`} className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
            <select
              id={`${idPrefix}-head`}
              value={departmentHeadId}
              onChange={e => setHeadId(e.target.value)}
              disabled={departmentHeads.length === 0}
              className={`${INPUT} disabled:opacity-50`}
            >
              <option value="">None</option>
              {departmentHeads.map(dh => (
                <option key={dh.uid} value={dh.uid}>{getDisplayName(dh)}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {departmentHeads.length === 0
                ? 'Invite a Department Head first to assign one here.'
                : 'Can add and edit people of this type.'}
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowExtras(v => !v)}
            aria-expanded={showExtras}
            className="text-sm font-medium text-places-blue hover:text-places-blue/90 transition-colors"
          >
            {showExtras ? '▾' : '▸'} Fields to collect (optional)
          </button>
        </div>

        {showExtras && (
          <div className="space-y-4 border-t border-places-blue/10 pt-4">
            <div>
              <label htmlFor={`${idPrefix}-desc`} className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                id={`${idPrefix}-desc`}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional. What is this type of person?"
                rows={2}
                className={`${INPUT} resize-none`}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Always collected</p>
              <div className="flex flex-wrap gap-2">
                {['Name', 'Email', 'Phone', 'Emergency Contact'].map(f => (
                  <span key={f} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Optional fields</p>
              <div className="space-y-2">
                {TOGGLEABLE_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700">{field.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleField(field.key)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        toggledFields[field.key] ? 'bg-places-blue' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={Boolean(toggledFields[field.key])}
                      aria-label={field.label}
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
              <p className="text-sm font-medium text-gray-700 mb-1">Custom fields</p>
              <div className="space-y-3">
                {customFields.map(field => (
                  <div key={field.fieldId} className="border border-gray-200 bg-white rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={e => updateCustomField(field.fieldId, { label: e.target.value })}
                        placeholder="Field name"
                        className={`flex-1 ${INPUT}`}
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
                      onChange={e => updateCustomField(field.fieldId, { type: e.target.value })}
                      className={INPUT}
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
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue"
                          />
                          <button
                            type="button"
                            onClick={() => addCustomFieldOption(field.fieldId)}
                            disabled={!(optionInputs[field.fieldId] || '').trim()}
                            className="text-sm font-medium text-places-blue hover:text-places-blue/90 disabled:opacity-40 transition-colors"
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
                        onClick={() => updateCustomField(field.fieldId, { required: !field.required })}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          field.required ? 'bg-places-blue' : 'bg-gray-200'
                        }`}
                        role="switch"
                        aria-checked={field.required}
                        aria-label="Required"
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
                className="mt-3 text-sm font-medium text-places-blue hover:text-places-blue/90 transition-colors"
              >
                Add Field
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Person Type'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
